"""
Enhanced Feature Engineering for MMA Fight Prediction.
Handles data cleaning, feature extraction, and normalization.
Adds support for active vs. retired fighter distinction.
"""

import re
import datetime
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from dateutil.parser import parse

# Constants for feature engineering
ACTIVE_THRESHOLD_DAYS = 730  # Fighters inactive for 2+ years are considered retired
DEFAULT_DATE_FORMAT = "%Y-%m-%d"
CURRENT_DATE = datetime.datetime.now()
MIN_FEATURES_VALUE = 1e-6  # To avoid division by zero

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

def get_days_since_last_fight(recent_fights: List[Dict[str, Any]]) -> float:
    """Calculate days since the fighter's last fight."""
    if not recent_fights:
        return ACTIVE_THRESHOLD_DAYS * 1.5  # If no recent fights, consider inactive
    
    try:
        # Sort fights by date (newest first)
        sorted_fights = sorted(
            recent_fights,
            key=lambda x: parse(x.get('fight_date', '2000-01-01')),
            reverse=True
        )
        
        # Get most recent fight date
        last_fight_date_str = sorted_fights[0].get('fight_date', None)
        if not last_fight_date_str:
            return ACTIVE_THRESHOLD_DAYS * 1.5
        
        # Parse date and calculate days since
        last_fight_date = parse(last_fight_date_str)
        days_since = (CURRENT_DATE - last_fight_date).days
        
        return max(0, days_since)
    except Exception:
        return ACTIVE_THRESHOLD_DAYS * 1.5

def is_fighter_active(fighter_data: Dict[str, Any]) -> bool:
    """Determine if a fighter is active or retired based on recent activity."""
    # Check explicit status if available
    status = fighter_data.get('status', '').lower()
    if status == 'retired' or status == 'inactive':
        return False
    if status == 'active':
        return True
    
    # Check based on time since last fight
    recent_fights = fighter_data.get('recent_fights', [])
    days_since_last_fight = get_days_since_last_fight(recent_fights)
    
    return days_since_last_fight < ACTIVE_THRESHOLD_DAYS

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
        'draws': float(draws),
        'total_fights': float(total_fights),
        'win_rate': float(wins) / float(max(total_fights, MIN_FEATURES_VALUE)),
        'loss_rate': float(losses) / float(max(total_fights, MIN_FEATURES_VALUE)),
        'draw_rate': float(draws) / float(max(total_fights, MIN_FEATURES_VALUE))
    }

def calculate_finish_stats(recent_fights: List[Dict[str, Any]]) -> Dict[str, float]:
    """Calculate finish-related statistics from recent fights."""
    if not recent_fights:
        return {
            'finish_rate': 0.0,
            'ko_rate': 0.0,
            'sub_rate': 0.0,
            'decision_rate': 0.0,
            'is_finished_rate': 0.0
        }
    
    total_fights = len(recent_fights)
    
    ko_wins = sum(1 for fight in recent_fights 
                 if 'W' in fight.get('result', '').upper() and 
                 ('KO' in fight.get('method', '').upper() or 'TKO' in fight.get('method', '').upper()))
    
    sub_wins = sum(1 for fight in recent_fights 
                  if 'W' in fight.get('result', '').upper() and 
                  'SUB' in fight.get('method', '').upper())
    
    decision_wins = sum(1 for fight in recent_fights 
                       if 'W' in fight.get('result', '').upper() and 
                       'DEC' in fight.get('method', '').upper())
    
    # Times finished (either by KO or submission)
    times_finished = sum(1 for fight in recent_fights 
                        if 'L' in fight.get('result', '').upper() and 
                        ('KO' in fight.get('method', '').upper() or 
                         'TKO' in fight.get('method', '').upper() or 
                         'SUB' in fight.get('method', '').upper()))
    
    return {
        'finish_rate': (ko_wins + sub_wins) / total_fights,
        'ko_rate': ko_wins / total_fights,
        'sub_rate': sub_wins / total_fights,
        'decision_rate': decision_wins / total_fights,
        'is_finished_rate': times_finished / total_fights
    }

