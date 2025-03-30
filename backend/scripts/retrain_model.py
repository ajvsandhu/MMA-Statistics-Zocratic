import os
import sys
import logging
from pathlib import Path

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent.parent))

from backend.ml.train import train_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    """Retrain the model with the new format."""
    logger = logging.getLogger(__name__)
    logger.info("Starting model retraining process...")
    
    try:
        # Train the model
        train_model()
        logger.info("Model retraining completed successfully!")
    except Exception as e:
        logger.error(f"Error during model retraining: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 