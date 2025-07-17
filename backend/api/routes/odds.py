"""
Odds API Routes

This module provides API endpoints for fetching and serving betting odds data
for UFC/MMA events using The Odds API integration.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
import logging
from typing import Optional, List
from datetime import datetime
import json

# Import the odds service
from backend.api.utils.odds_service import get_odds_service, OddsService
from backend.api.database import get_db_connection

router = APIRouter(prefix="/api/v1/odds", tags=["odds"])
logger = logging.getLogger(__name__)

@router.get("/sports")
async def get_available_sports():
    """Get list of available sports from the Odds API"""
    try:
        odds_service = get_odds_service()
        if not odds_service:
            raise HTTPException(status_code=503, detail="Odds service unavailable")
        
        sports = odds_service.get_available_sports()
        return JSONResponse(content={
            "success": True,
            "sports": sports,
            "count": len(sports)
        })
    
    except Exception as e:
        logger.error(f"Error fetching sports: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch sports")

@router.get("/mma")
async def get_mma_odds(
    regions: Optional[str] = Query(None, description="Comma-separated regions (us,uk,eu,au)"),
    markets: Optional[str] = Query(None, description="Comma-separated markets (h2h,spreads,totals)")
):
    """Get current MMA/UFC odds"""
    try:
        odds_service = get_odds_service()
        if not odds_service:
            raise HTTPException(status_code=503, detail="Odds service unavailable")
        
        # Parse regions and markets
        regions_list = regions.split(',') if regions else ['us', 'uk', 'eu', 'au']
        markets_list = markets.split(',') if markets else ['h2h']
        
        odds_events = odds_service.get_mma_odds(regions=regions_list, markets=markets_list)
        
        return JSONResponse(content={
            "success": True,
            "events": odds_events,
            "count": len(odds_events),
            "regions": regions_list,
            "markets": markets_list,
            "fetched_at": datetime.now().isoformat()
        })
    
    except Exception as e:
        logger.error(f"Error fetching MMA odds: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch MMA odds")

@router.get("/event/{event_id}")
async def get_event_odds(
    event_id: str,
    regions: Optional[str] = Query(None, description="Comma-separated regions (us,uk,eu,au)"),
    markets: Optional[str] = Query(None, description="Comma-separated markets (h2h,spreads,totals)")
):
    """Get odds for a specific event"""
    try:
        odds_service = get_odds_service()
        if not odds_service:
            raise HTTPException(status_code=503, detail="Odds service unavailable")
        
        # Parse regions and markets
        regions_list = regions.split(',') if regions else ['us', 'uk', 'eu', 'au']
        markets_list = markets.split(',') if markets else ['h2h']
        
        event_odds = odds_service.get_event_odds(event_id, regions=regions_list, markets=markets_list)
        
        if not event_odds:
            raise HTTPException(status_code=404, detail="Event not found or no odds available")
        
        return JSONResponse(content={
            "success": True,
            "event": event_odds,
            "fetched_at": datetime.now().isoformat()
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching event odds: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch event odds")

@router.get("/upcoming-with-odds")
async def get_upcoming_events_with_odds():
    """Get upcoming events from database with their associated odds"""
    try:
        # Get database connection
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=503, detail="Database unavailable")
        
        # Fetch active upcoming events
        response = supabase.table('upcoming_events').select('*').eq('is_active', True).execute()
        
        if not response.data:
            return JSONResponse(content={
                "success": True,
                "events": [],
                "message": "No upcoming events found"
            })
        
        event_data = response.data[0]  # Get the active event
        
        # Parse fights and extract those with odds
        fights = event_data.get('fights', [])
        fights_with_odds = []
        
        for fight in fights:
            if fight.get('odds_data'):
                fight_summary = {
                    "fighter1_name": fight.get('fighter1_name'),
                    "fighter2_name": fight.get('fighter2_name'),
                    "fighter1_id": fight.get('fighter1_id'),
                    "fighter2_id": fight.get('fighter2_id'),
                    "odds_summary": get_odds_service().get_odds_summary(fight.get('odds_data')) if get_odds_service() else {},
                    "odds_event_id": fight.get('odds_event_id'),
                    "prediction": fight.get('prediction')
                }
                fights_with_odds.append(fight_summary)
        
        return JSONResponse(content={
            "success": True,
            "event_name": event_data.get('event_name'),
            "event_date": event_data.get('event_date'),
            "scraped_at": event_data.get('scraped_at'),
            "fights_with_odds": fights_with_odds,
            "total_fights": len(fights),
            "fights_with_odds_count": len(fights_with_odds)
        })
    
    except Exception as e:
        logger.error(f"Error fetching upcoming events with odds: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch upcoming events with odds")

@router.get("/test")
async def test_odds_service():
    """Test the odds service connection and functionality"""
    try:
        odds_service = get_odds_service()
        if not odds_service:
            return JSONResponse(content={
                "success": False,
                "error": "Odds service unavailable - check ODDS_KEY environment variable"
            })
        
        # Test getting sports
        sports = odds_service.get_available_sports()
        
        # Test getting MMA sport key
        mma_sport_key = odds_service.get_mma_sport_key()
        
        # Test getting MMA odds (limited to 1 region to save API calls)
        mma_odds = odds_service.get_mma_odds(regions=['us'], markets=['h2h'])
        
        return JSONResponse(content={
            "success": True,
            "tests": {
                "sports_fetch": {"success": len(sports) > 0, "count": len(sports)},
                "mma_sport_key": {"success": mma_sport_key is not None, "key": mma_sport_key},
                "mma_odds_fetch": {"success": len(mma_odds) >= 0, "count": len(mma_odds)}
            },
            "api_key_configured": bool(odds_service.api_key),
            "sample_sports": sports[:5] if sports else [],
            "sample_mma_odds": mma_odds[:2] if mma_odds else []
        })
    
    except Exception as e:
        logger.error(f"Error testing odds service: {str(e)}")
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        })

@router.get("/health")
async def odds_health_check():
    """Health check for the odds service"""
    try:
        odds_service = get_odds_service()
        if not odds_service:
            return JSONResponse(content={
                "status": "unhealthy",
                "service": "odds",
                "error": "Odds service unavailable"
            })
        
        # Quick test - just check if we can access the API
        sports = odds_service.get_available_sports()
        
        return JSONResponse(content={
            "status": "healthy",
            "service": "odds",
            "api_key_configured": bool(odds_service.api_key),
            "sports_available": len(sports) > 0
        })
    
    except Exception as e:
        logger.error(f"Odds health check failed: {str(e)}")
        return JSONResponse(content={
            "status": "unhealthy",
            "service": "odds",
            "error": str(e)
        }) 