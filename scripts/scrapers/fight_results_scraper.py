import requests
from bs4 import BeautifulSoup
import json
import time
import random
import os
import sys
import logging
from dotenv import load_dotenv
import argparse
from datetime import datetime, timedelta
import pandas as pd
import re

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'))

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

# Setup logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Use a persistent session for faster HTTP requests
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/91.0.4472.124 Safari/537.36"
    )
}
session = requests.Session()
session.headers.update(HEADERS)

# Import Supabase client
try:
    from backend.api.database import get_supabase_client
    supabase = get_supabase_client()
    if not supabase:
        logger.warning("Could not connect to Supabase.")
        db_available = False
    else:
        db_available = True
except ImportError as e:
    logger.warning(f"Error importing database module: {str(e)}")
    supabase = None
    db_available = False
except Exception as e:
    logger.warning(f"Error connecting to database: {str(e)}")
    supabase = None
    db_available = False

def should_monitor_event(event_data):
    """Check if we should monitor this event based on timing"""
    try:
        # Get event start time
        event_start_str = event_data.get('event_start_time') or event_data.get('event_date')
        if not event_start_str:
            logger.warning("No event start time found - monitoring anyway")
            return True
            
        # Parse event start time
        if event_start_str.endswith('Z'):
            event_start_str = event_start_str.replace('Z', '+00:00')
        
        from datetime import timezone
        event_start = datetime.fromisoformat(event_start_str)
        if event_start.tzinfo is None:
            event_start = event_start.replace(tzinfo=timezone.utc)
            
        current_time = datetime.now(timezone.utc)
        
        # Start monitoring 1 hour before event (for early prelims)
        monitor_start = event_start - timedelta(hours=1)
        # Stop monitoring 8 hours after event start (events typically last 4-6 hours)
        monitor_end = event_start + timedelta(hours=8)
        
        should_monitor = monitor_start <= current_time <= monitor_end
        
        if not should_monitor:
            hours_until_start = (monitor_start - current_time).total_seconds() / 3600
            hours_since_start = (current_time - event_start).total_seconds() / 3600
            
            if hours_until_start > 0:
                logger.info(f"⏰ Event starts in {hours_until_start:.1f} hours - too early to monitor")
            else:
                logger.info(f"⏰ Event ended {abs(hours_since_start):.1f} hours ago - too late to monitor")
            
            return False
            
        logger.info(f"✅ Event timing is appropriate for monitoring")
        return True
        
    except Exception as e:
        logger.error(f"Error checking event timing: {str(e)}")
        return True  # Default to monitoring if we can't determine timing

def settle_event_predictions(event_id):
    """Settle predictions for completed fights in an event"""
    if not db_available or not supabase:
        logger.warning("Database not available for predictions settlement")
        return False
    
    try:
        # Call the settlement function via RPC
        response = supabase.rpc('settle_event_bets', {'p_event_id': event_id}).execute()
        
        if response.error:
            logger.error(f"Error settling predictions: {response.error.message}")
            return False
            
        settled_count = response.data or 0
        if settled_count > 0:
            logger.info(f"✅ Settled {settled_count} predictions for event {event_id}")
        else:
            logger.info(f"No predictions to settle for event {event_id}")
            
        return True
        
    except Exception as e:
        logger.error(f"Exception during predictions settlement: {str(e)}")
        return False

def get_active_event():
    """Get the currently active event from database"""
    if not db_available or not supabase:
        logger.error("Database not available")
        return None
    
    try:
        response = supabase.table('upcoming_events').select('*').eq('is_active', True).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None
    except Exception as e:
        logger.error(f"Error getting active event: {str(e)}")
        return None

