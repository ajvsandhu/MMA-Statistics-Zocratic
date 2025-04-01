"""
MMA Fight Predictor

A focused machine learning system for predicting UFC fight outcomes.
Uses fighter stats and recent performance to make predictions.
"""

import os
import logging
import numpy as np
from typing import Dict, Any, Optional, Union
import joblib
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

from backend.api.database import get_db_connection
from backend.ml.feature_engineering import extract_all_features, create_fight_vector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FighterPredictor:
    def __init__(self):
        """Initialize the fight predictor."""
        self.model = None
        self.scaler = None
        self._load_model()
    
    def _load_model(self) -> bool:
        """Load the trained model from disk."""
        try:
            model_paths = [
                'backend/ml/models/fight_predictor_model.joblib',
                os.path.join(os.getcwd(), 'backend/ml/models/fight_predictor_model.joblib')
            ]
            
            for path in model_paths:
                if os.path.exists(path):
                    model_data = joblib.load(path)
                    if isinstance(model_data, dict):
                        self.model = model_data.get('model')
                        self.scaler = model_data.get('scaler')
                        return True
            
            # If no model found, create a new one
            self.model = GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=3,
                random_state=42
            )
            self.scaler = StandardScaler()
            return False
            
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            return False
    
    def _get_fighter_data(self, fighter_name: str) -> Optional[Dict[str, Any]]:
        """Get fighter data from the database."""
        try:
            if not fighter_name:
                return None
            
            supabase = get_db_connection()
            if not supabase:
                return None
            
            # Get fighter data
            response = supabase.table('fighters').select('*').ilike('fighter_name', fighter_name).execute()
            
            if not response.data:
                return None
            
            fighter_data = response.data[0]
            
            # Get recent fights
            fights_response = supabase.table('fighter_last_5_fights').select('*')\
                .eq('fighter_name', fighter_data['fighter_name'])\
                .order('fight_date', desc=True)\
                .limit(5)\
                .execute()
            
            fighter_data['recent_fights'] = fights_response.data if fights_response.data else []
            
            return fighter_data
            
        except Exception as e:
            logger.error(f"Error getting fighter data: {str(e)}")
            return None
    
    def predict_winner(self, fighter1_name: str, fighter2_name: str) -> Dict[str, Any]:
        """Predict the outcome of a fight between two fighters."""
        try:
            # Validate input
            if not fighter1_name or not fighter2_name:
                return {"error": "Fighter names cannot be empty"}
            
            # Get fighter data
            fighter1_data = self._get_fighter_data(fighter1_name)
            fighter2_data = self._get_fighter_data(fighter2_name)
            
            if not fighter1_data or not fighter2_data:
                return {"error": "Could not retrieve fighter data"}
            
            # Extract features
            fighter1_features = extract_all_features(fighter1_data)
            fighter2_features = extract_all_features(fighter2_data)
            
            if not fighter1_features or not fighter2_features:
                return {"error": "Could not extract fighter features"}
            
            # Create feature vector
            feature_vector = create_fight_vector(fighter1_features, fighter2_features)
            
            if feature_vector.size == 0:
                return {"error": "Could not create feature vector"}
            
            # Reshape and scale features
            feature_vector = feature_vector.reshape(1, -1)
            if self.scaler:
                feature_vector = self.scaler.transform(feature_vector)
            
            # Get prediction probabilities
            probabilities = self.model.predict_proba(feature_vector)[0]
            
            # Convert to percentages
            fighter1_prob = int(round(probabilities[1] * 100))
            fighter2_prob = int(round(probabilities[0] * 100))
            
            # Ensure percentages sum to 100
            if fighter1_prob + fighter2_prob != 100:
                if fighter1_prob > fighter2_prob:
                    fighter2_prob = 100 - fighter1_prob
                else:
                    fighter1_prob = 100 - fighter2_prob
            
            # Determine winner
            if fighter1_prob > fighter2_prob:
                winner = fighter1_name
                winner_prob = fighter1_prob
                loser = fighter2_name
                loser_prob = fighter2_prob
            else:
                winner = fighter2_name
                winner_prob = fighter2_prob
                loser = fighter1_name
                loser_prob = fighter1_prob
            
            return {
                "winner": winner,
                "loser": loser,
                "winner_probability": winner_prob,
                "loser_probability": loser_prob,
                "fighter1_name": fighter1_name,
                "fighter2_name": fighter2_name,
                "fighter1_probability": fighter1_prob,
                "fighter2_probability": fighter2_prob
            }
            
        except Exception as e:
            logger.error(f"Error predicting fight: {str(e)}")
            return {"error": str(e)}