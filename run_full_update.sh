#!/bin/bash
set -e

# If you use a virtual environment, activate it here:
source venv/bin/activate

# Change to the project root (if not already there)
cd "$(dirname "$0")"

# Step 1: Run ssqlufc.py in recent mode
echo "[1/4] Running ssqlufc.py in recent mode..."
python3 scripts/scrapers/ssqlufc.py --mode recent --events 2

# Step 2: Run l55.py in recent mode
echo "[2/4] Running l55.py in recent mode..."
python3 scripts/scrapers/l55.py --mode recent --num-events 1

# Step 3: Run UFC rankings scraper
echo "[3/4] Running UFC rankings scraper..."
PYTHONPATH=. python3 scripts/scrapers/ufc_rankings_scraper.py

# Step 4: Retrain the model
echo "[4/4] Retraining the model..."
python3 backend/ml_new/train.py

echo "All steps completed successfully!" 