import os
import time
import random
import re
import logging
import argparse
from logging import FileHandler, Formatter
from datetime import datetime
from bs4 import BeautifulSoup
from difflib import SequenceMatcher
import requests
from dotenv import load_dotenv
import sys
from typing import List, Dict, Any, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Simple fix - add the project root to Python's path
sys.path.insert(0, '.')

# Load environment variables
load_dotenv()

# Now import from backend modules
from backend.constants import (
    LOG_LEVEL,
    LOG_FORMAT,
    LOG_DATE_FORMAT,
    REQUEST_HEADERS,
    REQUEST_TIMEOUT,
    RETRY_ATTEMPTS,
    RETRY_DELAY,
    MAX_FIGHTS_DISPLAY
)

# Import Supabase client 
from backend.api.database import (
    get_supabase_client,
    SimpleSupabaseClient,
    QueryBuilder
)

# Initialize Supabase client
supabase = get_supabase_client()

###############################################################################
# CONFIG
###############################################################################
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) 
LOG_PATH = os.path.join(BASE_DIR, "ufc_scraper.log")
HEADERS = {"User-Agent": "Mozilla/5.0"}
MAX_FIGHTS = 5
RETRY_ATTEMPTS = 3
RETRY_SLEEP = 2
REQUEST_TIMEOUT = 15
EVENT_URL = "http://ufcstats.com/statistics/events/completed"

# Thread-local storage for requests session
thread_local = threading.local()

def get_session():
    """Get a thread-local session"""
    if not hasattr(thread_local, "session"):
        thread_local.session = requests.Session()
        thread_local.session.headers.update(REQUEST_HEADERS)
    return thread_local.session

# Helper functions to maintain compatibility with old code
def get_fighters():
    """Get all fighters from the database."""
    try:
        response = supabase.table('fighters').select('*').execute()
        if not response or not response.data:
            logger.warning("No fighters found in database")
            return []
        return response.data
    except Exception as e:
        logger.error(f"Error getting fighters: {str(e)}")
        return []

def get_fighter(fighter_name: str):
    """Get fighter by name."""
    try:
        response = supabase.table('fighters').select('*').ilike('fighter_name', f"%{fighter_name}%").execute()
        if not response or not response.data:
            logger.warning(f"No fighter found with name containing: {fighter_name}")
            return None
        return response.data[0]
    except Exception as e:
        logger.error(f"Error getting fighter: {str(e)}")
        return None

def get_fighter_by_url(fighter_url: str):
    """Get fighter by URL."""
    try:
        response = supabase.table('fighters').select('*').eq('fighter_url', fighter_url).execute()
        if not response or not response.data:
            logger.warning(f"No fighter found with URL: {fighter_url}")
            return None
        return response.data[0]
    except Exception as e:
        logger.error(f"Error getting fighter by URL: {str(e)}")
        return None

def get_fighter_fights(fighter_name: str):
    """Get all fights for a fighter."""
    try:
        response = supabase.table('fights').select('*').eq('fighter_name', fighter_name).execute()
        if not response or not response.data:
            logger.warning(f"No fights found for fighter: {fighter_name}")
            return []
        return response.data
    except Exception as e:
        logger.error(f"Error getting fighter fights: {str(e)}")
        return []

def update_fighter_all_fights(fighter_name: str, fights: list):
    """Update all fights for a fighter."""
    try:
        # First delete existing fights
        delete_response = supabase.table('fights').delete().eq('fighter_name', fighter_name).execute()
        if not delete_response:
            logger.warning(f"Failed to delete existing fights for {fighter_name}")
            return False
            
        # Then insert new fights
        if fights:
            insert_response = supabase.table('fights').insert(fights).execute()
            if not insert_response:
                logger.warning(f"Failed to insert new fights for {fighter_name}")
                return False
            logger.info(f"Successfully updated {len(fights)} fights for {fighter_name}")
        return True
    except Exception as e:
        logger.error(f"Error updating fighter fights: {str(e)}")
        return False

def update_fighter_recent_fight(fighter_name: str, new_fight: dict):
    """Update the most recent fight for a fighter."""
    try:
        response = supabase.table('fights').upsert(new_fight).execute()
        if not response:
            logger.warning(f"Failed to update recent fight for {fighter_name}")
            return False
        logger.info(f"Successfully updated recent fight for {fighter_name}")
        return True
    except Exception as e:
        logger.error(f"Error updating recent fight: {str(e)}")
        return False

def insert_fighter_fight(fight_data: dict):
    """Insert a new fight into fighter_last_5_fights table."""
    try:
        response = supabase.table('fighter_last_5_fights').insert(fight_data).execute()
        if not response:
            logger.warning(f"Failed to insert fight: {fight_data.get('fighter_name', 'Unknown')}")
            return False
        logger.info(f"Successfully inserted fight for {fight_data.get('fighter_name', 'Unknown')}")
        return True
    except Exception as e:
        logger.error(f"Error inserting fight: {str(e)}")
        return False

def delete_fighter_fights(fighter_name: str):
    """Delete all fights for a fighter from fighter_last_5_fights table."""
    try:
        response = supabase.table('fighter_last_5_fights').delete().eq('fighter_name', fighter_name).execute()
        if not response:
            logger.warning(f"Failed to delete fights for {fighter_name}")
            return False
        logger.info(f"Successfully deleted fights for {fighter_name}")
        return True
    except Exception as e:
        logger.error(f"Error deleting fighter fights: {str(e)}")
        return False

def truncate_table(table_name: str):
    """Truncate a table."""
    try:
        response = supabase.table(table_name).delete().neq('id', 0).execute()
        if not response:
            logger.warning(f"Failed to truncate table: {table_name}")
            return False
        logger.info(f"Successfully truncated table: {table_name}")
        return True
    except Exception as e:
        logger.error(f"Error truncating table: {str(e)}")
        return False

###############################################################################
# LOGGING
###############################################################################
logger = logging.getLogger()
while logger.handlers:
    logger.removeHandler(logger.handlers[0])

LOG_PATH = os.path.join(os.path.dirname(__file__), "ufc_scraper.log")
file_handler = FileHandler(LOG_PATH, mode="a", encoding="utf-8")
formatter = Formatter(LOG_FORMAT)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)
logger.setLevel(getattr(logging, LOG_LEVEL))

# Also add a console handler for better visibility during execution
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

logger.info("UFC Last 5 Fights Scraper - Supabase Edition")

###############################################################################
# PERSISTENT SESSION
###############################################################################
session = requests.Session()
session.headers.update(REQUEST_HEADERS)

###############################################################################
# 1) RECREATE TABLE with AUTOINCREMENT and reordered columns
###############################################################################
def reset_sequence():
    """Reset the ID sequence for fighter_last_5_fights table to start at 1."""
    try:
        supabase.rpc('reset_sequence', {'table_name': 'fighter_last_5_fights'}).execute()
        logger.info("Reset sequence for 'fighter_last_5_fights' table to start at 1")
    except Exception as e:
        logger.error(f"Error resetting sequence: {e}")

