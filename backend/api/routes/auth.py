from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
import os
import logging
from typing import Dict, Any

# Try to import boto3, but don't fail if it's not available
try:
    import boto3
    from botocore.exceptions import ClientError
    BOTO3_AVAILABLE = True
except ImportError:
    BOTO3_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("boto3 not available, username checking will use basic validation only")

logger = logging.getLogger(__name__)
router = APIRouter()

# Get Cognito configuration from environment
COGNITO_REGION = os.getenv("COGNITO_REGION") or os.getenv("NEXT_PUBLIC_COGNITO_REGION")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID") or os.getenv("NEXT_PUBLIC_COGNITO_USER_POOL_ID")

if not COGNITO_REGION or not COGNITO_USER_POOL_ID:
    logger.warning("Cognito configuration not found in environment variables")

class UsernameCheckRequest(BaseModel):
    username: str

class UsernameCheckResponse(BaseModel):
    available: bool
    message: str

@router.post("/check-username", response_model=UsernameCheckResponse)
async def check_username_availability(request: UsernameCheckRequest):
    """
    Check if a username is available in the Cognito user pool
    """
    try:
        username = request.username.strip()
        
        # Basic validation
        if not username:
            return UsernameCheckResponse(
                available=False,
                message="Username is required"
            )
        
        if len(username) < 3 or len(username) > 20:
            return UsernameCheckResponse(
                available=False,
                message="Username must be 3-20 characters"
            )
        
        # Reserved usernames
        reserved_usernames = {
            'admin', 'administrator', 'moderator', 'support', 'help', 'test', 'user',
            'zocratic', 'ufc', 'mma', 'fighter', 'champion', 'manager', 'official',
            'root', 'api', 'www', 'mail', 'email', 'system', 'bot', 'staff'
        }
        
        if username.lower() in reserved_usernames:
            return UsernameCheckResponse(
                available=False,
                message="This username is reserved"
            )
        
        # Check Cognito user pool if configured and boto3 is available
        if BOTO3_AVAILABLE and COGNITO_REGION and COGNITO_USER_POOL_ID:
            try:
                cognito_client = boto3.client('cognito-idp', region_name=COGNITO_REGION)
                
                # Try to get user by username
                response = cognito_client.admin_get_user(
                    UserPoolId=COGNITO_USER_POOL_ID,
                    Username=username
                )
                
                # If we get here, user exists
                return UsernameCheckResponse(
                    available=False,
                    message="Username is already taken"
                )
                
            except ClientError as e:
                error_code = e.response['Error']['Code']
                
                if error_code == 'UserNotFoundException':
                    # User doesn't exist, username is available
                    return UsernameCheckResponse(
                        available=True,
                        message="Username is available"
                    )
                else:
                    # Other error, log it but don't block user
                    logger.error(f"Cognito error checking username: {error_code}")
                    return UsernameCheckResponse(
                        available=True,
                        message="Username appears to be available"
                    )
        else:
            # No Cognito configuration or boto3 not available, just check reserved names
            return UsernameCheckResponse(
                available=True,
                message="Username appears to be available"
            )
            
    except Exception as e:
        logger.error(f"Error checking username availability: {str(e)}")
        # On error, assume available to not block users
        return UsernameCheckResponse(
            available=True,
            message="Unable to verify availability, but username appears to be available"
        )

@router.get("/health")
async def auth_health():
    """Health check endpoint for auth routes"""
    return {"status": "healthy", "service": "auth"} 