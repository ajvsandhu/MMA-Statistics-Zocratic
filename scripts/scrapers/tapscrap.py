#!/usr/bin/env python
"""
Tapology Data Scraper

A simplified, human-like scraper for collecting fighter data from Tapology
with careful rate limiting to avoid detection.
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
from difflib import SequenceMatcher
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

# Default image URL as fallback
DEFAULT_IMAGE_URL = "https://static1.cbrimages.com/wordpress/wp-content/uploads/2021/01/Captain-Rocks.jpg"

def setup_logging():
    """Set up logging configuration with console handler only."""
    console_formatter = logging.Formatter('%(message)s')
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

# Progress tracking
PROGRESS_FILE = "tapology_scraper_progress.json"

# List of realistic User-Agents to rotate
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/116.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.69",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
]

# Referrers to rotate (makes requests look more natural)
REFERRERS = [
    "https://www.google.com/",
    "https://www.bing.com/",
    "https://duckduckgo.com/",
    "https://www.tapology.com/",
    "https://www.tapology.com/search",
    "https://www.tapology.com/fightcenter",
    None  # Sometimes no referrer
]

def get_human_headers():
    """Generate random headers that look like they're from a real browser."""
    user_agent = random.choice(USER_AGENTS)
    referrer = random.choice(REFERRERS)
    
    headers = {
        'User-Agent': user_agent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
        'DNT': '1',  # Do Not Track, varies between users
    }
    
    if referrer:
        headers['Referer'] = referrer
    
    # Randomly add extra headers sometimes used by browsers
    if random.random() < 0.3:
        headers['Sec-Fetch-Dest'] = 'document'
        headers['Sec-Fetch-Mode'] = 'navigate'
        headers['Sec-Fetch-Site'] = 'none' if not referrer else 'cross-site'
        headers['Sec-Fetch-User'] = '?1'
    
    return headers

def human_delay(seconds=30):
    """Add a consistent delay before web requests to avoid rate limiting."""
    logger.info(f"Waiting {seconds} seconds before next web request...")
    time.sleep(seconds)
    return seconds

def reset_progress(force=False):
    """Reset the scraping progress."""
    if not force:
        confirm = input("Are you sure you want to reset progress? This will delete the progress file. (y/N): ")
        if confirm.lower() != 'y':
            logger.info("Progress reset cancelled")
            return
    
    try:
        if os.path.exists(PROGRESS_FILE):
            os.remove(PROGRESS_FILE)
            logger.info(f"Progress file {PROGRESS_FILE} deleted")
        else:
            logger.info("No progress file found to delete")
        
        logger.info("Progress reset successfully")
    except Exception as e:
        logger.error(f"Failed to reset progress: {str(e)}")

def parse_args():
    """Parse command line arguments for scraper configuration."""
    parser = argparse.ArgumentParser(description='Tapology Fighter Scraper')
    parser.add_argument('--reset', action='store_true', help='Reset progress and start from the beginning')
    parser.add_argument('--force-reset', action='store_true', help='Force reset progress without confirmation')
    parser.add_argument('--start-index', type=int, default=None, help='Start processing from a specific fighter index')
    parser.add_argument('--batch-size', type=int, default=5, help='Number of fighters to process in each batch (default: 5)')
    parser.add_argument('--test', action='store_true', help='Run in test mode with a specific fighter')
    parser.add_argument('--test-fighter', type=str, default="Jon Jones", help='Specify the fighter name to test')
    return parser.parse_args()

def safe_request(url, timeout=30, max_retries=3, cooldown_time=180):
    """Make a request with error handling and rate limit detection."""
    for attempt in range(1, max_retries + 1):
        try:
         
            actual_timeout = timeout + random.uniform(-5, 5)
            actual_timeout = max(10, actual_timeout)  # Ensure minimum timeout
            
            # Get fresh headers for each request
            headers = get_human_headers()
            
            # Remove the small pre-request delay since we're using a flat delay before calling this function
            
            logger.info(f"Requesting {url}")
            response = requests.get(url, headers=headers, timeout=actual_timeout)
            
            # Handle rate limiting responses
            if response.status_code == 429 or "too many requests" in response.text.lower():
                retry_delay = cooldown_time * attempt
                logger.warning(f"Rate limited! Cooling down for {retry_delay} seconds...")
                time.sleep(retry_delay)
                continue
                
            # Check for other error status codes
            if response.status_code >= 400:
                logger.warning(f"Received status code {response.status_code} for {url}")
                if attempt < max_retries:
                    retry_delay = 60 * attempt
                    logger.info(f"Retrying in {retry_delay} seconds... (Attempt {attempt} of {max_retries})")
                    time.sleep(retry_delay)
                    continue
                return None
                
            # Return successful response
            return response
            
        except requests.Timeout:
            logger.warning(f"Request timed out for {url}")
            if attempt < max_retries:
                retry_delay = 60 * attempt
                logger.info(f"Retrying in {retry_delay} seconds... (Attempt {attempt} of {max_retries})")
                time.sleep(retry_delay)
            else:
                logger.error(f"Max retries reached for {url}")
                return None
                
        except requests.RequestException as e:
            logger.warning(f"Request error for {url}: {str(e)}")
            if attempt < max_retries:
                retry_delay = 60 * attempt
                logger.info(f"Retrying in {retry_delay} seconds... (Attempt {attempt} of {max_retries})")
                time.sleep(retry_delay)
            else:
                logger.error(f"Max retries reached for {url}")
                return None
            
        except Exception as e:
            logger.error(f"Unexpected error for {url}: {str(e)}")
            if attempt < max_retries:
                retry_delay = 60 * attempt
                logger.info(f"Retrying in {retry_delay} seconds... (Attempt {attempt} of {max_retries})")
                time.sleep(retry_delay)
            else:
                return None
    
    return None