def recreate_last5_table(mode: str = 'all') -> bool:
    """Recreate the fighter_last_5_fights table"""
    try:
        supabase = get_supabase_client()
        if not supabase:
            logger.error("Failed to get Supabase client")
            return False

        if mode == 'all':
            logger.info("Clearing all records from fighter_last_5_fights table")
            
            # First delete all records using a proper WHERE clause
            try:
                # Delete all records where id is greater than or equal to 0 (matches all records)
                response = supabase.table('fighter_last_5_fights').delete().gte('id', 0).execute()
                if not response.data and response.data != []:
                    logger.error("Failed to delete all fights")
                    return False
                logger.info("Successfully deleted all records")
            except Exception as e:
                logger.error(f"Error deleting records: {e}")
                return False
            
            # Reset the sequence using direct SQL
            try:
                # Use raw SQL to reset the sequence
                sql = "ALTER SEQUENCE fighter_last_5_fights_id_seq RESTART WITH 1"
                response = supabase.table('fighter_last_5_fights').select("*").execute({"raw_sql": sql})
                logger.info("Successfully reset sequence using direct SQL")
            except Exception as e:
                logger.error(f"Error resetting sequence: {e}")
                # Even if sequence reset fails, we can continue since IDs will still be unique
            
            # Verify the table is empty
            try:
                response = supabase.table('fighter_last_5_fights').select('count').execute()
                if response.data and response.data[0]['count'] > 0:
                    logger.warning(f"Table still contains {response.data[0]['count']} records after deletion")
                    # Try one more time with a different delete approach
                    supabase.table('fighter_last_5_fights').delete().gte('id', 0).execute()
                else:
                    logger.info("Verified table is empty")
            except Exception as e:
                logger.error(f"Error verifying table is empty: {e}")
                return False
            
        return True
    except Exception as e:
        logger.error(f"Error recreating table: {e}")
        return False

###############################################################################
# 2) FETCH FIGHTERS
###############################################################################
def get_fighters_in_db_order():
    """
    Return list of (fighter_name, fighter_url) from 'fighters' table, in id order.
    """
    try:
        all_fighters = []
        page_size = 1000
        current_page = 0
        total_retrieved = 0
        
        while True:
            start = current_page * page_size
            logger.info(f"Fetching fighters page {current_page + 1} (offset: {start})")
            
            # Get fighters from Supabase, ordered by id, with pagination
            response = supabase.table("fighters") \
                .select("fighter_name, fighter_url") \
                .order("id") \
                .range(start, start + page_size - 1) \
                .execute()
            
            if not response.data or len(response.data) == 0:
                break
                
            batch_size = len(response.data)
            all_fighters.extend([(row["fighter_name"], row["fighter_url"]) for row in response.data])
            total_retrieved += batch_size
            
            logger.info(f"Retrieved {batch_size} fighters in this batch (total: {total_retrieved})")
            
            if batch_size < page_size:
                break
                
            current_page += 1
            
        logger.info(f"Retrieved {len(all_fighters)} fighters total")
        return all_fighters
    except Exception as e:
        logger.error(f"Error getting fighters from Supabase: {e}")
        raise  # Re-raise the exception since we're fully committed to Supabase

###############################################################################
# 3) HTTP GET with RETRIES
###############################################################################
def fetch_url_quietly(url: str):
    for attempt in range(1, RETRY_ATTEMPTS + 1):
        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp
        except Exception:
            time.sleep(RETRY_SLEEP)
    return None

###############################################################################
# 4) GATHER ALL FIGHTS, THEN TAKE THE MOST RECENT 5
###############################################################################
def parse_date_from_row(text: str) -> str:
    date_regex = re.compile(r"[A-Z][a-z]{2}\.?\.?\s*\d{1,2},\s*\d{4}")
    match = date_regex.search(text)
    return match.group().strip() if match else ""

def get_fight_links_top5(fighter_url: str) -> list:
    """
    Gather all fights from the table, parse their date, ignore future fights,
    sort them by date descending, then return the 5 most recent as a list of:
      [(fight_date_str, fight_url), ...]
    """
    logger.info(f"Getting fight links for {fighter_url}")
    resp = fetch_url_quietly(fighter_url)
    if not resp:
        logger.error(f"Failed to fetch URL: {fighter_url}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", class_="b-fight-details__table")
    if not table:
        logger.warning(f"No fight table found at {fighter_url}")
        return []

    tbody = table.find("tbody", class_="b-fight-details__table-body")
    if not tbody:
        logger.warning(f"No tbody found in fight table at {fighter_url}")
        return []

    rows = tbody.find_all("tr", class_="b-fight-details__table-row")
    logger.info(f"Found {len(rows)} fight rows for fighter")
    all_fights = []

    for row in rows:
        link = ""
        data_link = row.get("data-link", "").strip()
        if data_link:
            link = data_link
        else:
            onclick_val = row.get("onclick", "").strip()
            if "doNav(" in onclick_val:
                start = onclick_val.find("doNav('") + len("doNav('")
                end = onclick_val.find("')", start)
                link = onclick_val[start:end].strip()
        if not link:
            continue

        row_text = row.get_text(" ", strip=True)
        row_date_str = parse_date_from_row(row_text)
        if not row_date_str:
            continue

        try:
            # Handle both date formats with and without a period
            date_format = "%b. %d, %Y" if "." in row_date_str else "%b %d, %Y"
            fight_date_obj = datetime.strptime(row_date_str, date_format)
            
            # Log the parsed date for debugging
            logger.info(f"Parsed fight date: {row_date_str} -> {fight_date_obj.strftime('%Y-%m-%d')}")
            
            # Allow fights dated in the future (since many events are predated)
            # but not more than a year in the future
            one_year_from_now = datetime.now().replace(year=datetime.now().year + 1)
            if fight_date_obj > one_year_from_now:
                logger.warning(f"Skipping future fight dated {row_date_str} (more than a year in the future)")
                continue
        except Exception as e:
            logger.warning(f"Error parsing date {row_date_str}: {e}")
            continue

        all_fights.append((fight_date_obj, row_date_str, link))

    # Add detailed logging about all fights found
    logger.info(f"Found {len(all_fights)} valid fights for fighter")
    for date_obj, date_str, link in all_fights:
        logger.info(f"Fight: {date_str} ({date_obj.strftime('%Y-%m-%d')}) - {link}")

    # Sort by date (newest first)
    all_fights.sort(key=lambda x: x[0], reverse=True)
    
    # Log the sorted results
    logger.info("Sorted fights (newest first):")
    for date_obj, date_str, link in all_fights:
        logger.info(f"  {date_str} ({date_obj.strftime('%Y-%m-%d')}) - {link}")
    
    top_5 = all_fights[:MAX_FIGHTS]
    date_links = [(item[1], item[2]) for item in top_5]
    logger.info(f"Returning {len(date_links)} fight links after processing")
    
    # Log the final selected fights
    for date_str, link in date_links:
        logger.info(f"Selected fight: {date_str} - {link}")
        
    return date_links

###############################################################################
# 5) FUZZY MATCH HELPERS
###############################################################################
def basic_clean(s: str) -> str:
    return re.sub(r'["\'].*?["\']', '', s).lower().strip()

