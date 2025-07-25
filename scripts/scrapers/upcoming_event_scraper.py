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
from datetime import datetime
import pandas as pd
import numpy as np

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
    # Initialize Supabase client
    supabase = get_supabase_client()
    # Test Supabase connection
    if not supabase:
        logger.warning("Could not connect to Supabase. Fighter IDs will not be available.")
        db_available = False
    else:
        db_available = True
except ImportError as e:
    logger.warning(f"Error importing database module: {str(e)}")
    logger.warning("Fighter IDs will not be available.")
    supabase = None
    db_available = False
except Exception as e:
    logger.warning(f"Error connecting to database: {str(e)}")
    logger.warning("Fighter IDs will not be available.")
    supabase = None
    db_available = False

# Try to import ML components for predictions
try:
    # Import required ML components directly
    from backend.ml_new.utils.data_loader import DataLoader
    from backend.ml_new.models.trainer import UFCTrainer
    from backend.ml_new.utils.advanced_features import FighterProfiler, MatchupAnalyzer
    from backend.ml_new.config.settings import DATA_DIR
    from datetime import timezone
    
    ml_initialized = False
    data_loader = None
    profiler = None
    analyzer = None
    trainer = None
    
    def init_ml_components():
        """Initialize ML components needed for predictions"""
        global ml_initialized, data_loader, profiler, analyzer, trainer
        
        if not ml_initialized:
            logger.info("Initializing ML components for predictions...")
            try:
                # 1. Load DataLoader
                logger.info("Loading DataLoader...")
                data_loader = DataLoader()
                
                # 2. Load Data using DataLoader
                logger.info("Loading fighters and fights data...")
                fighters_df = data_loader.load_fighters()
                fights_df = data_loader.load_fights()
                logger.info(f"Loaded {len(fighters_df)} fighters and {len(fights_df)} fights.")
                
                # Preprocess fights_df date column
                logger.info("Preprocessing fight dates...")
                fights_df['fight_date'] = pd.to_datetime(fights_df['fight_date'], errors='coerce')
                if fights_df['fight_date'].dt.tz is None:
                    fights_df['fight_date'] = fights_df['fight_date'].dt.tz_localize(timezone.utc)
                else:
                    fights_df['fight_date'] = fights_df['fight_date'].dt.tz_convert(timezone.utc)
                fights_df.dropna(subset=['fight_date'], inplace=True)  # Drop rows missing critical date info
                
                # 3. Load Profiler & Analyzer
                logger.info("Initializing FighterProfiler...")
                profiler = FighterProfiler(fighters_df, fights_df)
                logger.info("Initializing MatchupAnalyzer...")
                analyzer = MatchupAnalyzer(profiler, fights_df)
                
                # 4. Load Model Trainer
                logger.info("Initializing UFCTrainer...")
                trainer = UFCTrainer()
                logger.info("Loading latest model from bucket...")
                # Use the bucket method to get the most recent model
                model_info = trainer.load_latest_model_from_bucket_direct()
                logger.info(f"Successfully loaded model: {model_info.get('model_version', 'unknown')} from bucket")
                
                if trainer.model and trainer.features is not None:
                    ml_initialized = True
                    logger.info("ML components initialized successfully.")
                    return True
                else:
                    logger.warning("Model or features not loaded properly.")
                    return False
                    
            except Exception as e:
                logger.error(f"Error initializing ML components: {str(e)}")
                import traceback
                traceback.print_exc()
                return False
                
        return ml_initialized
    
    predictions_available = True
except ImportError as e:
    logger.warning(f"Error importing ML components: {str(e)}")
    logger.warning("Fight predictions will not be available.")
    predictions_available = False
except Exception as e:
    logger.warning(f"Error setting up ML components: {str(e)}")
    logger.warning("Fight predictions will not be available.")
    predictions_available = False

# Try to import odds service
try:
    from backend.api.utils.odds_service import get_odds_service
    odds_service_available = True
    logger.info("Odds service imported successfully")
except ImportError as e:
    logger.warning(f"Error importing odds service: {str(e)}")
    logger.warning("Odds data will not be available.")
    odds_service_available = False
    get_odds_service = None
except Exception as e:
    logger.warning(f"Error setting up odds service: {str(e)}")
    logger.warning("Odds data will not be available.")
    odds_service_available = False
    get_odds_service = None

