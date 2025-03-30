import os
import logging
import joblib
import traceback
import numpy as np
from typing import Any, Dict, List, Tuple, Optional
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler

from backend.constants import MODEL_PATH, SCALER_PATH, FEATURES_PATH

# Configure logging
logger = logging.getLogger(__name__)

# Global model variables
_model = None
_scaler = None
_features = None

def create_directory_if_not_exists(directory_path):
    """Create a directory if it doesn't exist."""
    if not os.path.exists(directory_path):
        try:
            os.makedirs(directory_path)
            logger.info(f"Created directory: {directory_path}")
            return True
        except Exception as e:
            logger.error(f"Error creating directory {directory_path}: {str(e)}")
            return False
    return True

def load_model():
    """
    Load model and associated components.
    
    Returns:
        bool: True if successful, False otherwise
    """
    global _model, _scaler, _features
    
    try:
        # Ensure model directory exists
        model_dir = os.path.dirname(MODEL_PATH)
        if not create_directory_if_not_exists(model_dir):
            logger.error(f"Failed to create model directory: {model_dir}")
            return False
            
        if not os.path.exists(MODEL_PATH):
            logger.warning(f"Model file not found at {MODEL_PATH}")
            return False
        
        logger.info(f"Loading model from {MODEL_PATH}")
        
        # Load model package
        try:
            model_package = joblib.load(MODEL_PATH)
            if not isinstance(model_package, dict):
                logger.error("Model file is not in the expected package format")
                return False
            
            # Extract components with validation
            _model = model_package.get('model')
            _scaler = model_package.get('scaler')
            _features = model_package.get('feature_names')
            metadata = model_package.get('metadata', {})
            
            # Validate components
            if not all([_model, _scaler, _features]):
                logger.error("Model package is missing required components")
                return False
            
            # Log model metadata
            logger.info(f"Model metadata: {metadata}")
            
            # Verify scikit-learn version compatibility
            model_version = metadata.get('scikit_learn_version')
            if model_version:
                logger.info(f"Model was trained with scikit-learn version: {model_version}")
            
            logger.info("Successfully loaded model package")
            
        except Exception as e:
            logger.error(f"Failed to load model package: {str(e)}")
            return False
        
        # Test if model is usable
        try:
            # Try to make a small prediction to check compatibility
            dummy_data = np.array([[0.0] * len(_features)])
            test_data = _scaler.transform(dummy_data)
            _ = _model.predict_proba(test_data)
            logger.info("Model compatibility check passed")
            return True
        except Exception as predict_e:
            logger.error(f"Model compatibility check failed: {str(predict_e)}")
            return False
            
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        logger.error(traceback.format_exc())
        return False

def get_loaded_model():
    """Get the currently loaded model."""
    global _model
    return _model

def get_loaded_scaler():
    """Get the currently loaded scaler."""
    global _scaler
    return _scaler

def get_loaded_features():
    """Get the currently loaded feature names."""
    global _features
    return _features

def save_model(model: Any, scaler: Any, features: List[str]) -> bool:
    """Save model, scaler and features to files."""
    try:
        # Create model directory if it doesn't exist
        model_dir = os.path.dirname(MODEL_PATH)
        if not create_directory_if_not_exists(model_dir):
            return False
        
        # Create model package with metadata
        model_package = {
            'model': model,
            'scaler': scaler,
            'feature_names': features,
            'metadata': {
                'model_type': type(model).__name__,
                'n_features': len(features)
            }
        }
        
        # Save model package
        joblib.dump(model_package, MODEL_PATH)
        logger.info(f"Model package saved to {MODEL_PATH}")
        
        return True
    except Exception as e:
        logger.error(f"Error saving model package: {str(e)}")
        logger.error(traceback.format_exc())
        return False 