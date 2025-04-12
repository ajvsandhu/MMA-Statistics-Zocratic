"""
Comprehensive Testing Suite for MMA Fight Predictor

Tests the calibration and quality of predictions across different fighter matchup types:
- Active vs Active
- Active vs Retired
- Retired vs Retired

Also validates that predictions are naturally calibrated without extreme values.
"""

import os
import random
import logging
import argparse
from collections import defaultdict
from typing import Dict, List, Tuple, Any, Optional

import numpy as np
import matplotlib.pyplot as plt
import joblib

from backend.ml.predictor import FighterPredictor
from backend.api.database import get_db_connection
from backend.ml.feature_engineering import is_fighter_active

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_test_fighters(active_count: int = 10, retired_count: int = 10) -> Tuple[List[str], List[str]]:
    """
    Get a sample of active and retired fighters for testing.
    
    Parameters:
        active_count: Number of active fighters to retrieve
        retired_count: Number of retired fighters to retrieve
        
    Returns:
        Tuple of (active_fighters, retired_fighters) lists with fighter names
    """
    try:
        supabase = get_db_connection()
        if not supabase:
            logger.error("Could not connect to database")
            return [], []
        
        # Get all fighters
        response = supabase.table('fighters').select('*').execute()
        if not response.data:
            logger.error("No fighters found in database")
            return [], []
        
        fighters = response.data
        logger.info(f"Retrieved {len(fighters)} fighters from database")
        
        # Get all fights to determine activity status
        response = supabase.table('fighter_last_5_fights').select('*').execute()
        if not response.data:
            logger.warning("No fights found in database, using basic fighter data only")
        
        fights = response.data if response.data else []
        
        # Create fighter dictionary with recent fights
        fighter_dict = {}
        for fighter in fighters:
            fighter_name = fighter.get('fighter_name')
            if fighter_name:
                fighter_dict[fighter_name] = fighter
                fighter_dict[fighter_name]['recent_fights'] = [
                    fight for fight in fights if fight.get('fighter_name') == fighter_name
                ]
        
        # Separate active and retired fighters
        active_fighters = []
        retired_fighters = []
        
        for name, fighter in fighter_dict.items():
            # Check active status
            if is_fighter_active(fighter):
                active_fighters.append(name)
            else:
                retired_fighters.append(name)
        
        logger.info(f"Found {len(active_fighters)} active fighters and {len(retired_fighters)} retired fighters")
        
        # Sample if we have more than requested
        if len(active_fighters) > active_count:
            active_fighters = np.random.choice(active_fighters, active_count, replace=False).tolist()
        
        if len(retired_fighters) > retired_count:
            retired_fighters = np.random.choice(retired_fighters, retired_count, replace=False).tolist()
        
        return active_fighters, retired_fighters
        
    except Exception as e:
        logger.error(f"Error getting test fighters: {str(e)}")
        return [], []

