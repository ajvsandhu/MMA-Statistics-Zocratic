#!/usr/bin/env python
"""
Tapology Data Scraper

A robust scraper for collecting fighter data from Tapology with built-in rate limiting
and error handling. Features include session management, proxy support, and progress tracking.
"""

import argparse
import datetime
import json
import logging
import os
import random
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from threading import Lock
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote_plus

# Check required packages
required_packages = {
    'requests': 'requests>=2.31.0',
    'bs4': 'beautifulsoup4>=4.12.0',
    'fuzzywuzzy': 'fuzzywuzzy==0.18.0',
    'Levenshtein': 'python-Levenshtein>=0.21.1'
}

missing_packages = []
for package, version in required_packages.items():
    try:
        if package == 'Levenshtein':
            import Levenshtein
        else:
            __import__(package)
    except ImportError:
        missing_packages.append(version)

if missing_packages:
    print("Missing required packages. Please install:")
    print("\npip install " + " ".join(missing_packages))
    sys.exit(1)

import requests
from bs4 import BeautifulSoup
from fuzzywuzzy import fuzz
import Levenshtein  # Explicit import

# Fix import by correctly adding the project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
    print(f"Added {PROJECT_ROOT} to Python path")

try:
    from backend.api.database import get_supabase_client
except ImportError as e:
    print(f"Error importing database module: {e}")
    print("Please ensure you're running the script from the project root directory")
    sys.exit(1)

# Headers for requests
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
}

# Add this constant at the top of the file with other constants
DEFAULT_IMAGE_URL = "https://static1.cbrimages.com/wordpress/wp-content/uploads/2021/01/Captain-Rocks.jpg"

def setup_logging():
    """
    Set up logging configuration with console handler only.
    """
    # Create formatters
    console_formatter = logging.Formatter('%(message)s')
    
    # Configure root logger
    logger = logging.getLogger()
    
    # Remove any existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(console_formatter)
    
    # Configure root logger
    logger.setLevel(logging.INFO)
    logger.addHandler(console_handler)
    
    return logger

# Set up logging
logger = setup_logging()

def parse_args() -> argparse.Namespace:
    """
    Parse command line arguments for scraper configuration.
    """
    parser = argparse.ArgumentParser(description='Tapology Fighter Scraper')
    parser.add_argument(
        '--reset',
        action='store_true',
        help='Reset progress and start from the beginning'
    )
    parser.add_argument(
        '--start-index',
        type=int,
        default=None,
        help='Start processing from a specific fighter index'
    )
    parser.add_argument(
        '--only-need-image',
        action='store_true',
        help='Only process fighters without an image'
    )
    parser.add_argument(
        '--only-need-tap',
        action='store_true',
        help='Only process fighters without a Tapology link'
    )
    parser.add_argument(
        '--include-complete',
        action='store_true',
        help='Include fighters with both image and Tapology link'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Run in test mode with a specific fighter'
    )
    parser.add_argument(
        '--test-fighter',
        type=str,
        default="Jon Jones",
        help='Specify the fighter name to test (default: Jon Jones)'
    )
    return parser.parse_args()

# Parse command line arguments
args = parse_args()

# List of User-Agents to rotate
USER_AGENTS = [
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"),
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
     "(KHTML, like Gecko) Version/16.0 Safari/605.1.15"),
    ("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) "
     "Gecko/20100101 Firefox/115.0"),
    ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 "
     "(KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"),
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"),
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) "
     "Gecko/20100101 Firefox/116.0"),
    ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.69"),
    ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"),
    ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
     "(KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"),
]

# Example proxy list (replace with your own working proxies)
PROXIES: List[Dict[str, str]] = [
    # {"http": "http://your_proxy:port", "https": "http://your_proxy:port"},
    # Add more proxies here or fetch from a proxy service
]

# Scraping configuration
CONFIG = {
    "base_delay": 10.0,           # Increased from 3.0 to 10.0 seconds
    "max_retries": 10,            # Increased from 5 to 10 retries
    "backoff_factor": 3.0,        # Increased from 2.0 to 3.0
    "max_workers": 1,             # Reduced from 2 to 1 to be more conservative
    "request_timeout": 30,        # Increased from 15 to 30 seconds
    "throttle_threshold": 2,      # Reduced from 3 to 2 to be more sensitive to failures
    "max_cooldown": 3600,         # Increased from 1800 to 3600 seconds (1 hour)
    "min_cooldown": 120,          # Increased from 60 to 120 seconds
    "session_requests_limit": 20,  # Reduced from 50 to 20 requests per session
    "session_duration_limit": 900, # Reduced from 1800 to 900 seconds (15 minutes)
    "state_save_interval": 10,    # Reduced from 20 to 10 fighters
    "max_failure_rate": 0.05,     # Reduced from 0.1 to 0.05 (5% max failure rate)
    "max_consecutive_failures": 3, # Reduced from 5 to 3
    "save_interval": 600,         # Increased from 300 to 600 seconds
}

