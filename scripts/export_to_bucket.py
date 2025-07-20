import json
import os
import sys
import logging
from datetime import datetime, timedelta
from dotenv import load_dotenv
import argparse

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../.env'))

# Setup logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Import Supabase client
try:
    from backend.api.database import get_supabase_client
    supabase = get_supabase_client()
    if not supabase:
        logger.error("Could not connect to Supabase.")
        sys.exit(1)
except ImportError as e:
    logger.error(f"Error importing database module: {str(e)}")
    sys.exit(1)
except Exception as e:
    logger.error(f"Error connecting to database: {str(e)}")
    sys.exit(1)

def generate_event_id(event_name):
    """Generate a clean event ID from event name"""
    # Convert to lowercase, replace spaces with hyphens, remove special chars
    event_id = event_name.lower()
    event_id = event_id.replace(":", "")
    event_id = event_id.replace(" ", "-")
    event_id = event_id.replace("--", "-")
    
    # Remove any remaining special characters except hyphens
    import re
    event_id = re.sub(r'[^a-z0-9\-]', '', event_id)
    
    return event_id

def calculate_accuracy_stats(fights):
    """Calculate prediction accuracy statistics for the event"""
    total_fights = len(fights)
    completed_fights = sum(1 for f in fights if f.get("status") == "completed")
    correct_predictions = sum(1 for f in fights if f.get("prediction_correct") is True)
    
    accuracy_percentage = (correct_predictions / completed_fights * 100) if completed_fights > 0 else 0
    
    # Calculate accuracy by confidence level
    high_confidence = [f for f in fights if f.get("prediction", {}).get("confidence_percent", 0) > 75]
    medium_confidence = [f for f in fights if 60 <= f.get("prediction", {}).get("confidence_percent", 0) <= 75]
    low_confidence = [f for f in fights if f.get("prediction", {}).get("confidence_percent", 0) < 60]
    
    def calc_accuracy(fight_list):
        completed = [f for f in fight_list if f.get("status") == "completed"]
        correct = [f for f in completed if f.get("prediction_correct") is True]
        return (len(correct) / len(completed) * 100) if completed else 0
    
    stats = {
        "total_fights": total_fights,
        "completed_fights": completed_fights,
        "correct_predictions": correct_predictions,
        "accuracy_percentage": round(accuracy_percentage, 2),
        "by_confidence": {
            "high_confidence": {
                "count": len(high_confidence),
                "accuracy": round(calc_accuracy(high_confidence), 2)
            },
            "medium_confidence": {
                "count": len(medium_confidence),
                "accuracy": round(calc_accuracy(medium_confidence), 2)
            },
            "low_confidence": {
                "count": len(low_confidence),
                "accuracy": round(calc_accuracy(low_confidence), 2)
            }
        },
        "calculated_at": datetime.now().isoformat()
    }
    
    return stats

def prepare_export_data(event_data):
    """Prepare event data for bucket export"""
    fights = event_data.get("fights", [])
    accuracy_stats = calculate_accuracy_stats(fights)
    
    export_data = {
        "event_id": generate_event_id(event_data["event_name"]),
        "event_name": event_data["event_name"],
        "event_date": event_data["event_date"],
        "event_url": event_data["event_url"],
        "status": event_data["status"],
        "total_fights": event_data.get("total_fights", len(fights)),
        "completed_fights": event_data.get("completed_fights", 0),
        "scraped_at": event_data["scraped_at"],
        "results_updated_at": event_data.get("results_updated_at"),
        "exported_at": datetime.now().isoformat(),
        "accuracy_stats": accuracy_stats,
        "fights": fights
    }
    
    return export_data

