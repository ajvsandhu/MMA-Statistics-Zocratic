import requests
from bs4 import BeautifulSoup
import pandas as pd
import concurrent.futures
import string
import re
import time
import random
import os
import argparse
from datetime import datetime
import logging
from dotenv import load_dotenv
import sys

# Simple fix - add the project root to Python's path
sys.path.insert(0, '.')

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

# Setup logging
logger = logging.getLogger(__name__)

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
MAX_WORKERS = 10
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Import Supabase client
from backend.api.database import (
    get_supabase_client,
    SimpleSupabaseClient,
    QueryBuilder
)

# Initialize Supabase client
supabase = get_supabase_client()

# Test Supabase connection
if not supabase:
    raise ValueError("Could not connect to Supabase. Please check your credentials and network connection.")

# Helper functions to maintain compatibility with old code
def get_fighters():
    """Get all fighters from the database."""
    try:
        response = supabase.table('fighters').select('*').execute()
        return response.data if response else []
    except Exception as e:
        logger.error(f"Error getting fighters: {str(e)}")
        return []

def get_fighter_by_url(fighter_url: str):
    """Get fighter by URL."""
    try:
        response = supabase.table('fighters').select('*').eq('fighter_url', fighter_url).execute()
        return response.data[0] if response and response.data else None
    except Exception as e:
        logger.error(f"Error getting fighter by URL: {str(e)}")
        return None

def insert_fighter(fighter_data: dict):
    """Insert a new fighter."""
    try:
        response = supabase.table('fighters').insert(fighter_data).execute()
        return bool(response)
    except Exception as e:
        logger.error(f"Error inserting fighter: {str(e)}")
        return False

def update_fighter(fighter_url: str, fighter_data: dict):
    """Update an existing fighter."""
    try:
        response = supabase.table('fighters').update(fighter_data).eq('fighter_url', fighter_url).execute()
        return bool(response)
    except Exception as e:
        logger.error(f"Error updating fighter: {str(e)}")
        return False

def upsert_fighter(fighter_data: dict):
    """Insert or update a fighter."""
    try:
        response = supabase.table('fighters').upsert(fighter_data).execute()
        return bool(response)
    except Exception as e:
        logger.error(f"Error upserting fighter: {str(e)}")
        return False

def get_fighter_fights(fighter_name: str):
    """Get all fights for a fighter."""
    try:
        response = supabase.table('fights').select('*').eq('fighter_name', fighter_name).execute()
        return response.data if response else []
    except Exception as e:
        logger.error(f"Error getting fighter fights: {str(e)}")
        return []

def update_fighter_all_fights(fighter_name: str, fights: list):
    """Update all fights for a fighter."""
    try:
        # First delete existing fights
        supabase.table('fights').delete().eq('fighter_name', fighter_name).execute()
        # Then insert new fights
        if fights:
            response = supabase.table('fights').insert(fights).execute()
            return bool(response)
        return True
    except Exception as e:
        logger.error(f"Error updating fighter fights: {str(e)}")
        return False

def update_fighter_recent_fight(fighter_name: str, new_fight: dict):
    """Update the most recent fight for a fighter."""
    try:
        response = supabase.table('fights').upsert(new_fight).execute()
        return bool(response)
    except Exception as e:
        logger.error(f"Error updating recent fight: {str(e)}")
        return False

def insert_fighter_fight(fight_data: dict):
    """Insert a new fight."""
    try:
        response = supabase.table('fights').insert(fight_data).execute()
        return bool(response)
    except Exception as e:
        logger.error(f"Error inserting fight: {str(e)}")
        return False

def delete_fighter_fights(fighter_name: str):
    """Delete all fights for a fighter."""
    try:
        response = supabase.table('fights').delete().eq('fighter_name', fighter_name).execute()
        return bool(response)
    except Exception as e:
        logger.error(f"Error deleting fighter fights: {str(e)}")
        return False

def truncate_table(table_name: str):
    """Truncate a table."""
    try:
        response = supabase.table(table_name).delete().neq('id', 0).execute()
        return bool(response)
    except Exception as e:
        logger.error(f"Error truncating table: {str(e)}")
        return False

def clean_record_text(rec_txt):
    rec_txt = rec_txt.replace("Record:", "").strip()
    rec_txt = re.sub(r'-\d{4,}$', '', rec_txt).strip()
    return rec_txt

