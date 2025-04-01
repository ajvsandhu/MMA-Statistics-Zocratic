"""
Feature engineering functions for MMA fight prediction.
Handles data cleaning, feature extraction, and normalization.
"""

import re
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

def clean_percentage(value: str) -> float:
    """Convert percentage string to float between 0 and 1."""
    try:
        if isinstance(value, (int, float)):
            return float(value) / 100
        if isinstance(value, str):
            return float(value.strip('%')) / 100
        return 0.0
    except (ValueError, TypeError):
        return 0.0

def extract_height_in_inches(height_str: str) -> float:
    """Convert height string (e.g. "5' 11"") to inches."""
    try:
        if not height_str:
            return 0.0
        parts = height_str.replace('"', '').split("'")
        feet = float(parts[0].strip())
        inches = float(parts[1].strip()) if len(parts) > 1 else 0
        return (feet * 12) + inches
    except (ValueError, IndexError):
        return 0.0

def extract_reach_in_inches(reach_str: str) -> float:
    """Convert reach string (e.g. "72.0"") to inches."""
    try:
        if not reach_str:
            return 0.0
        return float(reach_str.strip('"'))
    except ValueError:
        return 0.0

def extract_weight_in_pounds(weight_str: str) -> float:
    """Convert weight string (e.g. "185 lbs") to pounds."""
    try:
        if not weight_str:
            return 0.0
        return float(re.search(r'\d+', weight_str).group())
    except (ValueError, AttributeError):
        return 0.0

def parse_record(record_str: str) -> Tuple[int, int, int]:
    """Parse record string (e.g. "21-3-0") into (wins, losses, draws)."""
    try:
        if not record_str or not isinstance(record_str, str):
            return (0, 0, 0)
        parts = record_str.split('-')
        if len(parts) == 3:
            return (
                int(parts[0].strip() or 0),
                int(parts[1].strip() or 0),
                int(parts[2].strip() or 0)
            )
        return (0, 0, 0)
    except (ValueError, IndexError):
        return (0, 0, 0)

def extract_basic_stats(fighter_data: Dict[str, Any]) -> Dict[str, float]:
    """Extract and normalize basic fighter statistics."""
    return {
        'slpm': float(fighter_data.get('SLpM', 0) or 0),
        'str_acc': clean_percentage(fighter_data.get('Str. Acc.', '0%')),
        'sapm': float(fighter_data.get('SApM', 0) or 0),
        'str_def': clean_percentage(fighter_data.get('Str. Def', '0%')),
        'td_avg': float(fighter_data.get('TD Avg.', 0) or 0),
        'td_acc': clean_percentage(fighter_data.get('TD Acc.', '0%')),
        'td_def': clean_percentage(fighter_data.get('TD Def.', '0%')),
        'sub_avg': float(fighter_data.get('Sub. Avg.', 0) or 0)
    }

def extract_physical_stats(fighter_data: Dict[str, Any]) -> Dict[str, float]:
    """Extract and normalize physical attributes."""
    return {
        'height': extract_height_in_inches(fighter_data.get('Height', '')),
        'reach': extract_reach_in_inches(fighter_data.get('Reach', '')),
        'weight': extract_weight_in_pounds(fighter_data.get('Weight', ''))
    }

def extract_record_stats(fighter_data: Dict[str, Any]) -> Dict[str, float]:
    """Extract and normalize record-related statistics."""
    wins, losses, draws = parse_record(fighter_data.get('Record', '0-0-0'))
    total_fights = wins + losses + draws
    
    return {
        'wins': float(wins),
        'losses': float(losses),
        'total_fights': float(total_fights),
        'win_rate': float(wins) / float(total_fights) if total_fights > 0 else 0.0
    }

def calculate_finish_stats(recent_fights: List[Dict[str, Any]]) -> Dict[str, float]:
    """Calculate finish-related statistics from recent fights."""
    if not recent_fights:
        return {
            'finish_rate': 0.0,
            'ko_rate': 0.0,
            'sub_rate': 0.0,
            'decision_rate': 0.0
        }
    
    total_fights = len(recent_fights)
    ko_wins = sum(1 for fight in recent_fights if 'KO' in fight.get('method', '').upper() or 'TKO' in fight.get('method', '').upper())
    sub_wins = sum(1 for fight in recent_fights if 'SUB' in fight.get('method', '').upper())
    decision_wins = sum(1 for fight in recent_fights if 'DEC' in fight.get('method', '').upper())
    
    return {
        'finish_rate': (ko_wins + sub_wins) / total_fights,
        'ko_rate': ko_wins / total_fights,
        'sub_rate': sub_wins / total_fights,
        'decision_rate': decision_wins / total_fights
    }

