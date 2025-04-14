import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
DATA_DIR = os.path.join(PROJECT_ROOT, 'backend', 'ml_new', 'data')
MODELS_DIR = PROJECT_ROOT / "models"
FEATURES_DIR = PROJECT_ROOT / "features"

# Create necessary directories
os.makedirs(DATA_DIR, exist_ok=True)

# Model parameters
RANDOM_STATE = 42
TEST_SIZE = 0.2
VAL_SIZE = 0.2

# Supabase configuration
SUPABASE_URL = "https://jjfaidtdhuxmekdznwor.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqZmFpZHRkaHV4bWVrZHpud29yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0Mjg3ODQxNCwiZXhwIjoyMDU4NDU0NDE0fQ._hEy5tjczZoiuR15S0eElSayPvSPUFkI0-IruKA-buA"

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