import os
import sys
from pathlib import Path
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timezone

# Add project root directory to Python path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

from backend.ml_new.utils.data_loader import DataLoader
from backend.ml_new.models.trainer import UFCTrainer
from backend.ml_new.config.settings import DATA_DIR
from backend.ml_new.utils.advanced_features import FighterProfiler, MatchupAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def predict_matchup(fighter1_name: str, fighter2_name: str, data_loader: DataLoader, analyzer: MatchupAnalyzer, trainer: UFCTrainer) -> dict:
    """
    Predict the outcome of a matchup between two fighters using the advanced feature generator.
    """
    try:
        # Get current time as context_date (important for inactivity penalties etc.)
        context_date = pd.Timestamp.now(tz=timezone.utc)
        
        logger.info(f"Predicting {fighter1_name} vs {fighter2_name} using context date: {context_date.date()}")
        
        # Generate features using the MatchupAnalyzer
        # This automatically uses the FighterProfiler internally with the correct context_date
        features_dict = analyzer.get_prediction_features(fighter1_name, fighter2_name, context_date=context_date)
        
        if not features_dict:
            logger.error(f"Could not generate features for {fighter1_name} vs {fighter2_name}.")
            return {"error": "Could not generate features for prediction."}
        
        # Convert features dictionary to a DataFrame for the model
        prediction_df = pd.DataFrame([features_dict])
        
        # Ensure the DataFrame columns match the model's expected features
        # Add missing columns with 0 and reorder
        model_features = trainer.features # Get feature names from the loaded trainer
        if model_features is None:
            logger.error("Trainer object does not have feature names loaded. Cannot proceed.")
            return {"error": "Model features not loaded."}
            
        # Add missing columns to prediction_df, fill with 0
        for col in model_features:
            if col not in prediction_df.columns:
                prediction_df[col] = 0.0
                
        # Ensure correct column order and drop extra columns
        prediction_df = prediction_df[model_features] 

        # Final check for NaNs/Infs before prediction (belt and braces)
        nan_count = prediction_df.isna().sum().sum()
        if nan_count > 0:
            logger.warning(f"Found {nan_count} NaN values in prediction features. Filling with 0.")
            prediction_df = prediction_df.fillna(0.0)
            
        inf_count = np.isinf(prediction_df).sum().sum()
        if inf_count > 0:
            logger.warning(f"Found {inf_count} infinite values in prediction features. Replacing with 0.")
            prediction_df.replace([np.inf, -np.inf], 0.0, inplace=True)

        # Make prediction
        probability = trainer.predict_proba(prediction_df)[0][1] # Probability of fighter1 winning
        
        predicted_winner = fighter1_name if probability >= 0.5 else fighter2_name
        confidence = probability if predicted_winner == fighter1_name else 1 - probability
        
        return {
            "fighter1": fighter1_name,
            "fighter2": fighter2_name,
            "predicted_winner": predicted_winner,
            "confidence": round(confidence * 100, 2),
            "fighter1_win_probability": round(probability * 100, 2),
            "fighter2_win_probability": round((1 - probability) * 100, 2)
        }
        
    except Exception as e:
        logger.error(f"Error predicting matchup {fighter1_name} vs {fighter2_name}: {str(e)}", exc_info=True)
        return {"error": f"Prediction failed: {str(e)}"}