def format_percentage(value):
    if value == "N/A" or value is None:
        return "N/A"
    # Remove the % character if present
    if isinstance(value, str) and "%" in value:
        value = value.replace("%", "").strip()
    try:
        # Convert to float and format as integer percentage
        return f"{int(float(value))}%"
    except (ValueError, TypeError):
        return value

def format_decimal(value, decimal_places=2):
    if value == "N/A" or value is None:
        return "N/A"
    try:
        # Convert to float and format with specified decimal places
        return f"{float(value):.{decimal_places}f}"
    except (ValueError, TypeError):
        return value

def format_height(value):
    if value == "N/A" or value is None:
        return "N/A"
    # Ensure height is in the format like "5' 11""
    if isinstance(value, str) and "'" in value:
        return value.strip()
    return value

def parse_stats_block(ul_element, stats_dict):
    li_items = ul_element.find_all("li")
    for li in li_items:
        text = li.get_text(separator=" ", strip=True)
        if ":" in text:
            label, value = text.split(":", 1)
            label = label.strip()
            value = value.strip() if value.strip() else "N/A"
            if value == "--":
                value = "N/A"
            if label in stats_dict:
                stats_dict[label] = value

def fetch_listing_page(letter, max_retries=3):
    url = f"http://ufcstats.com/statistics/fighters?char={letter}&page=all"
    print(f"[INFO] Fetch listing for '{letter}' -> {url}")
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(url, timeout=(5, 30))
            resp.raise_for_status()
            return (letter, resp.text)
        except requests.exceptions.Timeout as e:
            print(f"[WARN] Timeout for '{letter}', attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt  # Exponential backoff
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"[ERROR] Failed after {max_retries} attempts for '{letter}'")
                return (letter, None)
        except requests.exceptions.HTTPError as e:
            print(f"[ERROR] HTTP error for '{letter}': {e}")
            return (letter, None)
        except Exception as e:
            print(f"[ERROR] Unexpected error for '{letter}': {e}")
            return (letter, None)

def parse_listing_page(html):
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", class_="b-statistics__table")
    if not table:
        print("[WARN] No table found on listing page.")
        return []
    rows = table.find_all("tr")[1:]  # skip header row
    fighter_urls = []
    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 1:
            continue
        link_tag = cols[0].find("a")
        if link_tag and "href" in link_tag.attrs:
            fighter_url = link_tag["href"].strip()
            if fighter_url:
                fighter_urls.append(fighter_url)
    return fighter_urls

