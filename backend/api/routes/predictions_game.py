from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.responses import JSONResponse
import logging
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
import json

from backend.api.database import get_db_connection
from backend.constants import API_V1_STR
from backend.utils import sanitize_json

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

# Create rate limiter
limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)

router = APIRouter(prefix=f"{API_V1_STR}/predictions-game", tags=["Predictions Game"])

# Pydantic Models
class CoinBalance(BaseModel):
    balance: int
    total_wagered: int
    total_won: int
    total_lost: int
    created_at: str
    updated_at: str

class PredictionPickRequest(BaseModel):
    event_id: int
    fight_id: str
    fighter_id: int
    fighter_name: str
    stake: int = Field(gt=0, description="Amount of coins to stake")
    odds_american: int = Field(description="American odds (-155, +130, etc.)")

class PredictionPick(BaseModel):
    id: str
    event_id: int
    fight_id: str
    fighter_id: int
    fighter_name: str
    stake: int
    odds_american: int
    odds_decimal: float
    potential_payout: int
    status: str
    payout: Optional[int] = None
    settled_at: Optional[str] = None
    created_at: str

class TransactionRecord(BaseModel):
    id: int
    amount: int
    type: str
    reason: Optional[str]
    balance_before: int
    balance_after: int
    created_at: str

# Import auth helper
from backend.api.utils.auth_helper import get_user_id_from_auth_header, get_user_id_simple
import os

# SECURITY: Simple auth disabled by default - only for development/testing
USE_SIMPLE_AUTH = os.getenv("USE_SIMPLE_AUTH", "false").lower() == "true"

# Warning if simple auth is enabled
if USE_SIMPLE_AUTH:
    logger.warning("⚠️  SECURITY WARNING: Simple auth is enabled! This should NEVER be used in production!")


def check_prediction_window(event_id: int) -> bool:
    """Check if predictions are still open (closes 10 min before event)"""
    try:
        supabase = get_db_connection()
        if not supabase:
            return False
            
        # If no event_id provided, check the active event
        if event_id is None:
            response = supabase.table('upcoming_events')\
                .select('event_start_time, event_date, is_active')\
                .eq('is_active', True)\
                .order('scraped_at', desc=True)\
                .limit(1)\
                .execute()
        else:
            response = supabase.table('upcoming_events')\
                .select('event_start_time, event_date, is_active')\
                .eq('id', event_id)\
                .execute()
            
        if not response.data or len(response.data) == 0:
            return False
            
        event = response.data[0]
        if not event.get('is_active', False):
            return False
        
        # Use event_start_time if available, otherwise fall back to event_date
        event_time_str = event.get('event_start_time') or event.get('event_date')
        
        if not event_time_str:
            return False
            
        # Parse the event time
        from datetime import timezone
        try:
            # Handle ISO format with or without timezone
            if event_time_str.endswith('Z'):
                event_time_str = event_time_str.replace('Z', '+00:00')
            event_time = datetime.fromisoformat(event_time_str)
            
            # Ensure timezone aware
            if event_time.tzinfo is None:
                event_time = event_time.replace(tzinfo=timezone.utc)
        except ValueError as e:
            logger.error(f"Failed to parse event time '{event_time_str}': {str(e)}")
            return False
        
        # Calculate cutoff time (10 minutes before event)
        cutoff_time = event_time - timedelta(minutes=10)
        current_time = datetime.now(timezone.utc)
        
        is_open = current_time < cutoff_time
        return is_open
        
    except Exception as e:
        logger.error(f"Error checking prediction window for event {event_id}: {str(e)}")
        return False

# API Endpoints

