from fastapi import APIRouter, HTTPException, status, Depends, Request
from pydantic import BaseModel
import os
import logging
from typing import Dict, Any
from datetime import datetime
from backend.api.database import get_db_connection
from backend.api.utils.auth_helper import get_user_id_from_auth_header
from backend.api.utils.geo_utils import get_request_geo_data

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

class PostSignupRequest(BaseModel):
    user_id: str
    email: str
    preferred_username: str = ""
    accepted_tos: bool = False
    email_notifications: bool = True

class PostSignupResponse(BaseModel):
    success: bool
    message: str
    group_added: bool = False
    settings_created: bool = False
    coin_wallet_created: bool = False

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

@router.post("/post-signup", response_model=PostSignupResponse)
async def handle_post_signup(
    signup_request: PostSignupRequest,
    request: Request,
    user_id: str = Depends(get_user_id_from_auth_header)
):
    """
    Handle post-signup operations: add user to Cognito group and create user settings.
    This replaces the AWS Lambda post-confirmation trigger.
    """
    logger.info(f"POST-SIGNUP ENDPOINT CALLED for user: {user_id}")
    logger.info(f"Request data: email={signup_request.email}, accepted_tos={signup_request.accepted_tos}")
    
    group_added = False
    settings_created = False
    coin_wallet_created = False
    errors = []
    
    # Verify the user_id from token matches the request
    if user_id != signup_request.user_id:
        raise HTTPException(
            status_code=403, 
            detail="User ID in token doesn't match request"
        )
    
    # Get IP and geo data from the request
    geo_data = get_request_geo_data(request)
    tos_accepted_at = datetime.utcnow().isoformat() if signup_request.accepted_tos else None
    
    logger.info(f"Geo data collected: {geo_data}")
    logger.info(f"TOS accepted at: {tos_accepted_at}")
    
    # 1. Add user to Cognito group
    if BOTO3_AVAILABLE and COGNITO_REGION and COGNITO_USER_POOL_ID:
        try:
            cognito_client = boto3.client('cognito-idp', region_name=COGNITO_REGION)
            default_group = os.getenv("DEFAULT_GROUP", "general-users")
            
            # Get username from email (Cognito uses email as username in many cases)
            username = signup_request.email
            
            cognito_client.admin_add_user_to_group(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=username,
                GroupName=default_group
            )
            
            group_added = True
            logger.info(f"Added user {username} to group '{default_group}'")
            
        except ClientError as e:
            error_msg = f"Failed to add user to Cognito group: {e.response['Error']['Message']}"
            logger.error(error_msg)
            errors.append(error_msg)
        except Exception as e:
            error_msg = f"Unexpected error adding user to group: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)
    else:
        errors.append("Cognito configuration not available")
    
    # 2. Create user settings in Supabase
    try:
        supabase = get_db_connection()
        if supabase:
            # Create comprehensive settings similar to Lambda trigger but with more data
            default_settings = {
                "email": signup_request.email,
                "notifications": signup_request.email_notifications,
                "email_notifications": signup_request.email_notifications,
                "preferred_username": signup_request.preferred_username,
                "created_via": "post_signup_api", 
                "registration_source": "cognito_api_endpoint",
                "cognito_region": COGNITO_REGION,
                "cognito_username": user_id,  # Store the Cognito user ID
                "last_login": tos_accepted_at,  # Set initial login time
                "account_created_at": tos_accepted_at,
                "user_agent": request.headers.get("User-Agent", "Unknown"),
                "signup_ip": geo_data.get("ip"),
                "signup_country": geo_data.get("country"),
                "signup_city": geo_data.get("city"),
                "accepted_tos": signup_request.accepted_tos,
                "tos_accepted_at": tos_accepted_at,
                "tos_accepted_ip": geo_data.get("ip"),
                "tos_location_data": {
                    "country": geo_data.get("country"),
                    "region": geo_data.get("region"),  
                    "city": geo_data.get("city"),
                    "latitude": geo_data.get("latitude"),
                    "longitude": geo_data.get("longitude"),
                    "timezone": geo_data.get("timezone"),
                    "isp": geo_data.get("isp")
                },
                # Add some additional useful fields
                "account_status": "active",
                "email_verified": True,  # Since they went through confirmation
                "profile_complete": False,  # They haven't filled out profile yet
                "marketing_emails": signup_request.email_notifications,  # Use their preference
                "weekly_reminders": signup_request.email_notifications,  # Enable weekly picks reminders if they want emails
                "feature_flags": {
                    "beta_features": False,
                    "premium_trial": True,  # Give new users premium trial
                    "notifications_enabled": signup_request.email_notifications
                }
            }
            
            # Store data in both settings and direct columns
            user_data = {
                "user_id": user_id, 
                "settings": default_settings,
                "tos_accepted_at": tos_accepted_at,
                "tos_accepted_ip": geo_data.get("ip"),
                "tos_location_data": default_settings["tos_location_data"]
            }
            
            logger.info(f"Storing user data: {user_data}")
            logger.info(f"Settings object: {default_settings}")
            
            result = supabase.table('user_settings').upsert(
                user_data, 
                on_conflict='user_id'
            ).execute()
            
            if result.data:
                settings_created = True
                logger.info(f"Created user_settings for user {user_id}")
                
                # Create coin wallet for new user
                try:
                    coin_wallet_result = supabase.table('coin_accounts').insert({
                        'user_id': user_id,
                        'balance': 1000,
                        'total_wagered': 0,
                        'total_won': 0,
                        'total_lost': 0
                    }).execute()
                    
                    if coin_wallet_result.data:
                        logger.info(f"Created coin wallet for user {user_id}")
                        coin_wallet_created = True
                    else:
                        logger.warning(f"Coin wallet creation returned no data for user {user_id}")
                        
                except Exception as e:
                    logger.warning(f"Coin wallet might already exist for user {user_id}: {str(e)}")
                
                # Send welcome email if user opted in for notifications
                if signup_request.email_notifications:
                    try:
                        from backend.api.email.services.resend_service import get_email_service
                        email_service = get_email_service()
                        
                        # Send welcome email asynchronously
                        import asyncio
                        asyncio.create_task(email_service.send_welcome_email(
                            to=signup_request.email,
                            username=signup_request.preferred_username,
                            email_preferences=signup_request.email_notifications
                        ))
                        
                        logger.info(f"Welcome email queued for {signup_request.email}")
                    except Exception as e:
                        logger.error(f"Failed to send welcome email to {signup_request.email}: {str(e)}")
                        # Don't fail the signup process if email fails
                        
            else:
                errors.append("Failed to create user settings - no data returned")
        else:
            errors.append("Database connection not available")
            
    except Exception as e:
        error_msg = f"Failed to create user settings: {str(e)}"
        logger.error(error_msg)
        errors.append(error_msg)
    
    # Determine overall success
    success = group_added and settings_created and coin_wallet_created
    message = "Post-signup processing completed successfully"
    
    if errors:
        message = f"Post-signup completed with errors: {'; '.join(errors)}"
    
    logger.info(f"Post-signup result for user {user_id}: success={success}, group_added={group_added}, settings_created={settings_created}, coin_wallet_created={coin_wallet_created}")
    logger.info(f"Final message: {message}")
    
    return PostSignupResponse(
        success=success,
        message=message,
        group_added=group_added,
        settings_created=settings_created,
        coin_wallet_created=coin_wallet_created
    )

@router.get("/health")
async def auth_health():
    """Health check endpoint for auth routes"""
    return {"status": "healthy", "service": "auth"} 