def calculate_striking_stats(recent_fights: List[Dict[str, Any]]) -> Dict[str, float]:
    """Calculate advanced striking statistics from recent fights."""
    if not recent_fights:
        return {
            'avg_strikes_landed': 0.0,
            'avg_strikes_absorbed': 0.0,
            'striking_differential': 0.0,
            'head_strike_rate': 0.0,
            'body_strike_rate': 0.0,
            'leg_strike_rate': 0.0
        }
    
    total_fights = len(recent_fights)
    total_strikes_landed = 0
    total_strikes_absorbed = 0
    total_head_strikes = 0
    total_body_strikes = 0
    total_leg_strikes = 0
    
    for fight in recent_fights:
        # Parse significant strikes (landed/attempted)
        sig_str = fight.get('sig_str', '0 of 0').split(' of ')
        landed = int(sig_str[0]) if len(sig_str) > 0 else 0
        
        # Parse opponent's strikes
        opp_sig_str = fight.get('opp_sig_str', '0 of 0').split(' of ')
        absorbed = int(opp_sig_str[0]) if len(opp_sig_str) > 0 else 0
        
        # Add to totals
        total_strikes_landed += landed
        total_strikes_absorbed += absorbed
        
        # Parse head strikes
        head_str = fight.get('head_str', '0 of 0').split(' of ')
        head_strikes = int(head_str[0]) if len(head_str) > 0 else 0
        total_head_strikes += head_strikes
        
        # Parse body strikes
        body_str = fight.get('body_str', '0 of 0').split(' of ')
        body_strikes = int(body_str[0]) if len(body_str) > 0 else 0
        total_body_strikes += body_strikes
        
        # Parse leg strikes
        leg_str = fight.get('leg_str', '0 of 0').split(' of ')
        leg_strikes = int(leg_str[0]) if len(leg_str) > 0 else 0
        total_leg_strikes += leg_strikes
    
    # Avoid division by zero
    total_strikes_landed_safe = max(total_strikes_landed, MIN_FEATURES_VALUE)
    
    return {
        'avg_strikes_landed': total_strikes_landed / total_fights,
        'avg_strikes_absorbed': total_strikes_absorbed / total_fights,
        'striking_differential': (total_strikes_landed - total_strikes_absorbed) / total_fights,
        'head_strike_rate': total_head_strikes / total_strikes_landed_safe,
        'body_strike_rate': total_body_strikes / total_strikes_landed_safe,
        'leg_strike_rate': total_leg_strikes / total_strikes_landed_safe
    }

def calculate_grappling_stats(recent_fights: List[Dict[str, Any]]) -> Dict[str, float]:
    """Calculate advanced grappling statistics from recent fights."""
    if not recent_fights:
        return {
            'avg_takedowns_landed': 0.0,
            'avg_takedowns_attempted': 0.0,
            'avg_takedown_defense': 0.0,
            'control_time_ratio': 0.0
        }
    
    total_fights = len(recent_fights)
    total_td_landed = 0
    total_td_attempted = 0
    total_td_defended = 0
    total_td_defended_attempted = 0
    total_control_time_seconds = 0
    
    for fight in recent_fights:
        # Parse takedowns (landed/attempted)
        td_str = fight.get('td', '0 of 0').split(' of ')
        if len(td_str) >= 2:
            td_landed = int(td_str[0]) if td_str[0].isdigit() else 0
            td_attempted = int(td_str[1]) if td_str[1].isdigit() else 0
            total_td_landed += td_landed
            total_td_attempted += td_attempted
        
        # Parse takedown defense
        opp_td_str = fight.get('opp_td', '0 of 0').split(' of ')
        if len(opp_td_str) >= 2:
            opp_td_landed = int(opp_td_str[0]) if opp_td_str[0].isdigit() else 0
            opp_td_attempted = int(opp_td_str[1]) if opp_td_str[1].isdigit() else 0
            total_td_defended += (opp_td_attempted - opp_td_landed)
            total_td_defended_attempted += opp_td_attempted
        
        # Parse control time (minutes:seconds)
        control_time = fight.get('ctrl', '0:00')
        try:
            if ':' in control_time:
                minutes, seconds = control_time.split(':')
                total_control_time_seconds += (int(minutes) * 60 + int(seconds))
        except Exception:
            pass
    
    # Calculate averages, avoiding division by zero
    td_defense_ratio = (total_td_defended / max(total_td_defended_attempted, MIN_FEATURES_VALUE) 
                        if total_td_defended_attempted > 0 else 0.0)
    
    # Average fight time is roughly 15 minutes (900 seconds)
    avg_fight_time = 900
    control_time_ratio = total_control_time_seconds / (total_fights * avg_fight_time)
    
    return {
        'avg_takedowns_landed': total_td_landed / total_fights,
        'avg_takedowns_attempted': total_td_attempted / total_fights,
        'avg_takedown_defense': td_defense_ratio,
        'control_time_ratio': min(control_time_ratio, 1.0)  # Cap at 1.0
    }

