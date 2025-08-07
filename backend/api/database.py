import logging
import os
import json
import requests
from functools import lru_cache
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from supabase import create_client, Client
import time
import traceback
import httpx

# Load environment variables from project root
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=PROJECT_ROOT / '.env')

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get Supabase credentials from environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Check credentials are loaded
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Missing Supabase credentials. Please check environment variables.")

# Connection settings
CONNECTION_TIMEOUT = int(os.getenv("CONNECTION_TIMEOUT", "30"))  # Increased to 30 seconds
MAX_RETRIES = int(os.getenv("CONNECTION_RETRIES", "5"))  # Increased to 5 retries
RETRY_BACKOFF = 2  # Exponential backoff multiplier

# Global connection instance
_supabase_client: Optional[Client] = None
_last_connection_attempt = 0
_connection_expiry = 1800  # Reduced to 30 minutes for better connection management

# Custom httpx client with better connection handling
_httpx_client: Optional[httpx.Client] = None

def get_httpx_client() -> httpx.Client:
    """Get a configured httpx client with proper timeouts and connection pooling."""
    global _httpx_client
    
    if _httpx_client is None:
        # Configure httpx client with better connection handling
        _httpx_client = httpx.Client(
            timeout=httpx.Timeout(
                connect=10.0,  # Connection timeout
                read=30.0,     # Read timeout
                write=10.0,    # Write timeout
                pool=60.0      # Pool timeout
            ),
            limits=httpx.Limits(
                max_keepalive_connections=20,  # Keep more connections alive
                max_connections=100,           # Allow more concurrent connections
                keepalive_expiry=60.0         # Keep connections alive for 60 seconds
            ),
            http2=True  # Enable HTTP/2 for better performance
        )
    
    return _httpx_client

class SimpleSupabaseClient:
    """A simplified client for Supabase that uses direct HTTP requests instead of SDK."""
    
    def __init__(self, url: str, key: str):
        self.base_url = url
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        self.client = get_httpx_client()
    
    def _handle_response(self, response):
        """Handle API response and convert to expected format."""
        if not response.is_success:
            logger.error(f"Supabase API error: {response.status_code} - {response.text}")
            return None
        
        try:
            data = response.json()
            # Wrap in the expected data property for compatibility
            return type('SupabaseResponse', (), {'data': data})
        except Exception as e:
            logger.error(f"Error parsing response: {str(e)}")
            return None
    
    def table(self, table_name: str):
        """Create a query builder for a table."""
        return QueryBuilder(self, table_name)
    
    def test_connection(self):
        """Test the connection to Supabase."""
        try:
            endpoint = f"{self.base_url}/rest/v1/fighters?limit=1"
            response = self.client.get(endpoint, headers=self.headers)
            return response.is_success
        except Exception as e:
            logger.error(f"Error testing connection: {str(e)}")
            return False

