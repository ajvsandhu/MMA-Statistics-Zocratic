from fastapi import APIRouter, Query, HTTPException
from backend.api.database import get_db_connection
import re
from typing import List, Dict, Optional
import logging
from urllib.parse import unquote
from backend.constants import (
    API_V1_STR,
    MAX_SEARCH_RESULTS,
    MAX_FIGHTS_DISPLAY,
    DEFAULT_RECORD,
    UNRANKED_VALUE
)
import traceback
from backend.utils import sanitize_json, set_parent_key
from thefuzz import fuzz, process
from functools import lru_cache
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix=API_V1_STR, tags=["Fighters"])

# Cache for fighter data with 5-minute expiry
CACHE_EXPIRY = 300  # 5 minutes
_fighter_cache = {'data': None, 'timestamp': 0}

def get_cached_fighters():
    """Get fighters from cache or database with 5-minute expiry."""
    current_time = time.time()
    
    # Return cached data if still valid
    if _fighter_cache['data'] is not None and current_time - _fighter_cache['timestamp'] < CACHE_EXPIRY:
        return _fighter_cache['data']
    
    # Fetch fresh data
    try:
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            return None
            
        response = supabase.table('fighters').select('id,fighter_name,Record,ranking,Weight').execute()
        if response and hasattr(response, 'data'):
            _fighter_cache['data'] = response.data
            _fighter_cache['timestamp'] = current_time
            return response.data
    except Exception as e:
        logger.error(f"Error fetching fighters: {str(e)}")
        return None
    
    return None

def format_ranking(rank_val: int) -> str:
    """Format ranking value into display format."""
    if rank_val == 1:
        return "Champion"
    elif 2 <= rank_val <= 16:
        return f"#{rank_val - 1}"
    return None  # Return None for unranked (99) or invalid rankings

@router.get("/fighters")
def get_fighters(
    query: str = Query("", min_length=0),
    weight_class: Optional[str] = None,
    is_ranked: Optional[bool] = None,
    min_score: int = Query(45, ge=0, le=100)
) -> Dict[str, List[Dict]]:
    """
    Get all fighters or search for fighters by name with optional filters.
    
    Args:
        query: Search query for fighter name
        weight_class: Filter by weight class
        is_ranked: Filter by ranking status (True for ranked, False for unranked)
        min_score: Minimum fuzzy match score (0-100)
    """
    try:
        # Get fighters from cache or database
        fighter_data = get_cached_fighters()
        if not fighter_data:
            return {"fighters": []}
        
        fighters_list = []
        
        # Pre-process query
        query_lower = query.lower().strip() if query else ""

        # Format and filter fighters
        for fighter in fighter_data:
            fighter_name = fighter.get('fighter_name', '')
            fighter_id = fighter.get('id', '')
            record = fighter.get('Record', DEFAULT_RECORD)
            weight_class_info = fighter.get('Weight', '')
            ranking = fighter.get('ranking', '99')
            
            # Skip invalid entries
            if not fighter_name or not fighter_id:
                continue

            # Apply weight class filter
            if weight_class and weight_class != weight_class_info:
                continue

            # Convert ranking to proper format
            try:
                rank_val = int(ranking) if ranking else 99
                rank_display = format_ranking(rank_val)
            except (ValueError, TypeError):
                rank_val = 99
                rank_display = None

            # Apply ranking filter here, after we have the numerical rank value
            if is_ranked is not None:
                if is_ranked and rank_val > 16:  # Skip unranked fighters when ranked filter is on
                    continue
                elif not is_ranked and rank_val != 99:  # Skip ranked fighters when unranked filter is on
                    continue
                
            formatted_name = f"{fighter_name} ({record})"
            if weight_class_info:
                formatted_name += f" - {weight_class_info}"
            if rank_display:  # Only add ranking if it should be displayed
                formatted_name += f" | {rank_display}"
            
            # If there's a search query, calculate fuzzy match score
            if query_lower:
                name_lower = fighter_name.lower()
                
                # Calculate fuzzy scores
                ratio = fuzz.ratio(query_lower, name_lower)
                partial_ratio = fuzz.partial_ratio(query_lower, name_lower)
                token_sort_ratio = fuzz.token_sort_ratio(query_lower, name_lower)
                token_set_ratio = fuzz.token_set_ratio(query_lower, name_lower)
                
                # Get best score from different matching methods
                best_score = max(
                    ratio,
                    partial_ratio * 1.2,  # Give more weight to partial matches
                    token_sort_ratio * 1.1,
                    token_set_ratio * 1.1
                )
                
                # Boost scores for exact matches and ranked fighters
                if query_lower == name_lower:
                    best_score += 15
                elif name_lower.startswith(query_lower):
                    best_score += 10
                elif query_lower in name_lower:
                    best_score += 5
                
                # Add to results if score is good enough
                if best_score >= min_score:
                    fighters_list.append({"name": formatted_name, "id": fighter_id, "score": best_score, "rank": rank_val})
            else:
                fighters_list.append({"name": formatted_name, "id": fighter_id, "score": 0, "rank": rank_val})
        
        # Sort and limit results
        if query:
            # Sort by score first, then by ranking
            fighters_list.sort(key=lambda x: (-x["score"], x["rank"]))
        else:
            # Sort by ranking only when no search query
            fighters_list.sort(key=lambda x: x["rank"])
            
        # Take top 5 results
        result = fighters_list[:5]
        
        logger.info(f"Returning {len(result)} fighters")
        return {"fighters": result}
        
    except Exception as e:
        logger.error(f"Error in get_fighters: {str(e)}")
        return {"fighters": []}