# Lock for thread-safe DB updates
db_lock = Lock()

# Tracking for adaptive throttling
request_stats = {
    "consecutive_failures": 0,
    "total_requests": 0,
    "successful_requests": 0,
    "session_start_time": time.time(),
    "session_request_count": 0,
    "progress_file": "tapology_scraper_progress.json",
    "last_fighter_index": 0,
    "last_save_time": time.time()
}

# If reset flag is set, delete the progress file
if args.reset and os.path.exists(request_stats["progress_file"]):
    try:
        os.remove(request_stats["progress_file"])
        logger.info(f"Reset progress: Deleted {request_stats['progress_file']}")
    except Exception as e:
        logger.error(f"Failed to delete progress file: {e}")

def get_random_headers() -> Dict[str, str]:
    """
    Generate random user agent headers to prevent request blocking.
    """
    return {"User-Agent": random.choice(USER_AGENTS)}

def get_random_proxy() -> Optional[Dict[str, str]]:
    """
    Select a random proxy from the available proxy pool.
    """
    return random.choice(PROXIES) if PROXIES else None

def adaptive_cooldown() -> float:
    """
    Calculate dynamic cooldown time based on request patterns.
    """
    base = CONFIG["min_cooldown"]
    if request_stats["consecutive_failures"] > CONFIG["throttle_threshold"]:
        backoff_multiplier = min(
            2 ** (request_stats["consecutive_failures"] - CONFIG["throttle_threshold"]),
            CONFIG["max_cooldown"] / base
        )
        cooldown = base * backoff_multiplier
        return min(cooldown, CONFIG["max_cooldown"])
    return base + random.uniform(0, 30)

def should_rotate_session() -> bool:
    """
    Determine if the current session needs rotation based on request count and duration.
    """
    session_duration = time.time() - request_stats["session_start_time"]
    return (request_stats["session_request_count"] >= CONFIG["session_requests_limit"] or 
            session_duration >= CONFIG["session_duration_limit"])

def rotate_session() -> None:
    """
    Rotate the current session and apply cooldown period.
    """
    cooldown = adaptive_cooldown()
    logger.debug(
        f"Rotating session after {request_stats['session_request_count']} requests, "
        f"cooldown: {cooldown:.2f}s"
    )
    
    save_progress()
    time.sleep(cooldown)
    request_stats["session_start_time"] = time.time()
    request_stats["session_request_count"] = 0
    request_stats["consecutive_failures"] = max(0, request_stats["consecutive_failures"] - 1)

def get_with_retries(
    url: str,
    max_retries: Optional[int] = None,
    backoff_factor: Optional[float] = None
) -> Optional[requests.Response]:
    """
    Execute HTTP GET request with retry logic and rate limiting.
    """
    if max_retries is None:
        max_retries = CONFIG["max_retries"]
    if backoff_factor is None:
        backoff_factor = CONFIG["backoff_factor"]
    
    if should_rotate_session():
        rotate_session()
    
    attempt = 0
    while attempt < max_retries:
        delay_variation = random.uniform(0.5, 1.5)
        current_delay = CONFIG["base_delay"] * delay_variation
        
        headers = get_random_headers()
        proxies = get_random_proxy()
        request_stats["total_requests"] += 1
        request_stats["session_request_count"] += 1
        
        try:
            response = requests.get(
                url,
                headers=headers,
                proxies=proxies,
                timeout=CONFIG["request_timeout"]
            )
            response.raise_for_status()
            
            request_stats["consecutive_failures"] = 0
            request_stats["successful_requests"] += 1
            
            sleep_time = current_delay + random.uniform(0, 2)
            logger.debug(f"Request successful, delay: {sleep_time:.2f}s")
            time.sleep(sleep_time)
            return response
        
        except requests.exceptions.HTTPError as e:
            request_stats["consecutive_failures"] += 1
            status_code = e.response.status_code if hasattr(e, 'response') else "Unknown"
            
            if status_code in (503, 429):
                cooldown = backoff_factor * (2 ** attempt) + random.uniform(10, 30)
                cooldown = min(cooldown, CONFIG["max_cooldown"])
                logger.debug(
                    f"Rate limit ({status_code}), attempt {attempt + 1}/{max_retries}, "
                    f"cooldown: {cooldown:.2f}s"
                )
                time.sleep(cooldown)
            else:
                logger.debug(f"HTTP error {status_code} for {url}")
                time.sleep(current_delay * 3)
            attempt += 1
                
        except requests.exceptions.ConnectionError as e:
            request_stats["consecutive_failures"] += 1
            logger.debug("Connection error, retrying after delay")
            time.sleep(current_delay * 3)
            attempt += 1
            
        except requests.exceptions.Timeout as e:
            request_stats["consecutive_failures"] += 1
            logger.debug("Request timeout, retrying after delay")
            time.sleep(current_delay * 3)
            attempt += 1
            
        except Exception as e:
            request_stats["consecutive_failures"] += 1
            logger.error(f"Unexpected error: {str(e)}")
            time.sleep(current_delay * 3)
            attempt += 1
    
    cooldown = adaptive_cooldown()
    logger.debug(f"Max retries reached, cooldown: {cooldown:.2f}s")
    time.sleep(cooldown)
    return None

