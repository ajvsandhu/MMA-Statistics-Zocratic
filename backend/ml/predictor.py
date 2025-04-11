"""
Enhanced MMA Fight Predictor

A robust machine learning system for predicting UFC fight outcomes
with natural probability calibration, considering active vs. retired fighter status.
"""

import os
import logging
import numpy as np
from typing import Dict, Any, Optional, Union, List, Tuple
import joblib
from datetime import datetime

from backend.api.database import get_db_connection
from backend.ml.feature_engineering import (
    extract_all_features, create_fight_vector, 
    is_fighter_active, get_days_since_last_fight
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FighterPredictor:
    def __init__(self):
        """Initialize the enhanced fight predictor."""
        self.model = None
        self.scaler = None
        self.feature_names: List[str] = []
        self.metrics: Dict[str, Any] = {}
        self.model_type: str = ""
        self.training_date: str = ""
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
                        self.feature_names = model_data.get('feature_names', [])
                        self.metrics = model_data.get('metrics', {})
                        self.model_type = model_data.get('model_type', "Unknown")
                        self.training_date = model_data.get('training_date', datetime.now().isoformat())
                        
                        logger.info(f"Model loaded successfully: {self.model_type}")
                        logger.info(f"Model trained on: {self.training_date}")
                        logger.info(f"Features: {len(self.feature_names)}")
                        
                        # Log calibration quality
                        if 'brier_score' in self.metrics:
                            logger.info(f"Model calibration quality (Brier score): {self.metrics['brier_score']:.4f}")
                        
                        return True
            
            # Model not found, return failure
            logger.error("No model found at expected locations")
            return False
            
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            return False
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        return {
            'model_type': self.model_type,
            'training_date': self.training_date,
            'feature_count': len(self.feature_names),
            'metrics': self.metrics,
            'is_loaded': self.model is not None and self.scaler is not None
        }
    
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
            
            # Add activity status
            fighter_data['is_active'] = is_fighter_active(fighter_data)
            fighter_data['days_since_last_fight'] = get_days_since_last_fight(fighter_data['recent_fights'])
            
            return fighter_data
            
        except Exception as e:
            logger.error(f"Error getting fighter data: {str(e)}")
            return None
    
    def predict_winner(self, fighter1_name: str, fighter2_name: str) -> Dict[str, Any]:
        """
        Predict the outcome of a fight between two fighters with natural calibration.
        
        Parameters:
            fighter1_name: Name of first fighter
            fighter2_name: Name of second fighter
            
        Returns:
            Dictionary with prediction results
        """
        try:
            # Validate input
            if not fighter1_name or not fighter2_name:
                return {"error": "Fighter names cannot be empty"}
            
            # Check if it's the same fighter
            if fighter1_name.lower() == fighter2_name.lower():
                return {"error": "Cannot predict a fight between the same fighter"}
            
            # Get fighter data
            fighter1_data = self._get_fighter_data(fighter1_name)
            fighter2_data = self._get_fighter_data(fighter2_name)
            
            if not fighter1_data:
                return {"error": f"Could not retrieve data for fighter: {fighter1_name}"}
            
            if not fighter2_data:
                return {"error": f"Could not retrieve data for fighter: {fighter2_name}"}
            
            # Get symmetric prediction (order-independent)
            result = self._get_symmetric_prediction(fighter1_data, fighter2_data)
            
            return result
            
        except Exception as e:
            logger.error(f"Error predicting fight: {str(e)}")
            return {"error": str(e)}
    
    def _calculate_weight_advantage(self, f1_weight: int, f2_weight: int) -> float:
        """
        Calculate weight advantage with progressive scaling that emphasizes larger differences.
        
        Parameters:
            f1_weight: Fighter 1 weight in pounds
            f2_weight: Fighter 2 weight in pounds
            
        Returns:
            float: Weight advantage factor (0.0 to 1.0)
        """
        if f1_weight <= 0 or f2_weight <= 0:
            return 0.0
            
        # Calculate absolute weight difference
        weight_diff = abs(f1_weight - f2_weight)
        
        # Define weight class boundaries
        weight_classes = [
            105,  # Atomweight
            115,  # Strawweight  
            125,  # Flyweight
            135,  # Bantamweight
            145,  # Featherweight
            155,  # Lightweight
            170,  # Welterweight
            185,  # Middleweight
            205,  # Light Heavyweight
            265   # Heavyweight
        ]
        
        # Calculate weight class jumps
        lower_weight = min(f1_weight, f2_weight)
        higher_weight = max(f1_weight, f2_weight)
        
        # Find which weight classes the fighters belong to
        lower_class = 0
        higher_class = 0
        
        for i, class_weight in enumerate(weight_classes):
            if lower_weight <= class_weight:
                lower_class = i
                break
        else:
            lower_class = len(weight_classes) - 1
            
        for i, class_weight in enumerate(weight_classes):
            if higher_weight <= class_weight:
                higher_class = i
                break
        else:
            higher_class = len(weight_classes) - 1
            
        # Calculate class jumps (more impactful than raw weight)
        class_jumps = higher_class - lower_class
        
        # Progressive advantage calculation:
        # - First 10 lbs: modest advantage
        # - Additional weight: increasingly significant advantage
        # - Weight class jumps: multiplier effect
        
        # Base advantage from raw weight (non-linear scaling)
        base_advantage = 0.0
        if weight_diff <= 10:
            # Up to 10 lbs: linear modest advantage (up to 0.08)
            base_advantage = weight_diff * 0.008
        else:
            # First 10 lbs: 0.08
            # Additional pounds: increasing advantage (quadratic growth)
            additional_pounds = weight_diff - 10
            additional_advantage = (additional_pounds ** 1.5) * 0.004
            base_advantage = 0.08 + additional_advantage
            
        # Apply weight class jump multiplier (exponential effect for multiple class jumps)
        class_multiplier = 1.0
        if class_jumps == 1:
            class_multiplier = 1.2  # One weight class: 20% increase
        elif class_jumps == 2:
            class_multiplier = 1.5  # Two weight classes: 50% increase
        elif class_jumps >= 3:
            class_multiplier = 1.8 + (class_jumps - 3) * 0.1  # Three+ classes: 80%+ increase
            
        # Calculate final advantage with class multiplier
        weight_advantage = base_advantage * class_multiplier
        
        # Cap at a maximum value of 0.9 (90% advantage)
        return min(weight_advantage, 0.9)
    
    def _ensure_feature_compatibility(self, feature_vector: np.ndarray, feature_names: List[str]) -> np.ndarray:
        """
        Ensures feature vector compatibility between different versions of features.
        
        If there's a mismatch between generated features and what the model expects,
        this method will adapt the feature vector to match model expectations.
        
        Parameters:
            feature_vector: Generated feature vector
            feature_names: Names of features in the vector
            
        Returns:
            np.ndarray: Feature vector compatible with the model
        """
        # Check if model has expected feature count information
        if not self.model or not self.feature_names:
            logger.warning("Model or feature names not loaded, cannot ensure compatibility")
            return feature_vector
            
        expected_feature_count = len(self.feature_names)
        actual_feature_count = len(feature_vector)
        
        # If feature counts match, no adjustment needed
        if expected_feature_count == actual_feature_count:
            return feature_vector
            
        logger.warning(f"Feature count mismatch: model expects {expected_feature_count} features but received {actual_feature_count}")
        
        # Option 1: Truncate extra features if we have too many
        if actual_feature_count > expected_feature_count:
            logger.warning(f"Truncating feature vector from {actual_feature_count} to {expected_feature_count} features")
            return feature_vector[:expected_feature_count]
            
        # Option 2: Pad with zeros if we have too few features
        if actual_feature_count < expected_feature_count:
            logger.warning(f"Padding feature vector from {actual_feature_count} to {expected_feature_count} features")
            padded_vector = np.zeros(expected_feature_count)
            padded_vector[:actual_feature_count] = feature_vector
            return padded_vector
            
        return feature_vector
    
    def _get_symmetric_prediction(self, fighter1_data: Dict[str, Any], fighter2_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make a symmetric prediction that's independent of fighter order.
        
        Calculates prediction both ways and averages the results for consistent probabilities
        regardless of which fighter is entered first.
        
        Parameters:
            fighter1_data: Data for first fighter
            fighter2_data: Data for second fighter
            
        Returns:
            Dictionary with order-independent prediction results
        """
        # Extract fighter names for the result
        fighter1_name = fighter1_data.get('fighter_name', 'Unknown')
        fighter2_name = fighter2_data.get('fighter_name', 'Unknown')
        
        # Determine matchup type (active vs active, active vs retired, retired vs retired)
        fighter1_active = fighter1_data.get('is_active', False)
        fighter2_active = fighter2_data.get('is_active', False)
        
        if fighter1_active and fighter2_active:
            matchup_type = "active_vs_active"
        elif not fighter1_active and not fighter2_active:
            matchup_type = "retired_vs_retired"
        else:
            matchup_type = "active_vs_retired"
        
        # Extract features
        fighter1_features = extract_all_features(fighter1_data)
        fighter2_features = extract_all_features(fighter2_data)
        
        if not fighter1_features or not fighter2_features:
            return {"error": "Could not extract fighter features"}
        
        # Check if this is an intergender matchup
        fighter1_female = fighter1_features.get('is_female', 0.0)
        fighter2_female = fighter2_features.get('is_female', 0.0)
        is_intergender = (fighter1_female == 1.0 and fighter2_female == 0.0) or (fighter1_female == 0.0 and fighter2_female == 1.0)
        
        # For intergender matchups, special handling to account for biological differences
        if is_intergender:
            # Create feature vectors for both fighters
            feature_vector, feature_names_list = create_fight_vector(fighter1_features, fighter2_features)
            
            if feature_vector.size == 0:
                return {"error": "Could not create feature vector"}
            
            # Ensure feature compatibility with model
            feature_vector = self._ensure_feature_compatibility(feature_vector, feature_names_list)
            
            # Reshape and scale features
            feature_vector = feature_vector.reshape(1, -1)
            
            if self.scaler:
                feature_vector = self.scaler.transform(feature_vector)
            
            # Get raw prediction probabilities
            raw_probabilities = self.model.predict_proba(feature_vector)[0]
            raw_prob_value = raw_probabilities[1]  # Probability of fighter1 winning
            
            # Extract weight and skill indicators for both fighters
            # Try multiple patterns to extract weight
            f1_weight = self._extract_fighter_weight(fighter1_data)
            f2_weight = self._extract_fighter_weight(fighter2_data)
            
            # Get skill indicators
            f1_win_rate = fighter1_features.get('win_rate_weighted', 0.5)
            f2_win_rate = fighter2_features.get('win_rate_weighted', 0.5)
            f1_exp = fighter1_features.get('total_fights', 5)
            f2_exp = fighter2_features.get('total_fights', 5)
            
            # Calculate performance metrics
            f1_finish_rate = fighter1_features.get('finish_rate', 0.5)
            f2_finish_rate = fighter2_features.get('finish_rate', 0.5)
            f1_str_acc = fighter1_features.get('str_acc', 0.5) 
            f2_str_acc = fighter2_features.get('str_acc', 0.5)
            f1_rank = min(fighter1_features.get('ranking', 15), 15)
            f2_rank = min(fighter2_features.get('ranking', 15), 15)
            
            # Calculate weight advantage using new progressive method
            weight_diff = abs(f1_weight - f2_weight)
            relative_weight_advantage = self._calculate_weight_advantage(f1_weight, f2_weight)
            
            # Calculate comprehensive skill factor (higher is better)
            # Incorporate win rate, experience, finish rate, striking accuracy, and ranking
            f1_skill = (
                f1_win_rate * 0.4 +
                min(f1_exp / 15, 1.0) * 0.2 +
                f1_finish_rate * 0.2 +
                f1_str_acc * 0.1 +
                (1.0 - (f1_rank / 15.0)) * 0.1
            )
            
            f2_skill = (
                f2_win_rate * 0.4 +
                min(f2_exp / 15, 1.0) * 0.2 +
                f2_finish_rate * 0.2 +
                f2_str_acc * 0.1 +
                (1.0 - (f2_rank / 15.0)) * 0.1
            )
            
            # Normalize skills to be between 0.3 and 1.0
            f1_skill = 0.3 + (f1_skill * 0.7)
            f2_skill = 0.3 + (f2_skill * 0.7)
            
            # Calculate skill advantage (positive means fighter1 has advantage)
            skill_advantage = (f1_skill - f2_skill) * 0.5  # Scale the impact
            
            # Determine advantage based on gender, weight, and skill
            if fighter1_female == 0.0 and fighter2_female == 1.0:
                # Fighter 1 is male, Fighter 2 is female
                # Base male advantage
                base_advantage = 0.7  # 70% base advantage
                
                # Weight advantage adds up to progressive advantage based on weight difference
                if f1_weight > f2_weight:
                    weight_factor = relative_weight_advantage
                else:
                    # Female is heavier, reduce advantage slightly
                    weight_factor = -relative_weight_advantage / 2
                
                # Skill differential can modify advantage by up to 15%
                skill_factor = min(max(skill_advantage, -0.15), 0.15)
                
                # Combined factors (with limits)
                male_advantage = min(max(base_advantage + weight_factor + skill_factor, 0.55), 0.95)
                
                # Raw model prediction can influence slightly (up to 5%)
                model_influence = (raw_prob_value - 0.5) * 0.1  # Scaled down influence
                final_advantage = min(max(male_advantage + model_influence, 0.55), 0.95)
                
                # Apply as fighter1 probability
                fighter1_prob = final_advantage
                fighter2_prob = 1.0 - fighter1_prob
                
            else:
                # Fighter 1 is female, Fighter 2 is male
                # Base male advantage
                base_advantage = 0.7  # 70% base advantage
                
                # Weight advantage with progressive scaling
                if f2_weight > f1_weight:
                    weight_factor = relative_weight_advantage
                else:
                    # Female is heavier, reduce advantage slightly
                    weight_factor = -relative_weight_advantage / 2
                
                # Skill differential can modify advantage by up to 15% (negative skill_advantage here means male is better)
                skill_factor = min(max(-skill_advantage, -0.15), 0.15)
                
                # Combined factors (with limits)
                male_advantage = min(max(base_advantage + weight_factor + skill_factor, 0.55), 0.95)
                
                # Raw model prediction can influence slightly (up to 5%)
                model_influence = ((1.0 - raw_prob_value) - 0.5) * 0.1  # Scaled down influence, inverted
                final_advantage = min(max(male_advantage + model_influence, 0.55), 0.95)
                
                # Apply as fighter2 probability  
                fighter1_prob = 1.0 - final_advantage
                fighter2_prob = final_advantage
            
            # Convert to percentages
            fighter1_prob_pct = int(round(fighter1_prob * 100))
            fighter2_prob_pct = 100 - fighter1_prob_pct
            
            # Add detailed calculation data for logging
            computation_details = {
                "fighter1": {
                    "name": fighter1_name,
                    "weight": f1_weight,
                    "weight_class": self._get_weight_class_name(f1_weight),
                    "skill_score": round(f1_skill, 2),
                    "win_rate": round(f1_win_rate, 2),
                    "female": fighter1_female == 1.0
                },
                "fighter2": {
                    "name": fighter2_name,
                    "weight": f2_weight,
                    "weight_class": self._get_weight_class_name(f2_weight),
                    "skill_score": round(f2_skill, 2),
                    "win_rate": round(f2_win_rate, 2),
                    "female": fighter2_female == 1.0
                },
                "weight_diff": weight_diff,
                "weight_advantage": round(relative_weight_advantage, 3),
                "skill_advantage": round(skill_advantage, 2),
                "raw_model_prob": round(raw_prob_value, 2)
            }
            
            logger.debug(f"Intergender matchup details: {computation_details}")
            
        else:
            # For same-gender matchups, use symmetric prediction approach but incorporate weight advantage
            # Create forward and reverse feature vectors
            # Forward (fighter1 vs fighter2)
            feature_vector_fwd, feature_names_list = create_fight_vector(fighter1_features, fighter2_features)
            
            # Reverse (fighter2 vs fighter1)
            feature_vector_rev, _ = create_fight_vector(fighter2_features, fighter1_features)
            
            if feature_vector_fwd.size == 0 or feature_vector_rev.size == 0:
                return {"error": "Could not create feature vector"}
                
            # Ensure feature compatibility with model
            feature_vector_fwd = self._ensure_feature_compatibility(feature_vector_fwd, feature_names_list)
            feature_vector_rev = self._ensure_feature_compatibility(feature_vector_rev, feature_names_list)
            
            # Reshape and scale features
            feature_vector_fwd = feature_vector_fwd.reshape(1, -1)
            feature_vector_rev = feature_vector_rev.reshape(1, -1)
            
            if self.scaler:
                feature_vector_fwd = self.scaler.transform(feature_vector_fwd)
                feature_vector_rev = self.scaler.transform(feature_vector_rev)
            
            # Get raw prediction probabilities for both directions
            raw_probabilities_fwd = self.model.predict_proba(feature_vector_fwd)[0]
            raw_probabilities_rev = self.model.predict_proba(feature_vector_rev)[0]
            
            # Extract relevant probabilities (fighter1 wins in forward prediction, 
            # and fighter1 loses in reverse prediction)
            fighter1_prob_fwd = raw_probabilities_fwd[1]  # Probability of fighter1 winning
            fighter1_prob_rev = 1.0 - raw_probabilities_rev[1]  # Probability of fighter2 losing
            
            # Extract weights for both fighters
            f1_weight = self._extract_fighter_weight(fighter1_data)
            f2_weight = self._extract_fighter_weight(fighter2_data)
            
            # Calculate weight advantage using progressive method
            weight_advantage = self._calculate_weight_advantage(f1_weight, f2_weight)
            
            # Apply weight advantage to the probability (if there's a significant difference)
            if weight_advantage > 0.05:  # Only apply if advantage is meaningful
                # Determine which fighter has weight advantage
                if f1_weight > f2_weight:
                    # Fighter 1 has weight advantage
                    weight_boost = weight_advantage * 0.3  # Scale the impact
                    fighter1_prob_fwd = min(fighter1_prob_fwd + weight_boost, 0.95)
                    fighter1_prob_rev = min(fighter1_prob_rev + weight_boost, 0.95)
                else:
                    # Fighter 2 has weight advantage
                    weight_boost = weight_advantage * 0.3  # Scale the impact
                    fighter1_prob_fwd = max(fighter1_prob_fwd - weight_boost, 0.05)
                    fighter1_prob_rev = max(fighter1_prob_rev - weight_boost, 0.05)
            
            # Take average of both directions for consistent results
            fighter1_prob = (fighter1_prob_fwd + fighter1_prob_rev) / 2.0
            fighter2_prob = 1.0 - fighter1_prob
            
            # Convert to percentages
            fighter1_prob_pct = int(round(fighter1_prob * 100))
            fighter2_prob_pct = 100 - fighter1_prob_pct
            
            # Add weight information to the debug data
            logger.debug(f"Weight classes: {fighter1_name} ({f1_weight}lbs) vs {fighter2_name} ({f2_weight}lbs)")
            logger.debug(f"Weight advantage factor: {weight_advantage:.3f}")
        
        # Create prediction summary
        prediction = {
            "fighter1_name": fighter1_name,
            "fighter2_name": fighter2_name,
            "fighter1_probability": fighter1_prob_pct,
            "fighter2_probability": fighter2_prob_pct,
            "fighter1_active": fighter1_active,
            "fighter2_active": fighter2_active,
            "matchup_type": matchup_type,
            "status": "success"
        }
        
        # If we have weight information, add it to the prediction
        if f1_weight > 0 and f2_weight > 0:
            prediction["fighter1_weight"] = f1_weight
            prediction["fighter2_weight"] = f2_weight
            prediction["weight_difference"] = abs(f1_weight - f2_weight)
            if abs(f1_weight - f2_weight) > 15:
                prediction["significant_weight_difference"] = True
                
            # Add weight class information
            prediction["fighter1_weight_class"] = self._get_weight_class_name(f1_weight)
            prediction["fighter2_weight_class"] = self._get_weight_class_name(f2_weight)
        
        # If it's an intergender match, note this in the prediction
        if is_intergender:
            if fighter1_female:
                prediction["gender_matchup"] = "female_vs_male"
            else:
                prediction["gender_matchup"] = "male_vs_female"
        
        # Determine winner
        if fighter1_prob_pct >= fighter2_prob_pct:
            prediction["winner"] = fighter1_name
            prediction["loser"] = fighter2_name
            prediction["winner_probability"] = fighter1_prob_pct
            prediction["loser_probability"] = fighter2_prob_pct
        else:
            prediction["winner"] = fighter2_name
            prediction["loser"] = fighter1_name
            prediction["winner_probability"] = fighter2_prob_pct
            prediction["loser_probability"] = fighter1_prob_pct
        
        # Log prediction details
        logger.info(f"Prediction: {fighter1_name} ({fighter1_prob_pct}%) vs {fighter2_name} ({fighter2_prob_pct}%)")
        logger.info(f"Matchup type: {matchup_type}")
        
        # Add feature contribution analysis if available
        if hasattr(self.model, 'feature_importances_') and self.feature_names:
            # For intergender, use the single vector; otherwise use forward direction
            if is_intergender:
                top_features = self._analyze_prediction_factors(
                    feature_vector[0], self.model.feature_importances_, self.feature_names
                )
            else:
                top_features = self._analyze_prediction_factors(
                    feature_vector_fwd[0], self.model.feature_importances_, self.feature_names
                )
            prediction["key_factors"] = top_features
        
        return prediction
    
    def _analyze_prediction_factors(self, 
                                   feature_values: np.ndarray,
                                   feature_importances: np.ndarray,
                                   feature_names: List[str],
                                   top_n: int = 5) -> List[Dict[str, Union[str, float]]]:
        """
        Analyze the most important factors in a prediction.
        
        Parameters:
            feature_values: The feature vector used for prediction
            feature_importances: The importance of each feature from the model
            feature_names: Names of the features
            top_n: Number of top factors to return
            
        Returns:
            List of dictionaries with factor name and contribution
        """
        try:
            # Combine feature values with importances
            feature_contributions = []
            
            for i, (name, value) in enumerate(zip(feature_names, feature_values)):
                if i < len(feature_importances):
                    importance = feature_importances[i]
                    # Contribution is a combination of feature value and importance
                    contribution = abs(value) * importance
                    
                    # Skip features with zero contribution
                    if contribution > 0:
                        # Make the feature name more readable
                        readable_name = name
                        if name.startswith('diff_'):
                            readable_name = f"Difference in {name[5:]}"
                        elif name.startswith('rel_diff_'):
                            readable_name = f"Relative difference in {name[9:]}"
                        elif name.startswith('f1_'):
                            readable_name = f"Fighter 1's {name[3:]}"
                        elif name.startswith('f2_'):
                            readable_name = f"Fighter 2's {name[3:]}"
                        elif name.startswith('matchup_'):
                            readable_name = f"Matchup {name[8:].replace('_', ' ')}"
                        
                        feature_contributions.append({
                            'name': readable_name,
                            'contribution': float(contribution),
                            'raw_value': float(value),
                            'importance': float(importance)
                        })
            
            # Sort by contribution and get top N
            top_features = sorted(
                feature_contributions, 
                key=lambda x: x['contribution'], 
                reverse=True
            )[:top_n]
            
            return top_features
            
        except Exception as e:
            logger.error(f"Error analyzing prediction factors: {str(e)}")
            return []
    
    def batch_predict(self, matchups: List[Tuple[str, str]]) -> List[Dict[str, Any]]:
        """
        Make predictions for multiple matchups at once.
        
        Parameters:
            matchups: List of (fighter1, fighter2) name tuples
            
        Returns:
            List of prediction dictionaries
        """
        results = []
        for fighter1_name, fighter2_name in matchups:
            results.append(self.predict_winner(fighter1_name, fighter2_name))
        return results
    
    def _extract_fighter_weight(self, fighter_data: Dict[str, Any]) -> int:
        """
        Extract fighter weight in pounds from fighter data.
        Tries multiple patterns to handle different weight formats.
        
        Parameters:
            fighter_data: Dictionary with fighter information
            
        Returns:
            int: Fighter weight in pounds, 0 if not found
        """
        weight_str = fighter_data.get('Weight', '')
        if not weight_str:
            return 0
            
        # Try to extract number from various formats
        weight_str = weight_str.lower()
        
        # Try to extract just the digits
        digits = ''.join(filter(str.isdigit, weight_str))
        if digits:
            try:
                return int(digits)
            except:
                pass
                
        # Try to handle weight class names
        weight_classes = {
            "strawweight": 115,
            "atomweight": 105,
            "flyweight": 125,
            "bantamweight": 135,
            "featherweight": 145,
            "lightweight": 155,
            "welterweight": 170,
            "middleweight": 185,
            "light heavyweight": 205,
            "heavyweight": 245
        }
        
        for class_name, weight_value in weight_classes.items():
            if class_name in weight_str:
                return weight_value
                
        # Handle common divisions that might have "women's" prefix
        if "women's strawweight" in weight_str:
            return 115
        if "women's flyweight" in weight_str:
            return 125
        if "women's bantamweight" in weight_str:
            return 135
        if "women's featherweight" in weight_str:
            return 145
            
        return 0
    
    def _get_weight_class_name(self, weight: int) -> str:
        """
        Convert weight in pounds to UFC weight class name.
        
        Parameters:
            weight: Fighter weight in pounds
            
        Returns:
            str: Weight class name
        """
        if weight <= 0:
            return "Unknown"
            
        # Women's divisions
        if weight <= 115:
            return "Strawweight"
        elif weight <= 125:
            return "Flyweight"
        elif weight <= 135:
            return "Bantamweight"
        elif weight <= 145:
            return "Featherweight"
            
        # Men's divisions (and higher women's catchweights)
        if weight <= 155:
            return "Lightweight"
        elif weight <= 170:
            return "Welterweight"
        elif weight <= 185:
            return "Middleweight"
        elif weight <= 205:
            return "Light Heavyweight"
        elif weight <= 265:
            return "Heavyweight"
        else:
            return "Super Heavyweight"