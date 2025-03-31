"""
UFC Fight Predictor

A machine learning system that predicts who's going to win in a UFC fight
Uses fighter stats, recent performance, and physical attributes to make smart predictions.
"""

import os
import json
import pickle
import logging
import math
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Union
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV
import random
import joblib
import traceback

from backend.api.database import get_db_connection
from backend.ml.config import get_config
from backend.ml.feature_engineering import (
    safe_convert_to_float, 
    extract_height_in_inches, 
    extract_reach_in_inches,
    extract_record_stats,
    calculate_win_percentage,
    extract_style_features,
    extract_recent_fight_stats,
    extract_advanced_fighter_profile,
    extract_physical_comparisons,
    analyze_opponent_quality,
    find_common_opponents,
    check_head_to_head,
    extract_strikes_landed_attempted
)

from backend.constants import (
    MODEL_PATH,
    APP_VERSION,
    LOG_LEVEL,
    LOG_FORMAT,
    LOG_DATE_FORMAT,
    DB_PATH,
    IMPORTANT_FEATURES,
    DEFAULT_CONFIDENCE,
    DEFAULT_MODEL_FILE
)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format=LOG_FORMAT,
    datefmt=LOG_DATE_FORMAT
)
logger = logging.getLogger(__name__)

def parse_record(record_str):
    """
    Takes a fighter's record (like '10-2-1') and breaks it down into wins, losses, and draws.
    """
    try:
        parts = record_str.split('-')
        if len(parts) == 3:
            wins = int(parts[0])
            losses = int(parts[1])
            draws = int(parts[2])
            return wins, losses, draws
        return 0, 0, 0
    except Exception:
        return 0, 0, 0

def calculate_recent_win_streak(recent_fights):
    """Calculate the current win streak from recent fights"""
    streak = 0
    for fight in recent_fights:
        result = fight.get('result', '').upper()
        if 'W' in result:
            streak += 1
        else:
            break
    return streak

def calculate_recent_loss_streak(recent_fights):
    """Calculate the current loss streak from recent fights"""
    streak = 0
    for fight in recent_fights:
        result = fight.get('result', '').upper()
        if 'L' in result:
            streak += 1
        else:
            break
    return streak

def calculate_finish_rate(recent_fights):
    """Calculate the rate of fights finished by KO/TKO/Submission"""
    if not recent_fights:
        return 0.0
    finished = sum(1 for fight in recent_fights 
                  if any(finish in fight.get('method', '').upper() 
                        for finish in ['KO', 'TKO', 'SUB']))
    return finished / len(recent_fights)

def calculate_decision_rate(recent_fights):
    """Calculate the rate of fights that went to decision"""
    if not recent_fights:
        return 0.0
    decisions = sum(1 for fight in recent_fights 
                   if 'DEC' in fight.get('method', '').upper())
    return decisions / len(recent_fights)