def fuzzy_ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()

def substring_or_fuzzy(db_name: str, site_name: str) -> float:
    c_db = basic_clean(db_name)
    c_site = basic_clean(site_name)
    if c_db in c_site or c_site in c_db:
        return 1.0
    return fuzzy_ratio(c_db, c_site)

def best_fighter_index(p_texts: list, db_fighter_name: str) -> tuple:
    best_i = None
    best_r = -1.0
    for i, txt in enumerate(p_texts):
        r = substring_or_fuzzy(db_fighter_name, txt)
        if r > best_r:
            best_r = r
            best_i = i
    return best_i, best_r

###############################################################################
# 6) SCRAPE SINGLE TOTALS or SUM ROUND-BY-ROUND
###############################################################################
def scrape_single_totals(soup: BeautifulSoup, db_fighter_name: str) -> dict:
    """Scrape totals from the fight page tables."""
    try:
        # Find the totals table
        tables = soup.select("table.b-fight-details__table")
        for table in tables:
            # Check if this is the totals table by looking at the header
            header = table.select_one("thead")
            if not header or not any("Totals" in th.get_text() for th in header.select("th")):
                continue

            tbody = table.find("tbody", class_="b-fight-details__table-body")
            if not tbody:
                continue

            rows = tbody.find_all("tr", class_="b-fight-details__table-row")
            if len(rows) != 1:  # Totals table should have exactly one row
                continue

            row = rows[0]
            cols = row.find_all("td", class_="b-fight-details__table-col")
            if len(cols) < 10:  # Need at least 10 columns for all stats
                continue

            # Find which fighter we're looking at (first or second in the row)
            p_tags = cols[0].find_all("p", class_="b-fight-details__table-text")
            if len(p_tags) != 2:
                continue

            texts = [p.get_text(strip=True) for p in p_tags]
            idx, ratio = best_fighter_index(texts, db_fighter_name)
            if ratio < 0.3:
                continue

            # Helper function to get clean text from a column
            def get_col(ci: int) -> str:
                ps = cols[ci].find_all("p", class_="b-fight-details__table-text")
                return ps[idx].get_text(strip=True) if len(ps) > idx else "0"

            # Extract all stats
            kd = get_col(1)
            sig_str = get_col(2)
            sig_landed, sig_attempted = parse_of(sig_str)
            sig_pct = f"{round((sig_landed / sig_attempted) * 100)}%" if sig_attempted > 0 else "0%"
            
            total_str = get_col(4)
            takedowns = get_col(5)
            td_pct = get_col(6)
            if not td_pct.endswith("%"):
                td_landed, td_attempted = parse_of(takedowns)
                td_pct = f"{round((td_landed / td_attempted) * 100)}%" if td_attempted > 0 else "0%"
            
            ctrl_time = get_col(9)
            if ctrl_time == "--":
                ctrl_time = "0:00"

            # Get strike locations from the significant strikes table
            strike_details = scrape_strike_details(soup, db_fighter_name)

            return {
                "kd": kd,
                "sig_str": sig_str,
                "sig_str_pct": sig_pct,
                "total_str": total_str,
                "takedowns": takedowns,
                "td_pct": td_pct,
                "ctrl": ctrl_time,
                "head_str": strike_details.get("head_str", "0 of 0"),
                "body_str": strike_details.get("body_str", "0 of 0"),
                "leg_str": strike_details.get("leg_str", "0 of 0")
            }

        return None

    except Exception as e:
        logger.error(f"Error in scrape_single_totals: {e}")
        return None

def scrape_strike_details(soup: BeautifulSoup, db_fighter_name: str) -> dict:
    """Scrape head, body, and leg strikes from the significant strikes table."""
    head_landed, head_attempted = 0, 0
    body_landed, body_attempted = 0, 0
    leg_landed, leg_attempted = 0, 0
    matched_rows = 0

    tables = soup.select("table.b-fight-details__table")
    for tbl in tables:
        headers = [th.get_text(strip=True).lower() for th in tbl.select("thead th")]
        if "head" in headers and "body" in headers and "leg" in headers:
            tbody = tbl.find("tbody", class_="b-fight-details__table-body")
            if not tbody:
                continue
            rows = tbody.find_all("tr", class_="b-fight-details__table-row")
            for row in rows:
                cols = row.find_all("td", class_="b-fight-details__table-col")
                if len(cols) < 6:
                    continue
                p_tags = cols[0].find_all("p", class_="b-fight-details__table-text")
                if len(p_tags) != 2:
                    continue

                texts = [p.get_text(strip=True) for p in p_tags]
                idx, ratio = best_fighter_index(texts, db_fighter_name)
                if ratio < 0.3:
                    continue

                matched_rows += 1
                head_txt = safe_text(cols[3], idx)
                body_txt = safe_text(cols[4], idx)
                leg_txt = safe_text(cols[5], idx)
                hl, ha = parse_of(head_txt)
                bl, ba = parse_of(body_txt)
                ll, la = parse_of(leg_txt)
                head_landed += hl
                head_attempted += ha
                body_landed += bl
                body_attempted += ba
                leg_landed += ll
                leg_attempted += la

    if matched_rows == 0:
        return {"head_str": "0 of 0", "body_str": "0 of 0", "leg_str": "0 of 0"}

    head_str = f"{head_landed} of {head_attempted}" if head_attempted > 0 else "0 of 0"
    body_str = f"{body_landed} of {body_attempted}" if body_attempted > 0 else "0 of 0"
    leg_str = f"{leg_landed} of {leg_attempted}" if leg_attempted > 0 else "0 of 0"

    return {
        "head_str": head_str,
        "body_str": body_str,
        "leg_str": leg_str
    }

