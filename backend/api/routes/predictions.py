from fastapi import APIRouter, HTTPException, Request, Body, BackgroundTasks, Query, status
from fastapi.responses import Response, JSONResponse
import logging
import traceback
import json
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from ..database import get_db_connection
from ...constants import (
    LOG_LEVEL,
    LOG_FORMAT,
    LOG_DATE_FORMAT,
    API_V1_STR
)
from typing import Dict, List, Optional, Any
import re
from urllib.parse import unquote
from pydantic import BaseModel, Field
from ...utils import sanitize_json, set_parent_key

# Set up logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format=LOG_FORMAT,
    datefmt=LOG_DATE_FORMAT
)
logger = logging.getLogger(__name__)

router = APIRouter(prefix=f"{API_V1_STR}/prediction", tags=["Predictions"])

class FighterInput(BaseModel):
    fighter1_name: str
    fighter2_name: str

class PredictionResponse(BaseModel):
    fighter1_name: str
    fighter2_name: str
    predicted_winner: str
    confidence_percent: float
    fighter1_win_probability_percent: float
    fighter2_win_probability_percent: float
    status: str = "success"
    probability_adjusted_for_weight: Optional[bool] = Field(None, description="Indicates if probability was adjusted due to large weight difference (>20 lbs)")

@router.post("/predict", response_model=PredictionResponse)
async def predict_fight(request: Request, fight_data: FighterInput):
    """
    Predict the winner of a fight between two fighters using the advanced ML model,
    ensuring consistency regardless of input order.
    """
    try:
        original_fighter1_name = fight_data.fighter1_name
        original_fighter2_name = fight_data.fighter2_name
        logger.info(f"Received prediction request for {original_fighter1_name} vs {original_fighter2_name}")
        
        # --- Get Pre-loaded ML Components --- 
        analyzer = getattr(request.app.state, 'analyzer', None)
        trainer = getattr(request.app.state, 'trainer', None)

        if not analyzer or not trainer or not trainer.model:
            logger.error("ML components (analyzer/trainer/model) not loaded properly.")
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Service Unavailable",
                    "message": "Prediction service components are not ready.",
                    "status": "ml_components_unavailable"
                }
            )

        # --- Input Validation --- 
        if not original_fighter1_name or not original_fighter2_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Invalid input",
                    "message": "Both fighter names are required",
                    "status": "invalid_input"
                }
            )
        
        # --- Canonical Ordering --- 
        # Sort names alphabetically to ensure consistent feature generation order
        ordered_names = sorted([original_fighter1_name, original_fighter2_name])
        canonical_f1_name = ordered_names[0]
        canonical_f2_name = ordered_names[1]
        # Track if the original order was swapped relative to canonical order
        order_swapped = original_fighter1_name != canonical_f1_name
        logger.info(f"Using canonical order for prediction: {canonical_f1_name} vs {canonical_f2_name}. Original order swapped: {order_swapped}")
        # --- End Canonical Ordering --- 
        
        context_date = pd.Timestamp.now(tz=timezone.utc)

        # --- Feature Generation (using canonical names) --- 
        logger.info(f"Generating features for {canonical_f1_name} vs {canonical_f2_name}...")
        features_dict = analyzer.get_prediction_features(canonical_f1_name, canonical_f2_name, context_date)
        
        if not features_dict:
            logger.error(f"Could not generate features. Check if fighters '{original_fighter1_name}' and '{original_fighter2_name}' exist in the loaded data.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={ 
                    "error": "Feature Generation Failed", 
                    "message": f"Could not generate features. One or both fighters ('{original_fighter1_name}', '{original_fighter2_name}') might not be found in the dataset used by the model.", 
                    "status": "feature_generation_error"
                }
            )
            
        # Get Weights (still based on canonical feature dict)
        f1_weight = features_dict.get('f1_weight', 0.0) # Corresponds to canonical_f1
        f2_weight = features_dict.get('f2_weight', 0.0) # Corresponds to canonical_f2
            
        # --- Prepare DataFrame for Model --- 
        prediction_df = pd.DataFrame([features_dict])
        
        model_features = trainer.features
        if model_features is None:
            logger.error("Model feature names are missing from the loaded trainer object.")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "Internal Server Error",
                    "message": "Model configuration error: Feature names not found.",
                    "status": "model_config_error"
                }
            )
            
        for col in model_features:
            if col not in prediction_df.columns:
                prediction_df[col] = 0.0
        prediction_df = prediction_df[model_features]
        
        if prediction_df.isna().any().any():
            logger.warning("NaN values found in features before prediction. Filling with 0.")
            prediction_df = prediction_df.fillna(0.0)
        if np.isinf(prediction_df).any().any():
             logger.warning("Infinite values found in features before prediction. Replacing with 0.")
             prediction_df.replace([np.inf, -np.inf], 0.0, inplace=True)

        # --- Initial Model Prediction (based on canonical order) --- 
        logger.info("Making initial prediction (canonical order)...")
        probability_canonical_f1_model = trainer.predict_proba(prediction_df)[0][1] # Prob of canonical F1 winning
        
        # --- Apply Weight Adjustment (based on canonical weights) --- 
        weight_diff = abs(f1_weight - f2_weight)
        weight_threshold = 20.0 
        probability_adjusted = False
        probability_canonical_f1_adjusted = probability_canonical_f1_model # Start with model prediction
        
        if weight_diff > weight_threshold:
            probability_adjusted = True
            excess_weight = weight_diff - weight_threshold
            k = 0.15 
            weight_impact = 1 / (1 + np.exp(-k * excess_weight)) 
            
            if f1_weight > f2_weight: # Canonical F1 is heavier
                probability_canonical_f1_adjusted = probability_canonical_f1_model + (1 - probability_canonical_f1_model) * (2 * weight_impact - 1) if weight_impact > 0.5 else probability_canonical_f1_model
                logger.warning(f"Adjusting probability for F1 (Heavier): Diff={weight_diff:.1f} lbs. Initial P={probability_canonical_f1_model:.3f}, Adjusted P={probability_canonical_f1_adjusted:.3f}")
            else: # Canonical F2 is heavier
                probability_canonical_f1_adjusted = probability_canonical_f1_model * (1 - (2 * weight_impact - 1)) if weight_impact > 0.5 else probability_canonical_f1_model
                logger.warning(f"Adjusting probability for F2 (Heavier): Diff={weight_diff:.1f} lbs. Initial P={probability_canonical_f1_model:.3f}, Adjusted P={probability_canonical_f1_adjusted:.3f}")

            probability_canonical_f1_adjusted = max(0.0, min(1.0, probability_canonical_f1_adjusted))

        # --- Re-orient Probability for Original Input Order --- 
        if order_swapped:
            # If original F1 was canonical F2, the probability we want is 1 - P(canonical F1)
            final_probability_for_original_f1 = 1.0 - probability_canonical_f1_adjusted
            logger.info(f"Original order was swapped. Adjusted probability for {original_fighter1_name}: {final_probability_for_original_f1:.3f}")
        else:
            # Original F1 was canonical F1, use the probability directly
            final_probability_for_original_f1 = probability_canonical_f1_adjusted
            logger.info(f"Original order matched canonical. Adjusted probability for {original_fighter1_name}: {final_probability_for_original_f1:.3f}")
        # --- End Re-orientation --- 
        
        # --- Determine Winner and Confidence (based on original F1's final probability) --- 
        predicted_winner = original_fighter1_name if final_probability_for_original_f1 >= 0.5 else original_fighter2_name
        confidence = final_probability_for_original_f1 if predicted_winner == original_fighter1_name else 1.0 - final_probability_for_original_f1
        
        # --- Format Response (using original names and re-oriented probabilities) --- 
        response_data = PredictionResponse(
            fighter1_name=original_fighter1_name,
            fighter2_name=original_fighter2_name,
            predicted_winner=predicted_winner,
            confidence_percent=round(confidence * 100, 2),
            fighter1_win_probability_percent=round(final_probability_for_original_f1 * 100, 2),
            fighter2_win_probability_percent=round((1.0 - final_probability_for_original_f1) * 100, 2),
            probability_adjusted_for_weight=probability_adjusted 
        )
        
        logger.info(f"Prediction successful for {original_fighter1_name} vs {original_fighter2_name}: Winner {predicted_winner}")
        return response_data
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error in prediction endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal Server Error",
                "message": f"An unexpected error occurred during prediction.",
                "details": str(e),
                "status": "internal_error"
            }
        ) 