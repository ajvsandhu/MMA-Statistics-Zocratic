"""
MMA Fight Prediction Model Pipeline

This script runs the complete modeling pipeline:
1. Training the model with naturally calibrated predictions
2. Testing the model across different fighter matchup types
3. Generating a final report on model performance

Usage: python -m backend.ml.run_model_pipeline --train --test --plot
"""

import os
import sys
import argparse
import logging
from datetime import datetime

# Create necessary directories first
os.makedirs('backend/ml/logs', exist_ok=True)
os.makedirs('backend/ml/models', exist_ok=True)
os.makedirs('backend/ml/reports', exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f"backend/ml/logs/model_pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
    ]
)
logger = logging.getLogger(__name__)

def setup_environment():
    """Set up the environment for running the pipeline."""
    # Directories already created above
    logger.info("Environment setup complete")

def run_training():
    """Run the model training process."""
    logger.info("Starting model training...")
    try:
        from backend.ml.train import main as train_main
        train_main()
        logger.info("Model training completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during model training: {str(e)}")
        return False

def run_testing(active_count=15, retired_count=15, samples=20, save_plot=False):
    """Run the model testing process."""
    logger.info("Starting model testing...")
    try:
        from backend.ml.test_predictor import test_predictor
        test_predictor(
            active_count=active_count,
            retired_count=retired_count,
            samples_per_category=samples,
            save_plot=save_plot
        )
        logger.info("Model testing completed successfully")
        return True
    except Exception as e:
        logger.error(f"Error during model testing: {str(e)}")
        return False

def generate_final_report():
    """Generate a final report on model performance."""
    logger.info("Generating final report...")
    try:
        # Import predictor to get model metadata
        from backend.ml.predictor import FighterPredictor
        predictor = FighterPredictor()
        
        # Get model info
        model_info = predictor.get_model_info()
        
        # Write report
        report_path = f"backend/ml/reports/model_report_{datetime.now().strftime('%Y%m%d')}.txt"
        
        with open(report_path, 'w') as f:
            f.write("=" * 80 + "\n")
            f.write("MMA FIGHT PREDICTION MODEL REPORT\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("=" * 80 + "\n\n")
            
            f.write("MODEL INFORMATION\n")
            f.write("-" * 50 + "\n")
            f.write(f"Model Type: {model_info.get('model_type', 'Unknown')}\n")
            f.write(f"Training Date: {model_info.get('training_date', 'Unknown')}\n")
            f.write(f"Feature Count: {model_info.get('feature_count', 0)}\n\n")
            
            f.write("PERFORMANCE METRICS\n")
            f.write("-" * 50 + "\n")
            metrics = model_info.get('metrics', {})
            for name, value in metrics.items():
                if not isinstance(value, (list, dict)):
                    f.write(f"{name.replace('_', ' ').title()}: {value:.4f if isinstance(value, float) else value}\n")
            
            f.write("\nCONCLUSION\n")
            f.write("-" * 50 + "\n")
            f.write("This model has been trained to provide naturally calibrated predictions\n")
            f.write("for MMA fights, taking into account active vs. retired fighter status.\n")
            f.write("\nThe model differentiates predictions based on fighter matchup types:\n")
            f.write("- Active vs. Active: More balanced predictions\n")
            f.write("- Active vs. Retired: Active fighters typically favored\n")
            f.write("- Retired vs. Retired: More weight on career-long statistics\n\n")
            
            f.write("=" * 80 + "\n")
        
        logger.info(f"Final report generated: {report_path}")
        return True
    except Exception as e:
        logger.error(f"Error generating final report: {str(e)}")
        return False

def main():
    """Main pipeline function."""
    parser = argparse.ArgumentParser(description="Run the MMA Fight Prediction Model Pipeline")
    parser.add_argument('--train', action='store_true', help="Run model training")
    parser.add_argument('--test', action='store_true', help="Run model testing")
    parser.add_argument('--active', type=int, default=15, help="Number of active fighters to test")
    parser.add_argument('--retired', type=int, default=15, help="Number of retired fighters to test")
    parser.add_argument('--samples', type=int, default=20, help="Number of matchups per category")
    parser.add_argument('--plot', action='store_true', help="Generate and save plots")
    parser.add_argument('--report', action='store_true', help="Generate final report")
    
    args = parser.parse_args()
    
    # If no arguments, run everything
    if not (args.train or args.test or args.report):
        args.train = True
        args.test = True
        args.report = True
    
    logger.info("Starting MMA Fight Prediction Model Pipeline")
    
    # Setup environment
    setup_environment()
    
    success = True
    
    # Run training if requested
    if args.train:
        train_success = run_training()
        success = success and train_success
    
    # Run testing if requested
    if args.test:
        test_success = run_testing(
            active_count=args.active,
            retired_count=args.retired,
            samples=args.samples,
            save_plot=args.plot
        )
        success = success and test_success
    
    # Generate report if requested
    if args.report:
        report_success = generate_final_report()
        success = success and report_success
    
    if success:
        logger.info("Pipeline completed successfully")
    else:
        logger.warning("Pipeline completed with errors")

if __name__ == '__main__':
    main() 