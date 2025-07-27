#!/bin/bash
set -e

# Change to the script's directory (project root)
cd "$(dirname "$0")"

# Activate the virtual environment
if [ -f venv/bin/activate ]; then
    source venv/bin/activate
else
    echo "ERROR: venv/bin/activate not found. Exiting."
    exit 1
fi

# Show which Python is being used
which python
python --version

# Step 1: Run ssqlufc.py in recent mode
echo "[1/5] Running ssqlufc.py in recent mode..."
python scripts/scrapers/ssqlufc.py --mode recent --events 2

# Step 2: Run ssqlufc.py in recent mode with --upcoming
echo "[2/5] Running ssqlufc.py in recent mode with --upcoming (to add all upcoming event fighters)..."
python scripts/scrapers/ssqlufc.py --mode recent --upcoming --events 2

# Step 3: Run the upcoming event scraper
echo "[3/5] Running upcoming_event_scraper.py..."
python scripts/scrapers/upcoming_event_scraper.py

# Step 4: Run l55.py in recent mode
echo "[4/5] Running l55.py in recent mode..."
python scripts/scrapers/l55.py --mode recent --num-events 1

# Step 5: Run UFC rankings scraper
echo "[5/5] Running UFC rankings scraper..."
PYTHONPATH=. python scripts/scrapers/ufc_rankings_scraper.py

# Step 6: Retrain the model
echo "[6] Retraining the model..."
python backend/ml_new/train.py

# Restart the server to load the new model
sudo systemctl restart zocratic



echo "Script completed."

echo "All steps completed successfully!" 