def calculate_striking_stats(recent_fights: List[Dict[str, Any]]) -> Dict[str, float]:
    """Calculate advanced striking statistics from recent fights."""
    if not recent_fights:
        return {
            'avg_strikes_landed': 0.0,
            'avg_strikes_absorbed': 0.0,
            'striking_differential': 0.0,
            'head_strike_rate': 0.0
        }
    
    total_fights = len(recent_fights)
    total_strikes_landed = 0
    total_strikes_absorbed = 0
    total_head_strikes = 0
    
    for fight in recent_fights:
        # Parse significant strikes (landed/attempted)
        sig_str = fight.get('sig_str', '0 of 0').split(' of ')
        landed = int(sig_str[0]) if len(sig_str) > 0 else 0
        
        # Add to totals
        total_strikes_landed += landed
        
        # Parse head strikes
        head_strikes = int(fight.get('head_str', '0').split(' of ')[0] or 0)
        total_head_strikes += head_strikes
    
    return {
        'avg_strikes_landed': total_strikes_landed / total_fights,
        'head_strike_rate': total_head_strikes / total_strikes_landed if total_strikes_landed > 0 else 0.0
    }

def extract_all_features(fighter_data: Dict[str, Any]) -> Dict[str, float]:
    """Extract all features for a fighter."""
    if not fighter_data:
        return {}
    
    # Get basic stats
    features = extract_basic_stats(fighter_data)
    
    # Add physical stats
    features.update(extract_physical_stats(fighter_data))
    
    # Add record stats
    features.update(extract_record_stats(fighter_data))
    
    # Get recent fights
    recent_fights = fighter_data.get('recent_fights', [])
    
    # Add finish stats
    features.update(calculate_finish_stats(recent_fights))
    
    # Add striking stats
    features.update(calculate_striking_stats(recent_fights))
    
    # Add ranking (lower is better, champion = 0)
    try:
        ranking = int(fighter_data.get('ranking', 99))
        features['ranking'] = (15 - min(ranking, 15)) / 15.0  # Normalize to 0-1
    except (ValueError, TypeError):
        features['ranking'] = 0.0
    
    # Calculate striking differential
    features['striking_differential'] = features['slpm'] - features['sapm']
    
    # Calculate grappling differential
    features['grappling_differential'] = features['td_avg'] * features['td_acc']
    
    # Calculate experience factor
    features['experience_factor'] = features['win_rate'] * np.log1p(features['total_fights'])
    
    return features

def create_fight_vector(fighter1_features: Dict[str, float], fighter2_features: Dict[str, float]) -> np.ndarray:
    """Create a feature vector for model prediction from two fighters' features."""
    if not fighter1_features or not fighter2_features:
        return np.array([])
    
    # Ensure both feature dictionaries have the same keys
    all_keys = sorted(set(fighter1_features.keys()) & set(fighter2_features.keys()))
    
    # Calculate differences for each feature
    feature_vector = []
    for key in all_keys:
        f1_val = fighter1_features.get(key, 0.0)
        f2_val = fighter2_features.get(key, 0.0)
        
        # Different handling based on feature type
        if key in ['str_acc', 'td_acc', 'str_def', 'td_def', 'win_rate']:
            # Percentage features: Direct difference
            diff = f1_val - f2_val
        elif key == 'ranking':
            # Ranking: Higher rank (lower number) is better
            diff = f2_val - f1_val
        elif key in ['height', 'reach', 'weight']:
            # Physical attributes: Relative difference
            avg = (f1_val + f2_val) / 2.0 if f2_val != 0 else f1_val
            diff = (f1_val - f2_val) / (avg + 1e-6)
        else:
            # Other numerical features: Direct difference
            diff = f1_val - f2_val
        
        feature_vector.append(diff)
    
    return np.array(feature_vector) 