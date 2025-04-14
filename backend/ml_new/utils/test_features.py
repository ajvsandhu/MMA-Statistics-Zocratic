#!/usr/bin/env python
"""
Test script for advanced feature engineering module.
This script loads fighter data from Supabase and creates fighter profiles
to verify that the feature engineering is working correctly.
"""

import os
import sys
import pandas as pd
import logging
from supabase import create_client
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.ml_new.utils.advanced_features import FighterProfiler, MatchupAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def fetch_all_data(supabase, table_name: str) -> pd.DataFrame:
    """Fetch all data from a table using pagination"""
    logger.info(f"Fetching data from {table_name}...")
    all_data = []
    offset = 0
    limit = 1000
    
    while True:
        response = supabase.table(table_name).select("*").range(offset, offset + limit - 1).execute()
        data = response.data
        
        if not data:
            break
            
        all_data.extend(data)
        logger.info(f"  Fetched {len(data)} rows, total so far: {len(all_data)}")
        offset += limit
        
        if len(data) < limit:
            break
    
    return pd.DataFrame(all_data)

def main():
    """Main function to test the FighterProfiler and MatchupAnalyzer"""
    # Supabase connection - Load from environment variables
    url = os.getenv("SUPABASE_URL") 
    key = os.getenv("SUPABASE_KEY")
    
    if not url or not key:
        logger.error("Supabase URL or Key not found in environment variables. Ensure .env file is present and loaded.")
        sys.exit(1)
    
    supabase = None # Initialize outside try block
    try:
        # Connect to Supabase
        supabase = create_client(url, key)
        
        # Fetch data
        fighters_df = fetch_all_data(supabase, "fighters")
        fights_df = fetch_all_data(supabase, "fighter_last_5_fights")
        
        logger.info(f"Fetched {len(fighters_df)} fighters and {len(fights_df)} fights")
        
        # Create fighter profiler
        profiler = FighterProfiler(fighters_df, fights_df)
        
        # Build all profiles first (can be time-consuming, consider optional pre-computation/caching later)
        logger.info("\nBuilding profiles for all fighters...")
        # Note: build_all_profiles might not be defined in FighterProfiler, 
        # profiles are usually built on demand via get_fighter_profile. 
        # If build_all_profiles is needed, it must be implemented in FighterProfiler.
        # Assuming profiles are built lazily for now.
        all_profiles = {} # Placeholder, profiles built via get_fighter_profile later
        # You might want to explicitly build profiles for test fighters if needed upfront
        # for name in test_fighters: 
        #     all_profiles[name] = profiler.get_fighter_profile(name)
        logger.info(f"Profiler initialized. Profiles will be built on demand.")

        # --- Test FighterProfiler ---
        test_fighters = [
            "Charles Oliveira",
            "Islam Makhachev",
            "Jon Jones",
            "Alex Pereira",
            "Israel Adesanya",
            "Paddy Pimblett"
        ]
        
        logger.info("\n--- Testing Fighter Profiles ---")
        for fighter_name in test_fighters:
            logger.info(f"\nProfile for: {fighter_name}")
            profile = profiler.get_fighter_profile(fighter_name)
            all_profiles[fighter_name] = profile # Store fetched profile
            
            if profile:
                # Updated to use correct keys based on FighterProfiler implementation
                logger.info(f"  Record: {profile.get('wins_record', 0)}-{profile.get('losses_record', 0)}-{profile.get('draws_record', 0)}")
                logger.info(f"  Rank Score: {profile.get('rank_score', 0):.2f}")
                logger.info(f"  Weighted Win Rate: {profile.get('weighted_win_rate', 0) * 100:.1f}%")
                logger.info(f"  Striking Style: {profile.get('striking_style', 'Unknown')}")
                logger.info(f"  Grappling Style: {profile.get('grappling_style', 'Unknown')}")
                logger.info(f"  Opponent Quality: {profile.get('opponent_quality_score', 0.5):.2f}")
                logger.info(f"  KO Vulnerability: {profile.get('ko_vulnerability', 0):.2f}")
                logger.info(f"  Sub Vulnerability: {profile.get('sub_vulnerability', 0):.2f}") # Fixed key name
            else:
                logger.warning(f"No profile found for {fighter_name}")

        # --- Test MatchupAnalyzer ---
        logger.info("\n--- Testing Matchup Analyzer ---")
        analyzer = MatchupAnalyzer(profiler, fights_df)
        
        test_matchups = [
            ("Charles Oliveira", "Islam Makhachev"),
            ("Alex Pereira", "Israel Adesanya"), 
            ("Jon Jones", "Stipe Miocic"), # Might need to check if Miocic exists
            ("Paddy Pimblett", "Tony Ferguson") # Check if Ferguson exists
        ]
        
        for f1, f2 in test_matchups:
            logger.info(f"\nAnalyzing matchup: {f1} vs {f2}")
            
            # Check if both fighters have profiles already fetched
            if f1 not in all_profiles or f2 not in all_profiles or not all_profiles.get(f1) or not all_profiles.get(f2):
                 logger.warning(f"Skipping matchup - one or both fighters not found or profile missing: {f1 if f1 not in all_profiles or not all_profiles.get(f1) else ''} {f2 if f2 not in all_profiles or not all_profiles.get(f2) else ''}")
                 continue

            matchup_features = analyzer.get_matchup_features(f1, f2)
            
            if matchup_features:
                logger.info(f"  Height Advantage (f1): {matchup_features.get('height_advantage', 0):.1f}") # Fixed extra quote
                logger.info(f"  Reach Advantage (f1): {matchup_features.get('reach_advantage', 0):.1f}") # Fixed extra quote
                # Fixed feature keys to match MatchupAnalyzer implementation
                logger.info(f"  SLpM Advantage (f1): {matchup_features.get('slpm_advantage', 0):.2f}")
                logger.info(f"  KO Potential Adv (f1): {matchup_features.get('ko_potential_advantage', 0):.2f}")
                logger.info(f"  TD Avg Advantage (f1): {matchup_features.get('td_avg_advantage', 0):.2f}")
                logger.info(f"  Sub Potential Adv (f1): {matchup_features.get('sub_potential_advantage', 0):.2f}")
                logger.info(f"  Opponent Quality Adv (f1): {matchup_features.get('opponent_quality_advantage', 0):.2f}")
                logger.info(f"  Fought Before: {'Yes' if matchup_features.get('fought_before', 0) == 1 else 'No'}")
                if matchup_features.get('fought_before', 0) == 1:
                     logger.info(f"  H2H Record Adv (f1): {matchup_features.get('h2h_record_advantage', 0)}")
                logger.info(f"  Common Opponent Adv (f1): {matchup_features.get('common_opponent_advantage', 0)}")
            else:
                logger.warning(f"Could not generate matchup features for {f1} vs {f2}")

        # Test final prediction feature generation
        logger.info("\n--- Testing Prediction Feature Generation ---")
        f1, f2 = "Charles Oliveira", "Islam Makhachev"
        if f1 in all_profiles and f2 in all_profiles and all_profiles.get(f1) and all_profiles.get(f2):
            prediction_features = analyzer.get_prediction_features(f1, f2)
            if prediction_features:
                logger.info(f"Generated {len(prediction_features)} features for {f1} vs {f2}")
                # Log a few example features
                example_keys = list(prediction_features.keys())[:5] + list(prediction_features.keys())[-5:]
                example_features_str = ", ".join([f'{k}: {prediction_features[k]:.2f}' for k in example_keys])
                logger.info(f"  Example features: {{ {example_features_str} }}")
            else:
                logger.warning(f"Could not generate prediction features for {f1} vs {f2}")
        else:
             logger.warning(f"Skipping prediction feature test - fighters not found or profiles missing: {f1} vs {f2}")

    except Exception as e:
        logger.error(f"Error in test script: {str(e)}", exc_info=True) # Added exc_info for traceback

if __name__ == "__main__":
    main() 