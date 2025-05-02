import os
import sys
from pathlib import Path
from datetime import timezone # Import timezone
# from dotenv import load_dotenv

# Add project root directory to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

import logging
import pandas as pd
import numpy as np
from tqdm import tqdm # Add progress bar

from backend.ml_new.utils.data_loader import DataLoader
from backend.ml_new.models.trainer import UFCTrainer
from backend.ml_new.config.settings import DATA_DIR, RANDOM_STATE
# Import the new feature engineering classes
from backend.ml_new.utils.advanced_features import FighterProfiler, MatchupAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../../.env'))

def main():
    logger.info("--- Starting Training Pipeline (with Data Leakage Prevention) ---")
    
    # 1. Load Data
    logger.info("Loading data...")
    data_loader = DataLoader() 
    fighters_df = data_loader.load_fighters()
    fights_df = data_loader.load_fights()
    # Ensure fight_date is datetime and timezone-aware (UTC)
    fights_df['fight_date'] = pd.to_datetime(fights_df['fight_date'], errors='coerce')
    if fights_df['fight_date'].dt.tz is None:
        fights_df['fight_date'] = fights_df['fight_date'].dt.tz_localize(timezone.utc)
    else:
        fights_df['fight_date'] = fights_df['fight_date'].dt.tz_convert(timezone.utc)
        
    # Drop fights with missing dates as they cannot be used for time-contextual features
    original_fight_count = len(fights_df)
    fights_df.dropna(subset=['fight_date'], inplace=True)
    if len(fights_df) < original_fight_count:
        logger.warning(f"Dropped {original_fight_count - len(fights_df)} fights due to missing dates.")
        
    logger.info(f"Loaded {len(fighters_df)} fighters and {len(fights_df)} fights with valid dates.")

    # 2. Initialize Feature Engineering Tools
    logger.info("Initializing feature engineering tools...")
    # Pass fights_df with processed dates
    profiler = FighterProfiler(fighters_df, fights_df)
    analyzer = MatchupAnalyzer(profiler, fights_df)
    logger.info("Feature tools initialized.")
    # No need to build all profiles beforehand now, will be done contextually

    # 3. Generate Features with Context (Preventing Data Leakage)
    logger.info("Generating time-contextual features for each fight...")
    all_features_list = []
    skipped_fights = 0

    # Iterate through each fight in the historical data
    # Use tqdm for a progress bar
    for index, fight_row in tqdm(fights_df.iterrows(), total=fights_df.shape[0], desc="Generating Features"):
        fighter1_name = fight_row['fighter_name']
        fighter2_name = fight_row['opponent'] # Use original opponent column name
        fight_date = fight_row['fight_date'] # This is the context_date
        target = 1 if fight_row['result'] == 'W' else 0

        # Basic validation
        if pd.isna(fighter1_name) or pd.isna(fighter2_name) or not isinstance(fighter1_name, str) or not isinstance(fighter2_name, str):
            skipped_fights += 1
            continue
            
        # Generate features using data available *before* the fight_date
        features = analyzer.get_prediction_features(fighter1_name, fighter2_name, context_date=fight_date)
        
        if features: # Only add if features were successfully generated
            features['target'] = target # Add target variable
            all_features_list.append(features)
        else:
             skipped_fights += 1
             # Log only a few warnings 
             # if skipped_fights < 5 or skipped_fights % 200 == 0: 
             #     logger.warning(f"({skipped_fights}) Could not generate features for: {fighter1_name} vs {fighter2_name} before {fight_date.date()}")

    if not all_features_list:
        logger.error("No features were generated. Cannot proceed. Check fighter names and data quality.")
        sys.exit(1) 

    logger.info(f"Successfully generated features for {len(all_features_list)} matchups (skipped {skipped_fights}).")

    # Create DataFrame from the list of feature dictionaries
    feature_df = pd.DataFrame(all_features_list)
    
    # Separate features (X) and target (y)
    y = feature_df['target']
    X = feature_df.drop(columns=['target'])

    # Final check for NaNs/Infs (should be less likely now)
    nan_count = X.isna().sum().sum()
    if nan_count > 0:
        logger.warning(f"Found {nan_count} NaN values after feature generation. Filling with column medians.")
        X = X.fillna(X.median())
        
    inf_count = np.isinf(X).sum().sum()
    if inf_count > 0:
        logger.warning(f"Found {inf_count} infinite values. Replacing with 0.")
        X.replace([np.inf, -np.inf], 0, inplace=True)

    logger.info(f"Final feature set shape: {X.shape}")
    if X.empty:
         logger.error("Feature DataFrame X is empty. Cannot train.")
         sys.exit(1)
         
    logger.info(f"Target variable shape: {y.shape}")
    logger.info(f"Features sample:\n{X.head()}")

    # 4. Train Model
    logger.info("Initializing and training model...")
    trainer = UFCTrainer()
    try:
        # prepare_data now captures feature names from X before scaling
        X_train, X_val, X_test, y_train, y_val, y_test = trainer.prepare_data(X, y)
        
        logger.info(f"Training data shape: {X_train.shape}")
        logger.info(f"Validation data shape: {X_val.shape}")
        logger.info(f"Test data shape: {X_test.shape}")
        
        # Ensure trainer has features before training
        if trainer.features is None:
             raise RuntimeError("Trainer did not capture feature names during prepare_data.")
             
        trainer.train(X_train, y_train, X_val, y_val)
        
        # 5. Evaluate Model
        logger.info("Evaluating model...")
        train_score = trainer.evaluate(X_train, y_train)
        val_score = trainer.evaluate(X_val, y_val)
        test_score = trainer.evaluate(X_test, y_test)
        
        logger.info(f"Training Accuracy: {train_score:.4f}")
        logger.info(f"Validation Accuracy: {val_score:.4f}")
        logger.info(f"Test Accuracy: {test_score:.4f}")
        
        # 6. Save Model (now includes features)
        model_path = os.path.join(DATA_DIR, 'advanced_leakproof_model.pkl') # Corrected name
        trainer.save_model(model_path)
        logger.info(f"Model saved successfully to {model_path}")
        
    except Exception as e:
        logger.error(f"An error occurred during model training or evaluation: {str(e)}", exc_info=True)
        raise

    logger.info("--- Training Pipeline Finished ---")

if __name__ == "__main__":
    main() 