def is_female_fighter(fighter_data: Dict[str, Any]) -> bool:
    """
    Determine if a fighter is female based on weight class and other indicators.
    
    Parameters:
        fighter_data: Dictionary containing fighter attributes
        
    Returns:
        bool: True if fighter is female, False otherwise
    """
    # Women's weight classes in UFC/MMA
    womens_weight_classes = [
        "women's strawweight", "women's flyweight", 
        "women's bantamweight", "women's featherweight",
        "strawweight", "atomweight"
    ]
    
    # Common female UFC fighters to use as reference
    known_female_fighters = [
        "amanda nunes", "valentina shevchenko", "ronda rousey", "joanna jedrzejczyk",
        "rose namajunas", "holly holm", "cris cyborg", "weili zhang", "jessica andrade",
        "carla esparza", "miesha tate", "paige vanzant", "julianna pena", "alexa grasso"
    ]
    
    # Check fighter name
    fighter_name = fighter_data.get('fighter_name', '').lower()
    if any(name in fighter_name for name in known_female_fighters):
        return True
    
    # Check weight class
    weight = fighter_data.get('Weight', '').lower()
    for weight_class in womens_weight_classes:
        if weight_class in weight:
            return True
    
    # Check weight thresholds (UFC women typically fight at 115, 125, 135, 145)
    try:
        weight_value = int(''.join(filter(str.isdigit, weight)))
        if weight_value <= 115:  # Only women fight at 115 lbs or lower
            return True
    except:
        pass
    
    return False