def scrape_sum_rounds(soup: BeautifulSoup, db_fighter_name: str) -> dict:
    """Fallback: Sum stats across round-by-round tables."""
    kd_sum = 0
    sig_x, sig_y = 0, 0
    tot_x, tot_y = 0, 0
    td_x, td_y = 0, 0
    td_pct_vals = []
    ctrl_sec = 0
    head_x, head_y = 0, 0
    body_x, body_y = 0, 0
    leg_x, leg_y = 0, 0
    matched_rows = 0

    tables = soup.select("table.b-fight-details__table")
    for tbl in tables:
        thead = tbl.find("thead", class_="b-fight-details__table-head_rnd")
        if not thead:
            continue
        tbody = tbl.find("tbody", class_="b-fight-details__table-body")
        if not tbody:
            continue
        rows = tbody.find_all("tr", class_="b-fight-details__table-row")
        for row in rows:
            cols = row.find_all("td", class_="b-fight-details__table-col")
            if len(cols) < 10:
                continue
            p_tags = cols[0].find_all("p", class_="b-fight-details__table-text")
            if len(p_tags) != 2:
                continue

            texts = [p.get_text(strip=True) for p in p_tags]
            idx, ratio = best_fighter_index(texts, db_fighter_name)
            if ratio < 0.3:
                continue

            matched_rows += 1
            kd_sum += safe_int(cols[1], idx)
            s_txt = safe_text(cols[2], idx)
            sx, sy = parse_of(s_txt)
            sig_x += sx
            sig_y += sy
            t_txt = safe_text(cols[4], idx)
            tx, ty = parse_of(t_txt)
            tot_x += tx
            tot_y += ty
            td_txt = safe_text(cols[5], idx)
            tdx, tdy = parse_of(td_txt)
            td_x += tdx
            td_y += tdy
            td_pct_txt = safe_text(cols[6], idx)
            if td_pct_txt.endswith("%"):
                try:
                    td_pct_vals.append(float(td_pct_txt[:-1]))
                except:
                    pass
            c_txt = safe_text(cols[9], idx)
            ctrl_sec += mmss_to_seconds(c_txt)

            if len(cols) >= 13:  # Check for strike details in round-by-round
                h_txt = safe_text(cols[10], idx)
                b_txt = safe_text(cols[11], idx)
                l_txt = safe_text(cols[12], idx)
                hx, hy = parse_of(h_txt)
                bx, by = parse_of(b_txt)
                lx, ly = parse_of(l_txt)
                head_x += hx
                head_y += hy
                body_x += bx
                body_y += by
                leg_x += lx
                leg_y += ly

    if matched_rows == 0:
        return None

    kd_str = str(kd_sum)
    sig_str_str = f"{sig_x} of {sig_y}" if sig_y > 0 else "0 of 0"
    sig_str_pct_str = f"{round((sig_x / sig_y) * 100)}%" if sig_y > 0 else "0%"
    tot_str_str = f"{tot_x} of {tot_y}" if tot_y > 0 else "0 of 0"
    td_str = f"{td_x} of {td_y}" if td_y > 0 else "0 of 0"
    td_pct_str = f"{(sum(td_pct_vals) / len(td_pct_vals)):.0f}%" if td_pct_vals else "0%"
    ctrl_str = seconds_to_mmss(ctrl_sec)
    head_str_str = f"{head_x} of {head_y}" if head_y > 0 else "0 of 0"
    body_str_str = f"{body_x} of {body_y}" if body_y > 0 else "0 of 0"
    leg_str_str = f"{leg_x} of {leg_y}" if leg_y > 0 else "0 of 0"

    return {
        "kd": kd_str,
        "sig_str": sig_str_str,
        "sig_str_pct": sig_str_pct_str,
        "total_str": tot_str_str,
        "head_str": head_str_str,
        "body_str": body_str_str,
        "leg_str": leg_str_str,
        "takedowns": td_str,
        "td_pct": td_pct_str,
        "ctrl": ctrl_str
    }

def safe_int(col, idx: int) -> int:
    p_tags = col.find_all("p", class_="b-fight-details__table-text")
    if len(p_tags) > idx:
        try:
            return int(p_tags[idx].get_text(strip=True))
        except:
            return 0
    return 0

def safe_text(col, idx: int) -> str:
    p_tags = col.find_all("p", class_="b-fight-details__table-text")
    if len(p_tags) > idx:
        return p_tags[idx].get_text(strip=True)
    return "0"

def parse_of(txt: str) -> tuple:
    try:
        parts = txt.lower().split("of")
        x = int(parts[0].strip())
        y = int(parts[1].strip())
        return (x, y)
    except:
        return (0, 0)

def mmss_to_seconds(txt: str) -> int:
    try:
        mm, ss = txt.split(":")
        return int(mm) * 60 + int(ss)
    except:
        return 0

def seconds_to_mmss(sec: int) -> str:
    m = sec // 60
    s = sec % 60
    return f"{m}:{s:02d}"

###############################################################################
# 7) PARSE RESULT, DATE, OPPONENT, EVENT, AND METHOD FROM FIGHT PAGE
###############################################################################
def parse_result_and_date(soup, fight_date_fallback=None, fighter_name=None):
    # Extract event name
    event_div = soup.select_one("h2.b-content__title")
    event = event_div.select_one("a").text.strip() if event_div else "N/A"
    logging.info(f"Extracted event: {event}")

    # Extract fighter names
    fighter_divs = soup.select("div.b-fight-details__person")
    if len(fighter_divs) >= 2:
        fighter1 = fighter_divs[0].select_one("h3.b-fight-details__person-name a").text.strip()
        fighter2 = fighter_divs[1].select_one("h3.b-fight-details__person-name a").text.strip()
        logging.info(f"Found fighters: {fighter1} vs {fighter2}")

        # Determine which fighter is ours using exact string matching first
        if fighter_name == fighter1:
            our_fighter_index = 0
            opponent_name = fighter2
        elif fighter_name == fighter2:
            our_fighter_index = 1
            opponent_name = fighter1
        else:
            # Fallback to fuzzy matching if needed
            ratio1 = fuzzy_ratio(basic_clean(fighter_name), basic_clean(fighter1))
            ratio2 = fuzzy_ratio(basic_clean(fighter_name), basic_clean(fighter2))
            if max(ratio1, ratio2) > 0.7:
                our_fighter_index = 0 if ratio1 > ratio2 else 1
                opponent_name = fighter2 if our_fighter_index == 0 else fighter1
            else:
                logging.warning(f"Could not match fighter name: {fighter_name} vs {fighter1} ({ratio1}) or {fighter2} ({ratio2})")
                return None
    else:
        logging.error("Could not find both fighters")
        return None

    # Extract result
    result = "N/A"
    i_status = fighter_divs[our_fighter_index].select_one("i.b-fight-details__person-status")
    if i_status:
        status_text = i_status.get_text(strip=True).upper()
        if "W" in status_text:
            result = "W"
        elif "L" in status_text:
            result = "L"
        elif "D" in status_text or "DRAW" in status_text:
            result = "D"
        elif "NC" in status_text or "NO CONTEST" in status_text:
            result = "NC"
        elif "DQ" in status_text or "DISQUALIFICATION" in status_text:
            result = "DQ"
        else:
            result = status_text

    # Extract method, round, and time from the fight details section
    method = "N/A"
    round_num = "N/A"
    time = "N/A"
    
    # Find the fight details section
    fight_details = soup.select_one("div.b-fight-details__content")
    if fight_details:
        # Extract method
        method_text = fight_details.select_one("p.b-fight-details__text")
        if method_text:
            method_str = method_text.get_text(strip=True)
            if "Method:" in method_str:
                # Split on "Method:" and take the first part before any other details
                method = method_str.split("Method:")[1].strip()
                # Remove any additional details in parentheses or after other keywords
                method = method.split("(")[0].strip()
                method = method.split("Round:")[0].strip()
                method = method.split("Time:")[0].strip()
                method = method.split("Time format:")[0].strip()
        
        # Extract round and time
        text_items = fight_details.select("i.b-fight-details__text-item")
        for item in text_items:
            text = item.get_text(strip=True)
            if "Round:" in text:
                round_num = text.split("Round:")[1].strip()
            elif "Time:" in text:
                time = text.split("Time:")[1].strip()

    # Extract date
    fight_date = "N/A"
    date_div = soup.select_one("div.b-fight-details__text-item")
    if date_div:
        date_text = date_div.text.strip()
        # Extract date using regex
        date_match = re.search(r'Date:\s+([A-Za-z]+\.\s+\d{1,2},\s+\d{4})', date_text)
        if date_match:
            fight_date = date_match.group(1)
    
    if fight_date == "N/A" and fight_date_fallback:
        logging.info(f"Using fallback fight date: {fight_date_fallback}")
        fight_date = fight_date_fallback

    logging.info("Final parsed values:")
    logging.info(f"Result: {result}")
    logging.info(f"Date: {fight_date}")
    logging.info(f"Opponent: {opponent_name}")
    logging.info(f"Event: {event}")
    logging.info(f"Method: {method}")
    logging.info(f"Round: {round_num}")
    logging.info(f"Time: {time}")

    return {
        'result': result,
        'fight_date': fight_date,
        'opponent': opponent_name,
        'event': event,
        'method': method,
        'round': round_num,
        'time': time
    }

