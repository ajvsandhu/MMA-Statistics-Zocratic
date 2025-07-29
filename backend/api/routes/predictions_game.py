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

class FightCancellationRequest(BaseModel):
    fight_id: str
    reason: str = Field(description="Reason for cancellation/change")
    refund_type: str = Field(description="full_refund or partial_refund")

class RefundResult(BaseModel):
    total_bets_refunded: int
    total_amount_refunded: int
    affected_users: int
    refund_details: List[Dict[str, Any]]

class BonusDistributionRequest(BaseModel):
    amount: int = Field(gt=0, description="Amount of coins to give each user")
    reason: str = Field(description="Reason for the bonus distribution")
    target_users: Optional[List[str]] = Field(None, description="Optional list of specific user IDs. If empty, distributes to all users")

class BonusDistributionResult(BaseModel):
    total_users_affected: int
    total_amount_distributed: int
    successful_distributions: int
    failed_distributions: int
    distribution_details: List[Dict[str, Any]]

# Import auth helper
from backend.api.utils.auth_helper import get_user_id_from_auth_header, get_user_id_simple, get_admin_user_from_auth_header, get_admin_user_simple
import os

# SECURITY: Simple auth disabled by default - only for development/testing
USE_SIMPLE_AUTH = os.getenv("USE_SIMPLE_AUTH", "false").lower() == "true"

# Warning if simple auth is enabled
if USE_SIMPLE_AUTH:
    logger.warning("⚠️  SECURITY WARNING: Simple auth is enabled! This should NEVER be used in production!")


def detect_fight_changes(old_fights: List[Dict], new_fights: List[Dict]) -> List[Dict]:
    """
    Detect significant changes in fights that warrant refunds.
    Industry best practice: Be conservative - refund when in doubt.
    """
    changes = []
    
    # Create lookup for old fights
    old_fights_map = {fight.get('fight_id'): fight for fight in old_fights}
    
    for new_fight in new_fights:
        fight_id = new_fight.get('fight_id')
        old_fight = old_fights_map.get(fight_id)
        
        if not old_fight:
            # New fight added - no refund needed
            continue
            
        change_reasons = []
        
        # Check for fighter changes (most critical)
        if (old_fight.get('fighter1_name') != new_fight.get('fighter1_name') or
            old_fight.get('fighter2_name') != new_fight.get('fighter2_name') or
            old_fight.get('fighter1_id') != new_fight.get('fighter1_id') or
            old_fight.get('fighter2_id') != new_fight.get('fighter2_id')):
            change_reasons.append("Fighter substitution detected")
            
        # Check for fight cancellation
        if new_fight.get('status') == 'cancelled' or new_fight.get('cancelled', False):
            change_reasons.append("Fight cancelled")
            
        # Check for significant weight class changes
        if (old_fight.get('weight_class') and new_fight.get('weight_class') and
            old_fight.get('weight_class') != new_fight.get('weight_class')):
            change_reasons.append("Weight class changed")
            
        # Check for fight type changes (title vs non-title)
        if (old_fight.get('is_title_fight') != new_fight.get('is_title_fight')):
            change_reasons.append("Title fight status changed")
        
        if change_reasons:
            changes.append({
                'fight_id': fight_id,
                'old_fight': old_fight,
                'new_fight': new_fight,
                'change_reasons': change_reasons,
                'refund_type': 'full_refund'  # Default to full refund for safety
            })
    
    # Check for removed fights
    new_fight_ids = {fight.get('fight_id') for fight in new_fights}
    for old_fight in old_fights:
        fight_id = old_fight.get('fight_id')
        if fight_id not in new_fight_ids:
            changes.append({
                'fight_id': fight_id,
                'old_fight': old_fight,
                'new_fight': None,
                'change_reasons': ['Fight removed from card'],
                'refund_type': 'full_refund'
            })
    
    return changes