def calculate_name_similarity(name1, name2):
    """Calculate similarity between two fighter names using multiple methods."""
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
    word_match_score = len(common_words) / max(len(words1), len(words2)) if max(len(words1), len(words2)) > 0 else 0
    scores.append(word_match_score)
    
    # Return highest score
    return max(scores)

def search_fighter(name):
    """Search for a fighter by name and return the best match."""
    try:
        # Create search URL
        search_url = f"https://www.tapology.com/search?term={quote_plus(name)}&search=fighters"
        logger.info(f"Searching for {name} at: {search_url}")
        
        # Web request - delay already added before this function call
        
        # Make the request
        response = safe_request(search_url)
        if not response:
            logger.warning(f"Failed to get search results for {name}")
            return None
        
        # Parse the response
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check for rate limiting
        if "too many requests" in soup.text.lower() or "rate limit" in soup.text.lower():
            logger.warning("Rate limiting detected, taking a long break")
            time.sleep(random.uniform(300, 600))  # 5-10 minute cooldown
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
        seen_urls = set()
        
        for selector in selectors:
            try:
                elements = soup.select(selector)
                
                for element in elements:
                    try:
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
                        
                        # Calculate similarity score
                        name_similarity = calculate_name_similarity(name, result_name)
                        
                        # Boost score if record or weight class is found
                        score = name_similarity
                        if record:
                            score += 0.1  # Small boost for having a record
                        if weight_class:
                            score += 0.1  # Small boost for having weight class
                        
                        if score > 0.6:  # Reasonable threshold for a match
                            results.append({
                                'score': score,
                                'name': result_name,
                                'url': full_url,
                                'record': record,
                                'weight_class': weight_class
                            })
                    except Exception as e:
                        logger.warning(f"Error processing result element: {str(e)}")
                        continue
            except Exception as e:
                logger.warning(f"Error with selector {selector}: {str(e)}")
                continue
        
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
    except Exception as e:
        logger.error(f"Error searching for fighter {name}: {str(e)}")
        return None
    
def get_fighter_details(url):
    """Get fighter details including image from their profile page."""
    if not url.startswith('http'):
        url = f"https://www.tapology.com{url}"
    
    # Web request - delay already added before this function call
    
    # Request the fighter's profile page
    response = safe_request(url)
    if not response:
        logger.warning(f"Failed to get fighter details from {url}")
        return {}
    
    # Parse the response
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
            # Clean the image URL
            details['image_url'] = image_url.split('?')[0]
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
                    test_response = safe_request(letterbox_url)
                    if test_response and test_response.status_code == 200:
                        details['image_url'] = letterbox_url
                        image_found = True
    
    # If still not found, try general image search in content
    if not image_found:
        for img in soup.select('img'):
            src = img.get('src', '')
            if 'tapology.com' in src and 'letterbox_images' in src:
                # Clean the image URL
                details['image_url'] = src.split('?')[0]
                break
    
    return details

def update_fighter_in_database(fighter_name, tap_link, image_url=None):
    """Update fighter info in database."""
    try:
        supabase = get_supabase_client()
        if not supabase:
            logger.error("Failed to get Supabase client")
            return False
        
        # Prepare update data
        update_data = {"tap_link": tap_link}
        if image_url:
            update_data["image_url"] = image_url
        
        # Make the update
        logger.info(f"Updating database for {fighter_name}")
        response = supabase.table("fighters").update(update_data).eq("fighter_name", fighter_name).execute()
        
        if response.data:
            logger.info(f"Successfully updated {fighter_name} with Tapology link: {tap_link}")
            if image_url:
                logger.info(f"Updated image URL for {fighter_name}")
            return True
        else:
            logger.warning(f"Update returned no data for {fighter_name}")
            return False
    except Exception as e:
        logger.error(f"Database error updating {fighter_name}: {str(e)}")
        return False
        
def process_fighter(fighter_data):
    """Process a single fighter."""
    fighter_name = fighter_data['fighter_name']
    current_link = fighter_data.get('tap_link')
    current_image = fighter_data.get('image_url')
    
    # Determine if we need to search for missing data
    needs_link = not current_link
    needs_image = not current_image or current_image == DEFAULT_IMAGE_URL
    
    if not needs_link and not needs_image:
        logger.info(f"Skipping {fighter_name} - has both link and proper image")
        return True

    # Search for fighter - add delay before web request
    human_delay()
    tap_link = search_fighter(fighter_name)
    
    if not tap_link:
        logger.warning(f"Could not find Tapology link for {fighter_name}")
        return False
    
    # Only get details if we need an image or found a new link
    fighter_details = {}
    if needs_image or (needs_link and tap_link != current_link):
        # Remove delay after best match selection
        fighter_details = get_fighter_details(tap_link)
    
    # Update database - no delay needed for database operations
    image_url = fighter_details.get('image_url')
    result = update_fighter_in_database(fighter_name, tap_link, image_url)
    
    # Add a short delay after database update - vital for completion
    logger.info(f"Database updated, allowing time for operation to complete...")
    time.sleep(5)
    
    return result