def main():
    # Initialize data loader
    logger.info("Initializing DataLoader...")
    data_loader = DataLoader()
    fighters_df = data_loader.load_fighters()
    fights_df = data_loader.load_fights()
    
    # Ensure fight_date is datetime and timezone-aware for Profiler/Analyzer
    fights_df['fight_date'] = pd.to_datetime(fights_df['fight_date'], errors='coerce')
    if fights_df['fight_date'].dt.tz is None:
        fights_df['fight_date'] = fights_df['fight_date'].dt.tz_localize(timezone.utc)
    else:
        fights_df['fight_date'] = fights_df['fight_date'].dt.tz_convert(timezone.utc)
    fights_df.dropna(subset=['fight_date'], inplace=True) # Drop rows missing critical date info
    
    # Initialize the feature engineering tools
    logger.info("Initializing FighterProfiler and MatchupAnalyzer...")
    profiler = FighterProfiler(fighters_df, fights_df)
    analyzer = MatchupAnalyzer(profiler, fights_df)
    
    # Load the trained model
    logger.info("Loading the trained model...")
    trainer = UFCTrainer()
    model_path = os.path.join(DATA_DIR, 'advanced_leakproof_model.pkl') # Use the new model name
    try:
        trainer.load_model(model_path)
        logger.info(f"Model loaded successfully from {model_path}")
        if trainer.features is None:
             logger.warning("Loaded model does not contain feature names. Predictions might fail if feature order differs.")
        else:
             logger.info(f"Model expects {len(trainer.features)} features.")
             
    except FileNotFoundError:
        logger.error(f"Model file not found at {model_path}. Please train the model first.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}", exc_info=True)
        sys.exit(1)

    # List of matchups to test
    matchups = [
        # Heavyweight (Fantasy/Potential)
        ("Jon Jones", "Tom Aspinall"),
        # Light Heavyweight (Potential Top Contender)
        ("Alex Pereira", "Magomed Ankalaev"),
        # Middleweight (Title/Potential)
        ("Dricus Du Plessis", "Israel Adesanya"),
        ("Sean Strickland", "Paulo Costa"),
        ("Bo Nickal", "Khamzat Chimaev"),
        # Welterweight vs Lightweight (Fantasy Champ vs Champ)
        ("Leon Edwards", "Islam Makhachev"),
        # Featherweight (Rematch Interest)
        ("Ilia Topuria", "Max Holloway"),
        # Bantamweight (Status Quo)
        ("Sean O'Malley", "Merab Dvalishvili"),
        # Women's Flyweight (Contender vs Ex-Champ)
        ("Erin Blanchfield", "Valentina Shevchenko"),
        # Women's Strawweight (Title Context)
        ("Zhang Weili", "Yan Xiaonan"),
        # The Problematic One (For comparison)
        ("Charles Oliveira", "Paddy Pimblett"),
        # --- Inactivity Tests --- #
        ("Conor McGregor", "Michael Chandler"),
        ("Stipe Miocic", "Tom Aspinall"),
        ("Dominick Cruz", "Merab Dvalishvili"),
        ("Nick Diaz", "Kevin Holland"),
        # --- Legendary Fantasy Matchup --- #
        ("Khabib Nurmagomedov", "Charles Oliveira"),
        # Keeping a couple from previous run for consistency check
        ("Alexander Volkanovski", "Ilia Topuria"),
        ("Khamzat Chimaev", "Robert Whittaker")
    ]

    # Predict each matchup
    logger.info("\n--- Starting Matchup Predictions ---")
    for fighter1, fighter2 in matchups:
        prediction_result = predict_matchup(fighter1, fighter2, data_loader, analyzer, trainer)
        
        print("\n" + "="*40)
        if "error" in prediction_result:
            print(f"Prediction Error for {fighter1} vs {fighter2}:")
            print(prediction_result["error"])
        else:
            print(f"Matchup: {prediction_result['fighter1']} vs {prediction_result['fighter2']}")
            print(f"Predicted Winner: {prediction_result['predicted_winner']} " 
                  f"(Confidence: {prediction_result['confidence']}%)")
            print(f"Win Probabilities: " 
                  f"{prediction_result['fighter1']}: {prediction_result['fighter1_win_probability']}%, " 
                  f"{prediction_result['fighter2']}: {prediction_result['fighter2_win_probability']}%")
        print("="*40)

    logger.info("--- Matchup Predictions Finished ---")

if __name__ == "__main__":
    main() 