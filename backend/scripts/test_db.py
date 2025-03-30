import os
import logging
from dotenv import load_dotenv
from backend.supabase_client import SupabaseClient

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_database():
    """Test database connection and list available tables."""
    try:
        # Load environment variables
        load_dotenv()
        
        # Get Supabase credentials
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_KEY = os.getenv("SUPABASE_KEY")
        
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError("Supabase URL or Key not found in environment variables")
            
        logger.info(f"Using Supabase URL: {SUPABASE_URL}")
        
        # Create client
        client = SupabaseClient(SUPABASE_URL, SUPABASE_KEY)
        
        # Test connection
        if not client.test_connection():
            logger.error("Could not connect to Supabase")
            return
            
        logger.info("Successfully connected to Supabase")
        
        # Try to get fighters
        response = client.table('fighters').select('*').limit(1).execute()
        if response.data:
            logger.info(f"Sample fighter data: {response.data[0]}")
            logger.info(f"Available fields: {list(response.data[0].keys())}")
        else:
            logger.warning("No fighters found in database")
            
        # Try to get fights
        response = client.table('fighter_last_5_fights').select('*').limit(1).execute()
        if response.data:
            logger.info(f"Sample fight data: {response.data[0]}")
            logger.info(f"Available fields: {list(response.data[0].keys())}")
        else:
            logger.warning("No fights found in database")
            
        # Test fighter search
        test_fighter = "Israel Adesanya"
        logger.info(f"Testing fighter search for: {test_fighter}")
        fighter_data = client.get_fighter_data(test_fighter)
        if fighter_data:
            logger.info(f"Found fighter data: {fighter_data}")
        else:
            logger.warning(f"Could not find fighter: {test_fighter}")
            
    except Exception as e:
        logger.error(f"Error testing database: {str(e)}")

if __name__ == '__main__':
    test_database() 