def save_progress(current_index, total_processed, success_count, error_count):
    """Save current progress to file."""
    try:
        with open(PROGRESS_FILE, 'w') as f:
            json.dump({
                'last_index': current_index,
                'total_processed': total_processed,
                'success_count': success_count, 
                'error_count': error_count,
                'timestamp': datetime.datetime.now().isoformat()
            }, f)
        logger.info(f"Progress saved: {current_index}/{total_processed}")
    except Exception as e:
        logger.warning(f"Failed to save progress: {str(e)}")

def load_progress():
    """Load saved progress from file."""
    try:
        if not os.path.exists(PROGRESS_FILE):
            return 0
            
        with open(PROGRESS_FILE, 'r') as f:
            state = json.load(f)
            
        logger.info(f"Loaded progress: index={state.get('last_index', 0)}, processed={state.get('total_processed', 0)}")
        return state.get('last_index', 0)
    except Exception as e:
        logger.warning(f"Failed to load progress: {str(e)}")
        return 0

def main():
    """Main scraper process."""
    try:
        # Parse command line arguments
        args = parse_args()
        
        # Handle reset flags
        if args.force_reset:
            reset_progress(force=True)
        elif args.reset:
            reset_progress()
        
        # Test mode - process a single fighter
        if args.test:
            logger.info(f"Running in test mode with fighter: {args.test_fighter}")
            test_fighter = {'fighter_name': args.test_fighter}
            process_fighter(test_fighter)
            return
        
        logger.info("Connecting to database...")
        supabase = get_supabase_client()
        
        # Test the connection
        logger.info("Testing database connection...")
        count_response = supabase.table('fighters').select('count', count='exact').execute()
        total_count = count_response.count
        logger.info(f"Total fighters in database: {total_count}")
        
        # Load starting index (handle command line override)
        start_index = args.start_index if args.start_index is not None else load_progress()
        
        # Fetch all fighters
        logger.info(f"Fetching fighters starting from index {start_index}...")
        response = supabase.table('fighters').select('fighter_name, tap_link, image_url').order('fighter_name').limit(5000).execute()
        
        all_fighters = response.data
        logger.info(f"Fetched {len(all_fighters)} fighters")
        
        # Process in small batches
        batch_size = min(args.batch_size, 10)  # Increased batch size
        success_count = 0
        error_count = 0
        
        # Start from saved index
        for i in range(start_index, len(all_fighters)):
            fighter = all_fighters[i]
            fighter_name = fighter['fighter_name']
            
            logger.info(f"\n--- Processing fighter {i+1}/{len(all_fighters)}: {fighter_name} ---")
            
            try:
                # Check if fighter already has complete data - no delay needed for db check
                has_complete_data = (fighter.get('tap_link') and 
                                   fighter.get('image_url') and 
                                   fighter.get('image_url') != DEFAULT_IMAGE_URL)
                
                if has_complete_data:
                    logger.info(f"Skipping {fighter_name} - already has complete data")
                    success_count += 1
                else:
                    # Process fighter that needs data
                    if process_fighter(fighter):
                        success_count += 1
                    else:
                        error_count += 1
                
                # Save progress periodically - no delay needed
                if (i + 1) % 5 == 0:
                    save_progress(i, i + 1, success_count, error_count)
                
                # Take a break after every few fighters to avoid patterns, but only if we made web requests
                if (i + 1) % batch_size == 0 and not has_complete_data:
                    logger.info(f"Completed batch of {batch_size} fighters. Taking a longer break...")
                    time.sleep(60)  # 1 minute break between batches
            except Exception as e:
                logger.error(f"Error processing fighter {fighter_name}: {str(e)}")
                error_count += 1
                continue
        
        # Progress update
        progress = (i + 1) / len(all_fighters) * 100
        logger.info(f"Progress: {progress:.1f}% ({i+1}/{len(all_fighters)} fighters)")
        logger.info(f"Stats: {success_count} successes, {error_count} errors")
        
        # Final progress save
        save_progress(len(all_fighters) - 1, len(all_fighters), success_count, error_count)
        
        logger.info("\n" + "="*50)
        logger.info("Processing complete!")
        logger.info(f"Total fighters processed: {len(all_fighters) - start_index}")
        logger.info(f"Successfully updated: {success_count}")
        logger.info(f"Errors: {error_count}")
        logger.info("="*50)
        
    except Exception as e:
        logger.error(f"Fatal error in main: {str(e)}")
        raise

if __name__ == "__main__":
    # Run the main process
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nScript interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        sys.exit(1)