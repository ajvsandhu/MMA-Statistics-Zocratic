import jwt
import os
import logging
from typing import Optional
from fastapi import HTTPException, Header
import requests
from functools import lru_cache
import json
import uuid
import re

logger = logging.getLogger(__name__)

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
                    # Update existing - ensure we preserve existing data and add new info
                    logger.info(f"Updating existing user settings for {user_id[:8]}...")
                    
                    # Merge new settings with existing ones, giving priority to JWT data
                    update_result = supabase.table('user_settings').update({
                        'settings': settings
                    }).eq('user_id', user_id).execute()
                    
                    if update_result.data:
                        logger.info(f"Successfully updated user settings for {user_id[:8]}... with email: {email}")
                    else:
                        logger.error(f"Update failed for user {user_id[:8]}...: {update_result}")
                        
                else:
                    # Create new user entry
                    logger.info(f"Creating new user settings for {user_id[:8]}... with email: {email}")
                    insert_result = supabase.table('user_settings').insert({
                        'user_id': user_id,
                        'settings': settings
                    }).execute()
                    
                    if insert_result.data:
                        logger.info(f"Successfully created user settings for {user_id[:8]}... with email: {email}")
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

# Alternative simpler version if you want to handle auth in your frontend
def get_user_id_simple(user_id: Optional[str] = Header(None, alias="X-User-ID")) -> str:
    """Simple version - get user_id from custom header (less secure, for testing)"""
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID header required")
    return user_id 