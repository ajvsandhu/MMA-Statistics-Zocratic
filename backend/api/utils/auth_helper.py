import jwt
import os
import logging
from typing import Optional, List
from fastapi import HTTPException, Header, Depends
import requests
from functools import lru_cache
import json
import uuid
import re
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Cache to avoid database checks for recently verified users
_user_settings_cache = {}
CACHE_DURATION_MINUTES = 5  # Cache user settings for 5 minutes

def cleanup_user_settings_cache():
    """Clean up expired cache entries to prevent memory leaks"""
    current_time = datetime.now()
    expired_keys = [
        key for key, cached_time in _user_settings_cache.items()
        if current_time - cached_time > timedelta(minutes=CACHE_DURATION_MINUTES * 2)
    ]
    for key in expired_keys:
        del _user_settings_cache[key]
    
    if expired_keys:
        logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")

# SECURITY: Load Cognito configuration from environment variables (support both backend and frontend env var names)
def get_env_any(*names):
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None

COGNITO_REGION = get_env_any("COGNITO_REGION", "NEXT_PUBLIC_COGNITO_REGION")
COGNITO_USER_POOL_ID = get_env_any("COGNITO_USER_POOL_ID", "NEXT_PUBLIC_COGNITO_USER_POOL_ID")
COGNITO_CLIENT_ID = get_env_any("COGNITO_CLIENT_ID", "NEXT_PUBLIC_COGNITO_CLIENT_ID")

# Validate required environment variables
if not COGNITO_REGION:
    raise ValueError("COGNITO_REGION or NEXT_PUBLIC_COGNITO_REGION environment variable is required")
if not COGNITO_USER_POOL_ID:
    raise ValueError("COGNITO_USER_POOL_ID or NEXT_PUBLIC_COGNITO_USER_POOL_ID environment variable is required")
if not COGNITO_CLIENT_ID:
    raise ValueError("COGNITO_CLIENT_ID or NEXT_PUBLIC_COGNITO_CLIENT_ID environment variable is required")

COGNITO_ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"

@lru_cache(maxsize=128)
def get_cognito_public_keys():
    """Fetch and cache Cognito public keys for JWT verification"""
    try:
        jwks_url = f"{COGNITO_ISSUER}/.well-known/jwks.json"
        response = requests.get(jwks_url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching Cognito public keys: {str(e)}")
        return None

def verify_cognito_token(token: str) -> Optional[dict]:
    """Verify Cognito JWT token and return decoded payload"""
    try:
        # Get public keys
        jwks = get_cognito_public_keys()
        if not jwks:
            return None
            
        # Decode header to get key ID
        header = jwt.get_unverified_header(token)
        kid = header.get('kid')
        
        # Find the right key
        public_key = None
        for key in jwks.get('keys', []):
            if key.get('kid') == kid:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break
                
        if not public_key:
            logger.warning("Could not find matching public key")
            return None
            
        # Verify and decode token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=['RS256'],
            audience=COGNITO_CLIENT_ID,
            issuer=COGNITO_ISSUER
        )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error verifying token: {str(e)}")
        return None

def extract_user_groups(payload: dict) -> List[str]:
    """Extract user groups from Cognito JWT payload"""
    groups = []
    
    # Cognito groups can be in different fields depending on configuration
    if 'cognito:groups' in payload:
        groups = payload['cognito:groups']
    elif 'groups' in payload:
        groups = payload['groups']
    
    return groups if isinstance(groups, list) else []

def is_admin(payload: dict) -> bool:
    """Check if user is in admin group"""
    groups = extract_user_groups(payload)
    return 'admin' in groups

def is_valid_uuid(uuid_string):
    """Check if a string is a valid UUID"""
    try:
        uuid.UUID(uuid_string)
        return True
    except (ValueError, TypeError, AttributeError):
        return False

