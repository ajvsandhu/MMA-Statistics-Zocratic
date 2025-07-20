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

# Run the upcoming event scraper
echo "Running Upcoming Event Scraper..."
python scripts/scrapers/upcoming_event_scraper.py

echo "Upcoming Event Scraper completed."

# Check if there are any changes to commit
if [[ -n $(git status --porcelain) ]]; then
    echo "Changes detected. Committing and pushing to GitHub..."
    
    # Add all changes
    git add .
    
    # Commit with timestamp
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    git commit -m "Auto-update upcoming event data - $TIMESTAMP"
    
    # Push to GitHub
    git push origin main
    
    echo "Changes successfully pushed to GitHub."
else
    echo "No changes detected. Nothing to commit."
fi

echo "Script completed." 