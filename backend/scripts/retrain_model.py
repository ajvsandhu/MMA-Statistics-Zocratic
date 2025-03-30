import os
import sys
import logging
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.supabase_client import SupabaseClient
from backend.ml.feature_engineering import extract_features
from backend.constants import MODEL_PATH, SCALER_PATH, FEATURES_PATH

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def retrain_model():
    """Retrain the fight prediction model using historical fight data."""
    logger.info("Starting model retraining process...")
    
    try:
        # Initialize Supabase client
        supabase = SupabaseClient()
        
        # Get all fighters
        fighters = supabase.get_all_fighters()
        logger.info(f"Retrieved {len(fighters)} fighters")
        
        # Get all fights
        fights = supabase.get_all_fights()
        logger.info(f"Retrieved {len(fights)} fights")
        
        # Process fights to create training data
        X = []  # Features
        y = []  # Labels (win/loss)
        
        processed_count = 0
        skipped_count = 0
        
        # Create fighter lookup dictionary
        fighter_dict = {f['fighter_name']: f for f in fighters}
        
        # Process each fight
        for fight in fights:
            try:
                fighter_name = fight.get('fighter_name')
                opponent = fight.get('opponent')
                result = fight.get('result', '').upper()
                
                # Skip if missing essential data
                if not all([fighter_name, opponent, result]):
                    skipped_count += 1
                    continue
                    
                # Find fighter data
                fighter_data = fighter_dict.get(fighter_name)
                opponent_data = fighter_dict.get(opponent)
                
                if not fighter_data or not opponent_data:
                    skipped_count += 1
                    continue
                
                # Extract features
                fighter_features = extract_features(fighter_data)
                opponent_features = extract_features(opponent_data)
                
                if not fighter_features or not opponent_features:
                    skipped_count += 1
                    continue
                
                # Create feature vector (difference between fighters)
                feature_vector = []
                for key in sorted(fighter_features.keys()):
                    feature_vector.append(fighter_features[key] - opponent_features[key])
                
                # Create label (1 if fighter won, 0 if lost)
                if 'W' not in result and 'L' not in result:  # Skip draws and no contests
                    skipped_count += 1
                    continue
                    
                label = 1 if 'W' in result else 0
                
                X.append(feature_vector)
                y.append(label)
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error processing fight: {str(e)}")
                skipped_count += 1
                continue
        
        logger.info(f"Processed {processed_count} fights, skipped {skipped_count} fights")
        
        if processed_count < 50:  # Minimum sample requirement
            logger.error(f"Insufficient training data: only {processed_count} samples")
            return
        
        # Convert to numpy arrays
        X = np.array(X)
        y = np.array(y)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=3,
            random_state=42
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        train_accuracy = model.score(X_train_scaled, y_train)
        test_accuracy = model.score(X_test_scaled, y_test)
        
        logger.info(f"Training accuracy: {train_accuracy:.3f}")
        logger.info(f"Test accuracy: {test_accuracy:.3f}")
        
        # Generate classification report
        y_pred = model.predict(X_test_scaled)
        logger.info("\nClassification Report:")
        logger.info(classification_report(y_test, y_pred))
        
        # Save model components
        model_dir = os.path.dirname(MODEL_PATH)
        os.makedirs(model_dir, exist_ok=True)
        
        # Save model components separately
        joblib.dump(model, MODEL_PATH, compress=3)
        joblib.dump(scaler, SCALER_PATH, compress=3)
        
        # Save feature names
        feature_names = sorted(fighter_features.keys())
        joblib.dump(feature_names, FEATURES_PATH, compress=3)
        
        # Save model info
        model_info = {
            'training_date': datetime.now().isoformat(),
            'train_accuracy': train_accuracy,
            'test_accuracy': test_accuracy,
            'n_samples': len(X),
            'n_features': len(feature_names),
            'scikit_learn_version': '1.0.2'
        }
        joblib.dump(model_info, os.path.join(model_dir, 'model_info.joblib'), compress=3)
        
        logger.info("Model retraining completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during model retraining: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

if __name__ == "__main__":
    retrain_model() 