def extract_fight_results(event_url, max_retries=3):
    """Extract fight results from a completed/ongoing UFC event page"""
    logger.info(f"Extracting results from event: {event_url}")
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(event_url, timeout=(5, 30))
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            results = []
            
            # Find all fight result tables
            fight_tables = soup.find_all("table")
            
            if not fight_tables:
                logger.warning("Could not find any tables")
                return []
            
            # Process all table rows looking for WIN indicators
            for table in fight_tables:
                rows = table.find_all("tr")
                
                for row in rows:
                    cells = row.find_all("td")
                    if not cells or len(cells) < 8:
                        continue
                        
                    # Check if this row has a WIN indicator - look for the specific flag structure
                    wl_cell = cells[0]
                    win_flag = wl_cell.find("i", class_="b-flag__text")
                    
                    if win_flag and win_flag.get_text(strip=True).upper() == "WIN":
                        # Extract result data from this row
                        result_data = extract_result_from_row(row)
                        if result_data:
                            results.append({
                                "winner_name": result_data["winner_name"],
                                "method": result_data["method"], 
                                "round": result_data["round"],
                                "time": result_data["time"]
                            })
            
            logger.info(f"Found {len(results)} fight results")
            return results
            
        except requests.exceptions.Timeout as e:
            logger.warning(f"Timeout extracting results, attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
        except Exception as e:
            logger.error(f"Failed to extract results: {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                return []
    
    return []

def extract_result_from_table(table):
    """Extract result data from a fight table"""
    try:
        # This is a simplified extraction - you'll need to adapt based on UFC Stats structure
        rows = table.find_all("tr")
        if len(rows) < 2:
            return None
        
        # Look for result indicators in the table
        result_data = {
            "winner": None,
            "winner_name": None,
            "method": None,
            "round": None,
            "time": None,
            "details": None
        }
        
        # Extract fighter names and determine winner
        fighter_links = table.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
        if len(fighter_links) >= 2:
            fighter1_name = fighter_links[0].get_text(strip=True)
            fighter2_name = fighter_links[1].get_text(strip=True)
            
            # Look for win/loss indicators (this needs to be adapted to actual UFC Stats structure)
            # You'll need to analyze the actual HTML structure to extract results properly
            
            return {
                "fighter1_name": fighter1_name,
                "fighter2_name": fighter2_name,
                "result": result_data
            }
        
        return None
    except Exception as e:
        logger.error(f"Error extracting result from table: {str(e)}")
        return None

def extract_result_from_row(row):
    """Extract result data from a table row"""
    try:
        cells = row.find_all("td")
        if len(cells) < 8:
            return None
            
        # UFC Stats structure: W/L, Fighter, KD, STR, TD, SUB, Weight Class, Method, Round, Time
        wl_cell = cells[0]
        win_flag = wl_cell.find("i", class_="b-flag__text")
        method_cell = cells[7].get_text(strip=True) if len(cells) > 7 else ""
        round_cell = cells[8].get_text(strip=True) if len(cells) > 8 else ""
        time_cell = cells[9].get_text(strip=True) if len(cells) > 9 else ""
        
        if win_flag and win_flag.get_text(strip=True).upper() == "WIN":
            # Cell 1 contains both fighters concatenated - extract winner (first fighter)
            fighter_cell = cells[1].get_text(strip=True)
            # The winner is typically the first fighter in the concatenated string
            # We'll need to split this properly - for now, extract the first part
            if fighter_cell:
                return {
                    "winner_name": fighter_cell,  # Store full string for now, will be processed later
                    "method": method_cell,
                    "round": round_cell,
                    "time": time_cell
                }
        
        return None
    except Exception as e:
        logger.error(f"Error extracting result from row: {str(e)}")
        return None

def match_fight_to_database(scraped_fight, db_fights):
    """Match a scraped fight result to a database fight record"""
    # Handle concatenated winner name (e.g., "Ateba GautierRobert Valentin")
    winner_name = scraped_fight.get("winner_name", "").lower().strip()
    
    if not winner_name:
        return None
    
    for i, db_fight in enumerate(db_fights):
        db_f1 = db_fight.get("fighter1_name", "").lower().strip()
        db_f2 = db_fight.get("fighter2_name", "").lower().strip()
        
        # Check if both database fighter names appear in the concatenated winner string
        if db_f1 and db_f2:
            # Remove spaces from all names for comparison
            db_f1_clean = db_f1.replace(" ", "")
            db_f2_clean = db_f2.replace(" ", "")
            winner_clean = winner_name.replace(" ", "")
            
            # Check if the concatenated string contains both fighters
            if db_f1_clean in winner_clean and db_f2_clean in winner_clean:
                # Extract the actual winner from the concatenated string
                # The winner appears first in the concatenation
                actual_winner = extract_winner_from_concatenated_string(winner_name, db_f1, db_f2)
                scraped_fight["actual_winner"] = actual_winner
                return i
    
    return None

def extract_winner_from_concatenated_string(concatenated_name, fighter1_name, fighter2_name):
    """
    Extract the actual winner from concatenated string like 'Ateba GautierRobert Valentin'
    The winner appears first in the concatenation
    """
    # Remove spaces for cleaner matching
    concat_clean = concatenated_name.replace(" ", "").lower()
    f1_clean = fighter1_name.replace(" ", "").lower()
    f2_clean = fighter2_name.replace(" ", "").lower()
    
    # Check which fighter name appears first in the concatenated string
    f1_pos = concat_clean.find(f1_clean)
    f2_pos = concat_clean.find(f2_clean)
    
    # The winner is the one whose name appears first (position 0 or close to 0)
    if f1_pos == 0:
        return fighter1_name
    elif f2_pos == 0:
        return fighter2_name
    elif f1_pos >= 0 and f2_pos >= 0:
        # If both are found but neither at position 0, winner is the one that appears first
        if f1_pos < f2_pos:
            return fighter1_name
        else:
            return fighter2_name
    elif f1_pos >= 0:
        return fighter1_name
    elif f2_pos >= 0:
        return fighter2_name
    else:
        # Fallback - return the concatenated name as is
        return concatenated_name

def update_event_with_results(event_data, scraped_results):
    """Update event data with scraped results"""
    if not scraped_results:
        logger.warning("No results to update")
        return event_data, 0

    updated_fights = 0
    fights = event_data.get("fights", [])

    for scraped_fight in scraped_results:
        match_index = match_fight_to_database(scraped_fight, fights)

        if match_index is not None:
            fight = fights[match_index]
            result_data = scraped_fight

            # Skip if fight already has results (efficiency improvement)
            if fight.get("status") == "completed" and fight.get("result", {}).get("winner_name"):
                continue

            if result_data and result_data.get("winner_name"):
                # Update fight with results, using extracted winner name if available
                processed_result = result_data.copy()
                if result_data.get("actual_winner"):
                    processed_result["winner_name"] = result_data["actual_winner"]
                fight["result"] = processed_result
                fight["status"] = "completed"
                fight["completed_at"] = datetime.now().isoformat()

                # Calculate prediction accuracy
                prediction = fight.get("prediction")
                predicted_winner = prediction.get("predicted_winner_name") if prediction else None
                # Use the extracted actual winner (not the concatenated string)
                actual_winner = result_data.get("actual_winner") or result_data.get("winner_name")

                if predicted_winner and actual_winner:
                    # Simple comparison of predicted vs actual winner (names only)
                    predicted_clean = predicted_winner.lower().strip()
                    actual_clean = actual_winner.lower().strip()

                    fight["prediction_correct"] = predicted_clean == actual_clean

                updated_fights += 1
                logger.info(f"NEW RESULT - Updated fight: {fight['fighter1_name']} vs {fight['fighter2_name']}")
    
    # Update event-level statistics
    completed_fights = sum(1 for f in fights if f.get("status") == "completed")
    total_fights = len(fights)
    
    event_data["completed_fights"] = completed_fights
    event_data["results_updated_at"] = datetime.now().isoformat()
    
    if completed_fights == total_fights:
        event_data["status"] = "completed"
        logger.info("Event completed - all fights have results")
    elif completed_fights > 0:
        event_data["status"] = "in_progress"
    
    return event_data, updated_fights

def save_updated_event(event_data):
    """Save updated event data back to database"""
    if not db_available or not supabase:
        logger.error("Database not available")
        return False
    
    try:
        response = supabase.table('upcoming_events').update({
            'fights': event_data['fights'],
            'status': event_data['status'],
            'completed_fights': event_data['completed_fights'],
            'results_updated_at': event_data['results_updated_at']
        }).eq('id', event_data['id']).execute()
        
        if response.data:
            logger.info(f"Successfully updated event in database")
            return True
        else:
            logger.error("Failed to update event in database")
            return False
            
    except Exception as e:
        logger.error(f"Error saving updated event: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def generate_event_id(event_name):
    """Generate a clean event ID from event name"""
    # Convert to lowercase, replace spaces with hyphens, remove special chars
    event_id = event_name.lower()
    event_id = event_id.replace(":", "")
    event_id = event_id.replace(" ", "-")
    event_id = event_id.replace("--", "-")
    
    # Remove any remaining special characters except hyphens
    event_id = re.sub(r'[^a-z0-9\-]', '', event_id)
    
    return event_id

def calculate_accuracy_stats(fights):
    """Calculate prediction accuracy statistics for the event"""
    total_fights = len(fights)
    completed_fights = sum(1 for f in fights if f.get("status") == "completed")
    correct_predictions = sum(1 for f in fights if f.get("prediction_correct") is True)
    
    accuracy_percentage = (correct_predictions / completed_fights * 100) if completed_fights > 0 else 0
    
    # Calculate accuracy by confidence level
    high_confidence = [f for f in fights if f.get("prediction") and f.get("prediction", {}).get("confidence_percent", 0) > 75]
    medium_confidence = [f for f in fights if f.get("prediction") and 60 <= f.get("prediction", {}).get("confidence_percent", 0) <= 75]
    low_confidence = [f for f in fights if f.get("prediction") and f.get("prediction", {}).get("confidence_percent", 0) < 60]
    
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
                "count": len([f for f in high_confidence if f.get("status") == "completed"]),
                "accuracy": round(calc_accuracy(high_confidence), 2)
            },
            "medium_confidence": {
                "count": len([f for f in medium_confidence if f.get("status") == "completed"]),
                "accuracy": round(calc_accuracy(medium_confidence), 2)
            },
            "low_confidence": {
                "count": len([f for f in low_confidence if f.get("status") == "completed"]),
                "accuracy": round(calc_accuracy(low_confidence), 2)
            }
        },
        "calculated_at": datetime.now().isoformat()
    }
    
    return stats