@router.get("/balance", response_model=CoinBalance)
@limiter.limit("60/minute")  # Rate limit: 60 requests per minute
async def get_coin_balance(
    request: Request,  # Required for rate limiting
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """Get user's current coin balance and stats"""
    try:
        user_id = authorization
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        response = supabase.table('coin_accounts')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()
            
        if not response.data or len(response.data) == 0:
            # Create account if it doesn't exist - need to create user_settings first
            
            # First create user_settings entry (required for foreign key)
            try:
                settings_check = supabase.table('user_settings').select('user_id').eq('user_id', user_id).execute()
                if not settings_check.data:
                    supabase.table('user_settings').insert({
                        'user_id': user_id,
                        'settings': {'notifications': False}
                    }).execute()
            except Exception as e:
                logger.warning(f"User settings creation issue: {e}")
            
            # Then create coin account with INSERT to avoid duplicates
            try:
                supabase.table('coin_accounts').insert({
                    'user_id': user_id,
                    'balance': 1000,
                    'total_wagered': 0,
                    'total_won': 0,
                    'total_lost': 0
                }).execute()
            except Exception as e:
                logger.warning(f"Coin account might already exist: {e}")
            
            # Fetch again
            response = supabase.table('coin_accounts')\
                .select('*')\
                .eq('user_id', user_id)\
                .execute()
                
        account = response.data[0]
        return CoinBalance(
            balance=account['balance'],
            total_wagered=account['total_wagered'],
            total_won=account['total_won'],
            total_lost=account['total_lost'],
            created_at=account['created_at'],
            updated_at=account['updated_at']
        )
        
    except Exception as e:
        logger.error(f"Error getting coin balance: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get balance")

@router.post("/place-pick")
@limiter.limit("10/minute")  # Rate limit: 10 picks per minute (prevent spam)
async def place_prediction_pick(
    request: Request,  # Required for rate limiting
    pick_request: PredictionPickRequest,
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """Place a prediction pick on a fight"""
    try:
        user_id = authorization
        
        # Check if predictions are still open
        if not check_prediction_window(pick_request.event_id):
            raise HTTPException(
                status_code=400, 
                detail="Predictions are closed for this event (closes 10 minutes before start)"
            )
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        # First, get user's current balance
        balance_response = supabase.table('coin_accounts')\
            .select('balance')\
            .eq('user_id', user_id)\
            .execute()
            
        if not balance_response.data:
            raise HTTPException(status_code=400, detail="User account not found")
            
        current_balance = balance_response.data[0]['balance']
        
        # Check if user has enough balance
        if current_balance < pick_request.stake:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient balance. You have {current_balance} coins but need {pick_request.stake} coins"
            )
        
        # Calculate odds and potential payout
        odds_decimal = (pick_request.odds_american / 100) + 1 if pick_request.odds_american > 0 else (100 / abs(pick_request.odds_american)) + 1
        potential_payout = int(pick_request.stake * odds_decimal)
        
        # Insert bet record
        bet_data = {
            'user_id': user_id,
            'event_id': pick_request.event_id,
            'fight_id': pick_request.fight_id,
            'fighter_id': pick_request.fighter_id,
            'fighter_name': pick_request.fighter_name,
            'stake': pick_request.stake,
            'odds_american': pick_request.odds_american,
            'odds_decimal': odds_decimal,
            'potential_payout': potential_payout,
            'status': 'pending'
        }
        
        bet_response = supabase.table('bets').insert(bet_data).execute()
        
        if not bet_response.data:
            logger.error("Failed to insert bet record")
            raise HTTPException(status_code=500, detail="Failed to place bet")
            
        # Update user's balance (deduct stake and update total_wagered)
        new_balance = current_balance - pick_request.stake
        
        # Get current total_wagered
        account_response = supabase.table('coin_accounts')\
            .select('total_wagered')\
            .eq('user_id', user_id)\
            .execute()
            
        current_total_wagered = account_response.data[0]['total_wagered'] if account_response.data else 0
        new_total_wagered = current_total_wagered + pick_request.stake
        
        balance_update_response = supabase.table('coin_accounts')\
            .update({
                'balance': new_balance,
                'total_wagered': new_total_wagered
            })\
            .eq('user_id', user_id)\
            .execute()
            
        if not balance_update_response.data:
            logger.error("Failed to update user balance after placing bet")
            
        pick_id = bet_response.data[0]['id']
        
        return JSONResponse(content={
            "success": True,
            "pick_id": pick_id,
            "message": f"Prediction placed on {pick_request.fighter_name} for {pick_request.stake} coins",
            "new_balance": new_balance
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error placing prediction pick: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to place prediction")

@router.get("/my-picks", response_model=List[PredictionPick])
async def get_user_picks(
    event_id: Optional[int] = None,
    limit: int = 50,
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """Get user's prediction picks"""
    try:
        user_id = authorization
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        query = supabase.table('bets')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .limit(limit)
            
        if event_id:
            query = query.eq('event_id', event_id)
            
        response = query.execute()
        
        picks = []
        for pick in response.data:
            picks.append(PredictionPick(
                id=pick['id'],
                event_id=pick['event_id'],
                fight_id=pick['fight_id'],
                fighter_id=pick['fighter_id'],
                fighter_name=pick['fighter_name'],
                stake=pick['stake'],
                odds_american=pick['odds_american'],
                odds_decimal=float(pick['odds_decimal']),
                potential_payout=pick['potential_payout'],
                status=pick['status'],
                payout=pick.get('payout'),
                settled_at=pick.get('settled_at'),
                created_at=pick['created_at']
            ))
            
        return picks
        
    except Exception as e:
        logger.error(f"Error getting user picks: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get picks")

@router.get("/transaction-history", response_model=List[TransactionRecord])
async def get_transaction_history(
    limit: int = 50,
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """Get user's transaction history"""
    try:
        user_id = authorization
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        response = supabase.table('coin_transactions')\
            .select('*')\
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .limit(limit)\
            .execute()
            
        transactions = []
        for tx in response.data:
            transactions.append(TransactionRecord(
                id=tx['id'],
                amount=tx['amount'],
                type=tx['type'],
                reason=tx.get('reason'),
                balance_before=tx['balance_before'],
                balance_after=tx['balance_after'],
                created_at=tx['created_at']
            ))
            
        return transactions
        
    except Exception as e:
        logger.error(f"Error getting transaction history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get transactions")

@router.get("/event-picks/{event_id}")
async def get_event_pick_stats(
    event_id: int,
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """Get pick statistics for an event (for display purposes)"""
    try:
        user_id = authorization
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        # Get user's picks for this event
        user_picks_response = supabase.table('bets')\
            .select('fight_id, fighter_id, fighter_name, stake, potential_payout, status')\
            .eq('user_id', user_id)\
            .eq('event_id', event_id)\
            .execute()
            
        # Get total pick counts per fight (optional - for community stats)
        # Note: We'll skip this complex aggregation for now and just get user picks
        # total_picks_response = supabase.table('bets')\
        #     .select('fight_id, fighter_id')\
        #     .eq('event_id', event_id)\
        #     .execute()
            
        user_picks = {pick['fight_id']: pick for pick in user_picks_response.data}
        
        return JSONResponse(content={
            "success": True,
            "user_picks": user_picks,
            "prediction_window_open": check_prediction_window(event_id)
        })
        
    except Exception as e:
        logger.error(f"Error getting event pick stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get event stats")

# Admin/System Functions (for your cron jobs)

@router.post("/admin/settle-event/{event_id}")
async def settle_event_predictions(event_id: int):
    """Settle all predictions for an event (called by your fight results scraper)"""
    try:
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        # Call the settlement function
        response = supabase.rpc('settle_event_bets', {
            'p_event_id': event_id
        }).execute()
        
        if response.error:
            raise HTTPException(status_code=500, detail=response.error.message)
            
        settled_count = response.data
        
        return JSONResponse(content={
            "success": True,
            "settled_count": settled_count,
            "message": f"Settled {settled_count} predictions"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error settling event predictions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to settle predictions")

@router.get("/debug/user-info")
async def get_user_info(authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)):
    """Debug endpoint to see user information"""
    return JSONResponse(content={
        "user_id": authorization,
        "message": "This is your extracted user ID from the JWT token"
    })

@router.get("/health")
async def predictions_game_health():
    """Health check for predictions game system"""
    try:
        supabase = get_db_connection()
        if not supabase:
            return JSONResponse(content={
                "status": "unhealthy",
                "service": "predictions-game",
                "error": "Database unavailable"
            })
            
        # Test database connectivity
        response = supabase.table('coin_accounts').select('count(*)', count='exact').execute()
        
        return JSONResponse(content={
            "status": "healthy",
            "service": "predictions-game",
            "database_connected": True,
            "total_accounts": response.count if response.count else 0
        })
        
    except Exception as e:
        logger.error(f"Predictions game health check failed: {str(e)}")
        return JSONResponse(content={
            "status": "unhealthy",
            "service": "predictions-game",
            "error": str(e)
        }) 

@router.get("/leaderboard")
async def get_leaderboard():
    """Get public leaderboard of all users ranked by portfolio value (balance + active picks)"""
    try:
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get all coin accounts
        accounts_response = supabase.table('coin_accounts')\
            .select('user_id, balance, total_wagered, total_won, total_lost, created_at')\
            .execute()
        
        if not accounts_response.data:
            return JSONResponse(content={
                "success": True,
                "leaderboard": [],
                "total_users": 0
            })
        
        # Get all user settings
        settings_response = supabase.table('user_settings')\
            .select('user_id, settings')\
            .execute()
        
        settings_map = {s['user_id']: s.get('settings', {}) for s in settings_response.data or []}
        
        # Get all active picks in one query
        all_active_picks_response = supabase.table('bets')\
            .select('user_id, stake, status')\
            .eq('status', 'pending')\
            .execute()
        
        # Group active picks by user_id
        user_active_picks = {}
        for pick in all_active_picks_response.data or []:
            user_id = pick['user_id']
            if user_id not in user_active_picks:
                user_active_picks[user_id] = 0
            user_active_picks[user_id] += pick['stake']
        
        # Get all picks for stats
        all_picks_response = supabase.table('bets')\
            .select('user_id, status')\
            .execute()
        
        # Group picks by user_id and status
        user_pick_stats = {}
        for pick in all_picks_response.data or []:
            user_id = pick['user_id']
            status = pick['status']
            
            if user_id not in user_pick_stats:
                user_pick_stats[user_id] = {'total': 0, 'won': 0, 'lost': 0}
                
            user_pick_stats[user_id]['total'] += 1
            if status == 'won':
                user_pick_stats[user_id]['won'] += 1
            elif status == 'lost':
                user_pick_stats[user_id]['lost'] += 1
        
        # Calculate portfolio values and stats for each user
        leaderboard_data = []
        
        for account in accounts_response.data:
            user_id = account['user_id']
            
            # Get active picks value
            active_picks_value = user_active_picks.get(user_id, 0)
            
            # Get pick stats
            pick_stats = user_pick_stats.get(user_id, {'total': 0, 'won': 0, 'lost': 0})
            total_picks = pick_stats['total']
            won_picks = pick_stats['won']
            lost_picks = pick_stats['lost']
            completed_picks = won_picks + lost_picks
            
            win_rate = (won_picks / completed_picks * 100) if completed_picks > 0 else 0
            roi = ((account['total_won'] - account['total_lost']) / account['total_wagered'] * 100) if account['total_wagered'] > 0 else 0
            
            # Calculate portfolio value
            portfolio_value = account['balance'] + active_picks_value
            
            # Get user info
            user_settings = settings_map.get(user_id, {})
            display_name = user_settings.get('display_name')
            email = user_settings.get('email', f"user_{user_id[:8]}@example.com")
            
            # Try multiple fields for username
            username = (
                user_settings.get('preferred_username') or 
                user_settings.get('cognito_username') or
                display_name or 
                email.split('@')[0]
            )
            
            leaderboard_data.append({
                "user_id": user_id,
                "email": email,
                "display_name": display_name,
                "username": username,
                "balance": account['balance'],
                "total_invested": account['total_wagered'],
                "total_won": account['total_won'],
                "total_lost": account['total_lost'],
                "active_picks_value": active_picks_value,
                "portfolio_value": portfolio_value,
                "win_rate": win_rate,
                "roi": roi,
                "total_picks": total_picks,
                "member_since": account['created_at']
            })
        
        # Sort by portfolio value (descending) and assign ranks
        leaderboard_data.sort(key=lambda x: x['portfolio_value'], reverse=True)
        
        # Assign ranks
        for i, user in enumerate(leaderboard_data):
            user['rank'] = i + 1
        
        return JSONResponse(content={
            "success": True,
            "leaderboard": leaderboard_data,
            "total_users": len(leaderboard_data)
        })
        
    except Exception as e:
        logger.error(f"Error getting leaderboard: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get leaderboard")

@router.get("/my-rank")
async def get_user_rank(authorization: str = Depends(get_user_id_from_auth_header)):
    """Get current user's rank and highest rank achieved"""
    try:
        user_id = authorization
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get user's current account data
        account_response = supabase.table('coin_accounts')\
            .select('balance, total_wagered, total_won, total_lost')\
            .eq('user_id', user_id)\
            .execute()
        
        if not account_response.data:
            return JSONResponse(content={
                "success": True,
                "current_rank": None,
                "highest_rank": None,
                "portfolio_value": 0,
                "total_users": 0
            })
        
        account = account_response.data[0]
        
        # Get active picks value for current user
        active_picks_response = supabase.table('bets')\
            .select('stake')\
            .eq('user_id', user_id)\
            .eq('status', 'pending')\
            .execute()
        
        active_picks_value = sum(pick['stake'] for pick in active_picks_response.data or [])
        user_portfolio_value = account['balance'] + active_picks_value
        
        # Efficiently calculate rank using a single query with aggregation
        # Get all users' portfolio values to calculate rank
        all_accounts_response = supabase.table('coin_accounts')\
            .select('user_id, balance')\
            .execute()
        
        # Get all active picks for portfolio calculation
        all_active_picks_response = supabase.table('bets')\
            .select('user_id, stake')\
            .eq('status', 'pending')\
            .execute()
        
        # Group active picks by user
        user_active_totals = {}
        for pick in all_active_picks_response.data or []:
            user_id_key = pick['user_id']
            if user_id_key not in user_active_totals:
                user_active_totals[user_id_key] = 0
            user_active_totals[user_id_key] += pick['stake']
        
        # Calculate all portfolio values
        all_portfolio_values = []
        higher_portfolio_count = 0
        
        for acc in all_accounts_response.data or []:
            other_active_value = user_active_totals.get(acc['user_id'], 0)
            other_portfolio = acc['balance'] + other_active_value
            all_portfolio_values.append(other_portfolio)
            
            # Count how many users have higher portfolio value
            if other_portfolio > user_portfolio_value:
                higher_portfolio_count += 1
        
        # Current rank is count of higher portfolios + 1
        current_rank = higher_portfolio_count + 1 if user_portfolio_value > 0 else None
        
        # For now, highest rank = current rank (you could store this in a separate table)
        highest_rank = current_rank
        
        return JSONResponse(content={
            "success": True,
            "current_rank": current_rank,
            "highest_rank": highest_rank,
            "portfolio_value": user_portfolio_value,
            "total_users": len(all_portfolio_values)
        })
        
    except Exception as e:
        logger.error(f"Error getting user rank: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user rank") 