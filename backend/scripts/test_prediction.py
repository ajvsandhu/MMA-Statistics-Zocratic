import os
import logging
import joblib
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_model():
    """Load the trained model and its components."""
    try:
        model_dir = os.path.join('backend', 'ml', 'models')
        model = joblib.load(os.path.join(model_dir, 'fight_predictor_model.joblib'))
        scaler = joblib.load(os.path.join(model_dir, 'scaler.joblib'))
        feature_names = joblib.load(os.path.join(model_dir, 'feature_names.joblib'))
        model_info = joblib.load(os.path.join(model_dir, 'model_info.joblib'))
        
        logger.info(f"Model loaded successfully. Training accuracy: {model_info['train_accuracy']:.3f}")
        return model, scaler, feature_names
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        return None, None, None

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

def predict_fight(fighter1_name, fighter2_name):
    """Predict the outcome of a fight between two fighters."""
    try:
        # Load model components
        model, scaler, feature_names = load_model()
        if not all([model, scaler, feature_names]):
            return None
        
        # Initialize Supabase client
        supabase: Client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_KEY")
        )
        
        # Get fighter data
        fighter1_response = supabase.table("fighters").select("*").eq("fighter_name", fighter1_name).execute()
        fighter2_response = supabase.table("fighters").select("*").eq("fighter_name", fighter2_name).execute()
        
        if not fighter1_response.data or not fighter2_response.data:
            logger.error("One or both fighters not found in database")
            return None
            
        fighter1_data = fighter1_response.data[0]
        fighter2_data = fighter2_response.data[0]
        
        # Extract features
        fighter1_features = extract_features(fighter1_data)
        fighter2_features = extract_features(fighter2_data)
        
        if not fighter1_features or not fighter2_features:
            logger.error("Could not extract features for one or both fighters")
            return None
        
        # Create feature vector (difference between fighters)
        feature_vector = []
        for key in sorted(fighter1_features.keys()):
            feature_vector.append(fighter1_features[key] - fighter2_features[key])
        
        # Scale features
        feature_vector_scaled = scaler.transform([feature_vector])
        
        # Make prediction
        probability = model.predict_proba(feature_vector_scaled)[0][1]
        
        # Get fighter details
        fighter1_record = fighter1_data.get('Record', 'N/A')
        fighter2_record = fighter2_data.get('Record', 'N/A')
        fighter1_weight = fighter1_data.get('Weight', 'N/A')
        fighter2_weight = fighter2_data.get('Weight', 'N/A')
        
        return {
            'fighter1': {
                'name': fighter1_name,
                'record': fighter1_record,
                'weight': fighter1_weight,
                'probability': probability
            },
            'fighter2': {
                'name': fighter2_name,
                'record': fighter2_record,
                'weight': fighter2_weight,
                'probability': 1 - probability
            }
        }
        
    except Exception as e:
        logger.error(f"Error making prediction: {str(e)}")
        return None

if __name__ == '__main__':
    # Example usage
    fighter1 = "Israel Adesanya"
    fighter2 = "Sean Strickland"
    
    result = predict_fight(fighter1, fighter2)
    if result:
        print(f"\nPrediction for {fighter1} vs {fighter2}:")
        print(f"{fighter1}: {result['fighter1']['probability']:.1%} chance to win")
        print(f"{fighter2}: {result['fighter2']['probability']:.1%} chance to win")
        print(f"\nFighter Details:")
        print(f"{fighter1}: {result['fighter1']['record']} ({result['fighter1']['weight']})")
        print(f"{fighter2}: {result['fighter2']['record']} ({result['fighter2']['weight']})")
    else:
        print("Could not make prediction") 