def save_progress() -> None:
    """
    Save current scraping progress to disk.
    """
    state = {
        "last_fighter_index": request_stats["last_fighter_index"],
        "total_requests": request_stats["total_requests"],
        "successful_requests": request_stats["successful_requests"],
        "consecutive_failures": request_stats["consecutive_failures"],
        "timestamp": datetime.datetime.now().isoformat()
    }
    try:
        with open(request_stats["progress_file"], 'w') as f:
            json.dump(state, f)
        logger.debug(
            f"Progress saved: {state['last_fighter_index']} fighters, "
            f"{state['successful_requests']}/{state['total_requests']} successful"
        )
        request_stats["last_save_time"] = time.sleep(request_stats["last_save_time"])
    except Exception as e:
        logger.error(f"Failed to save progress: {str(e)}")

def load_progress() -> int:
    """
    Load saved scraping progress from disk.
    """
    try:
        if not os.path.exists(request_stats["progress_file"]):
            logger.debug("No progress file found, starting from beginning")
            return 0
            
        with open(request_stats["progress_file"], 'r') as f:
            state = json.load(f)
            
        request_stats.update({
            "last_fighter_index": state.get("last_fighter_index", 0),
            "total_requests": state.get("total_requests", 0),
            "successful_requests": state.get("successful_requests", 0),
            "consecutive_failures": state.get("consecutive_failures", 0)
        })
        
        logger.debug(
            f"Progress loaded: index={state.get('last_fighter_index')}, "
            f"requests={state.get('total_requests')}"
        )
        return state.get("last_fighter_index", 0)
        
    except Exception as e:
        logger.error(f"Failed to load progress: {str(e)}")
        return 0

