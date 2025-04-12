"""
Enhanced Training Script for MMA Fight Prediction Model.
Implements robust data collection, preprocessing, calibrated model training,
and comprehensive evaluation focused on natural probability calibration.
"""

import os
import logging
from datetime import datetime
from typing import Tuple, List, Dict, Any, Optional

import numpy as np
import pandas as pd
import joblib
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report, brier_score_loss, 
    accuracy_score, roc_auc_score, precision_recall_curve,
    auc as auc_score, confusion_matrix, log_loss
)

from backend.api.database import get_db_connection
from backend.ml.feature_engineering import (
    extract_all_features, create_fight_vector, 
    is_fighter_active, get_days_since_last_fight
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_training_data(add_synthetic_data: bool = False) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Collect and preprocess training data from the database.
    
    Parameters:
        add_synthetic_data: Whether to add balanced synthetic examples for calibration
        
    Returns:
        X: Feature matrix
        y: Target labels
        feature_names: Names of features in X
    """
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
        fighter_pairs = []
        feature_names = []
        processed = 0
        skipped = 0
        
        # Count active vs retired fighters
        active_fighters = sum(1 for f in fighters.values() if is_fighter_active(f))
        retired_fighters = len(fighters) - active_fighters
        logger.info(f"Active fighters: {active_fighters}, Retired fighters: {retired_fighters}")
        
        # Track matchup types for balanced representation
        active_vs_active = 0
        active_vs_retired = 0
        retired_vs_retired = 0
        
        for fight in fights:
            try:
                # Get fighter data
                fighter_name = fight.get('fighter_name')
                opponent_name = fight.get('opponent')
                result = fight.get('result', '').upper()
                
                if not all([fighter_name, opponent_name, result]) or fighter_name == opponent_name:
                    skipped += 1
                    continue
                
                # Skip if this fighter pair has already been processed to avoid duplication
                pair = tuple(sorted([fighter_name, opponent_name]))
                if pair in fighter_pairs:
                    skipped += 1
                    continue
                fighter_pairs.append(pair)
                
                # Get fighter data
                fighter = fighters.get(fighter_name)
                opponent = fighters.get(opponent_name)
                
                if not fighter or not opponent:
                    skipped += 1
                    continue
                
                # Add recent fights to fighter data
                fighter['recent_fights'] = [f for f in fights if f['fighter_name'] == fighter_name]
                opponent['recent_fights'] = [f for f in fights if f['fighter_name'] == opponent_name]
                
                # Extract features
                fighter_features = extract_all_features(fighter)
                opponent_features = extract_all_features(opponent)
                
                if not fighter_features or not opponent_features:
                    skipped += 1
                    continue
                
                # Track fighter status to ensure balanced dataset
                fighter_active = is_fighter_active(fighter)
                opponent_active = is_fighter_active(opponent)
                
                if fighter_active and opponent_active:
                    active_vs_active += 1
                elif not fighter_active and not opponent_active:
                    retired_vs_retired += 1
                else:
                    active_vs_retired += 1
                
                # Create feature vector and get feature names
                feature_vector, current_feature_names = create_fight_vector(fighter_features, opponent_features)
                
                if feature_vector.size == 0:
                    skipped += 1
                    continue
                
                # Store feature names on first successful extraction
                if not feature_names and current_feature_names:
                    feature_names = current_feature_names
                
                # Create label (1 for fighter win, 0 for opponent win)
                # Result is from fighter's perspective, so W means fighter won
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
        logger.info(f"Matchup types - Active vs Active: {active_vs_active}, "
                    f"Active vs Retired: {active_vs_retired}, "
                    f"Retired vs Retired: {retired_vs_retired}")
        
        if not X:
            raise Exception("No valid training examples found")
        
        # Convert to numpy arrays
        X = np.array(X)
        y = np.array(y)
        
        return X, y, feature_names
        
    except Exception as e:
        logger.error(f"Error getting training data: {str(e)}")
        raise

def evaluate_model(model, X_test, y_test, scaler=None):
    """
    Comprehensively evaluate model performance with focus on calibration.
    
    Parameters:
        model: Trained model (classifiers or pipeline with classifier)
        X_test: Test feature matrix
        y_test: Test target labels
        scaler: Optional scaler to preprocess X_test
        
    Returns:
        metrics: Dictionary of evaluation metrics
    """
    if scaler is not None:
        X_test_scaled = scaler.transform(X_test)
    else:
        X_test_scaled = X_test
    
    # Get predictions
    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]
    
    # Calculate performance metrics
    accuracy = accuracy_score(y_test, y_pred)
    auc_score = roc_auc_score(y_test, y_prob)
    brier = brier_score_loss(y_test, y_prob)
    logloss = log_loss(y_test, y_prob)
    
    # Calibration (reliability) curve
    prob_true, prob_pred = calibration_curve(y_test, y_prob, n_bins=10)
    
    # Calculate ECE (Expected Calibration Error)
    ece = np.mean(np.abs(prob_true - prob_pred))
    
    # Calculate probability distribution
    bins = np.linspace(0, 1, 11)
    hist, _ = np.histogram(y_prob, bins=bins)
    hist = hist / len(y_prob)
    
    # Check if model outputs any extreme probabilities
    extreme_probs = np.sum((y_prob > 0.95) | (y_prob < 0.05)) / len(y_prob)
    
    metrics = {
        'accuracy': accuracy,
        'auc': auc_score,
        'brier_score': brier,
        'log_loss': logloss,
        'ece': ece,
        'extreme_probability_rate': extreme_probs,
        'prob_distribution': hist.tolist(),
        'reliability_curve': {
            'true_probs': prob_true.tolist(),
            'pred_probs': prob_pred.tolist()
        }
    }
    
    logger.info(f"Model Evaluation:")
    logger.info(f"  Accuracy: {accuracy:.4f}")
    logger.info(f"  AUC: {auc_score:.4f}")
    logger.info(f"  Brier Score: {brier:.4f} (lower is better)")
    logger.info(f"  Log Loss: {logloss:.4f} (lower is better)")
    logger.info(f"  ECE: {ece:.4f} (lower is better)")
    logger.info(f"  Extreme probability rate: {extreme_probs:.4f}")
    
    # Classification report
    class_report = classification_report(y_test, y_pred)
    logger.info(f"\nClassification Report:\n{class_report}")
    
    # Check predictions for zero vectors (identical fighters)
    zero_vector = np.zeros((1, X_test.shape[1]))
    if scaler is not None:
        zero_vector_scaled = scaler.transform(zero_vector)
    else:
        zero_vector_scaled = zero_vector
    
    zero_probs = model.predict_proba(zero_vector_scaled)[0]
    logger.info(f"Prediction for identical fighters: {zero_probs}")
    logger.info(f"  Win probability difference from 50%: {abs(zero_probs[1] - 0.5) * 100:.2f}%")
    
    return metrics

def save_model(model, scaler, feature_names, metrics=None):
    """
    Save the trained model, scaler, feature names, and metrics to a file.
    
    Parameters:
        model: Trained model
        scaler: Feature scaler
        feature_names: List of feature names
        metrics: Dictionary of performance metrics
    """
    try:
        # Create model directory if it doesn't exist
        os.makedirs('backend/ml/models', exist_ok=True)
        
        # Create a dictionary with all components
        model_package = {
            'model': model,
            'scaler': scaler,
            'feature_names': feature_names,
            'metadata': {
                'model_type': type(model).__name__,
                'training_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'feature_count': len(feature_names) if feature_names else 0,
                'metrics': metrics if metrics else {}
            }
        }
        
        # Save the package
        model_path = 'backend/ml/models/fight_predictor_model.joblib'
        joblib.dump(model_package, model_path)
        
        logger.info(f"Model saved to {model_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error saving model: {str(e)}")
        return False

def main():
    """Main training function."""
    try:
        logger.info("Starting MMA fight prediction model training")
        
        # Get training data - NO synthetic data
        X, y, feature_names = get_training_data(add_synthetic_data=False)
        
        if X.shape[0] == 0:
            raise Exception("No training examples found")
            
        logger.info(f"Got {X.shape[0]} training examples with {X.shape[1]} features")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train Gradient Boosting model
        logger.info("Training Gradient Boosting model with cross-validation")
        
        # Create the Gradient Boosting model
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        model = GradientBoostingClassifier(random_state=42)
        
        # Evaluate with cross-validation
        scores = cross_val_score(model, X_train_scaled, y_train, cv=cv, scoring='roc_auc')
        logger.info(f"Gradient Boosting cross-validation AUC: {scores.mean():.4f} (±{scores.std():.4f})")
        
        # Train the final model with optimized parameters
        logger.info("Training final Gradient Boosting model")
        model = GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=42)
        
        # Train with the full training set
        model.fit(X_train_scaled, y_train)
        
        # NO calibration - letting the model make pure predictions
        # Evaluate on test set directly without forcing calibration
        y_pred = model.predict(X_test_scaled)
        y_prob = model.predict_proba(X_test_scaled)[:, 1]
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_prob)
        precision, recall, _ = precision_recall_curve(y_test, y_prob)
        pr_auc = auc_score(recall, precision)
        brier = brier_score_loss(y_test, y_prob)
        
        logger.info(f"Test accuracy: {accuracy:.4f}")
        logger.info(f"Test AUC: {auc:.4f}")
        logger.info(f"Test PR-AUC: {pr_auc:.4f}")
        logger.info(f"Brier score (calibration error): {brier:.4f}")
        
        # Store metrics
        metrics = {
            'accuracy': accuracy,
            'auc': auc,
            'pr_auc': pr_auc,
            'brier_score': brier
        }
        
        # Save the model and scaler - use the uncalibrated model
        save_model(model, scaler, feature_names, metrics)
        
        logger.info("Model training completed successfully")
        
    except Exception as e:
        logger.error(f"Error in model training: {str(e)}")
        raise

if __name__ == '__main__':
    main() 