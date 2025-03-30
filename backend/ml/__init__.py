"""
UFC Fighter Data API machine learning modules.
"""

# ML package
from backend.ml.predictor import FighterPredictor
from backend.ml.model_loader import load_model, get_loaded_model
from backend.ml.feature_engineering import (
    extract_features,
    extract_advanced_fighter_profile,
    extract_recent_fight_stats,
    extract_style_features,
    check_head_to_head,
    find_common_opponents,
    extract_physical_comparisons,
    analyze_opponent_quality
)
from backend.ml.train import train_model

__all__ = [
    'FighterPredictor',
    'load_model',
    'get_loaded_model',
    'extract_features',
    'extract_advanced_fighter_profile',
    'extract_recent_fight_stats',
    'extract_style_features',
    'check_head_to_head',
    'find_common_opponents',
    'extract_physical_comparisons',
    'analyze_opponent_quality',
    'train_model'
] 