def extract_all_features(fighter_data: Dict[str, Any]) -> Dict[str, float]:
    """
    Extract all features from a fighter's data.
    
    Parameters:
        fighter_data: Dictionary containing fighter attributes
        
    Returns:
        Dictionary of extracted features
    """
    features = {}
    
    # Skip if no data
    if not fighter_data:
        return features
    
    # Basic stats
    is_active = is_fighter_active(fighter_data)
    features['is_active'] = 1.0 if is_active else 0.0
    features['is_female'] = 1.0 if is_female_fighter(fighter_data) else 0.0
    
    # Extract days since last fight
    days_since_last = get_days_since_last_fight(fighter_data.get('recent_fights', []))
    features['days_since_last_fight'] = float(days_since_last)
    
    # Add normalized days since last fight as a legitimate feature
    # This will allow the model to learn the significance naturally
    features['days_since_last_fight_normalized'] = min(days_since_last / 730.0, 1.0)  # Normalize to ~2 years
    
    # Add explicit retirement indicator - lets model learn the significance of retirement
    features['years_since_last_fight'] = days_since_last / 365.0
    
    # Add basic fighter stats
    features.update(extract_basic_stats(fighter_data))
    
    # Add record stats
    record_stats = extract_record_stats(fighter_data)
    features.update(record_stats)
    
    # Add finish stats
    finish_stats = calculate_finish_stats(fighter_data.get('recent_fights', []))
    features.update(finish_stats)
    
    # Add striking stats
    striking_stats = calculate_striking_stats(fighter_data.get('recent_fights', []))
    features.update(striking_stats)
    
    # Add grappling stats
    grappling_stats = calculate_grappling_stats(fighter_data.get('recent_fights', []))
    features.update(grappling_stats)
    
    # Balance between career and recent fights based on active status
    # For all fighters (active or retired), we'll let the model learn from the pattern
    career_weight = 0.4
    recent_weight = 0.6
    
    if not is_active:
        # For retired fighters, slightly weight career stats more heavily
        # but don't artificially cap or constrain
        career_weight = 0.6
        recent_weight = 0.4
    
    # Apply weighted statistics
    win_rate_career = record_stats['win_rate']
    win_rate_recent = sum(1 for fight in fighter_data.get('recent_fights', []) if 'W' in fight.get('result', '').upper()) / max(len(fighter_data.get('recent_fights', [])), MIN_FEATURES_VALUE)
    
    features['win_rate_weighted'] = (win_rate_career * career_weight) + (win_rate_recent * recent_weight)
    
    # Calculate consistency factor
    # (Standard deviation of results - lower means more consistent)
    if len(fighter_data.get('recent_fights', [])) >= 3:
        results = [1 if 'W' in fight.get('result', '').upper() else 0 for fight in fighter_data.get('recent_fights', [])]
        features['consistency'] = 1.0 - min(np.std(results), 0.5) / 0.5  # Higher is more consistent
    else:
        features['consistency'] = 0.5  # Default value
    
    # Add experience factor and prime indicator
    features['experience_factor'] = min(features.get('total_fights', 0) / 20.0, 1.0)
    
    # Add legacy score for retired fighters based on achievements
    if not is_active and features.get('total_fights', 0) >= 10:
        # Higher win rate + more fights = higher legacy score
        legacy_score = win_rate_career * min(features.get('total_fights', 0) / 25.0, 1.0)
        features['legacy_score'] = legacy_score
    else:
        features['legacy_score'] = 0.0
    
    return features

def create_matchup_features(fighter1_features: Dict[str, float], 
                           fighter2_features: Dict[str, float]) -> Dict[str, float]:
    """Create matchup-specific features based on both fighters' attributes."""
    matchup_features = {}
    
    # Activity matchup (0 = both retired, 1 = mixed, 2 = both active)
    f1_active = fighter1_features.get('is_active', 0)
    f2_active = fighter2_features.get('is_active', 0)
    activity_matchup = f1_active + f2_active
    matchup_features['activity_matchup'] = activity_matchup
    
    # Calculate stylistic matchups
    f1_ko_rate = fighter1_features.get('ko_rate', 0)
    f1_sub_rate = fighter1_features.get('sub_rate', 0)
    f1_td_avg = fighter1_features.get('td_avg', 0)
    
    f2_ko_rate = fighter2_features.get('ko_rate', 0)
    f2_sub_rate = fighter2_features.get('sub_rate', 0)
    f2_td_avg = fighter2_features.get('td_avg', 0)
    
    # Striker vs Striker matchup (higher value = more striking focused match)
    matchup_features['striker_vs_striker'] = (f1_ko_rate + f2_ko_rate) / 2.0
    
    # Grappler vs Grappler matchup (higher value = more grappling focused match)
    matchup_features['grappler_vs_grappler'] = (f1_sub_rate + f2_sub_rate + 
                                               f1_td_avg/5.0 + f2_td_avg/5.0) / 4.0
    
    # Striker vs Grappler matchup (closer to 1 = more striker vs grappler)
    f1_striking_bias = f1_ko_rate / max(f1_sub_rate + f1_td_avg/5.0, MIN_FEATURES_VALUE)
    f2_grappling_bias = (f2_sub_rate + f2_td_avg/5.0) / max(f2_ko_rate, MIN_FEATURES_VALUE)
    matchup_features['striker_vs_grappler'] = abs(f1_striking_bias - f2_grappling_bias) / 10.0
    
    # Experience mismatch (0 = evenly matched, 1 = completely mismatched)
    f1_exp = fighter1_features.get('total_fights', 0) 
    f2_exp = fighter2_features.get('total_fights', 0)
    exp_diff = abs(f1_exp - f2_exp) / max(f1_exp + f2_exp, MIN_FEATURES_VALUE)
    matchup_features['experience_mismatch'] = min(exp_diff, 1.0)
    
    return matchup_features