async def process_refunds_for_changes(changes: List[Dict], event_id: int) -> RefundResult:
    """
    Process refunds for detected fight changes.
    Industry best practice: Atomic transactions, comprehensive logging, user notifications.
    """
    supabase = get_db_connection()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    total_refunded = 0
    total_amount = 0
    affected_users = set()
    refund_details = []
    
    try:
        for change in changes:
            fight_id = change['fight_id']
            change_reasons = change['change_reasons']
            refund_type = change['refund_type']
            
            logger.info(f"Processing refunds for fight {fight_id}: {', '.join(change_reasons)}")
            
            # Get all pending bets for this fight
            bets_response = supabase.table('bets')\
                .select('*')\
                .eq('event_id', event_id)\
                .eq('fight_id', fight_id)\
                .eq('status', 'pending')\
                .execute()
            
            if not bets_response.data:
                logger.info(f"No pending bets found for fight {fight_id}")
                continue
            
            fight_refunds = []
            
            for bet in bets_response.data:
                user_id = bet['user_id']
                bet_id = bet['id']
                stake = bet['stake']
                
                # Calculate refund amount
                refund_amount = stake if refund_type == 'full_refund' else int(stake * 0.5)
                
                # Get current user balance
                balance_response = supabase.table('coin_accounts')\
                    .select('balance, total_wagered')\
                    .eq('user_id', user_id)\
                    .execute()
                
                if not balance_response.data:
                    logger.error(f"User account not found for user {user_id}")
                    continue
                
                current_balance = balance_response.data[0]['balance']
                current_total_wagered = balance_response.data[0]['total_wagered'] or 0
                
                # Calculate new balances
                new_balance = current_balance + refund_amount
                new_total_wagered = max(0, current_total_wagered - stake)  # Reduce total wagered
                
                # Update bet status to refunded
                current_timestamp = datetime.now().isoformat()
                bet_update_response = supabase.table('bets')\
                    .update({
                        'status': 'refunded',
                        'payout': refund_amount,
                        'settled_at': current_timestamp,
                        'refund_reason': '; '.join(change_reasons)
                    })\
                    .eq('id', bet_id)\
                    .execute()
                
                if not bet_update_response.data:
                    logger.error(f"Failed to update bet {bet_id} to refunded status")
                    continue
                
                # Update user balance
                balance_update_response = supabase.table('coin_accounts')\
                    .update({
                        'balance': new_balance,
                        'total_wagered': new_total_wagered
                    })\
                    .eq('user_id', user_id)\
                    .execute()
                
                if not balance_update_response.data:
                    logger.error(f"Failed to update balance for user {user_id}")
                    continue
                
                # Create transaction record
                transaction_data = {
                    'user_id': user_id,
                    'amount': refund_amount,
                    'type': 'bet_refunded',
                    'reason': f'Refund for {bet["fighter_name"]} - {"; ".join(change_reasons)}',
                    'ref_table': 'bets',
                    'ref_id': bet_id,
                    'balance_before': current_balance,
                    'balance_after': new_balance
                }
                
                transaction_response = supabase.table('coin_transactions')\
                    .insert(transaction_data)\
                    .execute()
                
                if transaction_response.data:
                    fight_refunds.append({
                        'user_id': user_id,
                        'bet_id': bet_id,
                        'fighter_name': bet['fighter_name'],
                        'refund_amount': refund_amount,
                        'original_stake': stake
                    })
                    
                    total_refunded += 1
                    total_amount += refund_amount
                    affected_users.add(user_id)
                    
                    logger.info(f"Refunded {refund_amount} coins to user {user_id} for bet on {bet['fighter_name']}")
                else:
                    logger.error(f"Failed to create transaction record for refund {bet_id}")
            
            if fight_refunds:
                refund_details.append({
                    'fight_id': fight_id,
                    'change_reasons': change_reasons,
                    'refunds': fight_refunds
                })
        
        return RefundResult(
            total_bets_refunded=total_refunded,
            total_amount_refunded=total_amount,
            affected_users=len(affected_users),
            refund_details=refund_details
        )
        
    except Exception as e:
        logger.error(f"Error processing refunds: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Refund processing failed: {str(e)}")


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
            
        # Parse the event time with multiple format support
        from datetime import timezone
        import dateutil.parser
        try:
            # First try ISO format with or without timezone
            if event_time_str.endswith('Z'):
                event_time_str = event_time_str.replace('Z', '+00:00')
            
            try:
                event_time = datetime.fromisoformat(event_time_str)
            except ValueError:
                # If ISO parsing fails, try dateutil parser for flexible parsing
                logger.info(f"ISO parsing failed for '{event_time_str}', trying flexible parsing...")
                event_time = dateutil.parser.parse(event_time_str)
            
            # Ensure timezone aware
            if event_time.tzinfo is None:
                event_time = event_time.replace(tzinfo=timezone.utc)
                
            logger.info(f"Successfully parsed event time: {event_time} (Original: '{event_time_str}')")
            
        except Exception as e:
            logger.error(f"Failed to parse event time '{event_time_str}': {str(e)}")
            # If we can't parse the date, assume picks are open to be safe
            logger.warning("Defaulting to picks OPEN due to date parsing failure")
            return True
        
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
            
            # Check if user_settings exists, but DON'T create minimal entries
            # Let the auth_helper handle proper user settings creation
            try:
                settings_check = supabase.table('user_settings').select('user_id').eq('user_id', user_id).execute()
                if not settings_check.data:
                    logger.warning(f"User {user_id[:8]}... accessing predictions without proper auth - user_settings missing")
                    raise HTTPException(
                        status_code=401, 
                        detail="User profile not found. Please log out and log back in to complete registration."
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"User settings check failed: {e}")
                raise HTTPException(status_code=503, detail="Unable to verify user profile")
            
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

