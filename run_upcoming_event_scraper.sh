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



echo "Script completed." 