import os
import logging
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report
from backend.supabase_client import SupabaseClient
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import List, Dict, Tuple

from backend.constants import MODEL_PATH, SCALER_PATH, FEATURES_PATH

# Load environment variables
load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase URL or Key not found in environment variables")

# Configure logging
logger = logging.getLogger(__name__)

def train_model():
    """
    Train the fight prediction model using historical fight data.
    This model uses a comprehensive set of fighter statistics to predict fight outcomes.
    Features include:
    - Striking metrics (SLpM, SApM, accuracy, defense)
    - Grappling metrics (takedowns, submissions)
    - Physical attributes (height, reach, weight)
    - Historical performance (win rate, recent results)
    """
    logger.info("Starting model training process...")
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY")
        )
        
        # Get all fighters and fights
        fighters = get_all_fighters(supabase)
        fights = get_all_fights(supabase)
        
        # Process fights to create training data
        X, y, feature_names = process_fights(fighters, fights)
        
        if len(X) < 50:
            logger.error(f"Insufficient training data: only {len(X)} samples")
            return
        
        # Train and evaluate model
        train_and_evaluate_model(X, y, feature_names)
        
    except Exception as e:
        logger.error(f"Error during model training: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

def get_all_fighters(supabase: Client) -> List[Dict]:
    """Retrieve all fighters from the database."""
    count_response = supabase.table("fighters").select("*", count="exact").execute()
    total_fighters = count_response.count
    logger.info(f"Total fighters in database: {total_fighters}")
    
    fighters = []
    page_size = 1000
    for offset in range(0, total_fighters, page_size):
        response = supabase.table("fighters").select("*").range(offset, offset + page_size - 1).execute()
        if response.data:
            fighters.extend(response.data)
            logger.info(f"Retrieved {len(fighters)}/{total_fighters} fighters")
    
    return fighters

def get_all_fights(supabase: Client) -> List[Dict]:
    """Retrieve all fights from the database."""
    count_response = supabase.table("fighter_last_5_fights").select("*", count="exact").execute()
    total_fights = count_response.count
    logger.info(f"Total fights in database: {total_fights}")
    
    fights = []
    page_size = 1000
    for offset in range(0, total_fights, page_size):
        response = supabase.table("fighter_last_5_fights").select("*").range(offset, offset + page_size - 1).execute()
        if response.data:
            fights.extend(response.data)
            logger.info(f"Retrieved {len(fights)}/{total_fights} fights")
    
    return fights

def process_fights(fighters: List[Dict], fights: List[Dict]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """Process fights to create training data."""
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
    
    return np.array(X), np.array(y), sorted(fighter_features.keys())

def train_and_evaluate_model(X: np.ndarray, y: np.ndarray, feature_names: List[str]):
    """Train and evaluate the model."""
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train model with optimized parameters
    model = GradientBoostingClassifier(
        n_estimators=200,  # Increased for better performance
        learning_rate=0.05,  # Reduced for better generalization
        max_depth=4,  # Increased for more complex patterns
        min_samples_split=5,  # Added to prevent overfitting
        min_samples_leaf=2,  # Added to prevent overfitting
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
    save_model_components(model, scaler, feature_names, train_accuracy, test_accuracy, len(X))

def save_model_components(model, scaler, feature_names, train_accuracy, test_accuracy, n_samples):
    """Save model components and metadata."""
    model_dir = os.path.join('backend', 'ml', 'models')
    os.makedirs(model_dir, exist_ok=True)
    
    # Create model package with metadata
    model_package = {
        'model': model,
        'scaler': scaler,
        'feature_names': feature_names,
        'metadata': {
            'training_date': datetime.now().isoformat(),
            'train_accuracy': train_accuracy,
            'test_accuracy': test_accuracy,
            'n_samples': n_samples,
            'n_features': len(feature_names),
            'model_type': 'GradientBoostingClassifier',
            'scikit_learn_version': '1.3.2'  # Explicitly specify version
        }
    }
    
    # Save model package
    joblib.dump(model_package, os.path.join(model_dir, 'fight_predictor_model.joblib'))
    logger.info("Model training completed successfully!")

def extract_features(fighter_data):
    """Extract comprehensive features from fighter data."""
    try:
        features = {}
        
        # Basic stats - handle N/A and percentage values
        def safe_float(val, default=0.0):
            try:
                if isinstance(val, (int, float)):
                    return float(val)
                if not val or val == 'N/A':
                    return default
                # Handle percentage strings
                if isinstance(val, str) and '%' in val:
                    return float(val.strip('%')) / 100
                return float(val)
            except:
                return default
        
        # Striking metrics
        features['slpm'] = safe_float(fighter_data.get('SLpM'))
        features['str_acc'] = safe_float(fighter_data.get('Str. Acc.'))
        features['sapm'] = safe_float(fighter_data.get('SApM'))
        features['str_def'] = safe_float(fighter_data.get('Str. Def'))
        
        # Grappling metrics
        features['td_avg'] = safe_float(fighter_data.get('TD Avg.'))
        features['td_acc'] = safe_float(fighter_data.get('TD Acc.'))
        features['td_def'] = safe_float(fighter_data.get('TD Def.'))
        features['sub_avg'] = safe_float(fighter_data.get('Sub. Avg.'))
        
        # Physical attributes
        reach_str = fighter_data.get('Reach', 'N/A')
        try:
            features['reach'] = float(reach_str.strip('"').strip() or 0)
        except:
            features['reach'] = 0
        
        # Height conversion
        height_str = fighter_data.get('Height', 'N/A')
        try:
            if height_str != 'N/A':
                height_parts = height_str.replace("'", "").replace('"', "").split()
                feet = int(height_parts[0]) if len(height_parts) > 0 else 0
                inches = int(height_parts[1]) if len(height_parts) > 1 else 0
                features['height'] = feet * 12 + inches
            else:
                features['height'] = 0
        except:
            features['height'] = 0
        
        # Weight class encoding
        weight_str = fighter_data.get('Weight', 'N/A')
        try:
            if weight_str != 'N/A':
                weight = float(weight_str.split()[0])
                features['weight'] = weight
            else:
                features['weight'] = 0
        except:
            features['weight'] = 0
        
        # Win rate calculation
        record = fighter_data.get('Record', '0-0-0')
        try:
            wins, losses, draws = map(int, record.split('-'))
            total = wins + losses + draws
            features['win_rate'] = wins / total if total > 0 else 0
        except:
            features['win_rate'] = 0
        
        return features
        
    except Exception as e:
        logger.error(f"Error extracting features: {str(e)}")
        return None

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    train_model() 