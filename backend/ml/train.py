import os
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
from backend.supabase_client import SupabaseClient
from dotenv import load_dotenv
from supabase import create_client, Client

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
    """Train the fight prediction model using historical fight data."""
    logger = logging.getLogger(__name__)
    logger.info("Starting model training process...")
    
    try:
        # Initialize Supabase client
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY")
        )
        
        # Get total count of fighters
        count_response = supabase.table("fighters").select("*", count="exact").execute()
        total_fighters = count_response.count
        logger.info(f"Total fighters in database: {total_fighters}")
        
        # Get all fighters using range
        fighters = []
        page_size = 1000
        for offset in range(0, total_fighters, page_size):
            response = supabase.table("fighters").select("*").range(offset, offset + page_size - 1).execute()
            if response.data:
                fighters.extend(response.data)
                logger.info(f"Retrieved {len(fighters)}/{total_fighters} fighters")
        
        logger.info(f"Retrieved all {len(fighters)} fighters")
        
        # Get total count of fights
        count_response = supabase.table("fighter_last_5_fights").select("*", count="exact").execute()
        total_fights = count_response.count
        logger.info(f"Total fights in database: {total_fights}")
        
        # Get all fights using range
        fights = []
        for offset in range(0, total_fights, page_size):
            response = supabase.table("fighter_last_5_fights").select("*").range(offset, offset + page_size - 1).execute()
            if response.data:
                fights.extend(response.data)
                logger.info(f"Retrieved {len(fights)}/{total_fights} fights")
        
        logger.info(f"Retrieved all {len(fights)} fights")
        
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
        model_dir = os.path.join('backend', 'ml', 'models')
        os.makedirs(model_dir, exist_ok=True)
        
        joblib.dump(model, os.path.join(model_dir, 'fight_predictor_model.joblib'))
        joblib.dump(scaler, os.path.join(model_dir, 'scaler.joblib'))
        
        # Save feature names
        feature_names = sorted(fighter_features.keys())
        joblib.dump(feature_names, os.path.join(model_dir, 'feature_names.joblib'))
        
        # Save model info
        model_info = {
            'training_date': datetime.now().isoformat(),
            'train_accuracy': train_accuracy,
            'test_accuracy': test_accuracy,
            'n_samples': len(X),
            'n_features': len(feature_names)
        }
        joblib.dump(model_info, os.path.join(model_dir, 'model_info.joblib'))
        
        logger.info("Model training completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during model training: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

def extract_features(fighter_data):
    """Extract features from fighter data."""
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
        
        # Use exact field names from database
        features['slpm'] = safe_float(fighter_data.get('SLpM'))
        features['str_acc'] = safe_float(fighter_data.get('Str. Acc.'))
        features['sapm'] = safe_float(fighter_data.get('SApM'))
        features['str_def'] = safe_float(fighter_data.get('Str. Def'))
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
        weight_classes = {
            '265 lbs.': 5,  # Heavyweight
            '205 lbs.': 4,  # Light Heavyweight
            '185 lbs.': 3,  # Middleweight
            '170 lbs.': 2,  # Welterweight
            '155 lbs.': 1,  # Lightweight
            '145 lbs.': 0,  # Featherweight
            '135 lbs.': -1, # Bantamweight
            '125 lbs.': -2  # Flyweight
        }
        features['weight_class_encoded'] = weight_classes.get(weight_str, 0)
        
        # Record stats - handle NC (No Contest)
        record_str = fighter_data.get('Record', '0-0-0')
        try:
            # Remove any NC or other annotations
            record_str = record_str.split('(')[0].strip()
            wins, losses, draws = map(int, record_str.split('-'))
        except:
            wins, losses, draws = 0, 0, 0
        
        features['wins'] = wins
        features['losses'] = losses
        features['draws'] = draws
        features['total_fights'] = wins + losses + draws
        features['win_percentage'] = wins / features['total_fights'] if features['total_fights'] > 0 else 0
        
        # Fighting style
        features['is_striker'] = 1 if features['slpm'] > 3.0 and features['str_acc'] > 0.4 else 0
        features['is_grappler'] = 1 if features['td_avg'] > 2.0 or features['sub_avg'] > 0.5 else 0
        
        # Age - skip for now as DOB is N/A
        features['age'] = 30  # default age
        
        # Derived metrics
        features['striking_differential'] = features['slpm'] - features['sapm']
        features['takedown_differential'] = features['td_avg'] * features['td_acc'] - features['td_avg'] * (1 - features['td_def'])
        features['combat_effectiveness'] = (features['slpm'] * features['str_acc']) + (features['td_avg'] * features['td_acc']) + features['sub_avg']
        
        # Stance encoding
        stance = fighter_data.get('STANCE', 'Orthodox')
        stance_encoding = {'Orthodox': 0, 'Southpaw': 1, 'Switch': 2, 'N/A': 3}
        features['stance_encoded'] = stance_encoding.get(stance, 3)
        
        # Recent performance - skip for now as we don't have recent fights
        features['recent_win_streak'] = 0
        features['recent_loss_streak'] = 0
        features['finish_rate'] = 0
        features['decision_rate'] = 0
        
        # Experience factor
        features['experience_factor'] = features['total_fights'] * features['win_percentage']
        
        # Ensure all features are float type
        features = {k: float(v) for k, v in features.items()}
        
        return features
        
    except Exception as e:
        logger.error(f"Error extracting features: {str(e)}")
        return None

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    train_model() 