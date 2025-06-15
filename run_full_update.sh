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
echo "[1/4] Running ssqlufc.py in recent mode..."
python scripts/scrapers/ssqlufc.py --mode recent --events 2

# Step 2: Run l55.py in recent mode
echo "[2/4] Running l55.py in recent mode..."
python scripts/scrapers/l55.py --mode recent --num-events 1

# Step 3: Run UFC rankings scraper
echo "[3/4] Running UFC rankings scraper..."
PYTHONPATH=. python scripts/scrapers/ufc_rankings_scraper.py

# Step 4: Retrain the model
echo "[4/4] Retraining the model..."
python backend/ml_new/train.py

# Restart the server to load the new model
sudo systemctl restart zocratic

# Check if there are any changes to commit
if [[ -n $(git status --porcelain) ]]; then
    echo "Changes detected. Committing and pushing to GitHub..."
    
    # Add all changes
    git add .
    
    # Commit with timestamp
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    git commit -m "Auto-update UFC rankings data - $TIMESTAMP"
    
    # Push to GitHub
    git push origin main
    
    echo "Changes successfully pushed to GitHub."
else
    echo "No changes detected. Nothing to commit."
fi

echo "Script completed."

echo "All steps completed successfully!" 