def generate_test_matchups(active_fighters: List[str], retired_fighters: List[str], 
                          samples_per_category: int = 10) -> Dict[str, List[Tuple[str, str]]]:
    """
    Generate test matchups across different categories.
    
    Parameters:
        active_fighters: List of active fighter names
        retired_fighters: List of retired fighter names
        samples_per_category: Number of matchups to generate per category
        
    Returns:
        Dictionary with matchup types as keys and lists of (fighter1, fighter2) tuples as values
    """
    np.random.seed(42)  # For reproducibility
    
    matchups = {
        'active_vs_active': [],
        'active_vs_retired': [],
        'retired_vs_retired': []
    }
    
    # Generate active vs active matchups
    if len(active_fighters) >= 2:
        for _ in range(min(samples_per_category, len(active_fighters) * (len(active_fighters) - 1) // 2)):
            fighter1, fighter2 = np.random.choice(active_fighters, 2, replace=False)
            matchups['active_vs_active'].append((fighter1, fighter2))
    
    # Generate active vs retired matchups
    if active_fighters and retired_fighters:
        for _ in range(min(samples_per_category, len(active_fighters) * len(retired_fighters))):
            fighter1 = np.random.choice(active_fighters)
            fighter2 = np.random.choice(retired_fighters)
            matchups['active_vs_retired'].append((fighter1, fighter2))
    
    # Generate retired vs retired matchups
    if len(retired_fighters) >= 2:
        for _ in range(min(samples_per_category, len(retired_fighters) * (len(retired_fighters) - 1) // 2)):
            fighter1, fighter2 = np.random.choice(retired_fighters, 2, replace=False)
            matchups['retired_vs_retired'].append((fighter1, fighter2))
    
    return matchups

def run_test_predictions(predictor: FighterPredictor, 
                        matchups: Dict[str, List[Tuple[str, str]]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Run predictions on test matchups.
    
    Parameters:
        predictor: FighterPredictor instance
        matchups: Dictionary of matchup categories and fighter pairs
        
    Returns:
        Dictionary with matchup types as keys and prediction results as values
    """
    results = {}
    
    for category, pairs in matchups.items():
        if not pairs:
            logger.warning(f"No matchups available for category: {category}")
            continue
        
        logger.info(f"Running {len(pairs)} predictions for category: {category}")
        category_results = []
        
        for fighter1, fighter2 in pairs:
            prediction = predictor.predict_winner(fighter1, fighter2)
            if "error" not in prediction:
                category_results.append(prediction)
            else:
                logger.warning(f"Error predicting {fighter1} vs {fighter2}: {prediction.get('error')}")
        
        results[category] = category_results
        logger.info(f"Completed {len(category_results)} predictions for {category}")
    
    return results

def analyze_prediction_statistics(results: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Dict[str, float]]:
    """
    Analyze prediction statistics across different matchup categories.
    
    Parameters:
        results: Dictionary with matchup types as keys and prediction results as values
        
    Returns:
        Dictionary with statistics by category
    """
    stats = {}
    
    for category, predictions in results.items():
        if not predictions:
            continue
        
        # Extract win probabilities
        win_probs = [p.get('winner_probability', 0) for p in predictions]
        
        # Calculate statistics
        category_stats = {
            'count': len(predictions),
            'min_probability': min(win_probs) if win_probs else 0,
            'max_probability': max(win_probs) if win_probs else 0,
            'mean_probability': np.mean(win_probs) if win_probs else 0,
            'median_probability': np.median(win_probs) if win_probs else 0,
            'std_probability': np.std(win_probs) if win_probs else 0,
            'extreme_predictions': sum(1 for p in win_probs if p > 90 or p < 10),
            'balanced_predictions': sum(1 for p in win_probs if 40 <= p <= 60),
        }
        
        # Calculate percentage metrics
        category_stats['extreme_prediction_rate'] = category_stats['extreme_predictions'] / category_stats['count'] if category_stats['count'] > 0 else 0
        category_stats['balanced_prediction_rate'] = category_stats['balanced_predictions'] / category_stats['count'] if category_stats['count'] > 0 else 0
        
        stats[category] = category_stats
    
    return stats

def plot_probability_distributions(results: Dict[str, List[Dict[str, Any]]], save_path: Optional[str] = None):
    """
    Plot probability distributions for different matchup categories.
    
    Parameters:
        results: Dictionary with matchup types as keys and prediction results as values
        save_path: Optional path to save the plot
    """
    plt.figure(figsize=(12, 8))
    
    bins = np.arange(50, 101, 5)  # 50-100% in 5% increments
    colors = {
        'active_vs_active': 'blue',
        'active_vs_retired': 'green',
        'retired_vs_retired': 'red'
    }
    
    for category, predictions in results.items():
        if not predictions:
            continue
        
        # Extract win probabilities
        win_probs = [p.get('winner_probability', 0) for p in predictions]
        
        # Plot histogram
        plt.hist(
            win_probs, 
            bins=bins, 
            alpha=0.5, 
            label=f"{category.replace('_', ' ').title()} (n={len(predictions)})",
            color=colors.get(category, 'gray'),
            edgecolor='black'
        )
    
    plt.xlabel('Winner Probability (%)')
    plt.ylabel('Number of Matchups')
    plt.title('Distribution of Winner Probabilities by Matchup Type')
    plt.legend()
    plt.grid(axis='y', alpha=0.3)
    
    if save_path:
        plt.savefig(save_path)
        logger.info(f"Plot saved to {save_path}")
    else:
        plt.show()

def print_example_predictions(results: Dict[str, List[Dict[str, Any]]], examples_per_category: int = 3):
    """
    Print example predictions for each matchup category.
    
    Parameters:
        results: Dictionary with matchup types as keys and prediction results as values
        examples_per_category: Number of examples to print per category
    """
    for category, predictions in results.items():
        if not predictions:
            continue
        
        logger.info(f"\nExample predictions for {category.replace('_', ' ').title()}:")
        
        # Get a mixture of high-confidence and balanced predictions
        sorted_by_conf = sorted(predictions, key=lambda p: abs(p.get('winner_probability', 50) - 50), reverse=True)
        
        # Take some from high confidence and some from balanced
        high_conf = sorted_by_conf[:examples_per_category]
        balanced = sorted_by_conf[-examples_per_category:] if len(sorted_by_conf) > examples_per_category else []
        
        examples = high_conf + balanced
        examples = examples[:examples_per_category]
        
        for i, pred in enumerate(examples):
            fighter1 = pred.get('fighter1_name', 'Unknown')
            fighter2 = pred.get('fighter2_name', 'Unknown')
            fighter1_prob = pred.get('fighter1_probability', 0)
            fighter2_prob = pred.get('fighter2_probability', 0)
            
            logger.info(f"  {i+1}. {fighter1} ({fighter1_prob}%) vs {fighter2} ({fighter2_prob}%)")
            
            # Add key factors if available
            if 'key_factors' in pred and pred['key_factors']:
                logger.info("     Key factors:")
                for factor in pred['key_factors'][:3]:  # Show top 3 factors
                    logger.info(f"       - {factor['name']}")

def create_test_feature_vector(fighter1: Dict[str, float], fighter2: Dict[str, float], 
                              feature_names: List[str]) -> np.ndarray:
    """
    Create a feature vector for testing from simplified fighter attributes.
    
    Parameters:
        fighter1: Dictionary of fighter 1 attributes
        fighter2: Dictionary of fighter 2 attributes
        feature_names: Names of features expected by the model
        
    Returns:
        np.ndarray: Feature vector for prediction
    """
    feature_vector = []
    
    # Create basic difference features first
    for name in feature_names:
        if name.startswith('diff_'):
            key = name[5:]  # Remove 'diff_' prefix
            if key in fighter1 and key in fighter2:
                feature_vector.append(fighter1[key] - fighter2[key])
            else:
                feature_vector.append(0.0)
        
        elif name.startswith('rel_diff_'):
            key = name[9:]  # Remove 'rel_diff_' prefix
            if key in fighter1 and key in fighter2:
                avg = (fighter1[key] + fighter2[key]) / 2.0
                diff = (fighter1[key] - fighter2[key]) / max(avg, 1e-6)
                feature_vector.append(diff)
            else:
                feature_vector.append(0.0)
        
        elif name.startswith('f1_'):
            key = name[3:]  # Remove 'f1_' prefix
            feature_vector.append(fighter1.get(key, 0.0))
        
        elif name.startswith('f2_'):
            key = name[3:]  # Remove 'f2_' prefix
            feature_vector.append(fighter2.get(key, 0.0))
        
        elif name.startswith('matchup_'):
            if name == 'matchup_activity_matchup':
                feature_vector.append(fighter1.get('is_active', 0) + fighter2.get('is_active', 0))
            elif name == 'matchup_experience_mismatch':
                f1_exp = fighter1.get('total_fights', 0)
                f2_exp = fighter2.get('total_fights', 0)
                exp_diff = abs(f1_exp - f2_exp) / max(f1_exp + f2_exp, 1e-6)
                feature_vector.append(min(exp_diff, 1.0))
            else:
                # Default matchup features
                feature_vector.append(0.5)
        else:
            # Unknown feature, add a neutral value
            feature_vector.append(0.0)
    
    # Ensure vector length matches expected feature count
    if len(feature_vector) != len(feature_names):
        # Pad with zeros if needed
        feature_vector.extend([0.0] * (len(feature_names) - len(feature_vector)))
    
    return np.array(feature_vector)

def test_predictor(active_count: int = 15, retired_count: int = 15, 
                    samples_per_category: int = 20, save_plot: bool = False):
    """
    Comprehensive test suite for the MMA fight prediction model.
    
    Tests:
    1. Overall prediction distribution
    2. Prediction distribution by fighter status
    3. Controlled test matchups
    
    Parameters:
        active_count: Number of active fighters to include
        retired_count: Number of retired fighters to include
        samples_per_category: Number of matchups to generate per category
        save_plot: Whether to save distribution plots
    """
    try:
        # Load the model
        logger.info("Loading model for testing...")
        model_path = "backend/ml/models/fight_predictor_model.joblib"
        
        if not os.path.exists(model_path):
            logger.error(f"Model file not found: {model_path}")
            return
        
        # Load the model package
        model_package = joblib.load(model_path)
        
        # Extract components
        model = model_package.get('model')
        scaler = model_package.get('scaler')
        feature_names = model_package.get('feature_names', [])
        
        if not model:
            logger.error("No model found in package")
            return
            
        if not scaler:
            logger.warning("No scaler found in package, using raw features")
            
        if not feature_names:
            logger.warning("No feature names found in package, some tests may be limited")
        
        # Check model metadata
        model_info = model_package.get('metadata', {})
        model_type = model_info.get('model_type', 'Unknown')
        training_date = model_info.get('training_date', 'Unknown')
        
        logger.info(f"Model type: {model_type}")
        logger.info(f"Training date: {training_date}")
        
        # Get database connection
        supabase = get_db_connection()
        if not supabase:
            logger.error("Could not connect to database")
            return
            
        # Get fighters
        response = supabase.table('fighters').select('*').execute()
        if not response.data:
            logger.error("No fighters found in database")
            return
            
        fighters = response.data
        
        # Separate active and retired fighters
        active_fighters = [f for f in fighters if is_fighter_active(f)]
        retired_fighters = [f for f in fighters if not is_fighter_active(f)]
        
        logger.info(f"Found {len(active_fighters)} active fighters and {len(retired_fighters)} retired fighters")
        
        # Select sample of fighters
        if len(active_fighters) > active_count:
            active_fighters = random.sample(active_fighters, active_count)
            
        if len(retired_fighters) > retired_count:
            retired_fighters = random.sample(retired_fighters, retired_count)
            
        logger.info(f"Selected {len(active_fighters)} active and {len(retired_fighters)} retired fighters for testing")
        
        # Create matchup pairs
        active_vs_active = []
        active_vs_retired = []
        retired_vs_retired = []
        
        # Generate random matchups
        for _ in range(samples_per_category):
            # Active vs active
            if len(active_fighters) >= 2:
                fighter1, fighter2 = random.sample(active_fighters, 2)
                active_vs_active.append((fighter1, fighter2))
                
            # Active vs retired
            if active_fighters and retired_fighters:
                fighter1 = random.choice(active_fighters)
                fighter2 = random.choice(retired_fighters)
                active_vs_retired.append((fighter1, fighter2))
                
            # Retired vs retired
            if len(retired_fighters) >= 2:
                fighter1, fighter2 = random.sample(retired_fighters, 2)
                retired_vs_retired.append((fighter1, fighter2))
        
        # Get predictions for each category
        predictor = FighterPredictor()
        
        # Create containers for prediction probabilities
        active_active_probs = []
        active_retired_probs = []
        retired_retired_probs = []
        
        # Test active vs active
        logger.info("\nTesting Active vs Active matchups:")
        for fighter1, fighter2 in active_vs_active:
            result = predictor.predict_winner(fighter1['fighter_name'], fighter2['fighter_name'])
            if 'error' in result:
                logger.warning(f"Error predicting {fighter1['fighter_name']} vs {fighter2['fighter_name']}: {result['error']}")
                continue
                
            prob = result['fighter1_probability'] / 100  # Convert percentage to probability
            active_active_probs.append(prob)
            logger.info(f"{fighter1['fighter_name']} vs {fighter2['fighter_name']} - Fighter 1 win probability: {prob:.2f}")
        
        # Test active vs retired
        logger.info("\nTesting Active vs Retired matchups:")
        for fighter1, fighter2 in active_vs_retired:
            result = predictor.predict_winner(fighter1['fighter_name'], fighter2['fighter_name'])
            if 'error' in result:
                logger.warning(f"Error predicting {fighter1['fighter_name']} vs {fighter2['fighter_name']}: {result['error']}")
                continue
                
            prob = result['fighter1_probability'] / 100  # Convert percentage to probability
            active_retired_probs.append(prob)
            logger.info(f"{fighter1['fighter_name']} vs {fighter2['fighter_name']} - Fighter 1 win probability: {prob:.2f}")
        
        # Test retired vs retired
        logger.info("\nTesting Retired vs Retired matchups:")
        for fighter1, fighter2 in retired_vs_retired:
            result = predictor.predict_winner(fighter1['fighter_name'], fighter2['fighter_name'])
            if 'error' in result:
                logger.warning(f"Error predicting {fighter1['fighter_name']} vs {fighter2['fighter_name']}: {result['error']}")
                continue
                
            prob = result['fighter1_probability'] / 100  # Convert percentage to probability
            retired_retired_probs.append(prob)
            logger.info(f"{fighter1['fighter_name']} vs {fighter2['fighter_name']} - Fighter 1 win probability: {prob:.2f}")
        
        # Plot probability distributions if we have enough data
        if save_plot and (active_active_probs or active_retired_probs or retired_retired_probs):
            try:
                os.makedirs('backend/ml/reports', exist_ok=True)
                
                plt.figure(figsize=(10, 6))
                
                if active_active_probs:
                    plt.hist(active_active_probs, alpha=0.7, bins=10, label='Active vs Active')
                    
                if active_retired_probs:
                    plt.hist(active_retired_probs, alpha=0.7, bins=10, label='Active vs Retired')
                    
                if retired_retired_probs:
                    plt.hist(retired_retired_probs, alpha=0.7, bins=10, label='Retired vs Retired')
                
                plt.title('Prediction Probability Distribution by Fighter Status')
                plt.xlabel('Fighter 1 Win Probability')
                plt.ylabel('Count')
                plt.legend()
                plt.grid(True, alpha=0.3)
                
                plot_path = 'backend/ml/reports/prediction_distribution.png'
                plt.savefig(plot_path)
                logger.info(f"Saved probability distribution plot to {plot_path}")
            except Exception as e:
                logger.error(f"Error creating plot: {str(e)}")
        
        # Run controlled matchup tests
        test_matchups(model, scaler, feature_names)
        
        # Analyze overall probability distribution
        all_probs = active_active_probs + active_retired_probs + retired_retired_probs
        
        if all_probs:
            # Calculate distribution statistics
            mean_prob = np.mean(all_probs)
            median_prob = np.median(all_probs)
            std_prob = np.std(all_probs)
            min_prob = np.min(all_probs)
            max_prob = np.max(all_probs)
            
            logger.info("\nProbability Distribution Analysis:")
            logger.info(f"Mean probability: {mean_prob:.2f}")
            logger.info(f"Median probability: {median_prob:.2f}")
            logger.info(f"Standard deviation: {std_prob:.2f}")
            logger.info(f"Range: {min_prob:.2f} - {max_prob:.2f}")
            
            # Check if we have a good distribution
            if min_prob < 0.1 and max_prob > 0.9:
                logger.info("✅ Prediction range is wide (good)")
            else:
                logger.warning("⚠️ Prediction range is narrow")
                
            if std_prob > 0.15:
                logger.info("✅ Prediction variation is sufficient (good)")
            else:
                logger.warning("⚠️ Prediction variation is low")
                
            # Calculate calibration-like metric (percent outcomes in each bin)
            bins = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
            hist, _ = np.histogram(all_probs, bins=bins)
            percentages = hist / len(all_probs) * 100
            
            logger.info("\nPrediction Distribution by Confidence Level:")
            for i, (low, high) in enumerate(zip(bins[:-1], bins[1:])):
                logger.info(f"{low:.1f}-{high:.1f}: {percentages[i]:.1f}%")
        
        logger.info("\nTesting complete")
        
    except Exception as e:
        logger.error(f"Error running tests: {str(e)}")

def test_matchups(model, scaler, feature_names):
    """
    Test model predictions on different fighter status combinations.
    
    Creates controlled test matchups for:
    1. Active vs. Active
    2. Active vs. Retired
    3. Retired vs. Retired
    
    Parameters:
        model: Trained model
        scaler: Feature scaler
        feature_names: Names of features in model
    """
    logger.info("\nTesting model on controlled matchups:")
    
    # Create synthetic fighter features to test different scenarios
    base_fighter = {
        'is_active': 1.0,
        'days_since_last_fight': 100,
        'days_since_last_fight_normalized': 100/730,
        'win_rate': 0.7,
        'win_rate_weighted': 0.7,
        'total_fights': 15,
        'wins': 10,
        'losses': 4,
        'draws': 1,
        'striking_differential': 1.5,
        'finish_rate': 0.6,
        'experience_factor': 0.7 * np.log1p(15)
    }
    
    # Create four fighters: elite active, average active, elite retired, average retired
    elite_active = base_fighter.copy()
    elite_active['ranking'] = 0.9
    elite_active['opposition_quality'] = 0.8
    
    average_active = base_fighter.copy()
    average_active['win_rate'] = 0.5
    average_active['win_rate_weighted'] = 0.5
    average_active['ranking'] = 0.4
    average_active['opposition_quality'] = 0.5
    
    elite_retired = elite_active.copy()
    elite_retired['is_active'] = 0.0
    elite_retired['days_since_last_fight'] = 1000
    elite_retired['days_since_last_fight_normalized'] = 1000/730
    
    average_retired = average_active.copy()
    average_retired['is_active'] = 0.0
    average_retired['days_since_last_fight'] = 1200
    average_retired['days_since_last_fight_normalized'] = 1200/730
    
    # Create matchups
    test_pairs = [
        # Closely matched active fighters
        (elite_active, elite_active),
        # Mismatched active fighters
        (elite_active, average_active),
        # Active vs retired (similar skill level)
        (elite_active, elite_retired),
        # Active vs retired (different skill level)
        (elite_active, average_retired),
        # Retired vs retired
        (elite_retired, average_retired)
    ]
    
    matchup_descriptions = [
        "Elite Active vs Elite Active (closely matched)",
        "Elite Active vs Average Active (skill mismatch)",
        "Elite Active vs Elite Retired (same skill, different status)",
        "Elite Active vs Average Retired (different skill and status)",
        "Elite Retired vs Average Retired (both retired, skill mismatch)"
    ]
    
    for idx, ((fighter1, fighter2), description) in enumerate(zip(test_pairs, matchup_descriptions)):
        # Create feature vectors using our test helper function
        feature_vector = create_test_feature_vector(fighter1, fighter2, feature_names)
        
        # Scale features
        feature_vector_scaled = scaler.transform(feature_vector.reshape(1, -1))
        
        # Get prediction
        probabilities = model.predict_proba(feature_vector_scaled)[0]
        fighter1_prob = probabilities[1]
        fighter2_prob = probabilities[0]
        
        logger.info(f"\nMatchup {idx+1}: {description}")
        logger.info(f"  - Fighter 1 win probability: {fighter1_prob:.2f}")
        logger.info(f"  - Fighter 2 win probability: {fighter2_prob:.2f}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Test the MMA Fight Predictor")
    parser.add_argument('--active', type=int, default=15, help="Number of active fighters to test")
    parser.add_argument('--retired', type=int, default=15, help="Number of retired fighters to test")
    parser.add_argument('--samples', type=int, default=20, help="Number of matchups per category")
    parser.add_argument('--save-plot', action='store_true', help="Save probability distribution plot")
    
    args = parser.parse_args()
    
    test_predictor(
        active_count=args.active,
        retired_count=args.retired,
        samples_per_category=args.samples,
        save_plot=args.save_plot
    ) 