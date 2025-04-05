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
            
        response = supabase.table('fighters').select('fighter_name,Record,ranking,Weight').execute()
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
) -> Dict[str, List[str]]:
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
            record = fighter.get('Record', DEFAULT_RECORD)
            weight_class_info = fighter.get('Weight', '')
            ranking = fighter.get('ranking', '99')
            
            # Skip invalid entries
            if not fighter_name:
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
                    fighters_list.append((formatted_name, best_score, rank_val))
            else:
                fighters_list.append((formatted_name, 0, rank_val))
        
        # Sort and limit results
        if query:
            # Sort by score first, then by ranking
            fighters_list.sort(key=lambda x: (-x[1], x[2]))
        else:
            # Sort by ranking only when no search query
            fighters_list.sort(key=lambda x: x[2])
            
        # Take top 5 results
        result = [fighter[0] for fighter in fighters_list[:5]]
        
        logger.info(f"Returning {len(result)} fighters")
        return {"fighters": result}
        
    except Exception as e:
        logger.error(f"Error in get_fighters: {str(e)}")
        return {"fighters": []}

@router.get("/fighter-stats/{fighter_name}")
def get_fighter_stats(fighter_name: str):
    """Get fighter stats by name."""
    try:
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            raise HTTPException(status_code=500, detail="Database connection error")
        
        # URL decode and clean fighter name
        fighter_name = unquote(fighter_name)
        
        # Clean fighter name - remove record if present
        if "(" in fighter_name:
            fighter_name = fighter_name.split("(")[0].strip()
        
        # First try exact match (case-sensitive)
        response = supabase.table('fighters')\
            .select('*')\
            .eq('fighter_name', fighter_name)\
            .execute()
        
        if response.data:
            logger.info(f"Exact match found for fighter: {fighter_name}")
            return sanitize_json(response.data[0])
        
        # Try case-insensitive match
        all_fighters = supabase.table('fighters').select('fighter_name').execute()
        if not all_fighters.data:
            logger.warning(f"No fighters found in database")
            raise HTTPException(status_code=404, detail="No fighters found in database")
        
        # First try case-insensitive exact match
        for f in all_fighters.data:
            if f['fighter_name'].lower() == fighter_name.lower():
                logger.info(f"Case-insensitive match found for {fighter_name}: {f['fighter_name']}")
                response = supabase.table('fighters')\
                    .select('*')\
                    .eq('fighter_name', f['fighter_name'])\
                    .execute()
                if response.data:
                    return sanitize_json(response.data[0])
        
        # If no exact match, try fuzzy matching
        fighter_names = [f['fighter_name'] for f in all_fighters.data]
        
        # Use fuzzy matching with higher threshold for more accurate matches
        best_match = process.extractOne(
            fighter_name,
            fighter_names,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=90  # Increased threshold to 90% for more accurate matches
        )
        
        if best_match:
            matched_name, score = best_match
            logger.info(f"Fuzzy match found for {fighter_name}: {matched_name} (score: {score})")
            
            # Fetch the matched fighter's data
            response = supabase.table('fighters')\
                .select('*')\
                .eq('fighter_name', matched_name)\
                .execute()
                
            if response.data:
                return sanitize_json(response.data[0])
        
        logger.warning(f"Fighter not found: {fighter_name}")
        raise HTTPException(status_code=404, detail=f"Fighter not found: {fighter_name}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching fighter stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

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

@router.get("/fighter/{fighter_name}")
def get_fighter(fighter_name: str) -> Dict:
    """Get fighter by name."""
    try:
        if fighter_name is None:
            logger.warning("Fighter name is None")
            raise HTTPException(status_code=400, detail="Fighter name is required")
            
        try:
            fighter_name = unquote(fighter_name)
        except Exception as e:
            logger.error(f"Error decoding fighter name: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid fighter name")
        
        logger.info(f"Fighter lookup requested for: {fighter_name}")
        
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            raise HTTPException(status_code=500, detail="Database connection error")
        
        # Clean the fighter name - remove record if present
        clean_name = fighter_name
        if "(" in fighter_name:
            clean_name = fighter_name.split("(")[0].strip()
        
        logger.info(f"Cleaned fighter name: {clean_name}")
        
        # Try exact match first
        response = supabase.table('fighters')\
            .select('*')\
            .eq('fighter_name', clean_name)\
            .execute()
            
        if response and hasattr(response, 'data') and response.data and len(response.data) > 0:
            fighter_data = response.data[0]
            logger.info(f"Found fighter via exact match: {clean_name}")
            return _process_fighter_data(fighter_data)
        
        # If no exact match, try case-insensitive match
        response = supabase.table('fighters')\
            .select('*')\
            .ilike('fighter_name', f"%{clean_name}%")\
            .execute()
            
        if response and hasattr(response, 'data') and response.data and len(response.data) > 0:
            fighters = response.data
            # Convert ranking to int for comparison
            ranked_fighters = [f for f in fighters if int(f.get('ranking', 99)) < 99]
            if ranked_fighters:
                fighter_data = ranked_fighters[0]
            else:
                fighter_data = fighters[0]
            logger.info(f"Found fighter via case-insensitive match: {clean_name}")
            return _process_fighter_data(fighter_data)
        
        logger.warning(f"Fighter not found: {clean_name}")
        raise HTTPException(status_code=404, detail=f"Fighter not found: {clean_name}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_fighter: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")

def _process_fighter_data(fighter_data: Dict) -> Dict:
    """Process fighter data and fetch last 5 fights."""
    try:
        fighter_name_from_db = fighter_data.get('fighter_name', '')
        logger.info(f"Fetching fights using exact fighter name from database: '{fighter_name_from_db}'")
        
        supabase = get_db_connection()
        if not supabase:
            logger.error("No database connection available")
            return fighter_data
        
        last_5_fights = []
        if fighter_name_from_db:
            fights_response = supabase.table('fighter_last_5_fights')\
                .select('*')\
                .eq('fighter_name', fighter_name_from_db)\
                .order('id', desc=False)\
                .limit(MAX_FIGHTS_DISPLAY)\
                .execute()
            
            if fights_response and hasattr(fights_response, 'data') and fights_response.data:
                last_5_fights = fights_response.data
                logger.info(f"SUCCESS! Found {len(last_5_fights)} fights for fighter '{fighter_name_from_db}'")
        
        fighter_data['last_5_fights'] = last_5_fights
        return fighter_data
    except Exception as e:
        logger.error(f"Error processing fighter data: {str(e)}")
        logger.error(traceback.format_exc())
        return fighter_data

def _get_default_fighter(name: str) -> Dict:
    """Return a default fighter object with the given name."""
    return {
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

@router.get("/fighter-details/{fighter_name}")
def get_fighter_details(fighter_name: str):
    """Get detailed fighter information by name."""
    try:
        # Use the same logic as get_fighter_stats but with more detailed logging
        fighter_data = get_fighter_stats(fighter_name)
        logger.info(f"Retrieved detailed information for fighter: {fighter_name}")
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
                response = supabase.table("fighters").upsert(fighter, on_conflict="fighter_name").execute()
                if response and hasattr(response, 'data') and response.data:
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

