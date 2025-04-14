"""
Advanced MMA Fight Prediction Script

Loads the advanced prediction model and uses the feature engineering
pipeline to predict fight outcomes based on comprehensive fighter profiles
and matchup analysis.

Usage:
  python -m backend.run_prediction --fighter1 "Fighter One Name" --fighter2 "Fighter Two Name"
  python -m backend.run_prediction --batch
"""

import os
import sys
import argparse
import logging
import pandas as pd
from typing import List, Tuple, Dict, Any

# Add project root directory to Python path
project_root = os.path.dirname(os.path.dirname(__file__))
sys.path.append(project_root)

from backend.ml_new.utils.data_loader import DataLoader
from backend.ml_new.utils.advanced_features import FighterProfiler, MatchupAnalyzer
from backend.ml_new.models.trainer import UFCTrainer
from backend.ml_new.config.settings import DATA_DIR

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def print_prediction_details(prediction_result: Dict[str, Any]) -> None:
    """Print detailed prediction information."""
    try:
        fighter1 = prediction_result['fighter1']
        fighter2 = prediction_result['fighter2']
        winner = prediction_result['winner']
        prob_f1 = prediction_result['probability_fighter1']
        prob_f2 = prediction_result['probability_fighter2']
        winner_prob = max(prob_f1, prob_f2)
        
        print("\n" + "=" * 80)
        print(f"FIGHT PREDICTION: {fighter1} vs {fighter2}")
        print("-" * 80)
        
        print(f"Win Probability:")
        print(f"  {fighter1}: {prob_f1:.1f}%")
        print(f"  {fighter2}: {prob_f2:.1f}%")
        
        print("\nPrediction:")
        confidence = "High" if winner_prob > 70 else "Medium" if winner_prob > 60 else "Low"
        print(f"  ---> {winner} wins with {confidence} confidence ({winner_prob:.1f}%)")
        
        # We can potentially add key feature differences here later if needed
        
        print("=" * 80)
            
    except KeyError as e:
        logger.error(f"Missing key in prediction result: {e}")
        print("Error displaying prediction details.")
    except Exception as e:
        logger.error(f"Error printing prediction: {str(e)}")
        print(prediction_result)

def predict_matchup(fighter1_name: str, fighter2_name: str, 
                    analyzer: MatchupAnalyzer, trainer: UFCTrainer, feature_columns: list) -> Dict[str, Any]:
    """Generates features and predicts the outcome for a single matchup."""
    result = {
        'fighter1': fighter1_name,
        'fighter2': fighter2_name,
        'error': None
    }
    
    try:
        # Generate features
        features = analyzer.get_prediction_features(fighter1_name, fighter2_name)
        
        if not features:
            result['error'] = f"Could not generate features. Check if both fighters exist."
            return result
            
        # Ensure features are in the correct order and format
        feature_vector = pd.DataFrame([features])
        feature_vector = feature_vector.reindex(columns=feature_columns, fill_value=0)
        
        # Predict probabilities
        probabilities = trainer.predict_proba(feature_vector)
        prob_f2_wins = probabilities[0][0] # Probability of class 0 (fighter 2 wins)
        prob_f1_wins = probabilities[0][1] # Probability of class 1 (fighter 1 wins)

        result['probability_fighter1'] = prob_f1_wins * 100
        result['probability_fighter2'] = prob_f2_wins * 100
        
        # Determine winner
        if prob_f1_wins > prob_f2_wins:
            result['winner'] = fighter1_name
        else:
            result['winner'] = fighter2_name
            
    except Exception as e:
        logger.error(f"Error during prediction for {fighter1_name} vs {fighter2_name}: {str(e)}", exc_info=True)
        result['error'] = str(e)
        
    return result

def get_test_matchups() -> List[Tuple[str, str]]:
    """Returns a list of predefined matchups for batch prediction."""
    return [
        # Current/Relevant Matchups
        ("Islam Makhachev", "Dustin Poirier"),
        ("Alex Pereira", "Jiri Prochazka"),
        ("Sean Strickland", "Paulo Costa"),
        ("Jon Jones", "Stipe Miocic"),
        ("Charles Oliveira", "Arman Tsarukyan"), # Recent Rematch
        
        # Cross-Era / Interesting
        ("Khabib Nurmagomedov", "Charles Oliveira"),
        ("Georges St-Pierre", "Kamaru Usman"),
        ("Anderson Silva", "Israel Adesanya"),
        ("Paddy Pimblett", "Conor McGregor"),
    ]

def main():
    """Main function to load model, data, and run predictions."""
    parser = argparse.ArgumentParser(description="Run Advanced MMA fight predictions")
    parser.add_argument('--fighter1', type=str, help="First fighter name")
    parser.add_argument('--fighter2', type=str, help="Second fighter name")
    parser.add_argument('--batch', action='store_true', help="Run batch predictions on test matchups")
    
    args = parser.parse_args()
    
    print("\nADVANCED MMA FIGHT PREDICTION SYSTEM")
    print("=" * 50)
    
    try:
        # 1. Load Data
        logger.info("Loading data...")
        data_loader = DataLoader()
        fighters_df = data_loader.load_fighters()
        fights_df = data_loader.load_fights()
        logger.info(f"Loaded {len(fighters_df)} fighters and {len(fights_df)} fights.")

        # 2. Initialize Feature Engineering Tools
        logger.info("Initializing feature engineering tools...")
        profiler = FighterProfiler(fighters_df, fights_df)
        profiler.build_all_profiles() # Pre-compute profiles
        analyzer = MatchupAnalyzer(profiler, fights_df)
        logger.info("Feature tools initialized.")

        # 3. Load Model
        logger.info("Loading the trained model...")
        trainer = UFCTrainer()
        model_path = os.path.join(DATA_DIR, 'advanced_model.pkl')
        trainer.load_model(model_path)
        
        if not hasattr(trainer, 'model') or not hasattr(trainer, 'features'):
             raise FileNotFoundError("Model or feature list not loaded correctly.")
             
        logger.info(f"Model loaded successfully from {model_path}")
        logger.info(f"Model trained with {len(trainer.features)} features.")
        print(f"Model: Advanced XGBoost")
        print(f"Features: {len(trainer.features)}")
        print("Status: Loaded Successfully")
        print("=" * 50)

        # 4. Run Predictions
        if args.fighter1 and args.fighter2:
            prediction = predict_matchup(args.fighter1, args.fighter2, analyzer, trainer, trainer.features)
            if prediction.get('error'):
                print(f"\nError predicting {args.fighter1} vs {args.fighter2}: {prediction['error']}")
            else:
                print_prediction_details(prediction)
                
        elif args.batch:
            print("\nRunning batch predictions...")
            matchups = get_test_matchups()
            for f1, f2 in matchups:
                prediction = predict_matchup(f1, f2, analyzer, trainer, trainer.features)
                if prediction.get('error'):
                    print(f"\nError predicting {f1} vs {f2}: {prediction['error']}")
                    # Optionally continue or break on error
                else:
                    print_prediction_details(prediction)
            print("\nBatch prediction complete.")
            
        else:
            print("\nNo prediction requested. Use --fighter1 and --fighter2, or --batch.")
            print("Example: python -m backend.run_prediction --fighter1 \"Jon Jones\" --fighter2 \"Stipe Miocic\"")

    except FileNotFoundError as e:
         logger.error(f"Model file not found at {model_path}. Please train the model first using train.py. Error: {e}")
         print(f"Error: Model file not found. Please run the training script first.")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {str(e)}", exc_info=True)
        print(f"An unexpected error occurred. Check logs for details.")

if __name__ == "__main__":
    main() 