def scrape_fighter_detail(fighter_url, max_retries=2):
    desired_stats = {
        "fighter_name": "N/A",
        "Record": "N/A",
        "Height": "N/A",
        "Weight": "N/A",
        "Reach": "N/A",
        "STANCE": "N/A",
        "DOB": "N/A",
        "SLpM": "N/A",
        "Str. Acc.": "N/A",
        "SApM": "N/A",
        "Str. Def": "N/A",
        "TD Avg.": "N/A",
        "TD Acc.": "N/A",
        "TD Def.": "N/A",
        "Sub. Avg.": "N/A"
    }
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(fighter_url, timeout=(5, 30))
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Scrape fighter_name - make sure it doesn't include the record
            name_tag = soup.find("h2", class_="b-content__title")
            if name_tag:
                # Get the text without any child elements (which might contain the record)
                fighter_name = name_tag.get_text(strip=True)
                
                # Sometimes the record is part of the name text, so we need to clean it
                # Look for the record pattern like "Record: XX-YY" and remove it
                fighter_name = re.sub(r'Record:.*$', '', fighter_name).strip()
                
                # Also remove any trailing parentheses content like "(XX-YY)"
                fighter_name = re.sub(r'\s*\([^)]*\)\s*$', '', fighter_name).strip()
                
                desired_stats["fighter_name"] = fighter_name
            
            # Scrape record separately
            rec_span = soup.find("span", class_="b-content__title-record")
            if rec_span:
                raw_text = rec_span.get_text(strip=True)
                cleaned = clean_record_text(raw_text)
                desired_stats["Record"] = cleaned if cleaned else "N/A"
            
            # Scrape other stats
            blocks = soup.find_all("ul", class_="b-list__box-list")
            for blk in blocks:
                parse_stats_block(blk, desired_stats)
            
            return desired_stats
        except requests.exceptions.Timeout as e:
            print(f"[WARN] Timeout for '{fighter_url}', attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                print(f"[ERROR] Failed after {max_retries} attempts for '{fighter_url}'")
                return desired_stats
        except requests.exceptions.HTTPError as e:
            print(f"[ERROR] HTTP error for '{fighter_url}': {e}")
            return desired_stats
        except Exception as e:
            print(f"[ERROR] Unexpected error for '{fighter_url}': {e}")
            return desired_stats

def process_fighter(fighter_url):
    stats = scrape_fighter_detail(fighter_url)
    
    # Format numeric values
    if "SLpM" in stats and stats["SLpM"] != "N/A":
        stats["SLpM"] = format_decimal(stats["SLpM"])
    if "SApM" in stats and stats["SApM"] != "N/A":
        stats["SApM"] = format_decimal(stats["SApM"])
    if "TD Avg." in stats and stats["TD Avg."] != "N/A":
        stats["TD Avg."] = format_decimal(stats["TD Avg."])
    
    # Format percentage values
    percentage_fields = ["Str. Acc.", "Str. Def", "TD Acc.", "TD Def."]
    for field in percentage_fields:
        if field in stats and stats[field] != "N/A":
            stats[field] = format_percentage(stats[field])
    
    # Format height
    if "Height" in stats and stats["Height"] != "N/A":
        stats["Height"] = format_height(stats["Height"])
    
    row = {
        "fighter_name": stats.pop("fighter_name", "N/A"),
        "fighter_url": fighter_url
    }
    row.update(stats)
    return row

def parse_fighter_name(fighter_name):
    no_quotes = fighter_name.replace('"', "")
    parts = no_quotes.split()
    if len(parts) == 1:
        return ("", parts[0])
    elif len(parts) == 2:
        return (parts[0], parts[1])
    else:
        # For names with more than 2 parts, consider everything except the last part as first name
        first_name = " ".join(parts[:-1])
        last_name = parts[-1]
        return (first_name, last_name)

def get_existing_fighters():
    """
    Return a dictionary of existing fighters {fighter_url: fighter_name}
    """
    try:
        # Query existing fighters from Supabase
        response = supabase.table("fighters").select("fighter_name, fighter_url").execute()
        if response.data:
            # Create dictionary mapping URLs to names for quick lookups
            return {row['fighter_url']: row['fighter_name'] for row in response.data}
        return {}
    except Exception as e:
        print(f"[ERROR] Could not read existing fighters from Supabase: {e}")
        return {}

def update_fighter_database(new_data_df):
    try:
        print(f"[INFO] Starting database update with {len(new_data_df)} fighters")
        
        # Validate data before database update
        record_pattern = re.compile(r'\d+-\d+(-\d+)?')  # Pattern like XX-YY or XX-YY-ZZ
        problematic_names = []
        
        # Check for fighter names that might still contain record information
        for idx, row in new_data_df.iterrows():
            fighter_name = row['fighter_name']
            # Look for patterns like "10-5" or "10-5-2" in the name
            if record_pattern.search(fighter_name):
                problematic_names.append(f"Row {idx}: {fighter_name}")
        
        if problematic_names:
            print("[WARN] Some fighter names may still contain record information:")
            for name in problematic_names[:10]:  # Show first 10 only
                print(f"  - {name}")
            if len(problematic_names) > 10:
                print(f"  - ... and {len(problematic_names) - 10} more")
        
        # Get existing fighter URLs
        response = supabase.table("fighters").select("fighter_url").execute()
        existing_urls = [row['fighter_url'] for row in response.data] if response.data else []
        print(f"[INFO] Found {len(existing_urls)} existing fighters in database")
        
        # Track statistics
        new_count = 0
        updated_count = 0
        unchanged_count = 0
        error_count = 0
        
        # Process each fighter
        for index, (_, row) in enumerate(new_data_df.iterrows()):
            if index % 100 == 0:
                print(f"[INFO] Processing fighter {index+1}/{len(new_data_df)}")
                
            try:
                fighter_url = row['fighter_url']
                
                # Convert row to dictionary for easier handling
                row_dict = row.to_dict()
                
                # Check if fighter exists
                if fighter_url in existing_urls:
                    # Get current data from Supabase
                    fighter_response = supabase.table("fighters").select("*").eq("fighter_url", fighter_url).execute()
                    
                    if fighter_response.data and len(fighter_response.data) > 0:
                        current_dict = fighter_response.data[0]
                        
                        # Check if any data has changed (only check base columns)
                        base_columns = [
                            "fighter_name", "Record", "Height", "Weight", "Reach", "STANCE", "DOB",
                            "SLpM", "Str. Acc.", "SApM", "Str. Def", "TD Avg.", "TD Acc.", "TD Def.", 
                            "Sub. Avg.", "fighter_url"
                        ]
                        
                        changed = False
                        changed_fields = []
                        for col in base_columns:
                            if col in current_dict and col in row_dict:
                                new_val = str(row_dict.get(col, "N/A"))
                                old_val = str(current_dict.get(col, "N/A"))
                                if new_val != old_val:
                                    changed = True
                                    changed_fields.append(col)
                        
                        if changed:
                            # Update the record
                            # Preserve any additional fields that were not in the scrape
                            for field in current_dict:
                                if field not in row_dict and field not in ['id', 'created_at', 'updated_at']:
                                    row_dict[field] = current_dict[field]
                            
                            # Update the fighter in Supabase
                            update_response = supabase.table("fighters").update(row_dict).eq("fighter_url", fighter_url).execute()
                            
                            if update_response.data:
                                updated_count += 1
                                
                                # Debug log for updates
                                if updated_count <= 5:  # Only show first 5 updates to avoid log spam
                                    fighter_name = row_dict.get('fighter_name', 'Unknown')
                                    print(f"[DEBUG] Updated fighter: {fighter_name}")
                                    for field in changed_fields:
                                        old = current_dict.get(field, 'N/A')
                                        new = row_dict.get(field, 'N/A')
                                        print(f"  - {field}: '{old}' -> '{new}'")
                            else:
                                error_count += 1
                                print(f"[ERROR] Failed to update fighter: {fighter_url}")
                        else:
                            unchanged_count += 1
                    else:
                        # This shouldn't happen but handle it anyway
                        print(f"[WARN] Fighter URL in existing_urls but not found in database: {fighter_url}")
                        
                        # Insert as new record
                        insert_response = supabase.table("fighters").insert(row_dict).execute()
                        if insert_response.data:
                            new_count += 1
                        else:
                            error_count += 1
                else:
                    # Insert new record
                    insert_response = supabase.table("fighters").insert(row_dict).execute()
                    
                    if insert_response.data:
                        new_count += 1
                        
                        # Debug log for new fighters
                        if new_count <= 5:  # Only show first 5 new fighters
                            print(f"[DEBUG] New fighter added: {row_dict.get('fighter_name', 'Unknown')}")
                    else:
                        error_count += 1
                        print(f"[ERROR] Failed to insert fighter: {fighter_url}")
            except Exception as e:
                error_count += 1
                print(f"[ERROR] Failed to process fighter: {e}")
                import traceback
                traceback.print_exc()
                # Continue with next fighter instead of failing completely
        
        print("\n" + "="*50)
        print(f"[DONE] Database update complete:")
        print(f"  - {new_count} new fighters added")
        print(f"  - {updated_count} fighters updated")
        print(f"  - {unchanged_count} fighters unchanged")
        print(f"  - {error_count} errors encountered")
        print(f"  - {len(new_data_df)} total fighters processed")
        print("="*50 + "\n")
        
        return True
    except Exception as e:
        print(f"[ERROR] Database update failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def fetch_recent_events(num_events=2, max_retries=3):
    """Fetch the most recent completed UFC events"""
    url = "http://ufcstats.com/statistics/events/completed"
    print(f"[INFO] Fetching recent events from {url}")
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(url, timeout=(5, 30))
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # The table is likely within a div with class "b-statistics__table-events"
            table_container = soup.find("div", class_="b-statistics__table-wrap")
            if not table_container:
                print("[WARN] Could not find table container, trying alternative approach")
                # Try to find any table that might contain event links
                events_table = soup.find("table")
            else:
                events_table = table_container.find("table")
                
            if not events_table:
                print("[ERROR] Could not find events table")
                # Try a more generic approach - look directly for links to event details
                event_links = []
                all_links = soup.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                
                for link in all_links[:num_events]:
                    event_url = link["href"].strip()
                    event_name = link.get_text(strip=True)
                    date_text = ""
                    
                    # Look for a nearby date element
                    parent = link.parent
                    date_span = parent.find("span", class_="b-statistics__date")
                    if date_span:
                        date_text = date_span.get_text(strip=True)
                    
                    event_links.append({
                        "url": event_url,
                        "name": event_name,
                        "date": date_text
                    })
                
                if event_links:
                    print(f"[INFO] Found {len(event_links)} recent events using alternative method")
                    return event_links
                
                return []
            
            event_links = []
            rows = events_table.find_all("tr")[1:]  # Skip header row
            
            for row in rows:
                # Check if this is an upcoming event
                if "b-statistics__table-row_type_first" in row.get("class", []):
                    # This might be the "next" event indicator
                    continue
                
                # Find the event link
                link_tag = row.find("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                if not link_tag:
                    continue
                
                event_url = link_tag["href"].strip()
                event_name = link_tag.get_text(strip=True)
                date_text = ""
                
                # Try to find the date
                date_cell = row.find("span", class_="b-statistics__date")
                if date_cell:
                    date_text = date_cell.get_text(strip=True)
                
                event_links.append({
                    "url": event_url,
                    "name": event_name,
                    "date": date_text
                })
                
                if len(event_links) >= num_events:
                    break
            
            print(f"[INFO] Found {len(event_links)} recent events")
            return event_links
            
        except requests.exceptions.Timeout as e:
            print(f"[WARN] Timeout fetching events, attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
        except Exception as e:
            print(f"[ERROR] Failed to fetch recent events: {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                return []
    
    return []

def extract_fighters_from_event(event_url, max_retries=3):
    """Extract all fighter URLs from a UFC event page"""
    print(f"[INFO] Extracting fighters from event: {event_url}")
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(event_url, timeout=(5, 30))
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            fighter_links = []
            
            # The page structure has tables for each fight with fighter links
            # First, let's try to find the fight tables
            fight_tables = soup.find_all("table", class_="b-fight-details__table")
            
            if not fight_tables:
                # If we can't find the specific tables, try a more generic approach
                print("[WARN] Could not find specific fight tables, trying alternative method")
            
            # Find all fighter links on the page
            link_tags = soup.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
            
            for link in link_tags:
                fighter_url = link["href"].strip()
                if fighter_url and fighter_url not in fighter_links:
                    fighter_links.append(fighter_url)
            
            if not fighter_links:
                print("[WARN] Could not find any fighter links, trying alternative method")
                # Try another approach - look for tr with class="b-fight-details__table-row"
                rows = soup.find_all("tr", class_="b-fight-details__table-row")
                for row in rows:
                    links = row.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
                    for link in links:
                        fighter_url = link["href"].strip()
                        if fighter_url and fighter_url not in fighter_links:
                            fighter_links.append(fighter_url)
            
            print(f"[INFO] Found {len(fighter_links)} fighters in event")
            return fighter_links
            
        except requests.exceptions.Timeout as e:
            print(f"[WARN] Timeout extracting fighters, attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
        except Exception as e:
            print(f"[ERROR] Failed to extract fighters: {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                return []
    
    return []

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="UFC Stats Scraper")
    parser.add_argument('--mode', choices=['full', 'recent'], default='full',
                      help='Scraping mode: full (all fighters) or recent (fighters from recent events)')
    parser.add_argument('--events', type=int, default=2,
                      help='Number of recent events to process in recent mode (default: 2)')
    parser.add_argument('--upcoming', action='store_true',
                      help='In recent mode, fetch fighters from upcoming events instead of completed events')
    
    return parser.parse_args()

def fetch_upcoming_events(num_events=1, max_retries=3):
    """Fetch the most recent upcoming UFC events"""
    url = "http://ufcstats.com/statistics/events/upcoming"
    print(f"[INFO] Fetching upcoming events from {url}")
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(url, timeout=(5, 30))
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Find the table containing upcoming events
            table_container = soup.find("div", class_="b-statistics__table-wrap")
            if not table_container:
                print("[WARN] Could not find table container, trying alternative approach")
                events_table = soup.find("table")
            else:
                events_table = table_container.find("table")
                
            if not events_table:
                print("[ERROR] Could not find events table")
                # Try a more generic approach
                event_links = []
                all_links = soup.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                
                for link in all_links[:num_events]:
                    event_url = link["href"].strip()
                    event_name = link.get_text(strip=True)
                    date_text = ""
                    
                    # Look for a nearby date element
                    parent = link.parent
                    date_span = parent.find("span", class_="b-statistics__date")
                    if date_span:
                        date_text = date_span.get_text(strip=True)
                    
                    event_links.append({
                        "url": event_url,
                        "name": event_name,
                        "date": date_text
                    })
                
                if event_links:
                    print(f"[INFO] Found {len(event_links)} upcoming events using alternative method")
                    return event_links
                
                return []
            
            event_links = []
            rows = events_table.find_all("tr")[1:]  # Skip header row
            
            for row in rows:
                # Find the event link
                link_tag = row.find("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                if not link_tag:
                    continue
                
                event_url = link_tag["href"].strip()
                event_name = link_tag.get_text(strip=True)
                date_text = ""
                
                # Try to find the date
                date_cell = row.find("span", class_="b-statistics__date")
                if date_cell:
                    date_text = date_cell.get_text(strip=True)
                
                event_links.append({
                    "url": event_url,
                    "name": event_name,
                    "date": date_text
                })
                
                if len(event_links) >= num_events:
                    break
            
            print(f"[INFO] Found {len(event_links)} upcoming events")
            return event_links
            
        except requests.exceptions.Timeout as e:
            print(f"[WARN] Timeout fetching upcoming events, attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
        except Exception as e:
            print(f"[ERROR] Failed to fetch upcoming events: {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries:
                wait_time = 2 ** attempt
                print(f"[INFO] Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                return []
    
    return []

def update_recent_fighters(num_events=2, use_upcoming=False):
    """Update only fighters who competed in the most recent events or upcoming events"""
    event_type = "upcoming" if use_upcoming else "completed"
    print(f"[INFO] Running in recent fighters mode, checking last {num_events} {event_type} events")
    
    # Get recent events (completed or upcoming)
    if use_upcoming:
        recent_events = fetch_upcoming_events(num_events)
    else:
        recent_events = fetch_recent_events(num_events)
        
    if not recent_events:
        print(f"[ERROR] Could not find recent {event_type} events. Exiting.")
        return False
    
    # Display events being processed
    print("\n" + "="*50)
    print(f"Processing the following {len(recent_events)} {event_type} events:")
    for i, event in enumerate(recent_events, 1):
        print(f"{i}. {event['name']} - {event['date']}")
    print("="*50 + "\n")
    
    # Extract fighters from these events
    all_fighter_urls = []
    for event in recent_events:
        fighter_urls = extract_fighters_from_event(event["url"])
        all_fighter_urls.extend(fighter_urls)
    
    # Remove duplicates
    all_fighter_urls = list(set(all_fighter_urls))
    
    if not all_fighter_urls:
        print(f"[ERROR] Could not find any fighters in the recent {event_type} events. Exiting.")
        return False
    
    print(f"[INFO] Found {len(all_fighter_urls)} unique fighters across {len(recent_events)} {event_type} events")
    
    # Get existing fighters before starting the scrape
    existing_fighters = get_existing_fighters()
    
    # Process fighter details
    all_rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        print(f"[INFO] Starting to scrape details for {len(all_fighter_urls)} fighters...")
        
        detail_futs = {
            executor.submit(process_fighter, url): url
            for url in all_fighter_urls
        }
        
        total_fighters = len(all_fighter_urls)
        completed = 0
        
        for dfut in concurrent.futures.as_completed(detail_futs):
            row_data = dfut.result()
            all_rows.append(row_data)
            
            # Show progress
            completed += 1
            if completed % 5 == 0 or completed == total_fighters:
                progress = (completed / total_fighters) * 100
                print(f"[INFO] Progress: {completed}/{total_fighters} fighters ({progress:.1f}%)")

    print("[INFO] All fighter details scraped. Processing data...")
    
    df = pd.DataFrame(all_rows)
    
    # Extract first and last names for sorting
    df["first_name_temp"] = ""
    df["last_name_temp"] = ""
    for idx, row in df.iterrows():
        fname, lname = parse_fighter_name(row["fighter_name"])
        df.at[idx, "first_name_temp"] = fname
        df.at[idx, "last_name_temp"] = lname
    
    # Sort by last name, then first name
    df.sort_values(by=["last_name_temp", "first_name_temp"], inplace=True)
    df.drop(columns=["first_name_temp", "last_name_temp"], inplace=True)
    
    # Reset index to match row numbers in display
    df.reset_index(drop=True, inplace=True)

    # Ensure all expected columns exist
    columns = [
        "fighter_name", "Record",
        "Height", "Weight", "Reach", "STANCE", "DOB",
        "SLpM", "Str. Acc.", "SApM", "Str. Def",
        "TD Avg.", "TD Acc.", "TD Def.", "Sub. Avg.",
        "fighter_url"
    ]
    for c in columns:
        if c not in df.columns:
            df[c] = "N/A"
    df = df[columns]

    print(f"[INFO] Data processing complete. Updating database with {len(df)} fighters...")
    # Update database with smart diffing instead of replacing
    return update_fighter_database(df)

def main():
    # Create argument parser
    args = parse_args()
    
    # Check if we should only update recent fighters
    if args.mode == 'recent':
        return update_recent_fighters(num_events=args.events, use_upcoming=args.upcoming)
    
    # Otherwise run the full scrape
    # Get existing fighters before starting the scrape
    existing_fighters = get_existing_fighters()
    print(f"[INFO] Found {len(existing_fighters)} existing fighters in database")
    
    all_rows = []
    letters = list(string.ascii_lowercase)
    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        listing_futures = {
            executor.submit(fetch_listing_page, letter): letter
            for letter in letters
        }
        all_fighter_urls = []
        for future in concurrent.futures.as_completed(listing_futures):
            letter = listing_futures[future]
            listing_result = future.result()
            if not listing_result:
                continue
            _, html = listing_result
            if not html:
                continue
            fighter_urls = parse_listing_page(html)
            all_fighter_urls.extend(fighter_urls)
            print(f"[INFO] letter='{letter}' -> {len(fighter_urls)} fighters")
        
        # Remove duplicates
        all_fighter_urls = list(set(all_fighter_urls))
        print(f"[INFO] Total unique fighter URLs: {len(all_fighter_urls)}")
        
        # Process fighter details
        detail_futs = {
            executor.submit(process_fighter, url): url
            for url in all_fighter_urls
        }
        
        total_fighters = len(all_fighter_urls)
        completed = 0
        print(f"[INFO] Starting to scrape details for {total_fighters} fighters...")
        print("[INFO] This may take a while. Progress will be shown every 50 fighters.")
        
        for dfut in concurrent.futures.as_completed(detail_futs):
            row_data = dfut.result()
            all_rows.append(row_data)
            
            # Show progress
            completed += 1
            if completed % 50 == 0 or completed == total_fighters:
                progress = (completed / total_fighters) * 100
                print(f"[INFO] Progress: {completed}/{total_fighters} fighters ({progress:.1f}%)")

    print("[INFO] All fighter details scraped. Processing data...")

    df = pd.DataFrame(all_rows)
    
    # Extract first and last names for sorting
    df["first_name_temp"] = ""
    df["last_name_temp"] = ""
    for idx, row in df.iterrows():
        fname, lname = parse_fighter_name(row["fighter_name"])
        df.at[idx, "first_name_temp"] = fname
        df.at[idx, "last_name_temp"] = lname
    
    # Sort by last name, then first name
    df.sort_values(by=["last_name_temp", "first_name_temp"], inplace=True)
    df.drop(columns=["first_name_temp", "last_name_temp"], inplace=True)

    # Reset index to match row numbers in display
    df.reset_index(drop=True, inplace=True)

    # Ensure all expected columns exist
    columns = [
        "fighter_name", "Record",
        "Height", "Weight", "Reach", "STANCE", "DOB",
        "SLpM", "Str. Acc.", "SApM", "Str. Def",
        "TD Avg.", "TD Acc.", "TD Def.", "Sub. Avg.",
        "fighter_url"
    ]
    for c in columns:
        if c not in df.columns:
            df[c] = "N/A"
    df = df[columns]

    print(f"[INFO] Data processing complete. Updating database with {len(df)} fighters...")
    # Update database with smart diffing instead of replacing
    update_fighter_database(df)
    return True  # Return True to indicate successful completion

if __name__ == "__main__":
    main()