###############################################################################
# 8) SCRAPE FIGHT PAGE (with fallback date)
###############################################################################
def scrape_fight_page_for_fighter(fight_url: str, fighter_name: str, fallback_date: str = None) -> dict:
    """Scrape a single fight page for a fighter's details."""
    data = {
        "result": "N/A",
        "fight_date": "N/A",
        "opponent": "N/A",
        "event": "N/A",
        "method": "N/A",
        "round": "0",
        "time": "0:00",
        "kd": "0",
        "sig_str": "0 of 0",
        "sig_str_pct": "0%",
        "total_str": "0 of 0",
        "takedowns": "0 of 0",
        "td_pct": "0%",
        "head_str": "0 of 0",
        "body_str": "0 of 0",
        "leg_str": "0 of 0",
        "ctrl": "0:00"
    }

    try:
        resp = requests.get(fight_url)
        if resp.status_code != 200:
            logger.error(f"Failed to get fight page {fight_url}: {resp.status_code}")
            return data

        soup = BeautifulSoup(resp.text, "html.parser")
        
        # Get basic fight info (result, date, opponent, event, method, round, time)
        parsed_data = parse_result_and_date(soup, fallback_date, fighter_name)
        if parsed_data:
            data.update(parsed_data)
        else:
            logger.error(f"Failed to parse fight data from {fight_url}")
            return data

        # First try to get stats from totals table
        totals = scrape_single_totals(soup, fighter_name)
        if totals:
            data.update(totals)
            logger.info("Successfully extracted stats from totals table")
        else:
            # Fallback to summing round-by-round stats
            summed_stats = scrape_sum_rounds(soup, fighter_name)
            if summed_stats:
                data.update(summed_stats)
                logger.info("Successfully extracted stats from round-by-round table")
            else:
                logger.warning("Failed to extract fight statistics")

        # Get strike details (head/body/leg) separately
        strike_details = scrape_strike_details(soup, fighter_name)
        if strike_details:
            data.update(strike_details)
            logger.info("Successfully extracted strike location details")

        # Log all extracted stats
        logger.info("Extracted fight statistics:")
        logger.info(f"KD: {data['kd']}")
        logger.info(f"Sig Strikes: {data['sig_str']} ({data['sig_str_pct']})")
        logger.info(f"Total Strikes: {data['total_str']}")
        logger.info(f"Takedowns: {data['takedowns']} ({data['td_pct']})")
        logger.info(f"Control Time: {data['ctrl']}")
        logger.info(f"Head Strikes: {data['head_str']}")
        logger.info(f"Body Strikes: {data['body_str']}")
        logger.info(f"Leg Strikes: {data['leg_str']}")

        return data

    except Exception as e:
        logger.error(f"Error scraping fight page {fight_url}: {e}")
        return data

###############################################################################
# 9) STORE FIGHT DATA (Manual check for duplicates)
###############################################################################
def store_fight_data(fighter_name: str, fight_url: str, fallback_date: str) -> bool:
    """Store fight data in the database"""
    try:
        # Get fight details
        fight_details = scrape_fight_page_for_fighter(fight_url, fighter_name, fallback_date)
        if not fight_details:
            logger.error(f"Failed to get fight details for {fighter_name} from {fight_url}")
            return False

        # Add required fields that were missing
        fight_details['fighter_name'] = fighter_name
        fight_details['fight_url'] = fight_url

        # Validate all required fields are present and not None
        required_fields = [
            'fighter_name', 'fight_url', 'result', 'fight_date', 'opponent', 
            'event', 'method', 'round', 'time', 'kd', 'sig_str', 'sig_str_pct',
            'total_str', 'takedowns', 'td_pct', 'ctrl', 'head_str', 'body_str', 'leg_str'
        ]

        # Ensure all fields have at least default values
        default_values = {
            'kd': '0',
            'sig_str': '0 of 0',
            'sig_str_pct': '0%',
            'total_str': '0 of 0',
            'takedowns': '0 of 0',
            'td_pct': '0%',
            'ctrl': '0:00',
            'head_str': '0 of 0',
            'body_str': '0 of 0',
            'leg_str': '0 of 0',
            'round': '0',
            'time': '0:00',
            'result': 'N/A',
            'method': 'N/A',
            'opponent': 'N/A',
            'event': 'N/A'
        }

        # Fill in any missing fields with defaults
        for field, default in default_values.items():
            if field not in fight_details or fight_details[field] is None or fight_details[field] == '':
                fight_details[field] = default
                logger.warning(f"Using default value for {field}: {default}")

        # Validate all required fields are present
        missing_fields = [field for field in required_fields if field not in fight_details or fight_details[field] is None]
        if missing_fields:
            logger.error(f"Missing required fields for {fighter_name}: {missing_fields}")
            return False

        # Log the final data being inserted
        logger.info(f"Inserting fight data for {fighter_name}:")
        for key, value in fight_details.items():
            logger.info(f"  {key}: {value}")

        # Insert the fight data
        response = supabase.table('fighter_last_5_fights').insert(fight_details).execute()
        if not response.data:
            logger.error(f"Failed to insert fight for {fighter_name}")
            return False

        logger.info(f"Successfully inserted fight for {fighter_name}")
        return True

    except Exception as e:
        logger.error(f"Error storing fight data: {e}")
        return False