def create_fight_vector(fighter1_features: Dict[str, float], 
                       fighter2_features: Dict[str, float]) -> Tuple[np.ndarray, List[str]]:
    """
    Create a feature vector for model prediction from two fighters' features.
    
    Parameters:
        fighter1_features: Dictionary of fighter 1 attributes
        fighter2_features: Dictionary of fighter 2 attributes
        
    Returns:
        Tuple containing:
            - np.ndarray: Feature vector
            - List[str]: Names of the features in the vector
    """
    if not fighter1_features or not fighter2_features:
        return np.array([]), []
    
    # Get all feature names
    feature_names = sorted(set(fighter1_features.keys()).union(set(fighter2_features.keys())))
    
    # Create the feature vector
    feature_vector = []
    output_feature_names = []
    
    # Add gender context features - let the model learn physical differences
    # Gender flags
    fighter1_female = fighter1_features.get('is_female', 0.0)
    fighter2_female = fighter2_features.get('is_female', 0.0)
    
    # Add gender features
    feature_vector.append(fighter1_female)
    output_feature_names.append('f1_is_female')
    
    feature_vector.append(fighter2_female)
    output_feature_names.append('f2_is_female')
    
    # Add gender matchup context (0=M vs M, 1=M vs F or F vs M, 2=F vs F)
    gender_matchup = 0
    if fighter1_female == 1.0 and fighter2_female == 1.0:
        gender_matchup = 2  # Female vs Female
    elif fighter1_female == 1.0 or fighter2_female == 1.0:
        gender_matchup = 1  # Mixed gender (only for training purposes, shouldn't happen in real fights)
    
    feature_vector.append(float(gender_matchup))
    output_feature_names.append('gender_matchup_type')
    
    # Add gender advantage feature - males have physical advantage over females
    gender_advantage = 0.0
    
    # If fighter1 is male and fighter2 is female, fighter1 has advantage
    if fighter1_female == 0.0 and fighter2_female == 1.0:
        gender_advantage = 0.9  # Male has strong advantage over female
    
    # If fighter1 is female and fighter2 is male, fighter2 has advantage
    elif fighter1_female == 1.0 and fighter2_female == 0.0:
        gender_advantage = -0.9  # Female has disadvantage against male
    
    feature_vector.append(gender_advantage)
    output_feature_names.append('gender_advantage')
    
    # Add all direct features
    for name in feature_names:
        # Skip gender indicator as we've already processed it
        if name == 'is_female':
            continue
            
        f1_value = fighter1_features.get(name, 0.0)
        f2_value = fighter2_features.get(name, 0.0)
        
        # Adjust physical stats based on gender matchups
        if name in ['striking_power', 'striking_differential', 'td_avg', 'sub_avg'] and gender_matchup == 1:
            # For mixed gender fights, adjust strength-related stats
            if fighter1_female == 1.0:  # Fighter 1 is female
                f1_value = f1_value * 0.7  # Reduce female power stats
            elif fighter2_female == 1.0:  # Fighter 2 is female
                f2_value = f2_value * 0.7  # Reduce female power stats
        
        # Add individual fighter features
        feature_vector.append(f1_value)
        output_feature_names.append(f'f1_{name}')
        
        feature_vector.append(f2_value)
        output_feature_names.append(f'f2_{name}')
        
        # Add difference features
        diff = f1_value - f2_value
        feature_vector.append(diff)
        output_feature_names.append(f'diff_{name}')
        
        # Add relative difference for non-zero values
        if abs(f1_value) > 0 and abs(f2_value) > 0:
            rel_diff = diff / max(abs(f1_value), abs(f2_value))
            feature_vector.append(rel_diff)
            output_feature_names.append(f'rel_diff_{name}')
        else:
            feature_vector.append(0.0)
            output_feature_names.append(f'rel_diff_{name}')
    
    return np.array(feature_vector), output_feature_names 