def sanitize_user_id(user_id):
    """Ensure user_id is a valid UUID format"""
    if not user_id:
        return None
    
    # If it's already a valid UUID, return as-is
    if is_valid_uuid(user_id):
        return user_id
    
    # If it contains only valid UUID characters but missing hyphens, try to format it
    clean_id = re.sub(r'[^a-fA-F0-9]', '', user_id)
    if len(clean_id) == 32:
        # Try to format as UUID: 8-4-4-4-12
        formatted = f"{clean_id[:8]}-{clean_id[8:12]}-{clean_id[12:16]}-{clean_id[16:20]}-{clean_id[20:]}"
        if is_valid_uuid(formatted):
            return formatted
    
    # Last resort: generate a deterministic UUID from the input
    logger.warning(f"Invalid user_id format received: {user_id[:10]}..., generating deterministic UUID")
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, user_id))

def get_user_id_from_auth_header(authorization: str = Header(None)) -> str:
    """Extract user ID from Cognito JWT token with PROPER verification"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = authorization.split(" ")[1]
    
    try:
        # USE PROPER JWT VERIFICATION - this validates signature, expiry, issuer, etc.
        payload_data = verify_cognito_token(token)
        
        if not payload_data:
            logger.warning("Failed to verify JWT token")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # Extract user information from verified payload
        raw_user_id = payload_data.get('sub')
        username = payload_data.get('preferred_username')
        email = payload_data.get('email')
        cognito_username = payload_data.get('cognito:username')
        
        if not raw_user_id:
            raise HTTPException(status_code=401, detail="No user ID in token")
        
        # Sanitize and validate user_id
        user_id = sanitize_user_id(raw_user_id)
        if not user_id:
            logger.error(f"Could not sanitize user_id from token: {raw_user_id[:10]}...")
            raise HTTPException(status_code=401, detail="Invalid user ID format")
        
        # Log only non-sensitive data for security
        logger.info(f"Authenticated user: {user_id[:8]}... (email: {email})")
        
        # ALWAYS store user info in settings - force update every time with PROPER ERROR HANDLING
        try:
            # Check cache first to avoid unnecessary database calls
            cache_key = f"{user_id}:{email}"
            current_time = datetime.now()
            
            # Cleanup old cache entries periodically
            if len(_user_settings_cache) > 100:  # Only cleanup when cache gets large
                cleanup_user_settings_cache()
            
            if cache_key in _user_settings_cache:
                cached_time = _user_settings_cache[cache_key]
                if current_time - cached_time < timedelta(minutes=CACHE_DURATION_MINUTES):
                    logger.debug(f"User settings for {user_id[:8]}... found in cache, skipping database check")
                    return user_id
            
            from backend.api.database import get_db_connection
            supabase = get_db_connection()
            if supabase:
                logger.info(f"Storing/updating user settings for user {user_id[:8]}...")
                
                # First check if user_settings exists
                existing_settings = supabase.table('user_settings')\
                    .select('id, settings')\
                    .eq('user_id', user_id)\
                    .execute()
                
                # Prepare the settings object with all possible username fields
                settings = {}
                if existing_settings.data:
                    settings = existing_settings.data[0].get('settings', {})
                
                # Update with ALL extracted info
                if username:
                    settings['preferred_username'] = username
                if email:
                    settings['email'] = email
                if cognito_username:
                    settings['cognito_username'] = cognito_username
                
                # Add metadata
                settings['last_login'] = payload_data.get('auth_time', 'unknown')
                settings['cognito_region'] = COGNITO_REGION
                
                logger.info(f"Prepared settings for user {user_id[:8]}... with email: {email}")
                
                if existing_settings.data:
                    # Check if settings need updating by comparing current with existing
                    existing_data = existing_settings.data[0]['settings'] or {}
                    
                    # Compare key fields to see if update is needed
                    needs_update = (
                        existing_data.get('email') != email or
                        existing_data.get('username') != username or
                        existing_data.get('display_name') != display_name or
                        existing_data.get('preferred_username') != preferred_username or
                        existing_data.get('cognito_username') != cognito_username or
                        existing_data.get('last_login') != payload_data.get('auth_time', 'unknown')
                    )
                    
                    if needs_update:
                        logger.info(f"Updating existing user settings for {user_id[:8]}... (data changed)")
                        
                        # Merge new settings with existing ones, giving priority to JWT data
                        update_result = supabase.table('user_settings').update({
                            'settings': settings
                        }).eq('user_id', user_id).execute()
                        
                        if update_result.data:
                            logger.info(f"Successfully updated user settings for {user_id[:8]}... with email: {email}")
                            # Cache the successful update
                            _user_settings_cache[cache_key] = current_time
                        else:
                            logger.error(f"Update failed for user {user_id[:8]}...: {update_result}")
                    else:
                        logger.debug(f"User settings for {user_id[:8]}... are up to date, skipping update")
                        # Cache that no update was needed
                        _user_settings_cache[cache_key] = current_time
                        
                else:
                    # Create new user entry
                    logger.info(f"Creating new user settings for {user_id[:8]}... with email: {email}")
                    insert_result = supabase.table('user_settings').insert({
                        'user_id': user_id,
                        'settings': settings
                    }).execute()
                    
                    if insert_result.data:
                        logger.info(f"Successfully created user settings for {user_id[:8]}... with email: {email}")
                        # Cache the successful creation
                        _user_settings_cache[cache_key] = current_time
                    else:
                        logger.error(f"Insert failed for user {user_id[:8]}...: {insert_result}")
                        
            else:
                logger.error("Failed to get database connection for user settings update")
                        
        except Exception as e:
            # DO NOT silently ignore errors - log them properly
            logger.error(f"CRITICAL: Failed to update user settings for user {user_id[:8]}... (email: {email}): {str(e)}")
            logger.error(f"User ID that failed: {user_id}")
            logger.error(f"Raw user ID from token: {raw_user_id}")
            logger.error(f"Error type: {type(e).__name__}")
            
            # Still allow authentication to proceed, but ensure we track this failure
            # In production, you might want to send this to an error monitoring service
        
        return user_id
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 401)
        raise
    except Exception as e:
        logger.error(f"Token validation error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

def get_admin_user_from_auth_header(authorization: str = Header(None)) -> str:
    """Extract user ID and verify admin group membership"""
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")
    
    token = authorization.split(" ")[1]
    
    try:
        payload_data = verify_cognito_token(token)
        
        if not payload_data:
            logger.warning("Failed to verify JWT token for admin access")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # Check if user is admin
        if not is_admin(payload_data):
            logger.warning(f"Non-admin user attempted to access admin endpoint: {payload_data.get('email', 'unknown')}")
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Extract and validate user ID
        raw_user_id = payload_data.get('sub')
        if not raw_user_id:
            raise HTTPException(status_code=401, detail="No user ID in token")
        
        user_id = sanitize_user_id(raw_user_id)
        if not user_id:
            logger.error(f"Could not sanitize admin user_id from token: {raw_user_id[:10]}...")
            raise HTTPException(status_code=401, detail="Invalid user ID format")
        
        logger.info(f"Admin access granted to user: {user_id[:8]}... (email: {payload_data.get('email', 'unknown')})")
        return user_id
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin token validation error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

# Alternative simpler version if you want to handle auth in your frontend
def get_user_id_simple(user_id: Optional[str] = Header(None, alias="X-User-ID")) -> str:
    """Simple version - get user_id from custom header (less secure, for testing)"""
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID header required")
    return user_id

def get_admin_user_simple(user_id: Optional[str] = Header(None, alias="X-User-ID")) -> str:
    """Simple admin version - for testing only, does not verify admin status"""
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID header required")
    logger.warning("Using simple admin auth - NOT SECURE for production!")
    return user_id 