"""
Training script for MMA fight prediction model.
Handles data collection, preprocessing, and model training.
"""

import os
import logging
import numpy as np
from typing import Tuple, List, Dict, Any
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report

from backend.api.database import get_db_connection
from backend.ml.feature_engineering import extract_all_features, create_fight_vector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_training_data() -> Tuple[np.ndarray, np.ndarray]:
    """Collect and preprocess training data from the database."""
    try:
        # Get database connection
        supabase = get_db_connection()
        if not supabase:
            raise Exception("Could not connect to database")
        
        # Get all fighters
        response = supabase.table('fighters').select('*').execute()
        if not response.data:
            raise Exception("No fighters found in database")
        
        fighters = {f['fighter_name']: f for f in response.data}
        logger.info(f"Retrieved {len(fighters)} fighters")
        
        # Get all fights
        response = supabase.table('fighter_last_5_fights').select('*').execute()
        if not response.data:
            raise Exception("No fights found in database")
        
        fights = response.data
        logger.info(f"Retrieved {len(fights)} fights")
        
        # Process fights into training data
        X = []
        y = []
        processed = 0
        skipped = 0
        
        for fight in fights:
            try:
                # Get fighter data
                fighter_name = fight.get('fighter_name')
                opponent_name = fight.get('opponent')
                result = fight.get('result', '').upper()
                
                if not all([fighter_name, opponent_name, result]):
                    skipped += 1
                    continue
                
                # Get fighter data
                fighter = fighters.get(fighter_name)
                opponent = fighters.get(opponent_name)
                
                if not fighter or not opponent:
                    skipped += 1
                    continue
                
                # Add recent fights
                fighter['recent_fights'] = [f for f in fights if f['fighter_name'] == fighter_name]
                opponent['recent_fights'] = [f for f in fights if f['fighter_name'] == opponent_name]
                
                # Extract features
                fighter_features = extract_all_features(fighter)
                opponent_features = extract_all_features(opponent)
                
                if not fighter_features or not opponent_features:
                    skipped += 1
                    continue
                
                # Create feature vector
                feature_vector = create_fight_vector(fighter_features, opponent_features)
                
                if feature_vector.size == 0:
                    skipped += 1
                    continue
                
                # Create label (1 for win, 0 for loss)
                if 'W' in result:
                    label = 1
                elif 'L' in result:
                    label = 0
                else:  # Skip draws and no contests
                    skipped += 1
                    continue
                
                X.append(feature_vector)
                y.append(label)
                processed += 1
                
            except Exception as e:
                logger.error(f"Error processing fight: {str(e)}")
                skipped += 1
                continue
        
        logger.info(f"Processed {processed} fights, skipped {skipped} fights")
        
        if not X:
            raise Exception("No valid training examples found")
        
        # Convert to numpy arrays
        X = np.array(X)
        y = np.array(y)
        
        return X, y
        
    except Exception as e:
        logger.error(f"Error getting training data: {str(e)}")
        raise

def train_model(X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """Train the fight prediction model."""
    try:
        # Add balanced examples (zero vectors should predict 50-50)
        n_features = X.shape[1]
        n_balanced = int(X.shape[0] * 0.1)  # Add 10% balanced examples
        
        # Create balanced examples
        X_balanced = np.zeros((n_balanced, n_features))
        y_balanced = np.random.randint(0, 2, n_balanced)  # Random labels for balanced fights
        
        # Combine with original data
        X = np.vstack([X, X_balanced])
        y = np.concatenate([y, y_balanced])
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Create and train model with balanced class weights
        model = GradientBoostingClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=3,
            subsample=0.8,
            random_state=42
        )
        
        # Train model
        model.fit(X_train_scaled, y_train)
        
        # Verify predictions on zero vectors
        zero_vector = np.zeros((1, n_features))
        zero_vector_scaled = scaler.transform(zero_vector)
        zero_probs = model.predict_proba(zero_vector_scaled)[0]
        logger.info(f"Prediction probabilities for identical fighters: {zero_probs}")
        
        # If predictions are not balanced, retrain with more balanced examples
        if abs(zero_probs[0] - 0.5) > 0.01:
            logger.warning("Model predictions not balanced, retraining with more balanced examples")
            n_balanced = int(X.shape[0] * 0.2)  # Increase to 20% balanced examples
            X_balanced = np.zeros((n_balanced, n_features))
            y_balanced = np.random.randint(0, 2, n_balanced)
            X = np.vstack([X, X_balanced])
            y = np.concatenate([y, y_balanced])
            
            # Retrain
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            model.fit(X_train_scaled, y_train)
            
            # Verify again
            zero_vector_scaled = scaler.transform(zero_vector)
            zero_probs = model.predict_proba(zero_vector_scaled)[0]
            logger.info(f"Prediction probabilities after retraining: {zero_probs}")
        
        # Evaluate model
        y_pred = model.predict(X_test_scaled)
        report = classification_report(y_test, y_pred)
        logger.info(f"\nModel Performance:\n{report}")
        
        # Save model
        os.makedirs('backend/ml/models', exist_ok=True)
        model_path = 'backend/ml/models/fight_predictor_model.joblib'
        
        model_package = {
            'model': model,
            'scaler': scaler
        }
        
        joblib.dump(model_package, model_path)
        logger.info(f"Model saved to {model_path}")
        
        return model_package
        
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise

def main():
    """Main training function."""
    try:
        logger.info("Starting model training")
        
        # Get training data
        X, y = get_training_data()
        logger.info(f"Training data shape: X={X.shape}, y={y.shape}")
        
        # Train model
        train_model(X, y)
        
        logger.info("Training completed successfully")
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise

if __name__ == '__main__':
    main() 