###############################################################################
# RECENT EVENT FUNCTIONS
###############################################################################
def fetch_most_recent_event(max_retries=RETRY_ATTEMPTS):
    """
    Fetch the most recent completed UFC event.
    Returns a tuple of (event_url, event_name, event_date) or None if failed.
    """
    logger.info(f"Fetching most recent event from {EVENT_URL}")
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            session = requests.Session()
            session.headers.update(HEADERS)
            resp = session.get(EVENT_URL, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Look for the events table - first completed events should be at the top
            event_tables = soup.find_all("table", class_="b-statistics__table")
            if not event_tables:
                logger.warning("Could not find main event table, trying alternative approach")
                event_tables = soup.find_all("table")
            
            if not event_tables:
                logger.error("Could not find any tables on the page")
                return None
            
            recent_events = []
            
            # Process each table to find recent events
            for table in event_tables:
                rows = table.find_all("tr")[1:]  # Skip header row
                
                for row in rows:
                    # Skip header rows
                    if "b-statistics__table-row_type_first" in row.get("class", []) or not row.find_all("td"):
                        continue
                    
                    # Find the event link
                    links = row.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                    if not links:
                        continue
                    
                    event_url = links[0]["href"].strip()
                    event_name = links[0].get_text(strip=True)
                    
                    # Try to find the date
                    date_span = row.find("span", class_="b-statistics__date")
                    if not date_span:
                        # Try other ways to find date
                        date_cell = row.find_all("td")
                        if len(date_cell) > 1:  # Usually second cell has the date
                            date_text = date_cell[1].get_text(strip=True)
                            if re.search(r'\d{4}', date_text):  # If it contains a year
                                event_date = date_text
                            else:
                                continue  # Skip if no valid date found
                        else:
                            continue  # Skip if no date cell found
                    else:
                        event_date = date_span.get_text(strip=True)
                    
                    # Skip future events
                    try:
                        # Parse the date to check if it's in the future
                        date_parts = event_date.split()
                        if len(date_parts) >= 3:
                            month_str = date_parts[0].rstrip('.')
                            month_map = {
                                'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4,
                                'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8,
                                'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
                            }
                            month = month_map.get(month_str, 1)
                            
                            day = int(date_parts[1].rstrip(',').strip())
                            year = int(date_parts[2])
                            
                            event_date_obj = datetime(year, month, day)
                            now = datetime.now()
                            
                            # Skip future events
                            if event_date_obj > now:
                                logger.info(f"Skipping future event: {event_name} - {event_date}")
                                continue
                                
                            # Add this to our candidates
                            recent_events.append((event_url, event_name, event_date, event_date_obj))
                    except Exception as e:
                        logger.warning(f"Error parsing event date '{event_date}': {e}")
                        # Still add it as a candidate with a default old date
                        recent_events.append((event_url, event_name, event_date, datetime(2000, 1, 1)))
            
            # Sort events by date (newest first)
            if recent_events:
                recent_events.sort(key=lambda x: x[3], reverse=True)
                most_recent = recent_events[0]
                logger.info(f"Found most recent event: {most_recent[1]} - {most_recent[2]}")
                return (most_recent[0], most_recent[1], most_recent[2])
            
            logger.error("No recent events found after processing all tables")
            return None
                    
        except Exception as e:
            logger.error(f"Error fetching recent event (attempt {attempt}/{max_retries}): {e}")
            if attempt < max_retries:
                time.sleep(RETRY_SLEEP)
    
    logger.error(f"Failed to fetch recent event after {max_retries} attempts")
    return None

def extract_fighters_from_event(event_url, max_retries=RETRY_ATTEMPTS):
    """
    Extract all fighters from an event page.
    Returns a list of tuples (fighter_name, fighter_url).
    """
    logger.info(f"Extracting fighters from event: {event_url}")
    
    fighters = []
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(event_url, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Find all table rows containing fighter details
            fight_tables = soup.find_all("tbody", class_="b-fight-details__table-body")
            
            if not fight_tables:
                logger.warning("Could not find fight tables, trying alternative approach")
                # Try to find any tables
                tables = soup.find_all("table")
                fight_tables = [table.find("tbody") for table in tables if table.find("tbody")]
            
            if not fight_tables:
                # Try directly finding the fighter links
                fighter_links = soup.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
                for link in fighter_links:
                    fighter_url = link["href"].strip()
                    fighter_name = link.get_text(strip=True)
                    if fighter_name and fighter_url and (fighter_name, fighter_url) not in fighters:
                        fighters.append((fighter_name, fighter_url))
                
                if fighters:
                    logger.info(f"Found {len(fighters)} fighters using direct link approach")
                    return fighters
                else:
                    logger.error("Could not find any fighter information")
                    return []
            
            # Process each fight table
            for tbody in fight_tables:
                rows = tbody.find_all("tr")
                
                for row in rows:
                    # Find all fighter links in this row
                    fighter_links = row.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
                    
                    for link in fighter_links:
                        fighter_url = link["href"].strip()
                        fighter_name = link.get_text(strip=True)
                        if fighter_name and fighter_url and (fighter_name, fighter_url) not in fighters:
                            fighters.append((fighter_name, fighter_url))
            
            logger.info(f"Found {len(fighters)} fighters")
            return fighters
            
        except requests.exceptions.Timeout as e:
            logger.warning(f"Timeout extracting fighters, attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                time.sleep(wait_time)
        except Exception as e:
            logger.error(f"Failed to extract fighters: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                time.sleep(wait_time)
            else:
                return []
    
    return []

def get_fighter_latest_fights(fighter_url, fighter_name, max_fights=MAX_FIGHTS, recent_only=False):
    """
    Gets either all 5 fights or just the most recent fight from the fighter's page.
    recent_only: If True, returns only the most recent fight. If False, returns up to max_fights.
    """
    logger.info(f"Getting {'most recent fight' if recent_only else 'last 5 fights'} for {fighter_name} from {fighter_url}")
    
    fight_info = get_fight_links_top5(fighter_url)
    if not fight_info or len(fight_info) == 0:
        logger.warning(f"No fights found for {fighter_name}")
        return []
    
    # For recent mode, only take the first (most recent) fight
    if recent_only:
        fight_info = fight_info[:1]
    
    # Get fights (either just most recent or all 5)
    fight_data_list = []
    for date_str, link in fight_info:
        # Scrape each fight's data
        row_data = scrape_fight_page_for_fighter(link, fighter_name, date_str)
        logger.info(f"Retrieved fight data: {row_data.get('event')} vs {row_data.get('opponent')}")
        fight_data_list.append(row_data)
        
    return fight_data_list

def update_fighter_latest_fight(fighter_name, fighter_url, recent_only=False):
    """Get and store either all 5 or just most recent fight for a fighter"""
    try:
        if recent_only:
            logger.info(f"Updating most recent fight for {fighter_name}")
            
            # First get their existing fights from the database
            existing_fights = []
            response = supabase.table('fighter_last_5_fights').select('*').eq('fighter_name', fighter_name).execute()
            if response.data:
                existing_fights = response.data
            logger.info(f"Found {len(existing_fights)} existing fights for {fighter_name}")
            
            # Get just their most recent fight
            new_fights = get_fighter_latest_fights(fighter_url, fighter_name, recent_only=True)
            if not new_fights:
                logger.warning(f"No new fights found for {fighter_name}")
                return False
            
            # Sort existing fights by date (newest first)
            existing_fights.sort(key=lambda x: datetime.strptime(x['fight_date'], '%b. %d, %Y' if '.' in x['fight_date'] else '%b %d, %Y'), reverse=True)
            
            # Combine new fight with existing fights
            all_fights = new_fights + existing_fights
            
            # Take only the 5 most recent fights
            final_fights = all_fights[:MAX_FIGHTS]
            
            # Delete existing fights
            delete_fighter_fights(fighter_name)
            logger.info(f"Deleted existing fights for {fighter_name}")
            
            # Store the final set of fights in order (newest first)
            success_count = 0
            for fight_data in final_fights:
                logger.info(f"Storing fight for {fighter_name}: {fight_data['event']} vs {fight_data['opponent']} ({fight_data['fight_date']})")
                if store_fight_data(fighter_name, fight_data['fight_url'], fight_data['fight_date']):
                    success_count += 1
                    logger.info(f"Successfully stored fight")
                else:
                    logger.warning(f"Failed to store fight")
            
            logger.info(f"Stored {success_count}/{len(final_fights)} fights for {fighter_name}")
            return success_count > 0
            
        else:
            # All mode - just get and store all 5 fights
            logger.info(f"Getting all 5 fights for {fighter_name}")
            fight_data_list = get_fighter_latest_fights(fighter_url, fighter_name, recent_only=False)
            
            if not fight_data_list:
                logger.warning(f"No fights found for {fighter_name}")
                return False
                
            # Remove existing fights for this fighter
            delete_fighter_fights(fighter_name)
            logger.info(f"Deleted existing fights for {fighter_name}")
            
            # Store all fight data in order (newest first)
            success_count = 0
            for fight_data in fight_data_list:
                logger.info(f"Storing fight for {fighter_name}: {fight_data['event']} vs {fight_data['opponent']} ({fight_data['fight_date']})")
                if store_fight_data(fighter_name, fight_data['fight_url'], fight_data['fight_date']):
                    success_count += 1
                    logger.info(f"Successfully stored fight")
                else:
                    logger.warning(f"Failed to store fight")
            
            logger.info(f"Stored {success_count}/{len(fight_data_list)} fights for {fighter_name}")
            return success_count > 0
        
    except Exception as e:
        logger.error(f"Error updating latest fights for {fighter_name}: {e}")
        import traceback
        traceback.print_exc()
        return False

def process_recent_event(num_events=1):
    """Process fighters from the most recent UFC events."""
    logger.info(f"Starting to process fighters from the {num_events} most recent UFC events")
    
    # Get fighters from Supabase first
    try:
        response = supabase.table("fighters").select("fighter_name, fighter_url").execute()
        fighters_dict = {}
        if response.data:
            fighters_dict = {row["fighter_url"]: row["fighter_name"] for row in response.data}
    except Exception as e:
        logger.error(f"Error getting fighters from Supabase: {e}")
        return
    
    total_processed = 0
    events_processed = 0
    
    # Keep track of processed events to avoid duplicates
    processed_events = set()
    
    while events_processed < num_events:
        # Fetch the most recent event
        latest_event = fetch_most_recent_event()
        if not latest_event:
            logger.error("Failed to fetch the most recent event")
            break
        
        # Unpack the tuple returned by fetch_most_recent_event
        event_url, event_name, event_date = latest_event
        
        # Skip if we've already processed this event
        if event_url in processed_events:
            logger.info(f"Already processed event: {event_name}. Moving to next event.")
            continue
        
        processed_events.add(event_url)
        logger.info(f"Processing event: {event_name} ({event_date}) - {event_url}")
        
        # Extract fighters from the event
        fighter_urls = extract_fighters_from_event(event_url)
        if not fighter_urls:
            logger.error(f"No fighters found in event: {event_name}")
            continue
        
        logger.info(f"Found {len(fighter_urls)} fighters in the event")
        
        # Process each fighter
        processed_count = 0
        for fighter_url in fighter_urls:
            # Get fighter name from the dictionary
            fighter_name = fighters_dict.get(fighter_url)
            if not fighter_name:
                logger.warning(f"Fighter URL {fighter_url} not found in database. Skipping.")
                continue
            
            # Update the fighter's most recent fight only
            updated = update_fighter_latest_fight(fighter_name, fighter_url, recent_only=True)
            
            if updated:
                processed_count += 1
                logger.info(f"Successfully updated most recent fight for {fighter_name}")
            else:
                logger.warning(f"Failed to update most recent fight for {fighter_name}")
        
        total_processed += processed_count
        events_processed += 1
        logger.info(f"Processed {processed_count}/{len(fighter_urls)} fighters from {event_name}")
        logger.info(f"Total events processed: {events_processed}/{num_events}")
    
    logger.info(f"Completed processing {events_processed} events. Total fighters processed: {total_processed}")

def process_recent_events(num_events: int) -> bool:
    """Process recent events wrapper function"""
    try:
        process_recent_event(num_events)
        return True
    except Exception as e:
        logger.error(f"Error processing recent events: {e}")
        return False

###############################################################################
# MAIN
###############################################################################
def process_fighter(fighter_name: str, fighter_url: str, mode: str = 'all') -> bool:
    """Process a fighter's fights"""
    try:
        if not fighter_name or not fighter_url:
            logger.error("Fighter name and URL are required")
            return False

        logger.info(f"Processing fighter: {fighter_name} ({fighter_url})")

        # Get all fight links for the fighter
        fight_links = get_fight_links_top5(fighter_url)
        if not fight_links:
            logger.warning(f"No fights found for {fighter_name}")
            return False

        logger.info(f"Found {len(fight_links)} fights for {fighter_name}")

        # Delete only this fighter's existing fights
        delete_fighter_fights(fighter_name)
        logger.info(f"Deleted existing fights for {fighter_name}")

        # Process each fight
        success_count = 0
        for date_str, fight_url in fight_links:
            logger.info(f"Processing fight: {date_str} - {fight_url}")
            
            # Validate fight URL
            if not fight_url or not fight_url.startswith("http"):
                logger.error(f"Invalid fight URL: {fight_url}")
                continue

            # Store fight data with retries
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    if store_fight_data(fighter_name, fight_url, date_str):
                        success_count += 1
                        logger.info(f"Successfully stored fight {success_count}/{len(fight_links)}")
                        break
                    else:
                        logger.warning(f"Failed to store fight data (attempt {attempt + 1}/{max_retries})")
                        if attempt < max_retries - 1:
                            time.sleep(2)  # Wait before retry
                except Exception as e:
                    logger.error(f"Error storing fight (attempt {attempt + 1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        time.sleep(2)

        logger.info(f"Successfully processed {success_count}/{len(fight_links)} fights for {fighter_name}")
        
        # Verify the fights were stored
        if success_count == 0:
            logger.error(f"Failed to store any fights for {fighter_name}")
            return False
            
        return success_count > 0

    except Exception as e:
        logger.error(f"Error processing fighter {fighter_name}: {e}")
        return False

def process_fighter_batch(fighters_batch):
    """Process a batch of fighters concurrently"""
    success_count = 0
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_fighter = {
            executor.submit(process_fighter, name, url): name 
            for name, url in fighters_batch
        }
        for future in as_completed(future_to_fighter):
            fighter_name = future_to_fighter[future]
            try:
                if future.result():
                    success_count += 1
                    logger.info(f"Successfully processed fighter: {fighter_name}")
                else:
                    logger.warning(f"Failed to process fighter: {fighter_name}")
            except Exception as e:
                logger.error(f"Error processing fighter {fighter_name}: {e}")
    return success_count

def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="UFC Last 5 Fights Scraper")
    parser.add_argument("--mode", choices=["all", "recent", "fighter"], default="recent",
                      help="Mode: all=all fighters (5 fights), recent=latest event(s) (1 fight), fighter=specific fighter (5 fights)")
    parser.add_argument("--fighter", type=str, default=None,
                      help="Fighter name (required in fighter mode)")
    parser.add_argument("--num-events", type=int, default=1,
                      help="Number of recent events to process (only used in recent mode)")
    parser.add_argument("--batch-size", type=int, default=50,
                      help="Number of fighters to process in parallel (only used in all mode)")
    return parser.parse_args()

def get_fighter_url(fighter_name: str) -> str:
    """Get fighter's URL from the database"""
    try:
        supabase = get_supabase_client()
        if not supabase:
            logger.error("Failed to get Supabase client")
            return None

        # Search for fighter in database
        response = supabase.table('fighters').select('fighter_url').ilike('fighter_name', f'%{fighter_name}%').execute()
        if not response.data:
            logger.error(f"Fighter {fighter_name} not found in database")
            return None

        # Return the first match's URL
        return response.data[0]['fighter_url']

    except Exception as e:
        logger.error(f"Error getting fighter URL: {e}")
        return None

def process_all_fighters(batch_size: int) -> bool:
    """Process all fighters in batches by alphabet"""
    try:
        # First, ensure the table is completely empty and reset sequence
        logger.info("Clearing all existing fight records")
        supabase = get_supabase_client()
        if not supabase:
            logger.error("Failed to get Supabase client")
            return False

        # Delete all records and reset sequence
        try:
            # First delete all records
            response = supabase.table('fighter_last_5_fights').delete().neq('id', 0).execute()
            logger.info("Successfully deleted all records")

            # Reset sequence by inserting and deleting a dummy record
            dummy_data = {
                'fighter_name': 'DUMMY_RESET',
                'fight_url': 'DUMMY_URL',
                'kd': '0',
                'sig_str': '0',
                'sig_str_pct': '0%',
                'total_str': '0',
                'head_str': '0',
                'body_str': '0',
                'leg_str': '0',
                'takedowns': '0',
                'td_pct': '0%',
                'ctrl': '0:00',
                'result': 'N/A',
                'method': 'N/A',
                'opponent': 'N/A',
                'fight_date': 'Jan 1, 2000',
                'event': 'N/A',
                'round': '0',
                'time': '0:00'
            }
            
            # Insert dummy record
            response = supabase.table('fighter_last_5_fights').insert(dummy_data).execute()
            if not response.data:
                logger.error("Failed to insert dummy record")
                return False
            
            # Delete dummy record
            response = supabase.table('fighter_last_5_fights').delete().eq('fighter_name', 'DUMMY_RESET').execute()
            if not response.data:
                logger.error("Failed to delete dummy record")
                return False
            
            logger.info("Successfully reset sequence")

        except Exception as e:
            logger.error(f"Error clearing table and resetting sequence: {e}")
            return False

        # Process fighters alphabetically from UFC stats
        total_success = 0
        total_fighters = 0
        base_url = "http://ufcstats.com/statistics/fighters?char={}&page=all"
        
        # Process A to Z
        for char in 'abcdefghijklmnopqrstuvwxyz':
            url = base_url.format(char)
            logger.info(f"Processing fighters starting with '{char.upper()}'")
            
            try:
                # Add delay between letters to avoid rate limiting
                time.sleep(2)
                
                session = requests.Session()
                session.headers.update(REQUEST_HEADERS)
                
                # Get fighters page with retries
                for attempt in range(RETRY_ATTEMPTS):
                    try:
                        response = session.get(url, timeout=REQUEST_TIMEOUT)
                        response.raise_for_status()
                        break
                    except Exception as e:
                        if attempt == RETRY_ATTEMPTS - 1:
                            raise
                        time.sleep(RETRY_SLEEP * (attempt + 1))
                
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Find all fighter rows
                rows = soup.select("table.b-statistics__table tbody tr")
                if not rows:
                    logger.warning(f"No fighters found for letter {char.upper()}")
                    continue

                # Extract fighters from this page
                fighters_batch = []
                for row in rows[1:]:  # Skip header row
                    # Get both first and last name cells
                    first_name_cell = row.select_one("td:nth-child(1) a")
                    last_name_cell = row.select_one("td:nth-child(2) a")
                    
                    if first_name_cell and last_name_cell and 'href' in first_name_cell.attrs:
                        fighter_url = first_name_cell['href'].strip()
                        first_name = first_name_cell.get_text(strip=True)
                        last_name = last_name_cell.get_text(strip=True)
                        fighter_name = f"{first_name} {last_name}"
                        
                        if fighter_url and fighter_name:
                            fighters_batch.append((fighter_name, fighter_url))
                
                logger.info(f"Found {len(fighters_batch)} fighters for letter {char.upper()}")
                total_fighters += len(fighters_batch)
                
                # Process each fighter individually with proper delays
                if fighters_batch:
                    for fighter_name, fighter_url in fighters_batch:
                        # Add delay between fighters to avoid rate limiting
                        time.sleep(1)
                        
                        logger.info(f"Processing fighter: {fighter_name}")
                        try:
                            # Use the same process_fighter function that works in fighter mode
                            if process_fighter(fighter_name, fighter_url, 'all'):
                                total_success += 1
                                logger.info(f"Successfully processed fighter: {fighter_name}")
                            else:
                                logger.warning(f"Failed to process fighter: {fighter_name}")
                        except Exception as e:
                            logger.error(f"Error processing fighter {fighter_name}: {e}")
                            # Add extra delay after errors
                            time.sleep(5)
                            continue
                
            except Exception as e:
                logger.error(f"Error processing letter {char.upper()}: {e}")
                # Add extra delay after errors
                time.sleep(10)
                continue

        logger.info(f"Total fighters successfully processed: {total_success}/{total_fighters}")
        return total_success > 0

    except Exception as e:
        logger.error(f"Error processing all fighters: {e}")
        return False

def main():
    """Main entry point"""
    args = parse_args()
    logger.info("UFC Last 5 Fights Scraper - Supabase Edition")
    logger.info(f"Running in {args.mode.upper()} mode")

    # Process based on mode
    if args.mode == 'fighter':
        if not args.fighter:
            logger.error("Fighter name is required in fighter mode")
            return
            
        # Get fighter URL
        fighter_url = get_fighter_url(args.fighter)
        if not fighter_url:
            logger.error(f"Could not find fighter URL for {args.fighter}")
            return
            
        # Process the fighter
        if not process_fighter(args.fighter, fighter_url, args.mode):
            logger.error(f"Failed to process fighter {args.fighter}")
            return
            
    elif args.mode == 'recent':
        if not args.num_events:
            logger.error("Number of events is required in recent mode")
            return
            
        # Process recent events
        if not process_recent_events(args.num_events):
            logger.error("Failed to process recent events")
            return
            
    elif args.mode == 'all':
        # Process all fighters - table clearing is now handled inside process_all_fighters
        if not process_all_fighters(args.batch_size):
            logger.error("Failed to process all fighters")
            return
        
    logger.info("Script execution completed!")

if __name__ == "__main__":
    main()