def export_completed_event_to_bucket(event_data, bucket_name="fight-events"):
    """Export completed event to Supabase storage bucket"""
    try:
        logger.info(f"Exporting completed event to bucket: {event_data['event_name']}")
        
        # Prepare export data
        fights = event_data.get("fights", [])
        accuracy_stats = calculate_accuracy_stats(fights)
        
        export_data = {
            "event_id": generate_event_id(event_data["event_name"]),
            "event_name": event_data["event_name"],
            "event_date": event_data["event_date"],
            "event_url": event_data["event_url"],
            "status": "completed",
            "total_fights": event_data.get("total_fights", len(fights)),
            "completed_fights": event_data.get("completed_fights", 0),
            "scraped_at": event_data["scraped_at"],
            "results_updated_at": event_data.get("results_updated_at"),
            "exported_at": datetime.now().isoformat(),
            "accuracy_stats": accuracy_stats,
            "fights": fights
        }
        
        # Generate filename
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
        
        logger.info(f"Successfully exported {filename} to bucket")
        return True
        
    except Exception as e:
        logger.error(f"Error exporting to bucket: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def deactivate_completed_event(event_id):
    """Deactivate event after successful export"""
    try:
        response = supabase.table('upcoming_events').update({
            'is_active': False,
            'status': 'completed'
        }).eq('id', event_id).execute()
        
        if response.data:
            logger.info(f"Deactivated completed event {event_id}")
            return True
        else:
            logger.error(f"Failed to deactivate event {event_id}")
            return False
            
    except Exception as e:
        logger.error(f"Error deactivating event: {str(e)}")
        return False

def monitor_event():
    """Monitor active event for result updates"""
    logger.info("Starting fight results monitoring...")
    
    # Get active event
    event_data = get_active_event()
    if not event_data:
        logger.error("No active event found to monitor")
        return False
    
    # Check if event timing is appropriate for monitoring
    if not should_monitor_event(event_data):
        logger.info("Event timing not appropriate for monitoring, skipping.")
        return True

    logger.info(f"Monitoring event: {event_data['event_name']}")
    
    # Extract current results from UFC Stats
    scraped_results = extract_fight_results(event_data['event_url'])
    
    if not scraped_results:
        logger.warning("No results found - event may not have started yet")
        return True
    
    # Update event data with results
    updated_event, updated_count = update_event_with_results(event_data, scraped_results)
    
    if updated_count > 0:
        # Save updated data back to database
        success = save_updated_event(updated_event)
        if success:
            logger.info(f"Successfully updated {updated_count} fights with results")
            
            # Settle predictions for newly completed fights
            try:
                settle_event_predictions(updated_event['id'])
            except Exception as e:
                logger.warning(f"Failed to settle predictions for event {updated_event['id']}: {str(e)}")
                # Don't fail the entire process if prediction settlement fails
        else:
            logger.error("Failed to save updates to database")
            return False
    else:
        logger.info("No new results to update")
    
    # Check if event is complete and auto-export
    completed_fights = updated_event.get('completed_fights', 0)
    total_fights = updated_event.get('total_fights', 0)
    
    if completed_fights > 0 and completed_fights == total_fights:
        logger.info(f"🎉 EVENT COMPLETE! All {total_fights} fights finished - auto-exporting to bucket...")
        
        # Export to bucket
        export_success = export_completed_event_to_bucket(updated_event)
        
        if export_success:
            # Deactivate event after successful export
            deactivate_success = deactivate_completed_event(updated_event['id'])
            
            if deactivate_success:
                logger.info("✅ Event exported and deactivated successfully - ready for next event!")
            else:
                logger.warning("⚠️  Event exported but failed to deactivate")
        else:
            logger.error("❌ Failed to export completed event to bucket")
    
    return True

def main():
    parser = argparse.ArgumentParser(description='UFC Fight Results Scraper')
    parser.add_argument('--mode', type=str, default='monitor', choices=['monitor', 'final'],
                       help='Mode: monitor (during event) or final (post-event sweep)')
    args = parser.parse_args()
    
    if args.mode == 'monitor':
        logger.info("Running in monitor mode - checking for live results")
        success = monitor_event()
    elif args.mode == 'final':
        logger.info("Running in final mode - final results sweep")
        success = monitor_event()  # Same logic for now
    
    if success:
        logger.info("✅ Results scraper completed successfully")
        return True
    else:
        logger.error("❌ Results scraper failed")
        return False

if __name__ == "__main__":
    main() 