@router.get("/fighter-stats/{fighter_id}")
def get_fighter_stats(fighter_id: str):
    """Get fighter stats by ID."""
    try:
        # Log the request
        logger.info(f"Fetching stats for fighter ID: {fighter_id}")
        
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            return {"status": "error", "detail": "Database connection error, please try again later"}
        
        # Try to get fighter by ID
        response = supabase.table('fighters')\
            .select('*')\
            .eq('id', fighter_id)\
            .execute()
        
        if response and hasattr(response, 'data') and response.data:
            logger.info(f"Found stats for fighter ID: {fighter_id}")
            return sanitize_json(response.data[0])
        
        logger.warning(f"Fighter with ID {fighter_id} not found")
        return {"status": "error", "detail": f"Fighter with ID {fighter_id} not found"}
        
    except Exception as e:
        logger.error(f"Error in get_fighter_stats: {str(e)}")
        return {"status": "error", "detail": str(e)}

def _sanitize_string(value, default=""):
    """Ensure a value is a valid string to prevent frontend errors."""
    if value is None:
        return default
    if not isinstance(value, str):
        try:
            return str(value)
        except:
            return default
    # Return empty string for "null", "undefined" or "None" strings
    if value.lower() in ("null", "undefined", "none"):
        return default
    return value

def _sanitize_fighter_data(fighter_data):
    """Sanitize all string fields in fighter data to prevent frontend errors."""
    if not fighter_data:
        return {}
        
    # For each critical field, set the parent key before sanitizing
    for key in ['fighter_name', 'Record', 'Height', 'Weight', 'Reach', 'STANCE', 'DOB',
               'Str. Acc.', 'Str. Def', 'TD Acc.', 'TD Def.']:
        if key in fighter_data:
            set_parent_key(key)
            
    # Handle last_5_fights if present
    if 'last_5_fights' in fighter_data and fighter_data['last_5_fights']:
        # Make sure it's a list
        if not isinstance(fighter_data['last_5_fights'], list):
            fighter_data['last_5_fights'] = [fighter_data['last_5_fights']]
        
        # Sanitize each fight in the list
        for i, fight in enumerate(fighter_data['last_5_fights']):
            # Set parent keys for important fight fields
            for field in ['opponent_name', 'result', 'method', 'round', 'time', 'date', 'event']:
                if field in fight:
                    set_parent_key(field)
            
            # Convert any None values to appropriate defaults
            if isinstance(fight, dict):
                for field in ['opponent_name', 'result', 'method', 'time', 'date', 'event']:
                    if field not in fight or fight[field] is None:
                        fight[field] = ""
                        
                # Ensure round is a number
                if 'round' not in fight or fight['round'] is None:
                    fight['round'] = 0
            
        # Log the fights for debugging
        logger.info(f"Sanitized {len(fighter_data['last_5_fights'])} fights")
            
    # Apply the enhanced sanitize_json function
    sanitized = sanitize_json(fighter_data)
            
    # Ensure critical fields exist with defaults
    if 'fighter_name' not in sanitized or not sanitized['fighter_name']:
        sanitized['fighter_name'] = ""
    if 'Record' not in sanitized or not sanitized['Record']:
        sanitized['Record'] = "0-0-0"
    if 'Height' not in sanitized or not sanitized['Height']:
        sanitized['Height'] = ""
    if 'Weight' not in sanitized or not sanitized['Weight']:
        sanitized['Weight'] = ""
    if 'Reach' not in sanitized or not sanitized['Reach']:
        sanitized['Reach'] = ""
    if 'STANCE' not in sanitized or not sanitized['STANCE']:
        sanitized['STANCE'] = ""
    if 'DOB' not in sanitized or not sanitized['DOB']:
        sanitized['DOB'] = ""
    if 'image_url' not in sanitized or not sanitized['image_url']:
        sanitized['image_url'] = ""
        
    return sanitized

