import os
import logging
# from dotenv import load_dotenv
from backend.api.database import get_db_connection, test_connection # Import from the correct module

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_database():
    """Test database connection and perform basic queries using backend.api.database."""
    try:
        # Load environment variables (already done by database module, but good practice)
        # load_dotenv()

        # Use the test_connection function from database module
        logger.info("Testing database connection...")
        if not test_connection():
            logger.error("Database connection test failed using test_connection()")
            return

        logger.info("Successfully connected to Supabase (verified via test_connection)")

        # Get the client instance
        client = get_db_connection()
        if client is None:
            logger.error("Failed to get Supabase client instance from get_db_connection()")
            return

        # Try to get fighters
        logger.info("Attempting to fetch sample fighter data...")
        response = client.table('fighters').select('*').limit(1).execute()

        # Check response using supabase-py structure (response.data)
        if response.data:
            logger.info(f"Sample fighter data: {response.data[0]}")
            logger.info(f"Available fields: {list(response.data[0].keys())}")
        else:
            logger.warning("No fighters found in database")

        # Try to get fights
        logger.info("Attempting to fetch sample fight data...")
        response = client.table('fighter_last_5_fights').select('*').limit(1).execute()
        if response.data:
            logger.info(f"Sample fight data: {response.data[0]}")
            logger.info(f"Available fields: {list(response.data[0].keys())}")
        else:
            logger.warning("No fights found in database")

        # Test fighter search (replicating get_fighter_data logic)
        test_fighter = "Israel Adesanya"
        logger.info(f"Testing fighter search for: {test_fighter}")
        # Use ilike for case-insensitive search on the 'fighter_name' column
        response = client.table('fighters').select('*').ilike('fighter_name', f"%{test_fighter}%").limit(1).execute()

        if response.data:
            fighter_data = response.data[0]
            logger.info(f"Found fighter data via search: {fighter_data}")
        else:
            logger.warning(f"Could not find fighter via search: {test_fighter}")

    except Exception as e:
        logger.error(f"Error testing database: {str(e)}")

if __name__ == '__main__':
    test_database() 