def fetch_upcoming_event(max_retries=3):
    """Fetch the next upcoming UFC event from ufcstats.com"""
    # First try the upcoming events page
    url = "http://ufcstats.com/statistics/events/upcoming"
    logger.info(f"Fetching upcoming event from {url}")
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(url, timeout=(5, 30))
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Method 1: Find the table containing upcoming events
            table_container = soup.find("div", class_="b-statistics__table-wrap")
            if table_container:
                events_table = table_container.find("table")
                if events_table:
                    # Get the first row which should be the next upcoming event
                    rows = events_table.find_all("tr")[1:]  # Skip header row
                    if rows:
                        # Extract event information from the first row
                        row = rows[0]
                        link_tag = row.find("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                        
                        if link_tag:
                            event_url = link_tag["href"].strip()
                            event_name = link_tag.get_text(strip=True)
                            
                            # Try to find the date
                            date_text = ""
                            date_span = row.find("span", class_="b-statistics__date")
                            if date_span:
                                date_text = date_span.get_text(strip=True)
                            
                            logger.info(f"Found upcoming event: {event_name} - {date_text}")
                            return {
                                "url": event_url,
                                "name": event_name,
                                "date": date_text
                            }
            
            # Method 2: Look for any table
            tables = soup.find_all("table")
            for table in tables:
                rows = table.find_all("tr")[1:] if len(table.find_all("tr")) > 1 else []
                for row in rows:
                    link_tag = row.find("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                    if link_tag:
                        event_url = link_tag["href"].strip()
                        event_name = link_tag.get_text(strip=True)
                        
                        # Try to find the date
                        date_text = ""
                        date_span = row.find("span", class_="b-statistics__date")
                        if date_span:
                            date_text = date_span.get_text(strip=True)
                        
                        logger.info(f"Found upcoming event: {event_name} - {date_text}")
                        return {
                            "url": event_url,
                            "name": event_name,
                            "date": date_text
                        }
            
            # Method 3: Look for links to event details directly
            logger.warning("Could not find event tables, trying direct link search")
            all_links = soup.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
            
            if all_links:
                # Assume the first link is the next event
                link = all_links[0]
                event_url = link["href"].strip()
                event_name = link.get_text(strip=True)
                
                # Try to find a date
                date_text = ""
                parent = link.parent
                date_span = parent.find("span", class_="b-statistics__date")
                if date_span:
                    date_text = date_span.get_text(strip=True)
                
                logger.info(f"Found upcoming event: {event_name} - {date_text}")
                return {
                    "url": event_url,
                    "name": event_name,
                    "date": date_text
                }
            
            # If we get here, try the main page as a fallback
            logger.warning("Could not find upcoming events, trying main page")
            main_url = "http://ufcstats.com/"
            main_resp = session.get(main_url, timeout=(5, 30))
            main_resp.raise_for_status()
            
            main_soup = BeautifulSoup(main_resp.text, "html.parser")
            
            # Look for a section that might contain the next event
            next_event_section = main_soup.find("div", class_="b-content__title")
            if next_event_section:
                link_tag = next_event_section.find("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
                if link_tag:
                    event_url = link_tag["href"].strip()
                    event_name = link_tag.get_text(strip=True)
                    
                    date_text = ""
                    date_span = next_event_section.find("span", class_="b-content__date")
                    if date_span:
                        date_text = date_span.get_text(strip=True)
                    
                    logger.info(f"Found upcoming event from main page: {event_name} - {date_text}")
                    return {
                        "url": event_url,
                        "name": event_name,
                        "date": date_text
                    }
            
            # One more attempt - look for any event links on the main page
            main_event_links = main_soup.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/event-details/"))
            if main_event_links:
                # Get the first one, which is likely the most recent/upcoming
                link = main_event_links[0]
                event_url = link["href"].strip()
                event_name = link.get_text(strip=True)
                
                logger.info(f"Found event from main page links: {event_name}")
                return {
                    "url": event_url,
                    "name": event_name,
                    "date": ""  # We may not be able to extract the date in this case
                }
            
            logger.error("Could not find any upcoming events")
            return None
            
        except requests.exceptions.Timeout as e:
            logger.warning(f"Timeout fetching events, attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
        except Exception as e:
            logger.error(f"Failed to fetch upcoming event: {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                return None
    
    return None

def extract_matchups_from_event(event_url, max_retries=3):
    """Extract all matchups from a UFC event page with fighter details"""
    logger.info(f"Extracting matchups from event: {event_url}")
    
    for attempt in range(1, max_retries + 1):
        try:
            time.sleep(random.uniform(1.0, 2.0))
            resp = session.get(event_url, timeout=(5, 30))
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, "html.parser")
            matchups = []
            
            # Find all tables that contain fight details
            fight_tables = soup.find_all("table", class_="b-fight-details__table")
            
            if not fight_tables:
                logger.warning("Could not find specific fight tables, trying alternative method")
                # Try a more generic approach
                rows = soup.find_all("tr", class_="b-fight-details__table-row")
                
                current_matchup = {}
                fighter_count = 0
                
                for row in rows:
                    # Skip header rows
                    if "b-fight-details__table-header" in row.get("class", []):
                        continue
                    
                    # Look for fighter links
                    fighter_links = row.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
                    
                    # If we found fighter links, process them
                    for link in fighter_links:
                        fighter_url = link["href"].strip()
                        fighter_name = link.get_text(strip=True)
                        
                        if fighter_count % 2 == 0:
                            # Start a new matchup
                            current_matchup = {
                                "fighter1_name": fighter_name,
                                "fighter1_url": fighter_url,
                                "fighter2_name": "",
                                "fighter2_url": ""
                            }
                        else:
                            # Complete the current matchup
                            current_matchup["fighter2_name"] = fighter_name
                            current_matchup["fighter2_url"] = fighter_url
                            matchups.append(current_matchup.copy())
                        
                        fighter_count += 1
            else:
                # Process each fight table
                for table in fight_tables:
                    rows = table.find_all("tr")
                    if len(rows) < 2:
                        continue
                    
                    # Skip header row
                    data_rows = [r for r in rows if "b-fight-details__table-header" not in r.get("class", [])]
                    
                    fighter_links = []
                    for row in data_rows:
                        links = row.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
                        for link in links:
                            fighter_url = link["href"].strip()
                            fighter_name = link.get_text(strip=True)
                            fighter_links.append((fighter_name, fighter_url))
                    
                    # Process fighter links in pairs
                    for i in range(0, len(fighter_links), 2):
                        if i + 1 < len(fighter_links):
                            matchup = {
                                "fighter1_name": fighter_links[i][0],
                                "fighter1_url": fighter_links[i][1],
                                "fighter2_name": fighter_links[i+1][0],
                                "fighter2_url": fighter_links[i+1][1]
                            }
                            matchups.append(matchup)
            
            # If we still didn't find any matchups, try one more approach
            if not matchups:
                logger.warning("Could not find matchups using table approach, trying direct fighter link extraction")
                
                # Get all fighter links
                all_links = soup.find_all("a", href=lambda href: href and href.startswith("http://ufcstats.com/fighter-details/"))
                fighter_links = [(link.get_text(strip=True), link["href"].strip()) for link in all_links]
                
                # Process fighter links in pairs
                for i in range(0, len(fighter_links), 2):
                    if i + 1 < len(fighter_links):
                        matchup = {
                            "fighter1_name": fighter_links[i][0],
                            "fighter1_url": fighter_links[i][1],
                            "fighter2_name": fighter_links[i+1][0],
                            "fighter2_url": fighter_links[i+1][1]
                        }
                        matchups.append(matchup)
            
            logger.info(f"Found {len(matchups)} matchups in event")
            return matchups
            
        except requests.exceptions.Timeout as e:
            logger.warning(f"Timeout extracting matchups, attempt {attempt}/{max_retries}: {e}")
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
        except Exception as e:
            logger.error(f"Failed to extract matchups: {e}")
            import traceback
            traceback.print_exc()
            if attempt < max_retries:
                wait_time = 2 ** attempt
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                return []
    
    return []

def get_fighter_id_by_url(fighter_url):
    """Get fighter ID and additional data from database by URL"""
    if not db_available or not supabase:
        return None, None, None
        
    try:
        response = supabase.table('fighters').select('id,tap_link,image_url').eq('fighter_url', fighter_url).execute()
        if response.data and len(response.data) > 0:
            fighter_data = response.data[0]
            return fighter_data['id'], fighter_data.get('tap_link'), fighter_data.get('image_url')
        return None, None, None
    except Exception as e:
        logger.error(f"Error getting fighter data by URL: {str(e)}")
        return None, None, None

def enrich_matchups_with_ids(matchups):
    """Add fighter IDs and additional data from the database to the matchups"""
    logger.info(f"Enriching {len(matchups)} matchups with fighter data")
    
    if not db_available:
        logger.warning("Database not available. Skipping data enrichment.")
        for matchup in matchups:
            matchup["fighter1_id"] = None
            matchup["fighter1_tap_link"] = None
            matchup["fighter1_image"] = None
            matchup["fighter2_id"] = None
            matchup["fighter2_tap_link"] = None
            matchup["fighter2_image"] = None
        return matchups
    
    for matchup in matchups:
        # Get fighter1 data
        fighter1_id, fighter1_tap_link, fighter1_image = get_fighter_id_by_url(matchup["fighter1_url"])
        if fighter1_id:
            matchup["fighter1_id"] = fighter1_id
            matchup["fighter1_tap_link"] = fighter1_tap_link
            matchup["fighter1_image"] = fighter1_image
        else:
            logger.warning(f"Could not find ID for fighter: {matchup['fighter1_name']}")
            matchup["fighter1_id"] = None
            matchup["fighter1_tap_link"] = None
            matchup["fighter1_image"] = None
            
        # Get fighter2 data
        fighter2_id, fighter2_tap_link, fighter2_image = get_fighter_id_by_url(matchup["fighter2_url"])
        if fighter2_id:
            matchup["fighter2_id"] = fighter2_id
            matchup["fighter2_tap_link"] = fighter2_tap_link
            matchup["fighter2_image"] = fighter2_image
        else:
            logger.warning(f"Could not find ID for fighter: {matchup['fighter2_name']}")
            matchup["fighter2_id"] = None
            matchup["fighter2_tap_link"] = None
            matchup["fighter2_image"] = None
    
    return matchups

def predict_fight(fighter1_name, fighter2_name, fighter1_id, fighter2_id):
    """Predict the outcome of a fight between two fighters"""
    if not predictions_available:
        logger.warning("Predictions are not available.")
        return None
    
    if not fighter1_id or not fighter2_id:
        logger.warning(f"Cannot make prediction without fighter IDs: {fighter1_name} vs {fighter2_name}")
        return None
    
    try:
        # Initialize ML components if not done yet
        if not init_ml_components():
            return None
        
        # Sort names alphabetically for canonical ordering
        # This ensures consistent feature generation regardless of input order
        original_fighter1_name = fighter1_name
        original_fighter2_name = fighter2_name
        ordered_names = sorted([original_fighter1_name, original_fighter2_name])
        canonical_f1_name = ordered_names[0]
        canonical_f2_name = ordered_names[1]
        order_swapped = original_fighter1_name != canonical_f1_name
        
        # Use current date as context date
        context_date = pd.Timestamp.now(tz=timezone.utc)
        
        logger.info(f"Generating prediction features for {fighter1_name} vs {fighter2_name}")
        
        # Generate prediction features for the canonical fighter order
        features_dict = analyzer.get_prediction_features(canonical_f1_name, canonical_f2_name, context_date)
        
        if not features_dict:
            logger.warning(f"Could not generate features for {fighter1_name} vs {fighter2_name}")
            return None
            
        # Get weights for possible weight class adjustment
        f1_weight = features_dict.get('f1_weight', 0.0)
        f2_weight = features_dict.get('f2_weight', 0.0)
        
        # Prepare DataFrame for model prediction
        prediction_df = pd.DataFrame([features_dict])
        
        # Ensure all required features are present
        model_features = trainer.features
        for col in model_features:
            if col not in prediction_df.columns:
                prediction_df[col] = 0.0
        prediction_df = prediction_df[model_features]
        
        # Clean up data
        if prediction_df.isna().any().any():
            prediction_df = prediction_df.fillna(0.0)
        if np.isinf(prediction_df).any().any():
            prediction_df.replace([np.inf, -np.inf], 0.0, inplace=True)
        
        # Make prediction
        probability_canonical_f1_model = trainer.predict_proba(prediction_df)[0][1]
        
        # Apply weight adjustment if there's a significant weight difference
        weight_diff = abs(f1_weight - f2_weight)
        weight_threshold = 20.0
        probability_canonical_f1_adjusted = probability_canonical_f1_model
        
        if weight_diff > weight_threshold:
            excess_weight = weight_diff - weight_threshold
            k = 0.15
            weight_impact = 1 / (1 + np.exp(-k * excess_weight))
            
            if f1_weight > f2_weight:  # Canonical F1 is heavier
                probability_canonical_f1_adjusted = probability_canonical_f1_model + (1 - probability_canonical_f1_model) * (2 * weight_impact - 1) if weight_impact > 0.5 else probability_canonical_f1_model
            else:  # Canonical F2 is heavier
                probability_canonical_f1_adjusted = probability_canonical_f1_model * (1 - (2 * weight_impact - 1)) if weight_impact > 0.5 else probability_canonical_f1_model
                
            probability_canonical_f1_adjusted = max(0.0, min(1.0, probability_canonical_f1_adjusted))
        
        # Re-orient probability for original input order
        if order_swapped:
            # If original F1 was canonical F2, the probability we want is 1 - P(canonical F1)
            final_probability_for_original_f1 = 1.0 - probability_canonical_f1_adjusted
        else:
            # Original F1 was canonical F1, use the probability directly
            final_probability_for_original_f1 = probability_canonical_f1_adjusted
        
        # Determine winner and confidence
        predicted_winner_name = original_fighter1_name if final_probability_for_original_f1 >= 0.5 else original_fighter2_name
        predicted_winner_id = fighter1_id if predicted_winner_name == original_fighter1_name else fighter2_id
        confidence = final_probability_for_original_f1 if predicted_winner_name == original_fighter1_name else 1.0 - final_probability_for_original_f1
        
        # Format the prediction result
        prediction_result = {
            "fighter1_name": original_fighter1_name,
            "fighter2_name": original_fighter2_name,
            "fighter1_id": fighter1_id,
            "fighter2_id": fighter2_id,
            "predicted_winner": predicted_winner_id,
            "predicted_winner_name": predicted_winner_name,
            "confidence_percent": float(round(confidence * 100, 2)),
            "fighter1_win_probability_percent": float(round(final_probability_for_original_f1 * 100, 2)),
            "fighter2_win_probability_percent": float(round((1.0 - final_probability_for_original_f1) * 100, 2))
        }
        
        # Convert NumPy types to Python native types for JSON serialization
        for key, value in prediction_result.items():
            if hasattr(value, "item") and callable(getattr(value, "item")):
                prediction_result[key] = value.item()
        
        logger.info(f"Prediction for {original_fighter1_name} vs {original_fighter2_name}: Winner {predicted_winner_name} ({round(confidence * 100, 2)}%)")
        return prediction_result
        
    except Exception as e:
        logger.error(f"Error making prediction for {fighter1_name} vs {fighter2_name}: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def add_predictions_to_matchups(matchups):
    """Add predictions to each matchup"""
    if not predictions_available:
        logger.warning("Predictions are not available. Skipping prediction step.")
        return matchups
    
    logger.info("Generating predictions for all matchups...")
    
    # Initialize ML components
    if not init_ml_components():
        logger.warning("Failed to initialize ML components. Skipping predictions.")
        return matchups
    
    for i, matchup in enumerate(matchups):
        logger.info(f"Generating prediction for matchup {i+1}/{len(matchups)}: {matchup['fighter1_name']} vs {matchup['fighter2_name']}")
        
        # Skip if we don't have both fighter IDs
        if not matchup.get('fighter1_id') or not matchup.get('fighter2_id'):
            logger.warning(f"Skipping prediction for {matchup['fighter1_name']} vs {matchup['fighter2_name']} - missing fighter ID(s)")
            matchup['prediction'] = None
            continue
        
        # Get prediction
        prediction = predict_fight(
            matchup['fighter1_name'], 
            matchup['fighter2_name'],
            matchup['fighter1_id'],
            matchup['fighter2_id']
        )
        
        # Add prediction to matchup
        matchup['prediction'] = prediction
    
    return matchups

def detect_fighter_changes(matchups, odds_events):
    """
    Detect potential fighter changes by comparing UFC Stats names with betting odds names.
    
    Args:
        matchups: List of matchups from UFC Stats
        odds_events: List of betting events from odds API
        
    Returns:
        List of detected changes with suggestions
    """
    if not odds_events or not matchups:
        logger.warning("No odds events or matchups to compare")
        return []
    
    logger.info(f"Starting fighter change detection with {len(matchups)} matchups and {len(odds_events)} odds events")
    detected_changes = []
    
    for i, matchup in enumerate(matchups):
        fighter1_name = matchup.get('fighter1_name', '').lower().strip()
        fighter2_name = matchup.get('fighter2_name', '').lower().strip()
        
        logger.debug(f"Checking matchup {i+1}: {fighter1_name} vs {fighter2_name}")
        
        # Find corresponding odds event - use more aggressive matching
        matching_odds_event = None
        best_match_score = 0
        
        for event in odds_events:
            home_team = event.get('home_team', '').lower().strip()
            away_team = event.get('away_team', '').lower().strip()
            
            # Calculate match score for this event
            match_score = 0
            
            # Check for partial name matches (more flexible)
            fighter1_parts = fighter1_name.split()
            fighter2_parts = fighter2_name.split()
            
            # Check each part of fighter names against odds teams
            for part in fighter1_parts:
                if len(part) >= 3:  # Lowered threshold
                    if part in home_team or part in away_team:
                        match_score += 0.5
                    # Enhanced similarity checking
                    if _calculate_name_similarity(part, home_team) > 0.7 or _calculate_name_similarity(part, away_team) > 0.7:
                        match_score += 0.4
            
            for part in fighter2_parts:
                if len(part) >= 3:  # Lowered threshold
                    if part in home_team or part in away_team:
                        match_score += 0.5
                    # Enhanced similarity checking
                    if _calculate_name_similarity(part, home_team) > 0.7 or _calculate_name_similarity(part, away_team) > 0.7:
                        match_score += 0.4
            
            # Also check if entire fighter name appears anywhere
            if fighter1_name and (fighter1_name in home_team or fighter1_name in away_team):
                match_score += 1
            if fighter2_name and (fighter2_name in home_team or fighter2_name in away_team):
                match_score += 1
                
            # Check overall name similarity
            if _calculate_name_similarity(fighter1_name, home_team) > 0.8 or _calculate_name_similarity(fighter1_name, away_team) > 0.8:
                match_score += 0.6
            if _calculate_name_similarity(fighter2_name, home_team) > 0.8 or _calculate_name_similarity(fighter2_name, away_team) > 0.8:
                match_score += 0.6
            
            if match_score > best_match_score and match_score >= 0.3:  # Lower threshold
                best_match_score = match_score
                matching_odds_event = event
                logger.debug(f"Found better match (score {match_score}): {home_team} vs {away_team}")
        
        if not matching_odds_event:
            logger.debug(f"No odds event found for {fighter1_name} vs {fighter2_name}")
            continue
            
        odds_home = matching_odds_event.get('home_team', '').lower().strip()
        odds_away = matching_odds_event.get('away_team', '').lower().strip()
        
        logger.info(f"Comparing UFC: '{fighter1_name}' vs '{fighter2_name}' with Odds: '{odds_home}' vs '{odds_away}'")
        
        # Check for mismatches
        changes = []
        
        # Check fighter1 vs both odds fighters
        f1_matches_home = _names_similar_enhanced(fighter1_name, odds_home)
        f1_matches_away = _names_similar_enhanced(fighter1_name, odds_away)
        f2_matches_home = _names_similar_enhanced(fighter2_name, odds_home)
        f2_matches_away = _names_similar_enhanced(fighter2_name, odds_away)
        
        logger.debug(f"Similarity check - F1 vs Home: {f1_matches_home}, F1 vs Away: {f1_matches_away}")
        logger.debug(f"Similarity check - F2 vs Home: {f2_matches_home}, F2 vs Away: {f2_matches_away}")
        
        # Case 1: Fighter1 doesn't match either odds fighter
        if not f1_matches_home and not f1_matches_away:
            # Determine which odds fighter should replace fighter1
            if f2_matches_home:
                # Fighter2 matches home, so fighter1 should be away
                suggested_replacement = odds_away
            elif f2_matches_away:
                # Fighter2 matches away, so fighter1 should be home
                suggested_replacement = odds_home
            else:
                # Neither fighter matches clearly, use the first one
                suggested_replacement = odds_home
                
            logger.warning(f"DETECTED CHANGE: Fighter1 '{fighter1_name}' doesn't match odds, suggesting '{suggested_replacement}'")
            changes.append({
                'type': 'fighter_replacement',
                'original_fighter': fighter1_name,
                'suggested_replacement': suggested_replacement,
                'position': 'fighter1',
                'confidence': 'high' if (f2_matches_home or f2_matches_away) else 'medium'
            })
        
        # Case 2: Fighter2 doesn't match either odds fighter
        if not f2_matches_home and not f2_matches_away:
            # Determine which odds fighter should replace fighter2
            if f1_matches_home:
                # Fighter1 matches home, so fighter2 should be away
                suggested_replacement = odds_away
            elif f1_matches_away:
                # Fighter1 matches away, so fighter2 should be home
                suggested_replacement = odds_home
            else:
                # Neither fighter matches clearly, use the second one
                suggested_replacement = odds_away
                
            logger.warning(f"DETECTED CHANGE: Fighter2 '{fighter2_name}' doesn't match odds, suggesting '{suggested_replacement}'")
            changes.append({
                'type': 'fighter_replacement',
                'original_fighter': fighter2_name,
                'suggested_replacement': suggested_replacement,
                'position': 'fighter2',
                'confidence': 'high' if (f1_matches_home or f1_matches_away) else 'medium'
            })
        
        if changes:
            detected_changes.append({
                'matchup': matchup,
                'odds_event': matching_odds_event,
                'detected_changes': changes,
                'odds_home_team': odds_home,
                'odds_away_team': odds_away
            })
            logger.warning(f"CHANGE DETECTED for matchup: {fighter1_name} vs {fighter2_name}")
        else:
            logger.debug(f"No changes detected for: {fighter1_name} vs {fighter2_name}")
    
    logger.info(f"Fighter change detection complete. Found {len(detected_changes)} potential changes.")
    return detected_changes

def _names_similar_enhanced(name1: str, name2: str, threshold: float = 0.6) -> bool:
    """Enhanced name similarity check with fuzzy matching"""
    if not name1 or not name2:
        return False
    
    # Normalize names
    name1 = name1.lower().strip()
    name2 = name2.lower().strip()
    
    # Direct match
    if name1 == name2:
        return True
    
    # Check if one name contains the other (with minimum length)
    if len(name1) >= 4 and len(name2) >= 4:
        if name1 in name2 or name2 in name1:
            return True
    
    # Check last names match
    name1_parts = name1.split()
    name2_parts = name2.split()
    
    if len(name1_parts) > 1 and len(name2_parts) > 1:
        if name1_parts[-1] == name2_parts[-1] and len(name1_parts[-1]) >= 3:  # Same last name, min 3 chars
            return True
    
    # Check first names match
    if len(name1_parts) > 0 and len(name2_parts) > 0:
        if name1_parts[0] == name2_parts[0] and len(name1_parts[0]) >= 3:  # Same first name, min 3 chars
            return True
    
    # Fuzzy matching using basic similarity
    def calculate_similarity(s1, s2):
        if len(s1) == 0 or len(s2) == 0:
            return 0.0
        
        # Simple character-based similarity
        longer = s1 if len(s1) > len(s2) else s2
        shorter = s2 if len(s1) > len(s2) else s1
        
        matches = sum(1 for i, char in enumerate(shorter) if i < len(longer) and char == longer[i])
        return matches / len(longer)
    
    similarity = calculate_similarity(name1, name2)
    return similarity >= threshold

def _calculate_name_similarity(name1: str, name2: str) -> float:
    """Calculate similarity between two names using edit distance"""
    if not name1 or not name2:
        return 0.0
    
    # Simple edit distance calculation
    def edit_distance(s1, s2):
        if len(s1) < len(s2):
            return edit_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    max_len = max(len(name1), len(name2))
    if max_len == 0:
        return 1.0
    
    distance = edit_distance(name1, name2)
    similarity = 1.0 - (distance / max_len)
    return similarity

def suggest_replacement_fighter(suggested_name):
    """
    Search the database for a fighter that matches the suggested replacement name.
    
    Args:
        suggested_name: Name from betting odds
        
    Returns:
        Fighter data if found, None otherwise
    """
    if not db_available or not supabase:
        logger.warning("Database not available for replacement search")
        return None
    
    try:
        # First try exact match
        response = supabase.table('fighters').select('*').eq('fighter_name', suggested_name).execute()
        if response.data:
            return response.data[0]
        
        # Try case-insensitive match
        response = supabase.table('fighters').select('*').ilike('fighter_name', f'%{suggested_name}%').execute()
        if response.data:
            # Return the best match
            for fighter in response.data:
                if _names_similar_enhanced(suggested_name, fighter['fighter_name'], threshold=0.8):
                    return fighter
        
        # No match found
        return None
        
    except Exception as e:
        logger.error(f"Error searching for replacement fighter: {str(e)}")
        return None

def apply_fighter_replacements(matchups, detected_changes):
    """
    Apply detected fighter replacements to matchups.
    
    Args:
        matchups: Original matchups
        detected_changes: List of detected changes
        
    Returns:
        Updated matchups with replacements applied
    """
    updated_matchups = matchups.copy()
    
    for change_info in detected_changes:
        matchup_to_update = None
        
        # Find the matchup in our list
        for i, matchup in enumerate(updated_matchups):
            if (matchup.get('fighter1_name') == change_info['matchup'].get('fighter1_name') and
                matchup.get('fighter2_name') == change_info['matchup'].get('fighter2_name')):
                matchup_to_update = i
                break
        
        if matchup_to_update is None:
            continue
        
        # Apply changes
        for change in change_info['detected_changes']:
            suggested_name = change['suggested_replacement']
            position = change['position']
            
            # Search for the replacement fighter in our database
            replacement_fighter = suggest_replacement_fighter(suggested_name)
            
            if replacement_fighter:
                logger.info(f"Found replacement fighter: {replacement_fighter['fighter_name']} for {change['original_fighter']}")
                
                # Update the matchup
                if position == 'fighter1':
                    updated_matchups[matchup_to_update]['fighter1_name'] = replacement_fighter['fighter_name']
                    updated_matchups[matchup_to_update]['fighter1_url'] = replacement_fighter['fighter_url']
                    updated_matchups[matchup_to_update]['fighter1_id'] = replacement_fighter.get('id')
                    updated_matchups[matchup_to_update]['fighter1_tap_link'] = replacement_fighter.get('tap_link')
                    updated_matchups[matchup_to_update]['fighter1_image'] = replacement_fighter.get('image_url')
                elif position == 'fighter2':
                    updated_matchups[matchup_to_update]['fighter2_name'] = replacement_fighter['fighter_name']
                    updated_matchups[matchup_to_update]['fighter2_url'] = replacement_fighter['fighter_url']
                    updated_matchups[matchup_to_update]['fighter2_id'] = replacement_fighter.get('id')
                    updated_matchups[matchup_to_update]['fighter2_tap_link'] = replacement_fighter.get('tap_link')
                    updated_matchups[matchup_to_update]['fighter2_image'] = replacement_fighter.get('image_url')
                
                # Mark as replaced
                updated_matchups[matchup_to_update]['has_replacement'] = True
                updated_matchups[matchup_to_update]['original_' + position + '_name'] = change['original_fighter']
            else:
                logger.warning(f"Could not find replacement fighter in database for: {suggested_name}")
    
    return updated_matchups

def add_odds_to_matchups(matchups):
    """Add betting odds to each matchup"""
    if not odds_service_available:
        logger.warning("Odds service is not available. Skipping odds step.")
        return matchups, None

    logger.info("Fetching betting odds for all matchups...")
    
    # Get odds service instance
    odds_service = get_odds_service()
    if not odds_service:
        logger.warning("Failed to initialize odds service. Skipping odds.")
        return matchups, None

    try:
        # Get all MMA odds from the API
        logger.info("Fetching MMA odds from Odds API...")
        odds_events = odds_service.get_mma_odds()
        
        if not odds_events:
            logger.warning("No MMA odds found from API")
            # Add empty odds data to all matchups
            for matchup in matchups:
                matchup['odds_data'] = None
                matchup['odds_event_id'] = None
            return matchups, None
        
        logger.info(f"Found {len(odds_events)} MMA events with odds")
        
        # EXTRACT EVENT START TIME from odds data
        event_start_time = None
        for event in odds_events:
            commence_time = event.get('commence_time')
            if commence_time:
                event_start_time = commence_time
                logger.info(f"Found event start time from odds API: {event_start_time}")
                break
        
        # DETECT FIGHTER CHANGES BEFORE MATCHING ODDS
        logger.info("Checking for potential fighter changes...")
        detected_changes = detect_fighter_changes(matchups, odds_events)
        
        if detected_changes:
            logger.warning(f"Detected {len(detected_changes)} potential fighter changes:")
            for change_info in detected_changes:
                logger.warning(f"Fight: {change_info['matchup']['fighter1_name']} vs {change_info['matchup']['fighter2_name']}")
                logger.warning(f"Odds show: {change_info['odds_home_team']} vs {change_info['odds_away_team']}")
                for change in change_info['detected_changes']:
                    logger.warning(f"  Suggested: Replace {change['original_fighter']} with {change['suggested_replacement']}")
            
            # Apply replacements
            logger.info("Applying fighter replacements...")
            matchups = apply_fighter_replacements(matchups, detected_changes)
            
            # REGENERATE PREDICTIONS for affected matchups
            if predictions_available:
                logger.info("Regenerating predictions for replaced fighters...")
                for change_info in detected_changes:
                    # Find the updated matchup
                    for matchup in matchups:
                        if matchup.get('has_replacement'):
                            logger.info(f"Regenerating prediction for updated matchup: {matchup['fighter1_name']} vs {matchup['fighter2_name']}")
                            
                            # Skip if we don't have both fighter IDs
                            if not matchup.get('fighter1_id') or not matchup.get('fighter2_id'):
                                logger.warning(f"Skipping prediction regeneration for {matchup['fighter1_name']} vs {matchup['fighter2_name']} - missing fighter ID(s)")
                                continue
                            
                            # Get new prediction
                            new_prediction = predict_fight(
                                matchup['fighter1_name'], 
                                matchup['fighter2_name'],
                                matchup['fighter1_id'],
                                matchup['fighter2_id']
                            )
                            
                            # Update prediction
                            if new_prediction:
                                matchup['prediction'] = new_prediction
                                logger.info(f"Updated prediction: {new_prediction['predicted_winner_name']} ({new_prediction['confidence_percent']}%)")
                            else:
                                logger.warning(f"Failed to generate new prediction for {matchup['fighter1_name']} vs {matchup['fighter2_name']}")
        
        # Use the odds service to match fighters to odds
        enriched_matchups = odds_service.match_fighters_to_odds(matchups, odds_events)
        
        # Count successful matches
        matched_count = sum(1 for m in enriched_matchups if m.get('odds_data') is not None)
        logger.info(f"Successfully matched {matched_count}/{len(enriched_matchups)} matchups with odds")
        
        return enriched_matchups, event_start_time
        
    except Exception as e:
        logger.error(f"Error adding odds to matchups: {str(e)}")
        # Return original matchups with empty odds data
        for matchup in matchups:
            matchup['odds_data'] = None
            matchup['odds_event_id'] = None
        return matchups, None

def save_to_database(event_data):
    """Save event data to the database using upsert to prevent duplicates"""
    if not db_available or not supabase:
        logger.error("Database not available. Cannot save event data.")
        return False
    
    try:
        # First, check if this event already exists based on event_url
        logger.info(f"Checking if event already exists: {event_data['event_name']}")
        existing_response = supabase.table('upcoming_events').select('*').eq('event_url', event_data['event_url']).execute()
        
        if existing_response.data and len(existing_response.data) > 0:
            # Event exists, update it
            existing_event = existing_response.data[0]
            logger.info(f"Event already exists with ID {existing_event['id']}, updating...")
            
            # First, deactivate all other events
            supabase.table('upcoming_events').update({'is_active': False}).neq('id', existing_event['id']).execute()
            
            # Update the existing event
            response = supabase.table('upcoming_events').update({
                'event_name': event_data['event_name'],
                'event_date': event_data['event_date'],
                'event_start_time': event_data.get('event_start_time'),
                'scraped_at': event_data['scraped_at'],
                'fights': event_data['fights'],
                'status': event_data.get('status', 'upcoming'),
                'total_fights': event_data.get('total_fights', 0),
                'completed_fights': event_data.get('completed_fights', 0),
                'results_updated_at': event_data.get('results_updated_at'),
                'is_active': True
            }).eq('id', existing_event['id']).execute()
            
            if response.data:
                logger.info(f"Successfully updated existing event with ID: {existing_event['id']}")
                return True
            else:
                logger.error("Failed to update existing event")
                return False
        else:
            # Event doesn't exist, create new one
            logger.info("Event doesn't exist, creating new one...")
            
        # First, deactivate any existing active events
        supabase.table('upcoming_events').update({'is_active': False}).eq('is_active', True).execute()
        
        # Insert the new event
        response = supabase.table('upcoming_events').insert({
            'event_name': event_data['event_name'],
            'event_date': event_data['event_date'],
            'event_url': event_data['event_url'],
            'event_start_time': event_data.get('event_start_time'),
            'scraped_at': event_data['scraped_at'],
            'fights': event_data['fights'],
            'status': event_data.get('status', 'upcoming'),
            'total_fights': event_data.get('total_fights', 0),
            'completed_fights': event_data.get('completed_fights', 0),
            'results_updated_at': event_data.get('results_updated_at'),
            'is_active': True
        }).execute()
        
        if response.data:
            logger.info(f"Successfully created new event with ID: {response.data[0]['id']}")
            return True
        else:
            logger.error("Failed to create new event")
            return False
            
    except Exception as e:
        logger.error(f"Error saving event to database: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def main():
    parser = argparse.ArgumentParser(description='UFC Upcoming Event Scraper')
    parser.add_argument('--output', type=str, default='frontend/public/upcoming_event.json',
                       help='Output file path (default: frontend/public/upcoming_event.json) - DEPRECATED, now saves to database')
    parser.add_argument('--no-predictions', action='store_true',
                       help='Skip generating predictions for matchups')
    parser.add_argument('--no-odds', action='store_true',
                       help='Skip fetching betting odds for matchups')
    parser.add_argument('--save-to-file', action='store_true',
                       help='Also save to JSON file (for backward compatibility)')
    args = parser.parse_args()
    
    # Create the directory if it doesn't exist (only if saving to file)
    if args.save_to_file:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Fetch the upcoming event
    event = fetch_upcoming_event()
    if not event:
        logger.error("Could not find upcoming event. Exiting.")
        return False
    
    # Display event information
    logger.info("="*50)
    logger.info(f"Upcoming event: {event['name']} - {event['date']}")
    logger.info("="*50)
    
    # Extract matchups from the event
    matchups = extract_matchups_from_event(event["url"])
    if not matchups:
        logger.error("Could not extract any matchups from the event. Exiting.")
        return False
    
    # Enrich matchups with fighter IDs from database
    enriched_matchups = enrich_matchups_with_ids(matchups)
    
    # Add predictions if requested
    if not args.no_predictions:
        enriched_matchups = add_predictions_to_matchups(enriched_matchups)
    
    # Add odds if requested and extract event start time
    event_start_time = None
    if not args.no_odds:
        enriched_matchups, event_start_time = add_odds_to_matchups(enriched_matchups)
    
    # Create the final event data structure
    event_data = {
        "event_name": event["name"],
        "event_date": event["date"],
        "event_url": event["url"],
        "event_start_time": event_start_time,
        "scraped_at": datetime.now().isoformat(),
        "status": "upcoming",
        "total_fights": len(enriched_matchups),
        "completed_fights": 0,
        "results_updated_at": None,
        "fights": enriched_matchups
    }
    
    # Enhance each fight with result fields
    for i, fight in enumerate(event_data["fights"]):
        fight.update({
            "fight_id": f"fight_{i+1}",
            "fight_order": i + 1,
            "status": "upcoming",  # upcoming, in_progress, completed
            "result": {
                "winner": None,
                "winner_name": None,
                "method": None,
                "round": None,
                "time": None,
                "details": None
            },
            "prediction_correct": None,
            "completed_at": None
        })
    
    # Save to database (primary method)
    database_success = save_to_database(event_data)
    
    # Optionally save to JSON file for backward compatibility
    if args.save_to_file:
        try:
            output_path = args.output
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(event_data, f, indent=2, ensure_ascii=False)
            logger.info(f"Successfully saved upcoming event data to {output_path}")
        except Exception as e:
            logger.error(f"Failed to save to JSON file: {str(e)}")
    
    # Log results
    logger.info(f"Event: {event['name']}")
    logger.info(f"Date: {event['date']}")
    logger.info(f"Fights: {len(enriched_matchups)}")
    
    # Count how many predictions were generated
    predictions_count = sum(1 for m in enriched_matchups if m.get('prediction') is not None)
    logger.info(f"Predictions generated: {predictions_count}/{len(enriched_matchups)}")
    
    # Count how many odds were fetched
    odds_count = sum(1 for m in enriched_matchups if m.get('odds_data') is not None)
    logger.info(f"Odds fetched: {odds_count}/{len(enriched_matchups)}")
    
    # Return success status
    if database_success:
        logger.info("✅ Event data successfully saved to database")
        return True
    else:
        logger.error("❌ Failed to save event data to database")
        return False

if __name__ == "__main__":
    main() 