class FighterPredictor:
    """
    The brain of our UFC prediction system! 🧠

    What it does:
    - Analyzes fighter stats and styles
    - Tracks how well fighters have been doing lately
    - Compares physical attributes (height, reach, etc.)
    - Looks at head-to-head history
    - Calculates who's likely to win
    """
    
    def __init__(self, train=False):
        """
        Initialize predictor with optional training mode.
        """
        self.logger = logging.getLogger(__name__)
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.model_info = {
            'version': APP_VERSION,
            'accuracy': 0.0,
            'status': 'Initializing',
            'last_trained': None,
            'training_size': 0
        }
        
        if not train:
            self._load_model()
        
        self.logger.debug("Predictor initialized")

    def _load_model(self) -> bool:
        """
        Loads the trained model in a deployment-friendly way.
        
        Returns:
            bool: True if everything loaded okay, False if something went wrong
        """
        try:
            # Log the absolute path being used
            abs_model_path = os.path.abspath(MODEL_PATH)
            self.logger.info(f"Attempting to load model from: {abs_model_path}")
            
            # Check if we're on Render
            if os.getenv('RENDER'):
                self.logger.info("Running on Render environment")
                # Try both potential paths on Render
                potential_paths = [
                    abs_model_path,
                    '/opt/render/project/src/ml/models/fight_predictor_model.joblib',
                    '/opt/render/project/src/backend/ml/models/fight_predictor_model.joblib'
                ]
                
                for path in potential_paths:
                    self.logger.info(f"Trying path: {path}")
                    if os.path.exists(path):
                        abs_model_path = path
                        self.logger.info(f"Found model at: {path}")
                        break
            
            if not os.path.exists(abs_model_path):
                self.logger.error(f"Model file not found at {abs_model_path}")
                # Log the current working directory and contents
                cwd = os.getcwd()
                self.logger.error(f"Current working directory: {cwd}")
                model_dir = os.path.dirname(abs_model_path)
                if os.path.exists(model_dir):
                    self.logger.info(f"Contents of model directory: {os.listdir(model_dir)}")
                else:
                    self.logger.error(f"Model directory does not exist: {model_dir}")
                return False

            # Load the model package with increased compatibility
            try:
                model_data = joblib.load(abs_model_path)
                self.logger.info("Successfully loaded model file")
            except Exception as e:
                self.logger.error(f"Failed to load model: {str(e)}")
                self.logger.error(f"Full error: {traceback.format_exc()}")
                return False

            # Extract model components with better error handling
            if isinstance(model_data, dict):
                try:
                    self.model = model_data.get('model')
                    self.scaler = model_data.get('scaler')
                    self.feature_names = model_data.get('feature_names')
                    
                    # Handle both old and new metadata format
                    metadata = model_data.get('metadata', model_data.get('model_info', {}))
                    if metadata:
                        self.model_info.update(metadata)
                except Exception as e:
                    self.logger.error(f"Error extracting model components: {str(e)}")
                    return False
            else:
                self.logger.warning("Model data not in expected format, using as direct model")
                self.model = model_data
                self.scaler = StandardScaler()
                self.feature_names = IMPORTANT_FEATURES

            # Verify model is loaded and supports probability predictions
            if self.model is None:
                self.logger.error("Failed to load model - model object is None")
                return False

            if hasattr(self.model, 'predict_proba'):
                self.logger.info("Model loaded successfully")
                return True
            else:
                self.logger.error("Loaded model does not support probability predictions")
                return False

        except Exception as e:
            self.logger.error(f"Error loading model: {str(e)}")
            self.logger.error(f"Full traceback: {traceback.format_exc()}")
            return False

    def _save_model(self) -> bool:
        """
        Save the trained model to disk in a deployment-friendly format.
        
        Returns:
            bool: True if model was successfully saved, False otherwise
        """
        if not self.model:
            self.logger.error("Cannot save model - no model is loaded")
            return False
            
        try:
            # Create model directory if it doesn't exist
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            
            # Ensure we have valid feature names
            if not self.feature_names or len(self.feature_names) == 0:
                self.logger.warning("No feature names available, creating dummy feature names")
                self.feature_names = [f"feature_{i}" for i in range(100)]
                
            # Ensure we have a valid scaler
            if not self.scaler:
                self.logger.warning("No scaler available, creating a default scaler")
                self.scaler = StandardScaler()
            
            # Create model package with all necessary components
            # Use protocol=4 for better compatibility across Python versions
            model_package = {
                'model': self.model,
                'scaler': self.scaler,
                'feature_names': self.feature_names,
                'metadata': {
                    'version': APP_VERSION,
                    'accuracy': self.model_info.get('accuracy', 0.0),
                    'last_trained': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    'n_features': len(self.feature_names)
                }
            }
            
            # Save using joblib with increased compatibility
            joblib.dump(model_package, MODEL_PATH, protocol=4, compress=('zlib', 3))
            self.logger.info(f"Model saved to {MODEL_PATH} with increased compatibility")
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving model: {str(e)}")
            self.logger.error(traceback.format_exc())
            return False
    
    def _get_db_connection(self):
        """
        Get a connection to the Supabase database.
        
        Returns:
            Optional: Supabase client if successful, None otherwise
        """
        try:
            return get_db_connection()
        except Exception as e:
            self.logger.error(f"Database connection error: {str(e)}")
            return None
    
    def _get_fighter_data(self, fighter_name: str) -> Optional[Dict[str, Any]]:
        """
        Looks up a fighter in our database to get all their info! 🔍
        
        Args:
            fighter_name: Name of the fighter we're looking for
            
        Returns:
            All the fighter's data if we find them, None if we don't
            
        Raises:
            ValueError: If the fighter name is empty or invalid
        """
        if not fighter_name or not isinstance(fighter_name, str):
            self.logger.error("Invalid fighter name provided")
            raise ValueError("Fighter name must be a non-empty string")
        
        try:
            supabase = self._get_db_connection()
            if not supabase:
                self.logger.error("No database connection available")
                return None
            
            try:
                # Get fighter data from Supabase using case-insensitive search
                response = supabase.table('fighters').select('*').ilike('fighter_name', fighter_name).execute()
                
                if not response.data or len(response.data) == 0:
                    # Try again with another approach - exact match case insensitive
                    response = supabase.table('fighters').select('*').eq('fighter_name', fighter_name).execute()
                    
                    if not response.data or len(response.data) == 0:
                        # Try one more approach with pattern matching
                        response = supabase.table('fighters').select('*').ilike('fighter_name', f"%{fighter_name}%").execute()
                        
                        if not response.data or len(response.data) == 0:
                            self.logger.warning(f"Fighter not found in database: {fighter_name}")
                            return None
                
                fighter_data = response.data[0]
                
                # Get fighter's recent fights from Supabase
                fights_response = supabase.table('fighter_last_5_fights').select('*')\
                    .eq('fighter_name', fighter_data.get('fighter_name', fighter_name))\
                    .order('fight_date', desc=True)\
                    .limit(10)\
                    .execute()
                
                if fights_response.data and len(fights_response.data) > 0:
                    fighter_data['recent_fights'] = fights_response.data
                else:
                    fighter_data['recent_fights'] = []
                
                return fighter_data
                
            except Exception as e:
                self.logger.error(f"Database error retrieving fighter data: {str(e)}")
                import traceback
                self.logger.error(traceback.format_exc())
                raise
                
        except Exception as e:
            self.logger.error(f"Error retrieving fighter data for {fighter_name}: {str(e)}")
            import traceback
            self.logger.error(traceback.format_exc())
            return None
    
    def _get_fighter_record(self, fighter_name):
        """
        Gets a fighter's win-loss-draw record and recent fight results! 📝
        
        This tells us how many fights they've won, lost, and drawn,
        plus how they did in their last few fights.
        """
        try:
            fighter_data = self._get_fighter_data(fighter_name)
            if not fighter_data:
                return None
                
            record = fighter_data.get('Record', '0-0-0')
            try:
                wins, losses, draws = parse_record(record)
            except:
                wins, losses, draws = 0, 0, 0
                
            # Get recent fight results
            recent_results = []
            for fight in fighter_data.get('recent_fights', [])[:3]:  # Last 3 fights
                result = fight.get('result', '')
                if 'w' in result.lower():
                    recent_results.append('W')
                elif 'l' in result.lower():
                    recent_results.append('L')
                else:
                    recent_results.append('D')
                    
            return {
                'record': record,
                'wins': wins,
                'losses': losses,
                'draws': draws,
                'last_three_results': recent_results
            }
        except Exception as e:
            self.logger.error(f"Error getting fighter record for {fighter_name}: {str(e)}")
            return None
    
    def _get_fighter_image(self, fighter_name):
        """Get fighter image URL from the database"""
        try:
            fighter_data = self._get_fighter_data(fighter_name)
            if not fighter_data:
                return None
                
            return fighter_data.get('image_url')
        except Exception as e:
            self.logger.error(f"Error getting fighter image for {fighter_name}: {str(e)}")
            return None 

    def _extract_features_from_fighter(self, fighter_input):
        try:
            # Handle both fighter name strings and fighter data dictionaries
            if isinstance(fighter_input, dict):
                fighter_data = fighter_input
                fighter_name = fighter_data.get('fighter_name', '')
            else:
                fighter_name = fighter_input
            fighter_data = self._get_fighter_data(fighter_name)
            
            if not fighter_data:
                self.logger.warning(f"No data found for fighter: {fighter_name}")
                return None
                
            # Initialize feature vector with exactly 23 features
            expected_features = [
                # Basic striking stats (4)
                'slpm', 'str_acc', 'sapm', 'str_def',
                # Grappling stats (4)
                'td_avg', 'td_acc', 'td_def', 'sub_avg',
                # Physical attributes (2)
                'reach', 'height',
                # Record stats (3)
                'wins', 'losses', 'draws',
                # Derived record stats (2)
                'win_percentage', 'total_fights',
                # Performance differentials (2)
                'striking_differential', 'takedown_differential',
                # Recent performance (2)
                'recent_win_streak', 'recent_loss_streak',
                # Fight ending tendencies (2)
                'finish_rate', 'decision_rate',
                # Experience (1)
                'experience_factor',
                # Ranking (1)
                'ranking'
            ]
            
            # Create empty features dictionary
            features = {}
            
            # Extract basic stats
            features['slpm'] = safe_convert_to_float(fighter_data.get('SLpM', 0))
            features['str_acc'] = safe_convert_to_float(fighter_data.get('Str. Acc.', 0))
            features['sapm'] = safe_convert_to_float(fighter_data.get('SApM', 0))
            features['str_def'] = safe_convert_to_float(fighter_data.get('Str. Def', 0))
            features['td_avg'] = safe_convert_to_float(fighter_data.get('TD Avg.', 0))
            features['td_acc'] = safe_convert_to_float(fighter_data.get('TD Acc.', 0))
            features['td_def'] = safe_convert_to_float(fighter_data.get('TD Def.', 0))
            features['sub_avg'] = safe_convert_to_float(fighter_data.get('Sub. Avg.', 0))
            
            # Extract physical attributes
            features['reach'] = extract_reach_in_inches(fighter_data.get('Reach', '0"'))
            features['height'] = extract_height_in_inches(fighter_data.get('Height', "0' 0\""))
            
            # Extract record stats
            record_str = fighter_data.get('Record', '0-0-0')
            wins, losses, draws = parse_record(record_str)
            features['wins'] = wins
            features['losses'] = losses
            features['draws'] = draws
            features['total_fights'] = wins + losses + draws
            features['win_percentage'] = calculate_win_percentage({'wins': wins, 'losses': losses, 'draws': draws})
            
            # Calculate performance differentials
            features['striking_differential'] = features['slpm'] - features['sapm']
            features['takedown_differential'] = features['td_avg'] * features['td_acc'] - features['td_avg'] * (1 - features['td_def'])
            
            # Calculate recent performance metrics
            recent_fights = fighter_data.get('recent_fights', [])
            features['recent_win_streak'] = calculate_recent_win_streak(recent_fights)
            features['recent_loss_streak'] = calculate_recent_loss_streak(recent_fights)
            features['finish_rate'] = calculate_finish_rate(recent_fights)
            features['decision_rate'] = calculate_decision_rate(recent_fights)
            
            # Calculate experience factor
            features['experience_factor'] = features['total_fights'] * features['win_percentage']
            
            # Extract ranking (default to 99 for unranked)
            features['ranking'] = int(fighter_data.get('ranking', 99))
            
            # Ensure we're returning exactly the expected features in the correct order
            result_features = {}
            for feature in expected_features:
                result_features[feature] = features.get(feature, 0.0)
                
            # Log extracted features for debugging
            self.logger.info(f"Extracted features for {fighter_name}: {result_features}")
            self.logger.info(f"Successfully extracted {len(result_features)} features for {fighter_name}")
            
            return result_features
            
        except Exception as e:
            self.logger.error(f"Error extracting features for {fighter_name}: {str(e)}")
            import traceback
            self.logger.error(traceback.format_exc())
            return None
    
    def _get_training_data(self):
        """
        Collect all the training data we need to teach our model! 📚
        
        This gathers historical fight results and fighter stats,
        then transforms them into the format our model needs to learn.
        
        Returns:
            tuple: (X, y) - Features and labels for training
        """
        try:
            # Get database connection
            supabase = self._get_db_connection()
            if not supabase:
                self.logger.error("No database connection available")
                return None, None
                
            # Get all fighters from the database
            response = supabase.table("fighters").select("*").execute()
            if not response.data:
                self.logger.warning("No fighters found in the database")
                return None, None
            
            fighters = response.data
            self.logger.info(f"Retrieved {len(fighters)} fighters for training")
            
            # Get all fights
            response = supabase.table("fighter_last_5_fights").select("*").execute()
            if not response.data:
                self.logger.warning("No fights found in the database")
                return None, None
            
            fights = response.data
            self.logger.info(f"Retrieved {len(fights)} fights for training")
            
            # Create a lookup dictionary for fighters to improve performance
            fighter_dict = {f['fighter_name']: f for f in fighters}
            
            # Create a lookup dictionary for head-to-head history
            h2h_history = {}
            for fight in fights:
                fighter = fight.get('fighter_name')
                opponent = fight.get('opponent')
                result = fight.get('result', '').upper()
                
                if fighter and opponent and result:
                    key = tuple(sorted([fighter, opponent]))
                    if key not in h2h_history:
                        h2h_history[key] = []
                    h2h_history[key].append((fighter, result))
            
            # Process fighters to extract training data
            X = []
            y = []
            processed_count = 0
            skipped_count = 0
            
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
                        
                    # Find fighter data using dictionary lookup
                    fighter_data = fighter_dict.get(fighter_name)
                    opponent_data = fighter_dict.get(opponent)
                    
                    if not fighter_data or not opponent_data:
                        skipped_count += 1
                        continue
                    
                    # Extract features for both fighters
                    fighter_features = self._extract_features_from_fighter(fighter_name)
                    opponent_features = self._extract_features_from_fighter(opponent)
                    
                    if not fighter_features or not opponent_features:
                        skipped_count += 1
                        continue
                    
                    # Add head-to-head history features
                    key = tuple(sorted([fighter_name, opponent]))
                    prior_fights = [f for f in h2h_history.get(key, []) if f[0] == fighter_name]
                    
                    # Calculate head-to-head features
                    h2h_wins = sum(1 for f in prior_fights if 'W' in f[1])
                    h2h_losses = sum(1 for f in prior_fights if 'L' in f[1])
                    h2h_win_rate = h2h_wins / len(prior_fights) if prior_fights else 0
                    
                    # Create feature vector (difference between fighters)
                    feature_vector = []
                    for key in sorted(fighter_features.keys()):
                        feature_vector.append(fighter_features[key] - opponent_features[key])
                    
                    # Append head-to-head features
                    feature_vector.extend([h2h_wins, h2h_losses, h2h_win_rate])
                    
                    # Create label (1 if fighter won, 0 if lost)
                    if 'W' not in result and 'L' not in result:  # Skip draws and no contests
                        skipped_count += 1
                        continue
                        
                    label = 1 if 'W' in result else 0
                    
                    X.append(feature_vector)
                    y.append(label)
                    processed_count += 1
                    
                except Exception as e:
                    self.logger.error(f"Error processing fight: {str(e)}")
                    skipped_count += 1
                    continue
            
            self.logger.info(f"Processed {processed_count} fights, skipped {skipped_count} fights")
            
            if processed_count == 0:
                self.logger.error("No training examples could be processed")
                return None, None
            
            # Convert to numpy arrays
            try:
                X = np.array(X)
                y = np.array(y)
                
                # Clean any NaN or infinite values
                X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
                
                self.logger.info(f"Final training data shape: X={X.shape}, y={y.shape}")
                return X, y
            except ValueError as e:
                self.logger.error(f"Error converting to numpy arrays: {str(e)}")
                return None, None
                
        except Exception as e:
            self.logger.error(f"Error retrieving training data: {str(e)}")
            import traceback
            self.logger.error(traceback.format_exc())
            return None, None
    
    def train(self, force=False):
        """
        Trains our model to get better at predicting fights! 🎓
        
        This is where the magic happens - we feed the model lots of past fight data
        so it can learn patterns and make smarter predictions.
        
        Args:
            force (bool): Set to True to retrain even if we already have a trained model
            
        Returns:
            bool: True if training went well, False if something went wrong
        """
        if self.model is not None and not force:
            self.logger.info("Model already exists. Use force=True to retrain")
            return True
        
        self.logger.info("Starting model training")
        
        try:
            # Get training data
            X, y = self._get_training_data()
            
            if X is None or y is None or len(X) < 10:
                self.logger.error("Insufficient training data")
                self.model_info['status'] = 'Error'
                self.model_info['message'] = 'Insufficient training data'
                return False
                
            self.logger.info(f"Training with {len(X)} samples")
            
            # Store feature names from the training data
            if not self.feature_names or len(self.feature_names) != X.shape[1]:
                self.feature_names = [f"feature_{i}" for i in range(X.shape[1])]
                self.logger.info(f"Setting {len(self.feature_names)} feature names based on training data")
            
            # Split data into training and validation sets
            # Use a larger portion for training with more data
            train_size = 0.8 if len(X) > 1000 else 0.7
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=(1.0 - train_size), random_state=42, stratify=y
            )
            
            # Scale features
            self.scaler = StandardScaler()
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Get model configuration with improved defaults
            model_config = self.config.get('model', {})
            model_type = model_config.get('type', 'GradientBoosting')
            
            # Dynamic parameter scaling based on dataset size
            n_estimators = model_config.get('n_estimators', 0)
            if n_estimators <= 0:
                # Automatically scale number of estimators based on dataset size
                if len(X) > 5000:
                    n_estimators = 200
                elif len(X) > 1000:
                    n_estimators = 150
                else:
                    n_estimators = 100
            
            # Other parameters with better defaults
            max_depth = model_config.get('max_depth', 5)  # Deeper trees for more complex patterns
            learning_rate = model_config.get('learning_rate', 0.05)  # Lower learning rate for better generalization
            
            # Create and train model with optimized parameters
            if model_type.lower() in ('gradientboosting', 'gbm'):
                self.logger.info(f"Training GradientBoostingClassifier with {n_estimators} estimators")
                model = GradientBoostingClassifier(
                    n_estimators=n_estimators,
                    max_depth=max_depth,
                    learning_rate=learning_rate,
                    subsample=0.8,  # Use subsampling to reduce overfitting
                    min_samples_split=10,  # Require more samples to split nodes
                    min_samples_leaf=5,  # Require more samples in leaf nodes
                    random_state=42
                )
            elif model_type.lower() in ('randomforest', 'rf'):
                self.logger.info(f"Training RandomForestClassifier with {n_estimators} estimators")
                model = RandomForestClassifier(
                    n_estimators=n_estimators,
                    max_depth=max_depth,
                    min_samples_split=10,
                    min_samples_leaf=5,
                    bootstrap=True,
                    class_weight='balanced',  # Better handling of class imbalance
                    random_state=42,
                    n_jobs=-1  # Use all available cores
                )
            else:
                self.logger.warning(f"Unknown model type: {model_type}, defaulting to GradientBoosting")
                model = GradientBoostingClassifier(
                    n_estimators=n_estimators,
                    max_depth=max_depth,
                    learning_rate=learning_rate,
                    random_state=42
                )
            
            # Train the model with progress logging for large datasets
            if len(X_train) > 5000:
                self.logger.info("Large dataset detected, training in stages...")
                batch_size = 1000
                for i in range(0, len(X_train), batch_size):
                    end_idx = min(i + batch_size, len(X_train))
                    self.logger.info(f"Training on batch {i//batch_size + 1}: samples {i} to {end_idx}")
                    
                    # For first batch, use fit; for subsequent batches, use partial_fit if available
                    if i == 0 or not hasattr(model, 'partial_fit'):
                        model.fit(X_train_scaled[i:end_idx], y_train[i:end_idx])
                    else:
                        if hasattr(model, 'partial_fit'):
                            model.partial_fit(X_train_scaled[i:end_idx], y_train[i:end_idx])
                        else:
                            # If partial_fit not available, continue with normal fit
                            model.fit(X_train_scaled[i:end_idx], y_train[i:end_idx])
            else:
                # For smaller datasets, train normally
                model.fit(X_train_scaled, y_train)
            
            # Calibrate probabilities if configured
            if model_config.get('calibrate_probabilities', True):
                self.logger.info("Calibrating probability estimates")
                calibrated_model = CalibratedClassifierCV(
                    model, method='sigmoid', cv='prefit'
                )
                calibrated_model.fit(X_test_scaled, y_test)
                self.model = calibrated_model
            else:
                self.model = model
                
            # Evaluate model
            y_pred = self.model.predict(X_test_scaled)
            accuracy = accuracy_score(y_test, y_pred)
            
            self.logger.info(f"Model accuracy: {accuracy:.4f}")
            self.logger.info("\nClassification Report:\n" + 
                               classification_report(y_test, y_pred))
            
            # Extract feature importance if available
            if hasattr(model, 'feature_importances_'):
                importances = model.feature_importances_
                self.logger.info("Feature importances:")
                for i, importance in enumerate(importances):
                    self.logger.info(f"Feature {i}: {importance:.4f}")
            
            # Update model info
            self.model_info['last_trained'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            self.model_info['accuracy'] = float(accuracy)
            self.model_info['sample_size'] = len(X)
            self.model_info['status'] = 'Trained'
            self.model_info['message'] = f'Model trained with accuracy {accuracy:.4f}'
            self.model_info['model_type'] = model_type
            self.model_info['n_estimators'] = n_estimators
            self.model_info['max_depth'] = max_depth
            
            # Save the model
            success = self._save_model()
            if not success:
                self.logger.error("Failed to save the trained model")
            
            self.logger.info("Model training completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Error training model: {str(e)}")
            import traceback
            self.logger.error(traceback.format_exc())
            self.model_info['status'] = 'Error'
            self.model_info['message'] = f'Training error: {str(e)}'
            return False
    
    def predict_winner(self, fighter1_name: str, fighter2_name: str) -> dict:
        try:
            # Extract features for both fighters
            fighter1_features = self._extract_features_from_fighter(fighter1_name)
            fighter2_features = self._extract_features_from_fighter(fighter2_name)
            
            if not fighter1_features or not fighter2_features:
                return {"error": "Could not extract features for one or both fighters"}
            
            # Create feature differences using exactly 23 features
            expected_features = [
                # Basic striking stats (4)
                'slpm', 'str_acc', 'sapm', 'str_def',
                # Grappling stats (4)
                'td_avg', 'td_acc', 'td_def', 'sub_avg',
                # Physical attributes (2)
                'reach', 'height',
                # Record stats (3)
                'wins', 'losses', 'draws',
                # Derived record stats (2)
                'win_percentage', 'total_fights',
                # Performance differentials (2)
                'striking_differential', 'takedown_differential',
                # Recent performance (2)
                'recent_win_streak', 'recent_loss_streak',
                # Fight ending tendencies (2)
                'finish_rate', 'decision_rate',
                # Experience (1)
                'experience_factor',
                # Ranking (1)
                'ranking'
            ]
            
            # Create feature differences
            feature_differences = []
            for feature in expected_features:
                diff = fighter1_features[feature] - fighter2_features[feature]
                feature_differences.append(diff)
            
            # Make prediction
            feature_differences = np.array(feature_differences).reshape(1, -1)
            prediction = self.model.predict_proba(feature_differences)[0]
            
            # Determine winner and probabilities
            fighter1_prob = prediction[0]
            fighter2_prob = prediction[1]
            
            winner = fighter1_name if fighter1_prob > fighter2_prob else fighter2_name
            loser = fighter2_name if winner == fighter1_name else fighter1_name
            winner_prob = max(fighter1_prob, fighter2_prob) * 100
            loser_prob = min(fighter1_prob, fighter2_prob) * 100
            
            # Format response in the expected format
            response = {
                "winner": winner,
                "loser": loser,
                "winner_probability": float(round(winner_prob, 2)),
                "loser_probability": float(round(loser_prob, 2)),
                "fighter1": fighter1_name,
                "fighter2": fighter2_name,
                "fighter1_probability": float(round(fighter1_prob * 100, 2)),
                "fighter2_probability": float(round(fighter2_prob * 100, 2))
            }
            
            # Log prediction details
            self.logger.info(f"Prediction made for {fighter1_name} vs {fighter2_name}")
            self.logger.info(f"Raw prediction: {prediction}")
            self.logger.info(f"Formatted response: {response}")
            
            return response
        except Exception as e:
            self.logger.error(f"Error making prediction: {str(e)}")
            import traceback
            self.logger.error(traceback.format_exc())
            return {"error": str(e)}