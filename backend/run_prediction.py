"""
MMA Fight Prediction Demo Script

This script demonstrates the enhanced MMA fight predictor by running predictions on
different types of fighter matchups (active vs active, active vs retired, retired vs retired).

Usage:
  python -m backend.run_prediction

Optional arguments:
  --fighter1 NAME    First fighter name
  --fighter2 NAME    Second fighter name
  --batch            Run batch predictions with predefined matchups
"""

import os
import sys
import argparse
import logging
from typing import List, Tuple

from backend.ml.predictor import FighterPredictor
from backend.ml.feature_engineering import is_fighter_active
from backend.api.database import get_db_connection

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def get_status_emoji(is_active: bool) -> str:
    """Get an emoji representing fighter status."""
    return "🟢" if is_active else "🔴"

def print_prediction_details(prediction: dict) -> None:
    """Print detailed prediction information."""
    try:
        # Extract basic information
        fighter1_name = prediction.get('fighter1_name', 'Unknown')
        fighter2_name = prediction.get('fighter2_name', 'Unknown')
        fighter1_prob = prediction.get('fighter1_probability', 0)
        fighter2_prob = prediction.get('fighter2_probability', 0)
        fighter1_active = prediction.get('fighter1_active', False)
        fighter2_active = prediction.get('fighter2_active', False)
        matchup_type = prediction.get('matchup_type', 'unknown')
        
        # Format fighter names with status indicators
        fighter1_display = f"{get_status_emoji(fighter1_active)} {fighter1_name}"
        fighter2_display = f"{get_status_emoji(fighter2_active)} {fighter2_name}"
        
        # Print prediction header
        print("\n" + "=" * 80)
        print(f"FIGHT PREDICTION: {fighter1_display} vs {fighter2_display}")
        print(f"Matchup Type: {matchup_type.replace('_', ' ').title()}")
        print("-" * 80)
        
        # Print probabilities
        print(f"Win Probability:")
        print(f"  {fighter1_name}: {fighter1_prob}%")
        print(f"  {fighter2_name}: {fighter2_prob}%")
        
        # Determine winner
        winner = prediction.get('winner', '')
        winner_prob = prediction.get('winner_probability', 0)
        
        # Print prediction
        print("\nPrediction:")
        confidence = "High" if winner_prob > 70 else "Medium" if winner_prob > 60 else "Low"
        print(f"  {winner} wins with {confidence} confidence ({winner_prob}%)")
        
        # Print key factors if available
        if 'key_factors' in prediction and prediction['key_factors']:
            print("\nKey Factors:")
            for i, factor in enumerate(prediction['key_factors'][:5]):
                print(f"  {i+1}. {factor['name']}")
        
        print("=" * 80)
            
    except Exception as e:
        logger.error(f"Error printing prediction: {str(e)}")
        print(prediction)

def get_predefined_matchups() -> List[Tuple[str, str, str]]:
    """Get predefined matchups for demonstration."""
    return [
        # Active vs Active (current champions/top contenders)
        ("Jon Jones", "Ciryl Gane", "active_vs_active"),
        ("Alex Pereira", "Jamahal Hill", "active_vs_active"),
        ("Leon Edwards", "Belal Muhammad", "active_vs_active"),
        
        # Active vs Retired
        ("Islam Makhachev", "Khabib Nurmagomedov", "active_vs_retired"),
        ("Dustin Poirier", "Georges St-Pierre", "active_vs_retired"),
        ("Charles Oliveira", "Anderson Silva", "active_vs_retired"),
        
        # Retired vs Retired (legends)
        ("Georges St-Pierre", "Anderson Silva", "retired_vs_retired"),
        ("Khabib Nurmagomedov", "Daniel Cormier", "retired_vs_retired"),
        ("Demetrious Johnson", "Henry Cejudo", "retired_vs_retired")
    ]

def run_custom_prediction(fighter1_name: str, fighter2_name: str) -> None:
    """Run prediction for user-specified fighters."""
    try:
        predictor = FighterPredictor()
        prediction = predictor.predict_winner(fighter1_name, fighter2_name)
        
        if "error" in prediction:
            logger.error(f"Prediction error: {prediction['error']}")
            print(f"\nError: {prediction['error']}")
            return
        
        print_prediction_details(prediction)
        
    except Exception as e:
        logger.error(f"Error running custom prediction: {str(e)}")

def run_batch_predictions() -> None:
    """Run a batch of predefined matchups."""
    try:
        predictor = FighterPredictor()
        matchups = get_predefined_matchups()
        
        logger.info(f"Running {len(matchups)} predefined matchups")
        print(f"\nRunning {len(matchups)} predefined matchups...")
        
        # Group matchups by type
        for matchup_type in ["active_vs_active", "active_vs_retired", "retired_vs_retired"]:
            print(f"\n\n{'=' * 40}")
            print(f"  {matchup_type.replace('_', ' ').upper()} MATCHUPS")
            print(f"{'=' * 40}")
            
            # Filter matchups by type
            type_matchups = [(f1, f2) for f1, f2, mtype in matchups if mtype == matchup_type]
            
            # Run predictions
            for fighter1, fighter2 in type_matchups:
                prediction = predictor.predict_winner(fighter1, fighter2)
                
                if "error" in prediction:
                    logger.warning(f"Prediction error for {fighter1} vs {fighter2}: {prediction['error']}")
                    continue
                
                print_prediction_details(prediction)
        
    except Exception as e:
        logger.error(f"Error running batch predictions: {str(e)}")

def main():
    """Main function to run predictions."""
    parser = argparse.ArgumentParser(description="Run MMA fight predictions")
    parser.add_argument('--fighter1', type=str, help="First fighter name")
    parser.add_argument('--fighter2', type=str, help="Second fighter name")
    parser.add_argument('--batch', action='store_true', help="Run batch predictions")
    
    args = parser.parse_args()
    
    print("\nMMA FIGHT PREDICTION SYSTEM")
    print("=" * 50)
    
    # Initialize predictor to verify model is loaded
    predictor = FighterPredictor()
    model_info = predictor.get_model_info()
    
    print(f"Model: {model_info.get('model_type', 'Unknown')}")
    print(f"Training Date: {model_info.get('training_date', 'Unknown')}")
    print(f"Features: {model_info.get('feature_count', 0)}")
    print(f"Status: {'Loaded Successfully' if model_info.get('is_loaded', False) else 'Error Loading Model'}")
    print("-" * 50)
    print("Legend: 🟢 Active Fighter | 🔴 Retired/Inactive Fighter")
    print("=" * 50)
    
    # Run requested predictions
    if args.fighter1 and args.fighter2:
        run_custom_prediction(args.fighter1, args.fighter2)
    elif args.batch:
        run_batch_predictions()
    else:
        print("\nNo prediction requested. Use --fighter1 and --fighter2 to specify fighters,")
        print("or use --batch to run predefined matchups.")
        print("\nExample: python -m backend.run_prediction --fighter1 \"Jon Jones\" --fighter2 \"Francis Ngannou\"")

if __name__ == "__main__":
    main() 