import os
from pathlib import Path
from dotenv import load_dotenv

# Always load .env from the project root
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
load_dotenv(dotenv_path=PROJECT_ROOT / '.env')

# Project paths
DATA_DIR = os.path.join(PROJECT_ROOT, 'backend', 'ml_new', 'data')
MODELS_DIR = PROJECT_ROOT / "models"
FEATURES_DIR = PROJECT_ROOT / "features"

# Create necessary directories
os.makedirs(DATA_DIR, exist_ok=True)

# Model parameters
RANDOM_STATE = 42
TEST_SIZE = 0.2
VAL_SIZE = 0.2

# Supabase configuration - Load from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Add checks to ensure variables are loaded
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase URL or Key not found in environment variables. Please check your .env file.")

# Feature configuration
NUMERICAL_FEATURES = [
    'SLpM', 'Str. Acc.', 'SApM', 'Str. Def',
    'TD Avg.', 'TD Acc.', 'TD Def.', 'Sub. Avg.'
]

CATEGORICAL_FEATURES = [
    'STANCE'
]

# Model configuration
MODEL_PARAMS = {
    'n_estimators': 100,
    'learning_rate': 0.1,
    'max_depth': 5,
    'random_state': RANDOM_STATE,
    'use_label_encoder': False,
    'eval_metric': 'logloss'
}

# Create directories if they don't exist
for directory in [MODELS_DIR, FEATURES_DIR]:
    directory.mkdir(parents=True, exist_ok=True) 