class QueryBuilder:
    """Simple query builder for Supabase tables."""
    
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.query_params = {}
        self.filters = []
        self.select_columns = "*"
        self.order_value = None
        self.limit_value = None
        self.offset_value = None
        self.count_option = None
    
    def select(self, columns="*", **kwargs):
        """Select columns to return."""
        self.select_columns = columns
        if kwargs.get('count'):
            self.count_option = kwargs.get('count')
        return self
    
    def eq(self, column, value):
        """Add equals filter."""
        self.filters.append(f"{column}=eq.{value}")
        return self
    
    def ilike(self, column, value):
        """Add case-insensitive LIKE filter."""
        self.filters.append(f"{column}=ilike.{value}")
        return self
    
    def order(self, column, desc=False, nulls_last=False):
        """Add order clause."""
        direction = "desc" if desc else "asc"
        nulls = ".nullslast" if nulls_last else ""
        self.order_value = f"{column}.{direction}{nulls}"
        return self
    
    def limit(self, limit_val):
        """Add limit clause."""
        self.limit_value = limit_val
        return self
    
    def range(self, from_val, to_val):
        """Add range for pagination."""
        self.offset_value = from_val
        self.limit_value = to_val - from_val + 1
        return self
    
    def _build_url(self):
        """Build the URL for the request."""
        url = f"{self.client.base_url}/rest/v1/{self.table_name}"
        
        # Add query parameters
        params = []
        
        # Add select columns
        params.append(f"select={self.select_columns}")
        
        # Add filters
        for f in self.filters:
            params.append(f)
        
        # Add order
        if self.order_value:
            params.append(f"order={self.order_value}")
        
        # Add limit
        if self.limit_value is not None:
            params.append(f"limit={self.limit_value}")
        
        # Add offset
        if self.offset_value is not None:
            params.append(f"offset={self.offset_value}")
            
        # Add count option
        if self.count_option:
            params.append(f"count={self.count_option}")
        
        # Combine parameters
        if params:
            url += "?" + "&".join(params)
        
        return url
    
    def execute(self):
        """Execute the query with retry logic."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                url = self._build_url()
                response = self.client.client.get(url, headers=self.client.headers)
                return self.client._handle_response(response)
            except (httpx.ConnectError, httpx.ReadError, httpx.WriteError) as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 1  # Exponential backoff
                    logger.warning(f"Connection error on attempt {attempt + 1}, retrying in {wait_time}s: {str(e)}")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"Failed to execute query after {max_retries} attempts: {str(e)}")
                    return None
            except Exception as e:
                logger.error(f"Error executing query: {str(e)}")
                return None
    
    def upsert(self, data, on_conflict=None):
        """Insert or update data."""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                url = f"{self.client.base_url}/rest/v1/{self.table_name}"
                
                headers = dict(self.client.headers)
                if on_conflict:
                    headers["Prefer"] = f"resolution=merge-duplicates,return=representation,on_conflict={on_conflict}"
                
                response = self.client.client.post(url, headers=headers, json=data if isinstance(data, list) else [data])
                return self.client._handle_response(response)
            except (httpx.ConnectError, httpx.ReadError, httpx.WriteError) as e:
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 1
                    logger.warning(f"Connection error on upsert attempt {attempt + 1}, retrying in {wait_time}s: {str(e)}")
                    time.sleep(wait_time)
                    continue
                else:
                    logger.error(f"Failed to upsert data after {max_retries} attempts: {str(e)}")
                    return None
            except Exception as e:
                logger.error(f"Error upserting data: {str(e)}")
                return None

def get_db_connection() -> Optional[Client]:
    """
    Get a connection to the Supabase database with retry logic.
    
    Returns:
        Optional[Client]: A Supabase client instance or None if connection fails
    """
    global _supabase_client, _last_connection_attempt
    
    try:
        # Return existing connection if available and not expired
        current_time = time.time()
        if _supabase_client is not None and (current_time - _last_connection_attempt) < _connection_expiry:
            return _supabase_client
            
        # Check if credentials are available
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.error("Missing Supabase credentials. Please check environment variables.")
            return None
        
        # Create new connection with retries
        for attempt in range(MAX_RETRIES):
            try:
                logger.info(f"Connecting to Supabase (attempt {attempt+1}/{MAX_RETRIES})...")
                
                # Create client with custom httpx client
                _supabase_client = create_client(
                    SUPABASE_URL, 
                    SUPABASE_KEY
                )
                
                # Test connection with timeout
                test_response = _supabase_client.table('fighters').select('id').limit(1).execute()
                if test_response is not None and hasattr(test_response, 'data'):
                    logger.info("Successfully connected to Supabase")
                    _last_connection_attempt = current_time
                    return _supabase_client
                else:
                    logger.warning(f"Connection test failed on attempt {attempt+1}")
            except Exception as e:
                retry_wait = RETRY_BACKOFF ** attempt
                logger.warning(f"Connection attempt {attempt+1} failed: {str(e)}")
                if attempt < MAX_RETRIES - 1:
                    logger.info(f"Retrying in {retry_wait} seconds...")
                    time.sleep(retry_wait)
        
        logger.error(f"Failed to connect to Supabase after {MAX_RETRIES} attempts")
        return None
        
    except Exception as e:
        logger.error(f"Failed to connect to Supabase: {str(e)}")
        logger.error(traceback.format_exc())
        return None

def test_connection() -> bool:
    """Test the database connection."""
    try:
        start_time = time.time()
        logger.info("Testing database connection...")
        client = get_db_connection()
        if client is None:
            logger.error("Database client is None")
            return False
        
        if isinstance(client, SimpleSupabaseClient):
            is_connected = client.test_connection()
        else:
            # For the official Supabase client
            try:
                # Execute a simple query to check the connection
                client.table('fighters').select('*').limit(1).execute()
                is_connected = True
            except Exception as e:
                logger.error(f"Error testing database connection: {str(e)}")
                is_connected = False
        
        elapsed = time.time() - start_time
        if is_connected:
            logger.info(f"Database connection successful (took {elapsed:.2f}s)")
        else:
            logger.error(f"Database connection test failed (took {elapsed:.2f}s)")
        
        return is_connected
    except Exception as e:
        logger.error(f"Error testing database connection: {str(e)}")
        logger.error(traceback.format_exc())
        return False

# Alias for get_db_connection to maintain compatibility
get_supabase_client = get_db_connection