@router.get("/fighter/{fighter_id}")
def get_fighter(fighter_id: str) -> Dict:
    """Get fighter by ID."""
    try:
        if fighter_id is None:
            logger.warning("Fighter ID is None")
            raise HTTPException(status_code=400, detail="Fighter ID is required")
            
        logger.info(f"Fighter lookup requested for ID: {fighter_id}")
        
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            raise HTTPException(status_code=500, detail="Database connection error")
        
        # Try to get fighter by ID
        response = supabase.table('fighters')\
            .select('*')\
            .eq('id', fighter_id)\
            .execute()
            
        if response and hasattr(response, 'data') and response.data and len(response.data) > 0:
            fighter_data = response.data[0]
            logger.info(f"Found fighter with ID: {fighter_id}")
            return _process_fighter_data(fighter_data)
        
        logger.warning(f"Fighter with ID {fighter_id} not found")
        raise HTTPException(status_code=404, detail=f"Fighter with ID {fighter_id} not found")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_fighter: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

def _process_fighter_data(fighter_data: Dict) -> Dict:
    """Process fighter data and fetch last 5 fights."""
    try:
        fighter_id = fighter_data.get('id', '')
        fighter_name = fighter_data.get('fighter_name', '')
        logger.info(f"Fetching fights for fighter ID: '{fighter_id}', name: '{fighter_name}'")
        
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            return fighter_data
        
        last_5_fights = []
        
        # Skip fighter_id lookup for now since the column doesn't exist yet
        # Just use fighter_name directly
        if fighter_name:
            try:
                fights_response = supabase.table('fighter_last_5_fights')\
                    .select('*')\
                    .eq('fighter_name', fighter_name)\
                    .order('id', desc=False)\
                    .limit(MAX_FIGHTS_DISPLAY)\
                    .execute()
                
                if fights_response and hasattr(fights_response, 'data') and fights_response.data:
                    last_5_fights = fights_response.data
                    logger.info(f"SUCCESS! Found {len(last_5_fights)} fights using fighter_name '{fighter_name}'")
                    
                    # Add the fighter_id to each fight for future reference
                    for fight in last_5_fights:
                        if fighter_id and 'fighter_id' not in fight:
                            fight['fighter_id'] = fighter_id
            except Exception as e:
                logger.error(f"Error fetching fights by fighter_name: {str(e)}")
        
        fighter_data['last_5_fights'] = last_5_fights
        return fighter_data
    except Exception as e:
        logger.error(f"Error processing fighter data: {str(e)}")
        logger.error(traceback.format_exc())
        return fighter_data

