from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, Dict, Any
import logging
from datetime import datetime
from backend.api.database import get_supabase_client

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/upcoming-events")
async def get_upcoming_events() -> Dict[str, Any]:
    """
    Get the current upcoming UFC event with all fights and predictions
    """
    try:
        supabase = get_supabase_client()
        
        # Get the most recent active upcoming event
        response = supabase.table('upcoming_events').select('*').eq('is_active', True).order('scraped_at', desc=True).limit(1).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="No upcoming events found")
        
        event_data = response.data[0]
        
        # Format the response
        return {
            "event_name": event_data['event_name'],
            "event_date": event_data['event_date'],
            "event_url": event_data['event_url'],
            "scraped_at": event_data['scraped_at'],
            "fights": event_data['fights'],
            "total_fights": len(event_data['fights']) if event_data['fights'] else 0
        }
        
    except Exception as e:
        logger.error(f"Error fetching upcoming events: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch upcoming events")

@router.get("/upcoming-events/all")
async def get_all_upcoming_events() -> Dict[str, Any]:
    """
    Get all upcoming events (for admin/debugging purposes)
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table('upcoming_events').select('*').order('scraped_at', desc=True).execute()
        
        return {
            "events": response.data,
            "total_events": len(response.data)
        }
        
    except Exception as e:
        logger.error(f"Error fetching all upcoming events: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch all upcoming events")

@router.delete("/upcoming-events/{event_id}")
async def deactivate_event(event_id: int) -> Dict[str, Any]:
    """
    Deactivate an upcoming event (set is_active to false)
    """
    try:
        supabase = get_supabase_client()
        
        response = supabase.table('upcoming_events').update({'is_active': False}).eq('id', event_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Event not found")
        
        return {"message": f"Event {event_id} deactivated successfully"}
        
    except Exception as e:
        logger.error(f"Error deactivating event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to deactivate event") 