"""
Fight Results API Routes

This module provides API endpoints for fetching historical fight results
from Supabase storage bucket.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import json

# Import the database connection
from backend.api.database import get_supabase_client

router = APIRouter(prefix="/api/v1/fight-results", tags=["fight-results"])
logger = logging.getLogger(__name__)

def get_bucket_client(bucket_name="fight-events"):
    """Get Supabase storage bucket client"""
    try:
        supabase = get_supabase_client()
        if not supabase:
            return None
        return supabase.storage.from_(bucket_name)
    except Exception as e:
        logger.error(f"Error getting bucket client: {str(e)}")
        return None

@router.get("/")
async def get_historical_events(
    limit: Optional[int] = Query(10, description="Number of events to return"),
    offset: Optional[int] = Query(0, description="Number of events to skip")
):
    """Get list of all historical events from bucket"""
    try:
        bucket = get_bucket_client()
        if not bucket:
            raise HTTPException(status_code=503, detail="Storage service unavailable")
        
        # List all files in bucket
        response = bucket.list()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error listing bucket files: {response.error}")
            raise HTTPException(status_code=500, detail="Failed to fetch historical events")
        
        # Handle Supabase response structure
        if hasattr(response, 'data') and response.data:
            files = response.data
        elif isinstance(response, list):
            files = response
        else:
            files = []
        
        # Filter for event JSON files (both completed and test files), exclude placeholders
        event_files = [f for f in files if (
            f.get('name', '').endswith('.json') and 
            not f.get('name', '').startswith('.') and
            f.get('name', '') != '.emptyFolderPlaceholder'
        )]
        
        # Sort by updated date (newest first)
        event_files.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
        
        # Apply pagination
        paginated_files = event_files[offset:offset + limit]
        
        # Get basic info for each event
        events_info = []
        for file_info in paginated_files:
            filename = file_info.get('name', '')
            # Remove .json extension for event_id, handle both _complete.json and .json files
            event_id = filename.replace('_complete.json', '').replace('.json', '')
            
            events_info.append({
                "event_id": event_id,
                "filename": filename,
                "created_at": file_info.get('updated_at'),  # Use updated_at as created_at for compatibility
                "size": file_info.get('metadata', {}).get('size', 0)
            })
        
        return JSONResponse(content={
            "success": True,
            "events": events_info,
            "total_count": len(event_files),
            "returned_count": len(events_info),
            "offset": offset,
            "limit": limit
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching historical events: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch historical events")

@router.get("/event/{filename}")
async def get_event_results(filename: str):
    """Get detailed results for a specific event by filename"""
    try:
        from urllib.parse import unquote
        
        bucket = get_bucket_client()
        if not bucket:
            raise HTTPException(status_code=503, detail="Storage service unavailable")
        
        # URL decode the filename to handle spaces and special characters
        decoded_filename = unquote(filename)
        logger.info(f"Fetching event file: {decoded_filename}")
        
        # Download file from bucket using the decoded filename
        response = bucket.download(decoded_filename)
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error downloading file {decoded_filename}: {response.error}")
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Parse JSON data
        try:
            if isinstance(response, bytes):
                event_data = json.loads(response.decode('utf-8'))
            else:
                event_data = response
                
            return JSONResponse(content={
                "success": True,
                "event": event_data
            })
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON for {filename}: {str(e)}")
            raise HTTPException(status_code=500, detail="Corrupted event data")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch event results")

@router.get("/{event_id}/accuracy")
async def get_event_accuracy(event_id: str):
    """Get prediction accuracy statistics for a specific event"""
    try:
        bucket = get_bucket_client()
        if not bucket:
            raise HTTPException(status_code=503, detail="Storage service unavailable")
        
        filename = f"{event_id}_complete.json"
        
        # Download file from bucket
        response = bucket.download(filename)
        
        if hasattr(response, 'error') and response.error:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Parse JSON and extract accuracy stats
        try:
            if isinstance(response, bytes):
                event_data = json.loads(response.decode('utf-8'))
            else:
                event_data = response
                
            accuracy_stats = event_data.get('accuracy_stats', {})
            
            return JSONResponse(content={
                "success": True,
                "event_id": event_id,
                "event_name": event_data.get('event_name'),
                "event_date": event_data.get('event_date'),
                "accuracy_stats": accuracy_stats
            })
            
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON for {filename}: {str(e)}")
            raise HTTPException(status_code=500, detail="Corrupted event data")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching accuracy for event {event_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch event accuracy")

@router.get("/stats/overall")
async def get_overall_accuracy_stats():
    """Get overall prediction accuracy statistics across all events"""
    try:
        bucket = get_bucket_client()
        if not bucket:
            raise HTTPException(status_code=503, detail="Storage service unavailable")
        
        # List all complete event files
        response = bucket.list()
        
        if hasattr(response, 'error') and response.error:
            raise HTTPException(status_code=500, detail="Failed to fetch events")
        
        files = response if isinstance(response, list) else []
        event_files = [f for f in files if f.get('name', '').endswith('_complete.json')]
        
        # Aggregate statistics across all events
        total_events = 0
        total_fights = 0
        total_completed = 0
        total_correct = 0
        
        confidence_stats = {
            "high": {"total": 0, "correct": 0},
            "medium": {"total": 0, "correct": 0},
            "low": {"total": 0, "correct": 0}
        }
        
        for file_info in event_files:
            try:
                filename = file_info.get('name')
                file_response = bucket.download(filename)
                
                if hasattr(file_response, 'error') and file_response.error:
                    continue
                
                if isinstance(file_response, bytes):
                    event_data = json.loads(file_response.decode('utf-8'))
                else:
                    event_data = file_response
                
                accuracy_stats = event_data.get('accuracy_stats', {})
                
                total_events += 1
                total_fights += accuracy_stats.get('total_fights', 0)
                total_completed += accuracy_stats.get('completed_fights', 0)
                total_correct += accuracy_stats.get('correct_predictions', 0)
                
                # Aggregate confidence stats
                by_confidence = accuracy_stats.get('by_confidence', {})
                for level in ['high_confidence', 'medium_confidence', 'low_confidence']:
                    key = level.split('_')[0]
                    conf_data = by_confidence.get(level, {})
                    count = conf_data.get('count', 0)
                    accuracy = conf_data.get('accuracy', 0)
                    correct = int(count * accuracy / 100) if accuracy > 0 else 0
                    
                    confidence_stats[key]["total"] += count
                    confidence_stats[key]["correct"] += correct
                
            except Exception as e:
                logger.warning(f"Error processing file {file_info.get('name')}: {str(e)}")
                continue
        
        # Calculate overall accuracy
        overall_accuracy = (total_correct / total_completed * 100) if total_completed > 0 else 0
        
        # Calculate confidence level accuracies
        for level in confidence_stats:
            stats = confidence_stats[level]
            if stats["total"] > 0:
                stats["accuracy"] = round(stats["correct"] / stats["total"] * 100, 2)
            else:
                stats["accuracy"] = 0
        
        overall_stats = {
            "total_events": total_events,
            "total_fights": total_fights,
            "total_completed": total_completed,
            "total_correct": total_correct,
            "overall_accuracy": round(overall_accuracy, 2),
            "by_confidence": {
                "high_confidence": {
                    "count": confidence_stats["high"]["total"],
                    "accuracy": confidence_stats["high"]["accuracy"]
                },
                "medium_confidence": {
                    "count": confidence_stats["medium"]["total"],
                    "accuracy": confidence_stats["medium"]["accuracy"]
                },
                "low_confidence": {
                    "count": confidence_stats["low"]["total"],
                    "accuracy": confidence_stats["low"]["accuracy"]
                }
            },
            "calculated_at": datetime.now().isoformat()
        }
        
        return JSONResponse(content={
            "success": True,
            "overall_stats": overall_stats
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating overall stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to calculate overall statistics") 