@router.get("/user-picks/{user_id}", response_model=List[PredictionPick])
async def get_user_picks_by_id(
    user_id: str,
    event_id: Optional[int] = None,
    limit: int = 50,
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """Get another user's prediction picks (public data)"""
    try:
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
        logger.error(f"Error getting user picks by ID: {str(e)}")
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


@router.post("/admin/refund-fight", response_model=RefundResult)
@limiter.limit("3/minute")  # Stricter rate limit for refund operations
async def refund_fight_manually(
    req_body: FightCancellationRequest,
    request: Request,
    authorization: str = Depends(get_admin_user_simple if USE_SIMPLE_AUTH else get_admin_user_from_auth_header)
):
    """
    Manually refund all bets for a specific fight.
    For admin use when fights are cancelled or significantly changed.
    """
    try:
        logger.info(f"Admin refund requested by user {authorization[:8]}... for fight {req_body.fight_id}: {req_body.reason}")
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get all pending bets for this fight
        bets_response = supabase.table('bets')\
            .select('*')\
            .eq('fight_id', req_body.fight_id)\
            .eq('status', 'pending')\
            .execute()
        
        if not bets_response.data:
            return RefundResult(
                total_bets_refunded=0,
                total_amount_refunded=0,
                affected_users=0,
                refund_details=[]
            )
        
        # Create a change object for processing
        change = {
            'fight_id': req_body.fight_id,
            'change_reasons': [req_body.reason],
            'refund_type': req_body.refund_type
        }
        
        # Get event_id from the first bet
        event_id = bets_response.data[0]['event_id']
        
        # Process refunds
        result = await process_refunds_for_changes([change], event_id)
        
        logger.info(f"Manual refund completed: {result.total_bets_refunded} bets, {result.total_amount_refunded} coins")
        return result
        
    except Exception as e:
        logger.error(f"Error processing manual refund: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Manual refund failed: {str(e)}")


@router.post("/admin/check-and-refund-changes/{event_id}", response_model=RefundResult)
@limiter.limit("10/minute")  # Rate limit for auto-refund checks
async def check_and_refund_fight_changes(
    event_id: int,
    request: Request,
    authorization: str = Depends(get_admin_user_simple if USE_SIMPLE_AUTH else get_admin_user_from_auth_header)
):
    """
    Check for fight changes in an event and automatically process refunds.
    This should be called whenever an event is updated from scrapers.
    """
    try:
        logger.info(f"Checking for fight changes in event {event_id}")
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get current event data
        current_response = supabase.table('upcoming_events')\
            .select('*')\
            .eq('id', event_id)\
            .execute()
        
        if not current_response.data:
            raise HTTPException(status_code=404, detail="Event not found")
        
        current_event = current_response.data[0]
        current_fights = current_event.get('fights', [])
        
        # Get previous version of this event from the database
        # Look for the previous scraped version by checking scraped_at timestamps
        previous_response = supabase.table('upcoming_events')\
            .select('*')\
            .eq('event_url', current_event['event_url'])\
            .neq('id', event_id)\
            .order('scraped_at', desc=True)\
            .limit(1)\
            .execute()
        
        if not previous_response.data:
            logger.info("No previous version found - treating as new event, no refunds needed")
            return RefundResult(
                total_bets_refunded=0,
                total_amount_refunded=0,
                affected_users=0,
                refund_details=[]
            )
        
        previous_event = previous_response.data[0]
        previous_fights = previous_event.get('fights', [])
        
        # Detect changes
        changes = detect_fight_changes(previous_fights, current_fights)
        
        if not changes:
            logger.info("No significant fight changes detected")
            return RefundResult(
                total_bets_refunded=0,
                total_amount_refunded=0,
                affected_users=0,
                refund_details=[]
            )
        
        logger.info(f"Detected {len(changes)} fight changes requiring refunds")
        
        # Process refunds for all changes
        result = await process_refunds_for_changes(changes, event_id)
        
        # Log the changes for audit trail
        for change in changes:
            logger.warning(f"REFUND PROCESSED - Fight {change['fight_id']}: {', '.join(change['change_reasons'])}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error checking/processing fight changes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fight change processing failed: {str(e)}")


@router.get("/admin/refund-status/{event_id}")
async def get_refund_status(
    event_id: int,
    authorization: str = Depends(get_admin_user_simple if USE_SIMPLE_AUTH else get_admin_user_from_auth_header)
):
    """Get refund statistics for an event"""
    try:
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get refunded bets for this event
        refunded_response = supabase.table('bets')\
            .select('*')\
            .eq('event_id', event_id)\
            .eq('status', 'refunded')\
            .execute()
        
        refunded_bets = refunded_response.data or []
        
        # Calculate statistics
        total_refunded_amount = sum(bet.get('payout', 0) for bet in refunded_bets)
        unique_users = len(set(bet['user_id'] for bet in refunded_bets))
        
        # Group by fight_id
        fights_with_refunds = {}
        for bet in refunded_bets:
            fight_id = bet['fight_id']
            if fight_id not in fights_with_refunds:
                fights_with_refunds[fight_id] = {
                    'fight_id': fight_id,
                    'refund_count': 0,
                    'refund_amount': 0,
                    'refund_reasons': set()
                }
            
            fights_with_refunds[fight_id]['refund_count'] += 1
            fights_with_refunds[fight_id]['refund_amount'] += bet.get('payout', 0)
            if bet.get('refund_reason'):
                fights_with_refunds[fight_id]['refund_reasons'].add(bet['refund_reason'])
        
        # Convert to list
        fights_summary = []
        for fight_data in fights_with_refunds.values():
            fight_data['refund_reasons'] = list(fight_data['refund_reasons'])
            fights_summary.append(fight_data)
        
        return {
            'event_id': event_id,
            'total_refunded_bets': len(refunded_bets),
            'total_refunded_amount': total_refunded_amount,
            'affected_users': unique_users,
            'fights_with_refunds': fights_summary
        }
        
    except Exception as e:
        logger.error(f"Error getting refund status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get refund status")

@router.post("/admin/distribute-bonus", response_model=BonusDistributionResult)
@limiter.limit("5/minute")  # Admin endpoints should be rate limited
async def distribute_bonus_coins(
    req_body: BonusDistributionRequest,
    request: Request,
    authorization: str = Depends(get_admin_user_simple if USE_SIMPLE_AUTH else get_admin_user_from_auth_header)
):
    """
    Distribute bonus coins to users.
    Admin endpoint to give bonus coins to all users or specific users.
    """
    try:
        logger.info(f"Admin bonus distribution requested by user {authorization[:8]}... - Amount: {req_body.amount}, Reason: {req_body.reason}")
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get target accounts
        if req_body.target_users:
            # Distribute to specific users
            accounts_response = supabase.table('coin_accounts')\
                .select('user_id, balance')\
                .in_('user_id', req_body.target_users)\
                .execute()
        else:
            # Distribute to all users
            accounts_response = supabase.table('coin_accounts')\
                .select('user_id, balance')\
                .execute()
        
        if not accounts_response.data:
            raise HTTPException(status_code=404, detail="No accounts found")
        
        accounts = accounts_response.data
        successful = 0
        failed = 0
        distribution_details = []
        
        for account in accounts:
            try:
                user_id = account['user_id']
                current_balance = account['balance']
                new_balance = current_balance + req_body.amount
                
                # Update balance
                update_response = supabase.table('coin_accounts')\
                    .update({'balance': new_balance})\
                    .eq('user_id', user_id)\
                    .execute()
                
                if update_response.data:
                    # Create transaction record
                    transaction_data = {
                        'user_id': user_id,
                        'amount': req_body.amount,
                        'type': 'admin_bonus',
                        'reason': req_body.reason,
                        'balance_before': current_balance,
                        'balance_after': new_balance
                    }
                    
                    supabase.table('coin_transactions').insert(transaction_data).execute()
                    
                    successful += 1
                    distribution_details.append({
                        'user_id': user_id[:8] + "...",
                        'amount': req_body.amount,
                        'old_balance': current_balance,
                        'new_balance': new_balance,
                        'status': 'success'
                    })
                    
                    logger.info(f"✅ Distributed {req_body.amount} coins to user {user_id[:8]}... (balance: {current_balance} → {new_balance})")
                else:
                    failed += 1
                    distribution_details.append({
                        'user_id': user_id[:8] + "...",
                        'amount': 0,
                        'status': 'failed',
                        'error': 'Database update failed'
                    })
                    logger.error(f"❌ Failed to update balance for user {user_id[:8]}...")
                    
            except Exception as e:
                failed += 1
                distribution_details.append({
                    'user_id': user_id[:8] + "..." if 'user_id' in locals() else 'unknown',
                    'amount': 0,
                    'status': 'failed',
                    'error': str(e)
                })
                logger.error(f"❌ Error processing user {user_id[:8] if 'user_id' in locals() else 'unknown'}...: {e}")
        
        total_distributed = successful * req_body.amount
        
        logger.info(f"✅ Bonus distribution completed: {successful} successful, {failed} failed, {total_distributed} total coins distributed")
        
        return BonusDistributionResult(
            total_users_affected=len(accounts),
            total_amount_distributed=total_distributed,
            successful_distributions=successful,
            failed_distributions=failed,
            distribution_details=distribution_details
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error distributing bonus coins: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to distribute bonus coins")

@router.get("/user/recent-refunds")
async def get_user_recent_refunds(
    limit: int = 10,
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """
    Get user's recent refunds with detailed information.
    Industry best practice: Transparent communication about refunds.
    """
    try:
        user_id = authorization
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get recent refunded bets for this user
        refunds_response = supabase.table('bets')\
            .select('*, upcoming_events(event_name, event_date)')\
            .eq('user_id', user_id)\
            .eq('status', 'refunded')\
            .order('settled_at', desc=True)\
            .limit(limit)\
            .execute()
        
        refunds = []
        for bet in refunds_response.data or []:
            refunds.append({
                'bet_id': bet['id'],
                'fight_id': bet['fight_id'],
                'fighter_name': bet['fighter_name'],
                'original_stake': bet['stake'],
                'refund_amount': bet.get('payout', 0),
                'refund_reason': bet.get('refund_reason', 'Fight cancelled or changed'),
                'refunded_at': bet.get('settled_at'),
                'event_name': bet.get('upcoming_events', {}).get('event_name', 'Unknown Event') if bet.get('upcoming_events') else 'Unknown Event',
                'event_date': bet.get('upcoming_events', {}).get('event_date') if bet.get('upcoming_events') else None
            })
        
        return {
            'user_id': user_id,
            'recent_refunds': refunds,
            'total_refunds_shown': len(refunds)
        }
        
    except Exception as e:
        logger.error(f"Error getting user refunds: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get refunds")


@router.get("/user/refund-summary")
async def get_user_refund_summary(
    authorization: str = Depends(get_user_id_simple if USE_SIMPLE_AUTH else get_user_id_from_auth_header)
):
    """Get summary of all user refunds"""
    try:
        user_id = authorization
        
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Get all refunded bets for this user
        refunds_response = supabase.table('bets')\
            .select('*')\
            .eq('user_id', user_id)\
            .eq('status', 'refunded')\
            .execute()
        
        refunded_bets = refunds_response.data or []
        
        if not refunded_bets:
            return {
                'total_refunds': 0,
                'total_refunded_amount': 0,
                'total_original_stakes': 0,
                'average_refund': 0
            }
        
        total_refunded_amount = sum(bet.get('payout', 0) for bet in refunded_bets)
        total_original_stakes = sum(bet.get('stake', 0) for bet in refunded_bets)
        
        return {
            'total_refunds': len(refunded_bets),
            'total_refunded_amount': total_refunded_amount,
            'total_original_stakes': total_original_stakes,
            'average_refund': total_refunded_amount // len(refunded_bets) if refunded_bets else 0
        }
        
    except Exception as e:
        logger.error(f"Error getting refund summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get refund summary")


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
@limiter.limit("10/minute")  # Rate limit for settlement operations
async def settle_event_predictions(
    event_id: int,
    request: Request,
    authorization: str = Depends(get_admin_user_simple if USE_SIMPLE_AUTH else get_admin_user_from_auth_header)
):
    """Settle all predictions for an event (called by your fight results scraper)"""
    try:
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        # Get all pending bets for this event that haven't been settled yet
        bets_response = supabase.table('bets')\
            .select('*')\
            .eq('event_id', event_id)\
            .eq('status', 'pending')\
            .is_('settled_at', 'null')\
            .execute()
        
        if not bets_response.data:
            return JSONResponse(content={
                "success": True,
                "settled_count": 0,
                "message": "No pending bets to settle"
            })
            
        pending_bets = bets_response.data
        
        # Get event data with fight results
        event_response = supabase.table('upcoming_events')\
            .select('*')\
            .eq('id', event_id)\
            .execute()
            
        if not event_response.data:
            raise HTTPException(status_code=404, detail="Event not found")
            
        event_data = event_response.data[0]
        fights = event_data.get('fights', [])
        
        settled_count = 0
        
        for bet in pending_bets:
            fight_id = bet['fight_id']
            fighter_id = bet['fighter_id']
            stake = bet['stake']
            potential_payout = bet['potential_payout']
            user_id = bet['user_id']
            bet_id = bet['id']
            
            # Extra safety check - skip if bet already has a payout or is settled
            if bet.get('payout') is not None or bet.get('settled_at') is not None:
                continue  # Skip already settled bets
            
            # Find the corresponding fight
            fight = None
            for f in fights:
                if f.get('fight_id') == fight_id:
                    fight = f
                    break
                    
            # Check if fight has a result
            fight_result = fight.get('result') if fight else None
            if not fight or not fight_result or not fight_result.get('winner_name'):
                continue  # Fight not completed yet
                
            # Determine if bet won or lost by matching winner_name to fighter
            won = False
            winner_name = fight_result.get('winner_name', '').lower().strip()
            
            # Get fighter names for comparison
            fighter1_name = fight.get('fighter1_name', '').lower().strip()
            fighter2_name = fight.get('fighter2_name', '').lower().strip()
            fighter1_id = fight.get('fighter1_id')
            fighter2_id = fight.get('fighter2_id')
            
            # Determine which fighter won
            winner_fighter_id = None
            if winner_name and fighter1_name and winner_name in fighter1_name:
                winner_fighter_id = fighter1_id
            elif winner_name and fighter2_name and winner_name in fighter2_name:
                winner_fighter_id = fighter2_id
            elif winner_name and fighter1_name and fighter1_name in winner_name:
                winner_fighter_id = fighter1_id
            elif winner_name and fighter2_name and fighter2_name in winner_name:
                winner_fighter_id = fighter2_id
            
            if not winner_fighter_id:
                continue  # Could not determine winner
                
            # Check if this bet is on the winning fighter
            won = (winner_fighter_id == fighter_id)
                
            # Calculate payout
            if won:
                payout_amount = potential_payout
                new_status = 'won'
            else:
                payout_amount = 0
                new_status = 'lost'
                
            # Update bet status and payout with timestamp
            from datetime import datetime
            current_timestamp = datetime.now().isoformat()
            bet_update_response = supabase.table('bets')\
                .update({
                    'status': new_status,
                    'payout': payout_amount,
                    'settled_at': current_timestamp
                })\
                .eq('id', bet_id)\
                .execute()
                
            if not bet_update_response.data:
                continue
                
            # Update user stats based on win/loss
            if won and payout_amount > 0:
                # Get current balance and total_won
                balance_response = supabase.table('coin_accounts')\
                    .select('balance, total_won')\
                    .eq('user_id', user_id)\
                    .execute()
                    
                if balance_response.data:
                    current_balance = balance_response.data[0]['balance']
                    current_total_won = balance_response.data[0]['total_won'] or 0
                    
                    new_balance = current_balance + payout_amount
                    new_total_won = current_total_won + payout_amount
                    
                    balance_update_response = supabase.table('coin_accounts')\
                        .update({
                            'balance': new_balance,
                            'total_won': new_total_won
                        })\
                        .eq('user_id', user_id)\
                        .execute()
                        
                    if balance_update_response.data:
                        # Create transaction record for win
                        transaction_data = {
                            'user_id': user_id,
                            'amount': payout_amount,
                            'type': 'bet_won',
                            'reason': f'Won bet on {bet["fighter_name"]}',
                            'ref_table': 'bets',
                            'ref_id': bet_id,
                            'balance_before': current_balance,
                            'balance_after': new_balance
                        }
                        
                        supabase.table('coin_transactions').insert(transaction_data).execute()
            else:
                # User lost - update total_lost
                account_response = supabase.table('coin_accounts')\
                    .select('balance, total_lost')\
                    .eq('user_id', user_id)\
                    .execute()
                    
                if account_response.data:
                    current_balance = account_response.data[0]['balance']
                    current_total_lost = account_response.data[0]['total_lost'] or 0
                    
                    new_total_lost = current_total_lost + stake
                    
                    loss_update_response = supabase.table('coin_accounts')\
                        .update({
                            'total_lost': new_total_lost
                        })\
                        .eq('user_id', user_id)\
                        .execute()
                        
                    if loss_update_response.data:
                        # Create transaction record for loss
                        transaction_data = {
                            'user_id': user_id,
                            'amount': -stake,  # Negative amount to indicate loss
                            'type': 'bet_lost',
                            'reason': f'Lost bet on {bet["fighter_name"]}',
                            'ref_table': 'bets',
                            'ref_id': bet_id,
                            'balance_before': current_balance,
                            'balance_after': current_balance  # Balance doesn't change on loss (already deducted when placed)
                        }
                        
                        supabase.table('coin_transactions').insert(transaction_data).execute()
                
            settled_count += 1
        
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
        
        # Get all picks for stats (excluding refunded bets)
        all_picks_response = supabase.table('bets')\
            .select('user_id, status')\
            .neq('status', 'refunded')\
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
        
        # Calculate global statistics (excluding refunded bets)
        total_picks = sum(stats['total'] for stats in user_pick_stats.values())
        total_wagered = sum(account['total_wagered'] for account in accounts_response.data)
        
        return JSONResponse(content={
            "success": True,
            "leaderboard": leaderboard_data,
            "total_users": len(leaderboard_data),
            "total_picks": total_picks,
            "total_wagered": total_wagered
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
        
        # Get all users' portfolio values to calculate rank (same logic as leaderboard)
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
        
        # Calculate all portfolio values and create ranking data
        all_portfolio_data = []
        
        for acc in all_accounts_response.data or []:
            other_active_value = user_active_totals.get(acc['user_id'], 0)
            other_portfolio = acc['balance'] + other_active_value
            all_portfolio_data.append({
                'user_id': acc['user_id'],
                'portfolio_value': other_portfolio
            })
        
        # Sort by portfolio value (descending) and assign ranks (same as leaderboard)
        all_portfolio_data.sort(key=lambda x: x['portfolio_value'], reverse=True)
        
        # Find current user's rank
        current_rank = None
        for i, user_data in enumerate(all_portfolio_data):
            if user_data['user_id'] == user_id:
                current_rank = i + 1
                break
        
        # For now, highest rank = current rank (you could store this in a separate table)
        highest_rank = current_rank
        
        return JSONResponse(content={
            "success": True,
            "current_rank": current_rank,
            "highest_rank": highest_rank,
            "portfolio_value": user_portfolio_value,
            "total_users": len(all_portfolio_data)
        })
        
    except Exception as e:
        logger.error(f"Error getting user rank: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user rank") 

@router.post("/admin/run-scraper")
@limiter.limit("5/minute")  # Rate limit for scraper runs
async def run_scraper_with_admin(
    request: Request,
    authorization: str = Depends(get_admin_user_simple if USE_SIMPLE_AUTH else get_admin_user_from_auth_header)
):
    """
    Run the upcoming event scraper with admin privileges to process refunds.
    This endpoint allows admins to trigger the scraper with proper authentication.
    """
    try:
        import subprocess
        import sys
        import os
        from pathlib import Path
        
        # Get the admin token from the request body
        body = await request.json()
        admin_token = body.get('admin_token')
        
        if not admin_token:
            raise HTTPException(status_code=400, detail="Admin token required")
        
        # Get the project root directory
        project_root = Path(__file__).resolve().parent.parent.parent.parent
        scraper_path = project_root / "scripts" / "scrapers" / "upcoming_event_scraper.py"
        
        if not scraper_path.exists():
            raise HTTPException(status_code=500, detail="Scraper script not found")
        
        # Run the scraper with admin token
        cmd = [
            sys.executable,
            str(scraper_path),
            "--admin-token",
            admin_token
        ]
        
        logger.info("Running scraper with admin privileges...")
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=project_root,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            logger.info("Scraper completed successfully")
            return {
                "success": True,
                "message": "Scraper completed successfully",
                "output": result.stdout
            }
        else:
            logger.error(f"Scraper failed: {result.stderr}")
            raise HTTPException(
                status_code=500, 
                detail=f"Scraper failed: {result.stderr}"
            )
            
    except subprocess.TimeoutExpired:
        logger.error("Scraper timed out")
        raise HTTPException(status_code=408, detail="Scraper timed out")
    except Exception as e:
        logger.error(f"Error running scraper: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to run scraper: {str(e)}") 

 