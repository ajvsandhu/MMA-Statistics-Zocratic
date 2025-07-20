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

# Show which Python is being used (for debugging)
which python >> /home/ubuntu/zocraticmma/cron.log 2>&1
python --version >> /home/ubuntu/zocraticmma/cron.log 2>&1

# Run the fight results scraper in monitor mode
echo "$(date): Running UFC Fight Results Monitor..." >> /home/ubuntu/zocraticmma/cron.log 2>&1
python scripts/scrapers/fight_results_scraper.py --mode monitor >> /home/ubuntu/zocraticmma/cron.log 2>&1
echo "$(date): UFC Monitor completed." >> /home/ubuntu/zocraticmma/cron.log 2>&1 