def ensure_tap_link_column() -> None:
    """
    Verify Supabase schema includes tap_link column.
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            raise Exception("Failed to initialize Supabase client")
            
        # Check if we can connect to the database
        response = supabase.table('fighters').select('fighter_name').limit(1).execute()
        if not response:
            raise Exception("Could not verify database connection")
            
        # Check if the tap_link column exists
        response = supabase.table('fighters').select('tap_link').limit(1).execute()
        if not response:
            logger.warning("tap_link column may not exist in the fighters table")
            # You may want to add code here to create the column if it doesn't exist
            
        logger.info("Database connection and schema verified successfully")
    except Exception as e:
        logger.error(f"Database verification failed: {str(e)}")
        raise

def get_database_connection():
    """
    Get a database connection with error handling.
    """
    try:
        supabase = get_supabase_client()
        if not supabase:
            raise Exception("Failed to initialize Supabase client")
        return supabase
    except Exception as e:
        logger.error(f"Failed to get database connection: {str(e)}")
        raise

def remove_nicknames_and_extras(name: str) -> str:
    """
    Clean fighter name by removing nicknames and additional information.
    """
    name = re.sub(r'["\'].*?["\']', '', name)
    name = re.sub(r'\(.*?\)', '', name)
    name = ' '.join(name.split())
    return name.strip()

def process_fighter_name(raw_name: str) -> str:
    """
    Standardize fighter name for consistent matching.
    """
    name = remove_nicknames_and_extras(raw_name)
    return standardize_name(name)

def standardize_name(name: str) -> str:
    """
    Convert fighter name to standardized format.
    """
    name = ' '.join(name.lower().split())
    name = re.sub(r'[^\w\s-]', '', name)
    return name.strip()

def calculate_similarity(db_name: str, scraped_name: str) -> float:
    """
    Calculate name similarity score with special handling for East Asian names.
    """
    db_name = standardize_name(db_name)
    scraped_name = standardize_name(scraped_name)
    
    similarity = SequenceMatcher(None, db_name, scraped_name).ratio()
    
    if looks_like_east_asian_name(db_name) and looks_like_east_asian_name(scraped_name):
        db_parts = db_name.split()
        scraped_parts = scraped_name.split()
        
        if len(db_parts) == len(scraped_parts) == 2:
            reversed_db = f"{db_parts[1]} {db_parts[0]}"
            reversed_similarity = SequenceMatcher(None, reversed_db, scraped_name).ratio()
            similarity = max(similarity, reversed_similarity)
    
    return similarity

def looks_like_east_asian_name(name: str) -> bool:
    """
    Check if name matches East Asian naming patterns.
    """
    east_asian_surnames = {
        'kim', 'lee', 'park', 'choi', 'jung', 'kang', 'cho', 'chang',
        'zhang', 'li', 'wang', 'chen', 'liu', 'yang', 'huang', 'zhao',
        'wu', 'zhou', 'xu', 'sun', 'ma', 'zhu', 'hu', 'guo', 'he',
        'gao', 'lin', 'luo', 'zheng', 'liang', 'xie', 'tang', 'xu',
        'sato', 'suzuki', 'takahashi', 'tanaka', 'watanabe', 'ito',
        'yamamoto', 'nakamura', 'kobayashi', 'kato', 'yoshida',
        'yamada', 'sasaki', 'yamaguchi', 'matsumoto', 'inoue',
        'nguyen', 'tran', 'le', 'pham', 'hoang', 'phan', 'vu', 'dang'
    }
    
    parts = name.lower().strip().split()
    
    if not (1 <= len(parts) <= 3):
        return False
        
    if not any(part in east_asian_surnames for part in parts):
        return False
        
    if not all(len(part) <= 3 for part in parts):
        return False
        
    return True

def tapology_search_url(fighter_name: str) -> str:
    """
    Generate search URL for fighter on Tapology.
    """
    cleaned_name = re.sub(r'[^\w\s]', ' ', fighter_name)
    cleaned_name = ' '.join(cleaned_name.split())
    encoded_name = quote_plus(cleaned_name)
    
    return f"https://www.tapology.com/search?term={encoded_name}&search=fighters"

def create_direct_fighter_url(fighter_name: str) -> List[str]:
    """
    Generate potential direct URLs to fighter's Tapology profile.
    """
    urls = []
    
    clean_name = re.sub(r'[^\w\s]', '', fighter_name).lower().strip()
    slug = re.sub(r'\s+', '-', clean_name)
    urls.append(f"https://www.tapology.com/fightcenter/fighters/{slug}")
    
    for i in range(1, 4):
        urls.append(f"https://www.tapology.com/fightcenter/fighters/{slug}-{i}")
    
    name_parts = clean_name.split()
    if len(name_parts) >= 2:
        first_name = name_parts[0]
        last_name = name_parts[-1]
        
        urls.append(f"https://www.tapology.com/fightcenter/fighters/{last_name}-{first_name}")
        
        for i in range(1, 3):
            urls.append(f"https://www.tapology.com/fightcenter/fighters/{last_name}-{first_name}-{i}")
        
        urls.append(f"https://www.tapology.com/fightcenter/fighters/{first_name}-{last_name}")
    
    return urls

def get_fighter_details(url):
    """
    Fetch and parse fighter details from their profile page.
    """
    if not url.startswith('http'):
        url = f"https://www.tapology.com{url}"
    
    response = get_with_retries(url)
    if not response:
        return {}
        
    soup = BeautifulSoup(response.text, 'html.parser')
    details = {}
    
    # Get fighter name and nickname
    name_elem = soup.select_one('span.name')
    if name_elem:
        details['full_name'] = name_elem.get_text(strip=True)
    
    # Get fighter image - try multiple selectors
    image_found = False
    
    # Try the profile image selector
    image_elem = soup.select_one('img.profile, img.profile_image')
    if image_elem and image_elem.get('src'):
        image_url = image_elem.get('src')
        if 'tapology.com' in image_url:
            details['image_url'] = image_url
            image_found = True
    
    # If not found, try the letterbox image pattern
    if not image_found:
        # Try to construct the letterbox URL from the fighter's ID in the URL
        fighter_id_match = re.search(r'/(\d+)/', url)
        if fighter_id_match:
            fighter_id = fighter_id_match.group(1)
            # Try to get the fighter's name from URL or page
            name_in_url = url.split('/')[-1].split('-')[0].lower()
            if name_elem:
                name_parts = name_elem.get_text(strip=True).split()
                if name_parts:
                    name_in_page = name_parts[0].lower()
                    letterbox_url = f"https://images.tapology.com/letterbox_images/{fighter_id}/default/{name_in_page}.jpg"
                    # Try to verify this URL exists
                    test_response = get_with_retries(letterbox_url)
                    if test_response and test_response.status_code == 200:
                        details['image_url'] = letterbox_url
                        image_found = True
    
    # If still not found, try general image search in content
    if not image_found:
        for img in soup.select('img'):
            src = img.get('src', '')
            if 'tapology.com' in src and 'letterbox_images' in src:
                details['image_url'] = src
                break
    
    return details

def calculate_fighter_score(search_name, result_name, details):
    """
    Calculate a score for how well a fighter matches the search criteria.
    """
    base_score = 0
    
    # Name matching score (0-100)
    name_score = fuzz.ratio(search_name.lower(), result_name.lower())
    base_score += name_score
    
    # Bonus for exact word matches
    search_words = set(search_name.lower().split())
    result_words = set(result_name.lower().split())
    matching_words = search_words & result_words
    base_score += len(matching_words) * 10
    
    # Simple UFC status check
    if details and details.get('is_ufc'):
        base_score += 20  # Reduced from 50 to make it less dominant
        
    return base_score

def get_random_delay(base, variation=0.5):
    """
    Get a randomized delay to make requests look more human-like.
    base: base delay in seconds
    variation: percentage of variation (0.5 = ±50%)
    """
    min_delay = base * (1 - variation)
    max_delay = base * (1 + variation)
    return random.uniform(min_delay, max_delay)

def search_fighter(name):
    """
    Search for a fighter by name and return the best match with full link.
    """
    try:
        # Add random delay between searches (5-15 seconds base)
        delay = get_random_delay(10, 0.5)
        logger.info(f"Waiting {delay:.1f} seconds before searching...")
        time.sleep(delay)
        
        # Format the search URL
        search_url = f"https://www.tapology.com/search?term={quote_plus(name)}&search=fighters"
        logger.info(f"Searching for {name} at: {search_url}")
        
        # Get the search page with retries - Add timeout here
        response = requests.get(search_url, headers=HEADERS, timeout=30)  # Add 30 second timeout
        response.raise_for_status()
        
        # Parse the HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check for rate limit indicators
        if "too many requests" in soup.text.lower() or "rate limit" in soup.text.lower():
            wait_time = get_random_delay(300)  # 5 minute base delay
            logger.warning(f"Rate limit detected, waiting {wait_time:.1f} seconds...")
            time.sleep(wait_time)
            return None
        
        # Try different selectors for search results
        selectors = [
            'div.searchResult',
            'a.searchResultsFighter',
            'a[href*="fightcenter/fighters"]',
            'div.fighter',
            'tr.fighter',
            'div.searchResults a',
            'table.fighterTable tr'
        ]
        
        results = []
        seen_urls = set()  # Track seen URLs to avoid duplicates
        
        for selector in selectors:
            elements = soup.select(selector)
            logger.debug(f"Found {len(elements)} results with selector '{selector}'")
            
            for element in elements:
                # Get the link and name
                if element.name == 'a':
                    link = element
                else:
                    link = element.select_one('a.name, a[href*="fightcenter/fighters"]') or element.select_one('a')
                
                if not link:
                    continue
                    
                href = link.get('href', '')
                if not href or 'fightcenter/fighters' not in href:
                    continue
                    
                # Skip if we've seen this URL
                full_url = f"https://www.tapology.com{href}" if not href.startswith('http') else href
                if full_url in seen_urls:
                    continue
                seen_urls.add(full_url)
                
                # Get fighter details
                result_name = link.get_text(strip=True)
                record = None
                weight_class = None
                
                # Try to find record and weight class
                record_elem = element.select_one('.record, .fighterRecord')
                if record_elem:
                    record = record_elem.get_text(strip=True)
                
                weight_elem = element.select_one('.weight, .weightClass')
                if weight_elem:
                    weight_class = weight_elem.get_text(strip=True)
                
                # Calculate multiple similarity scores
                name_similarity = calculate_name_similarity(name, result_name)
                
                # Boost score if record or weight class is found
                score = name_similarity
                if record:
                    score += 0.1  # Small boost for having a record
                if weight_class:
                    score += 0.1  # Small boost for having weight class
                
                if score > 0.6:  # Lowered threshold but we'll sort by score
                    results.append({
                        'score': score,
                        'name': result_name,
                        'url': full_url,
                        'record': record,
                        'weight_class': weight_class
                    })
        
        if results:
            # Sort by score
            results.sort(key=lambda x: x['score'], reverse=True)
            best_match = results[0]
            
            # Log all potential matches for debugging
            logger.info(f"Found {len(results)} potential matches for {name}:")
            for i, result in enumerate(results[:3], 1):  # Show top 3
                logger.info(f"{i}. {result['name']} (score: {result['score']:.2f})")
                if result['record']:
                    logger.info(f"   Record: {result['record']}")
                if result['weight_class']:
                    logger.info(f"   Weight: {result['weight_class']}")
            
            logger.info(f"Selected best match: {best_match['name']} (score: {best_match['score']:.2f})")
            return best_match['url']
        
        logger.warning(f"No results found for {name}")
        return None
        
    except requests.Timeout:
        logger.error(f"Request timed out for {name}")
        return None
    except requests.RequestException as e:
        logger.error(f"Request failed for {name}: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error searching for fighter {name}: {str(e)}")
        time.sleep(get_random_delay(60))  # 1 minute base delay on error
        return None

def calculate_name_similarity(name1, name2):
    """
    Calculate similarity between two fighter names with improved matching.
    """
    def clean_name(name):
        # Remove common nicknames and extra info
        name = re.sub(r'"[^"]*"', '', name)  # Remove quoted nicknames
        name = re.sub(r"'[^']*'", '', name)  # Remove single-quoted nicknames
        name = re.sub(r'\([^)]*\)', '', name)  # Remove parentheses
        name = re.sub(r'\s+', ' ', name)  # Normalize spaces
        return name.lower().strip()
    
    # Clean both names
    clean1 = clean_name(name1)
    clean2 = clean_name(name2)
    
    # Calculate various similarity scores
    scores = [
        fuzz.ratio(clean1, clean2) / 100,  # Basic ratio
        fuzz.partial_ratio(clean1, clean2) / 100,  # Partial match
        fuzz.token_sort_ratio(clean1, clean2) / 100,  # Order-independent
        fuzz.token_set_ratio(clean1, clean2) / 100,  # Set-based comparison
    ]
    
    # Calculate word-by-word match score
    words1 = set(clean1.split())
    words2 = set(clean2.split())
    common_words = words1 & words2
    word_match_score = len(common_words) / max(len(words1), len(words2))
    scores.append(word_match_score)
    
    # Return highest score
    return max(scores)

def test_fighter_search(fighter_name: str):
    """
    Test the fighter search function with detailed output.
    """
    print(f"\nTesting search for fighter: {fighter_name}")
    print("=" * 50)
    
    try:
        results = search_fighter(fighter_name)
        
        if not results:
            print("No results found")
            return
            
        print("\nTop 5 Matches:")
        for i, result in enumerate(results, 1):
            print(f"\n{i}. {result}")
            
    except Exception as e:
        print(f"Error during test: {str(e)}")
        raise

def should_continue_processing() -> bool:
    """
    Check if scraping should continue based on failure rates and limits.
    """
    if request_stats["consecutive_failures"] >= CONFIG["max_consecutive_failures"]:
        logger.warning("Too many consecutive failures")
        return False
        
    if request_stats["total_requests"] > 0:
        failure_rate = 1 - (request_stats["successful_requests"] / request_stats["total_requests"])
        if failure_rate > CONFIG["max_failure_rate"]:
            logger.warning(f"Failure rate too high: {failure_rate:.2%}")
            return False
            
    return True

def process_fighter(fighter: Tuple[str, Optional[str], Optional[str]]) -> bool:
    """
    Process a single fighter's data.
    Returns True if processing was successful.
    """
    fighter_name, image_url, tap_link = fighter
    
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Search for the fighter
            results = search_fighter(fighter_name)
            
            if not results:
                logger.warning(f"No results found for {fighter_name}")
                retry_count += 1
                if retry_count < max_retries:
                    logger.info(f"Retrying search for {fighter_name} (attempt {retry_count + 1}/{max_retries})")
                    time.sleep(CONFIG["base_delay"] * (retry_count + 1))
                    continue
                return False
                
            # Get the best match
            best_match = results
            
            # Only update if we have a reasonably good match
            if best_match:
                with db_lock:
                    try:
                        supabase = get_database_connection()
                        response = supabase.table('fighters') \
                            .update({"tap_link": best_match}) \
                            .eq('fighter_name', fighter_name) \
                            .execute()
                            
                        if not response.data:
                            logger.error(f"Failed to update tap_link for {fighter_name}")
                            retry_count += 1
                            if retry_count < max_retries:
                                logger.info(f"Retrying database update for {fighter_name} (attempt {retry_count + 1}/{max_retries})")
                                time.sleep(CONFIG["base_delay"] * (retry_count + 1))
                                continue
                            return False
                            
                        logger.info(f"Updated tap_link for {fighter_name}")
                        return True
                    except Exception as db_error:
                        logger.error(f"Database error for {fighter_name}: {str(db_error)}")
                        retry_count += 1
                        if retry_count < max_retries:
                            logger.info(f"Retrying database operation for {fighter_name} (attempt {retry_count + 1}/{max_retries})")
                            time.sleep(CONFIG["base_delay"] * (retry_count + 1))
                            continue
                        return False
            else:
                logger.warning(f"No good match found for {fighter_name}")
                return False
                
        except Exception as e:
            logger.error(f"Error processing fighter {fighter_name}: {str(e)}")
            retry_count += 1
            if retry_count < max_retries:
                logger.info(f"Retrying processing for {fighter_name} (attempt {retry_count + 1}/{max_retries})")
                time.sleep(CONFIG["base_delay"] * (retry_count + 1))
                continue
            return False
            
    return False

def main():
    """
    Main function to process all fighters in the database.
    Always starts from the beginning and processes all fighters.
    """
    try:
        logger.info("Starting fresh run - processing all fighters from the beginning")
        
        # Initialize database connection
        supabase = get_supabase_client()
        
        # First, get total count
        count_response = supabase.table('fighters').select('count', count='exact').execute()
        total_count = count_response.count
        logger.info(f"Total fighters in database: {total_count}")
        
        # Fetch all fighters using proper pagination
        page_size = 1000  # Maximum allowed by Supabase
        all_fighters = []
        page = 0
        
        while len(all_fighters) < total_count:
            # Fetch a page of fighters - we need name, current tap_link and image_url
            response = supabase.table('fighters') \
                .select('fighter_name, tap_link, image_url') \
                .order('fighter_name', desc=False) \
                .range(page * page_size, (page + 1) * page_size - 1) \
                .execute()
            
            # Add fighters to our list
            fighters_page = response.data
            if not fighters_page:  # No more results
                break
                
            all_fighters.extend(fighters_page)
            logger.info(f"Fetched page {page + 1}: {len(fighters_page)} fighters (Total: {len(all_fighters)}/{total_count})")
            
            # Move to next page
            page += 1
            time.sleep(get_random_delay(2))  # Random delay between pages
        
        total_fighters = len(all_fighters)
        logger.info(f"Successfully fetched all {total_fighters} fighters from the database.")
        logger.info("Processing fighters in alphabetical order...")
        
        # Process in smaller batches to avoid rate limits
        batch_size = 10  # Small batch size
        success_count = 0
        error_count = 0
        consecutive_errors = 0
        
        for i in range(0, total_fighters, batch_size):
            current_batch = i // batch_size + 1
            total_batches = (total_fighters + batch_size - 1) // batch_size
            logger.info(f"\nStarting batch {current_batch}/{total_batches}")
            
            batch = all_fighters[i:i+batch_size]
            batch_success = 0
            
            for fighter in batch:
                fighter_name = fighter['fighter_name']
                current_link = fighter.get('tap_link')
                current_image = fighter.get('image_url')
                
                # Determine if we need to search for missing data
                needs_link = not current_link
                # Consider default image or no image as needing image
                needs_image = not current_image or current_image == DEFAULT_IMAGE_URL
                
                if not needs_link and not needs_image:
                    logger.info(f"Skipping {fighter_name} - has both link and proper image")
                    continue
                
                try:
                    # If we have a link but no proper image, use the existing link
                    if current_link and needs_image:
                        result = current_link
                        logger.info(f"Using existing link for {fighter_name} to find proper image")
                    else:
                        # Search for fighter if we need a link
                        result = search_fighter(fighter_name)
                    
                    if result:
                        # Get fighter details including image
                        details = get_fighter_details(result)
                        update_data = {}
                        
                        # Update link if needed
                        if needs_link:
                            update_data['tap_link'] = result
                        
                        # Update image if needed and found (and it's not the default image)
                        if needs_image and details.get('image_url') and details['image_url'] != DEFAULT_IMAGE_URL:
                            update_data['image_url'] = details['image_url']
                            logger.info(f"Found image URL: {details['image_url']}")
                        
                        # Only update if we found something new to update
                        if update_data:
                            # Update fighter record
                            response = supabase.table('fighters') \
                                .update(update_data) \
                                .eq('fighter_name', fighter_name) \
                                .execute()
                            
                            if response.data:
                                success_count += 1
                                batch_success += 1
                                consecutive_errors = 0
                                logger.info(f"Updated {fighter_name}:")
                                if 'tap_link' in update_data:
                                    logger.info(f"  New link: {update_data['tap_link']}")
                                    if current_link:
                                        logger.info(f"  (Previous link: {current_link})")
                                if 'image_url' in update_data:
                                    logger.info(f"  New image: {update_data['image_url']}")
                                    if current_image:
                                        logger.info(f"  (Previous image: {current_image})")
                        else:
                            logger.info(f"No new data found for {fighter_name}")
                    else:
                        error_count += 1
                        consecutive_errors += 1
                        logger.warning(f"Could not find Tapology data for {fighter_name}")
                except Exception as e:
                    error_count += 1
                    consecutive_errors += 1
                    logger.error(f"Failed to process {fighter_name}: {str(e)}")
                
                # Add extra delay if we're getting too many errors
                if consecutive_errors >= 2:  # Reduced threshold
                    delay = min(60 * (consecutive_errors - 1), 900)  # Max 15 minute delay
                    actual_delay = get_random_delay(delay)
                    logger.warning(f"Too many consecutive errors ({consecutive_errors}). Waiting {actual_delay:.1f} seconds...")
                    time.sleep(actual_delay)
                
                # Random delay between fighters (4-8 seconds)
                time.sleep(get_random_delay(6, 0.3))
            
            progress = (i + len(batch)) / total_fighters * 100
            logger.info(f"Progress: {progress:.1f}% ({min(i + batch_size, total_fighters)}/{total_fighters} fighters)")
            logger.info(f"Batch {current_batch} success rate: {batch_success}/{len(batch)}")
            
            # Add longer random delay between batches (20-40 seconds)
            batch_delay = get_random_delay(30, 0.3)
            logger.info(f"Batch complete. Waiting {batch_delay:.1f} seconds before next batch...")
            time.sleep(batch_delay)
        
        logger.info("\n" + "="*50)
        logger.info("Processing complete!")
        logger.info(f"Total fighters processed: {total_fighters}")
        logger.info(f"Successfully updated: {success_count}")
        logger.info(f"Errors: {error_count}")
        logger.info(f"Skipped (has both link and proper image): {total_fighters - success_count - error_count}")
        logger.info("="*50)
    except Exception as e:
        logger.error(f"Failed to process fighters: {str(e)}")
        raise

def test_multiple_fighters():
    """
    Test the search function with multiple fighters.
    """
    test_fighters = [
        "Jon Jones",
        "Conor McGregor",
        "Israel Adesanya",
        "Amanda Nunes",
        "Khabib Nurmagomedov"
    ]
    
    print("\nTesting search with multiple fighters:")
    print("=" * 50)
    
    for fighter in test_fighters:
        print(f"\nSearching for: {fighter}")
        result = search_fighter(fighter)
        if result:
            print(f"Found: {result}")
        else:
            print("No results found")
        time.sleep(2)  # Be nice to the server
        
    print("\n" + "=" * 50)

if __name__ == "__main__":
    # Set up logging
    logger = setup_logging()
    
    try:
        # Run the main process
        main()
    except KeyboardInterrupt:
        logger.info("\nScript interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)

    # Test the search function
    test_multiple_fighters()