def upload_to_bucket(export_data, bucket_name="fight-events"):
    """Upload event data to Supabase storage bucket"""
    try:
        event_id = export_data["event_id"]
        filename = f"{event_id}_complete.json"
        
        # Convert to JSON string
        json_data = json.dumps(export_data, indent=2, ensure_ascii=False)
        json_bytes = json_data.encode('utf-8')
        
        # Upload to bucket
        logger.info(f"Uploading {filename} to bucket '{bucket_name}'...")
        
        response = supabase.storage.from_(bucket_name).upload(
            file=json_bytes,
            path=filename,
            file_options={"content-type": "application/json", "upsert": "true"}
        )
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Failed to upload to bucket: {response.error}")
            return False
        
        logger.info(f"Successfully uploaded {filename} to bucket")
        return True
        
    except Exception as e:
        logger.error(f"Error uploading to bucket: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def deactivate_event(event_id):
    """Deactivate event after successful export"""
    try:
        response = supabase.table('upcoming_events').update({
            'is_active': False
        }).eq('id', event_id).execute()
        
        if response.data:
            logger.info(f"Deactivated event {event_id}")
            return True
        else:
            logger.error(f"Failed to deactivate event {event_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error deactivating event: {str(e)}")
        return False

def get_completed_events(days_back=7):
    """Get completed events from the last N days"""
    try:
        cutoff_date = (datetime.now() - timedelta(days=days_back)).isoformat()
        
        response = supabase.table('upcoming_events').select('*').eq('status', 'completed').gte('scraped_at', cutoff_date).execute()
        
        if response.data:
            logger.info(f"Found {len(response.data)} completed events")
            return response.data
        else:
            logger.info("No completed events found")
            return []
            
    except Exception as e:
        logger.error(f"Error getting completed events: {str(e)}")
        return []

def export_completed_events(bucket_name="fight-events", days_back=7):
    """Export all completed events to bucket"""
    logger.info("Starting export of completed events to bucket...")
    
    # Get completed events
    completed_events = get_completed_events(days_back)
    
    if not completed_events:
        logger.info("No completed events to export")
        return True
    
    exported_count = 0
    failed_count = 0
    
    for event in completed_events:
        try:
            logger.info(f"Processing event: {event['event_name']}")
            
            # Prepare export data
            export_data = prepare_export_data(event)
            
            # Upload to bucket
            success = upload_to_bucket(export_data, bucket_name)
            
            if success:
                # Deactivate event after successful export
                if deactivate_event(event['id']):
                    exported_count += 1
                    logger.info(f"Successfully exported and deactivated: {event['event_name']}")
                else:
                    logger.warning(f"Exported but failed to deactivate: {event['event_name']}")
                    exported_count += 1
            else:
                failed_count += 1
                logger.error(f"Failed to export: {event['event_name']}")
                
        except Exception as e:
            failed_count += 1
            logger.error(f"Error processing event {event.get('event_name', 'Unknown')}: {str(e)}")
    
    logger.info(f"Export complete: {exported_count} exported, {failed_count} failed")
    return failed_count == 0

def list_bucket_files(bucket_name="fight-events"):
    """List files in the bucket (for debugging)"""
    try:
        response = supabase.storage.from_(bucket_name).list()
        
        if hasattr(response, 'error') and response.error:
            logger.error(f"Error listing bucket files: {response.error}")
            return []
        
        files = response if isinstance(response, list) else []
        logger.info(f"Found {len(files)} files in bucket '{bucket_name}'")
        
        for file_info in files:
            logger.info(f"  - {file_info.get('name', 'Unknown')} ({file_info.get('updated_at', 'Unknown date')})")
        
        return files
        
    except Exception as e:
        logger.error(f"Error listing bucket files: {str(e)}")
        return []

def main():
    parser = argparse.ArgumentParser(description='Export completed UFC events to Supabase bucket')
    parser.add_argument('--bucket', type=str, default='fight-events',
                       help='Bucket name (default: fight-events)')
    parser.add_argument('--days', type=int, default=7,
                       help='Number of days back to look for completed events (default: 7)')
    parser.add_argument('--list', action='store_true',
                       help='List files in bucket and exit')
    args = parser.parse_args()
    
    if args.list:
        logger.info(f"Listing files in bucket '{args.bucket}'...")
        list_bucket_files(args.bucket)
        return True
    
    # Export completed events
    success = export_completed_events(args.bucket, args.days)
    
    if success:
        logger.info("✅ Export to bucket completed successfully")
        return True
    else:
        logger.error("❌ Export to bucket failed")
        return False

if __name__ == "__main__":
    main() 