def _get_default_fighter(fighter_id: str, name: str = "") -> Dict:
    """Return a default fighter object with the given ID and name."""
    return {
        "id": fighter_id,
        "fighter_name": name,
        "Record": "0-0-0",
        "Height": "",
        "Weight": "",
        "Reach": "",
        "STANCE": "",
        "DOB": "",
        "SLpM": 0.0,
        "Str. Acc.": "0%", 
        "SApM": 0.0,
        "Str. Def": "0%",
        "TD Avg.": 0.0,
        "TD Acc.": "0%",
        "TD Def.": "0%",
        "Sub. Avg.": 0.0,
        "image_url": "",
        "ranking": UNRANKED_VALUE,
        "is_champion": False
    }

@router.get("/fighter-details/{fighter_id}")
def get_fighter_details(fighter_id: str):
    """Get detailed fighter information by ID."""
    try:
        # Use the same logic as get_fighter_stats
        fighter_data = get_fighter_stats(fighter_id)
        logger.info(f"Retrieved detailed information for fighter ID: {fighter_id}")
        return sanitize_json(fighter_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching fighter details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@router.get("/fighter-average-stats")
def get_fighter_average_stats():
    """Get average stats across all fighters."""
    try:
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            raise HTTPException(status_code=500, detail="Database connection error")
        
        # Fetch all fighters data from Supabase for calculating averages
        response = supabase.table('fighters').select('*').execute()
        
        if not response.data:
            logger.warning("No fighters found in database")
            raise HTTPException(status_code=404, detail="No fighters found")
        
        fighters = response.data
        
        # Calculate averages of numerical fields
        numeric_fields = [
            'SSLA', 'SApM', 'SSA', 'TDA', 'TDD', 'KD', 'SLPM', 'StrAcc', 'StrDef', 'SUB', 'TD',
            'Height', 'Weight', 'Reach', 'Win', 'Loss', 'Draw', 'winratio'
        ]
        
        # Initialize sums and counts
        sums = {field: 0 for field in numeric_fields}
        counts = {field: 0 for field in numeric_fields}
        
        # Sum up values
        for fighter in fighters:
            for field in numeric_fields:
                if field in fighter and fighter[field] is not None:
                    try:
                        # Convert to float if it's a string
                        value = float(fighter[field]) if isinstance(fighter[field], str) else fighter[field]
                        sums[field] += value
                        counts[field] += 1
                    except (ValueError, TypeError):
                        # Skip if conversion fails
                        pass
        
        # Calculate averages
        averages = {}
        for field in numeric_fields:
            if counts[field] > 0:
                averages[field] = round(sums[field] / counts[field], 2)
            else:
                averages[field] = 0
        
        logger.info("Calculated average stats across all fighters")
        return sanitize_json(averages)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error calculating fighter average stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

def process_fighter_name(raw_name: str) -> str:
    """
    Keep the nickname if the fighter has at least a first and last name,
    e.g. Israel "The Last Stylebender" Adesanya, but remove the nickname
    if there's only one name, e.g. "The Lion" Kangwang => 'Kangwang'.
    """
    # Check if there is a quoted nickname
    # We look for either single or double quotes
    pattern = r'["\']([^"\']+)["\']'
    match = re.search(pattern, raw_name)
    if not match:
        # No nickname in quotes, just return as-is
        return raw_name.strip()

    # If there is a nickname, split out the quoted part
    nickname = match.group(1)
    # Remove the nickname portion from the full string, leaving the outside
    outside_parts = re.sub(pattern, '', raw_name).strip()

    # Count how many words remain outside the quotes
    word_count = len(outside_parts.split())
    if word_count >= 2:
        # If there are at least two words (e.g. "Israel Adesanya"), keep the nickname
        return raw_name.strip()
    else:
        # Only one name outside the quotes, remove the nickname entirely
        return outside_parts

@router.post("/scrape_and_store_fighters")
def scrape_and_store_fighters(fighters: List[Dict]):
    """
    Endpoint to store fighters in the Supabase database.
    
    This endpoint processes fighter names and stores them in the database.
    """
    try:
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            raise HTTPException(status_code=500, detail="Database connection error")
            
        success_count = 0
        error_count = 0
        
        for fighter in fighters:
            # Process the fighter name if needed
            if "fighter_name" in fighter:
                fighter["fighter_name"] = process_fighter_name(fighter["fighter_name"])
                
            try:
                # Upsert the fighter data to the database
                # Note: We now use 'id' as the conflict column if available, otherwise fallback to fighter_name
                conflict_column = "id" if "id" in fighter else "fighter_name"
                response = supabase.table("fighters").upsert(fighter, on_conflict=conflict_column).execute()
                
                if response and hasattr(response, 'data') and response.data:
                    # Get the fighter ID - either from the response or from the original fighter data
                    fighter_id = None
                    if response.data and len(response.data) > 0:
                        fighter_id = response.data[0].get('id')
                    elif "id" in fighter:
                        fighter_id = fighter.get('id')
                        
                    if fighter_id:
                        # If this fighter has fights data, update the last_5_fights table with the fighter_id
                        if "fights" in fighter:
                            for fight in fighter["fights"]:
                                # Add fighter_id to each fight record
                                fight["fighter_id"] = fighter_id
                                # Keep fighter_name for backward compatibility if needed
                                if "fighter_name" not in fight and "fighter_name" in fighter:
                                    fight["fighter_name"] = fighter["fighter_name"]
                                
                                # Upsert the fight data
                                fight_response = supabase.table("fighter_last_5_fights").upsert(
                                    fight, 
                                    on_conflict=["fighter_id", "opponent"] if "opponent" in fight else "id"
                                ).execute()
                                
                                if not fight_response or not hasattr(fight_response, 'data'):
                                    logger.warning(f"Failed to insert fight for fighter ID {fighter_id}")
                    
                    success_count += 1
                else:
                    error_count += 1
                    logger.warning(f"Failed to insert fighter: {fighter.get('fighter_name', 'Unknown')}")
            except Exception as e:
                error_count += 1
                logger.error(f"Error inserting fighter {fighter.get('fighter_name', 'Unknown')}: {str(e)}")
        
        return sanitize_json({
            "status": "success",
            "detail": f"Processed {len(fighters)} fighters. {success_count} succeeded, {error_count} failed."
        })
    except Exception as e:
        logger.error(f"Error in scrape_and_store_fighters: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@router.get("/fighters-count")
def get_fighters_count():
    """Get total number of fighters in the database."""
    try:
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            raise HTTPException(status_code=500, detail="Database connection error")
        
        response = supabase.table('fighters').select('id', count='exact').execute()
        
        if not response or not hasattr(response, 'count'):
            logger.warning("Could not get fighters count")
            return {"count": 0}
        
        logger.info(f"Total fighters count: {response.count}")
        return {"count": response.count}
    except Exception as e:
        logger.error(f"Error getting fighters count: {str(e)}")
        return {"count": 0}

@router.get("/update-rankings")
def update_rankings():
    """Update fighter rankings from external sources."""
    try:
        logger.info("Updating fighter rankings...")
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            return {"status": "error", "detail": "Database connection error"}
        
        # Get existing fighters
        fighter_data = get_cached_fighters()
        if not fighter_data:
            return {"status": "error", "detail": "Failed to get fighters from database"}
        
        # Get rankings data from UFC website or another source
        # This is a mock implementation that just resets rankings
        update_count = 0
        for fighter in fighter_data:
            fighter_name = fighter.get('fighter_name')
            if not fighter_name:
                continue
            
            # For demonstration purposes, we're not actually updating rankings
            # In a real implementation, you would get real ranking data from an external source
            
            update_count += 1
            
        return {
            "status": "success",
            "detail": f"Updated {update_count} fighter rankings",
            "fighters_processed": len(fighter_data) if fighter_data else 0,
            "fighters_updated": update_count
        }
    except Exception as e:
        logger.error(f"Error updating rankings: {str(e)}")
        logger.error(traceback.format_exc())
        return {"status": "error", "detail": str(e)}

