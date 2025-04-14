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

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from backend.ml_new.utils.advanced_features import FighterProfiler, MatchupAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    # Supabase connection
    url = "https://jjfaidtdhuxmekdznwor.supabase.co"
    key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZmFpZHRkaHV4bWVrZHpud29yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Mjg3ODQxNCwiZXhwIjoyMDU4NDU0NDE0fQ._hEy5tjczZoiuR15S0eElSayPvSPUFkI0-IruKA-buA"
    
    try:
        # Connect to Supabase
        supabase = create_client(url, key)
        
        # Fetch data
        fighters_df = fetch_all_data(supabase, "fighters")
        fights_df = fetch_all_data(supabase, "fighter_last_5_fights")
        
        logger.info(f"Fetched {len(fighters_df)} fighters and {len(fights_df)} fights")
        
        # Create fighter profiler
        profiler = FighterProfiler(fighters_df, fights_df)
        
        # Build all profiles first (required for matchup analysis)
        logger.info("\nBuilding profiles for all fighters...")
        all_profiles = profiler.build_all_profiles()
        logger.info(f"Successfully built {len(all_profiles)} fighter profiles")

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
            
            if profile:
                logger.info(f"  Record: {profile.get('wins')}-{profile.get('losses')}-{profile.get('draws')}")
                logger.info(f"  Rank Score: {profile.get('rank_score', 0):.2f}")
                logger.info(f"  Weighted Win Rate: {profile.get('weighted_win_rate', 0) * 100:.1f}%")
                logger.info(f"  Striking Style: {profile.get('striking_style', 'Unknown')}")
                logger.info(f"  Grappling Style: {profile.get('grappling_style', 'Unknown')}")
                logger.info(f"  Opponent Quality: {profile.get('opponent_quality_score', 0.5):.2f}")
                logger.info(f"  KO Vulnerability: {profile.get('ko_vulnerability', 0):.2f}")
                logger.info(f"  Sub Vulnerability: {profile.get('submission_vulnerability', 0):.2f}")
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
            
            # Check if both fighters have profiles
            if f1 not in all_profiles or f2 not in all_profiles:
                logger.warning(f"Skipping matchup - one or both fighters not found: {f1 if f1 not in all_profiles else ''} {f2 if f2 not in all_profiles else ''}")
                continue

            matchup_features = analyzer.get_matchup_features(f1, f2)
            
            if matchup_features:
                logger.info(f"  Height Advantage (f1): {matchup_features.get('height_advantage', 0):.1f}"")
                logger.info(f"  Reach Advantage (f1): {matchup_features.get('reach_advantage', 0):.1f}"")
                logger.info(f"  Striking Eff. Adv (f1): {matchup_features.get('striking_effectiveness_advantage', 0):.2f}")
                logger.info(f"  KO Potential Adv (f1): {matchup_features.get('knockout_potential_advantage', 0):.2f}")
                logger.info(f"  Takedown Eff. Adv (f1): {matchup_features.get('takedown_effectiveness_advantage', 0):.2f}")
                logger.info(f"  Sub Potential Adv (f1): {matchup_features.get('submission_potential_advantage', 0):.2f}")
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
        if f1 in all_profiles and f2 in all_profiles:
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
             logger.warning(f"Skipping prediction feature test - fighters not found: {f1} vs {f2}")

    except Exception as e:
        logger.error(f"Error in test script: {str(e)}")

if __name__ == "__main__":
    main() 