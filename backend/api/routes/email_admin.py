from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
import logging
from typing import List, Optional
from backend.api.utils.auth_helper import get_admin_user_from_auth_header
from backend.api.email.services.resend_service import get_email_service
from backend.api.database import get_db_connection
import asyncio
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)
router = APIRouter()

class EmailStatsResponse(BaseModel):
    total_users: int
    email_enabled_users: int
    weekly_reminder_users: int
    marketing_email_users: int

class SendTestEmailRequest(BaseModel):
    email: str
    email_type: str = "welcome"  # welcome, weekly_reminder, test

class BulkEmailResponse(BaseModel):
    success: bool
    message: str
    total_sent: int
    failed_count: int

@router.get("/stats", response_model=EmailStatsResponse)
async def get_email_stats(admin_user: str = Depends(get_admin_user_from_auth_header)):
    """Get email statistics for admin dashboard"""
    try:
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        # Get all user settings
        result = supabase.table('user_settings').select('settings').execute()
        
        total_users = len(result.data) if result.data else 0
        email_enabled = 0
        weekly_reminders = 0
        marketing_emails = 0
        
        for user in result.data or []:
            settings = user.get('settings', {})
            if settings.get('email_notifications', False):
                email_enabled += 1
            if settings.get('weekly_reminders', False):
                weekly_reminders += 1
            if settings.get('marketing_emails', False):
                marketing_emails += 1
        
        return EmailStatsResponse(
            total_users=total_users,
            email_enabled_users=email_enabled,
            weekly_reminder_users=weekly_reminders,
            marketing_email_users=marketing_emails
        )
        
    except Exception as e:
        logger.error(f"Error getting email stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-test", response_model=dict)
async def send_test_email(
    request: SendTestEmailRequest,
    admin_user: str = Depends(get_admin_user_from_auth_header)
):
    """Send a test email to a specific address"""
    try:
        email_service = get_email_service()
        
        if request.email_type == "welcome":
            result = email_service.send_welcome_email(
                to=request.email,
                username="Test User"
            )
        elif request.email_type == "weekly_reminder":
            # Mock upcoming events for testing
            mock_events = [
                {
                    "name": "UFC 300: Test Event",
                    "date": "2025-01-15",
                    "main_event": "Fighter A vs Fighter B"
                }
            ]
            result = email_service.send_weekly_picks_reminder(
                to=request.email,
                username="Test User",
                upcoming_events=mock_events
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid email type")
        
        return {
            "success": result.get("success", False),
            "message": "Test email sent successfully" if result.get("success") else "Failed to send test email",
            "email_id": result.get("message_id")
        }
        
    except Exception as e:
        logger.error(f"Error sending test email: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-weekly-reminders", response_model=BulkEmailResponse)
async def send_weekly_reminders_manual(
    dry_run: bool = Query(False, description="If true, only count users without sending emails"),
    admin_user: str = Depends(get_admin_user_from_auth_header)
):
    """Manually trigger weekly reminder emails"""
    try:
        supabase = get_db_connection()
        if not supabase:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        # Get users with weekly reminders enabled
        result = supabase.table('user_settings')\
            .select('user_id, settings')\
            .execute()
        
        eligible_users = []
        for user in result.data or []:
            settings = user.get('settings', {})
            email = settings.get('email')
            email_notifications = settings.get('email_notifications', False)
            weekly_reminders = settings.get('weekly_reminders', False)
            
            if email and email_notifications and weekly_reminders:
                eligible_users.append({
                    'email': email,
                    'username': settings.get('preferred_username', 'Fighter')
                })
        
        if dry_run:
            return BulkEmailResponse(
                success=True,
                message=f"Dry run: Would send to {len(eligible_users)} users",
                total_sent=0,
                failed_count=0
            )
        
        # Get upcoming events
        today = datetime.now().date()
        two_weeks_later = today + timedelta(days=14)
        
        events_result = supabase.table('upcoming_events')\
            .select('id, name, date, main_event')\
            .gte('date', today.isoformat())\
            .lte('date', two_weeks_later.isoformat())\
            .order('date', desc=False)\
            .limit(5)\
            .execute()
        
        upcoming_events = events_result.data or []
        
        # Send emails
        email_service = get_email_service()
        successful_sends = 0
        failed_sends = 0
        
        for user in eligible_users:
            try:
                result = email_service.send_weekly_picks_reminder(
                    to=user['email'],
                    username=user['username'],
                    upcoming_events=upcoming_events
                )
                
                if result.get('success'):
                    successful_sends += 1
                else:
                    failed_sends += 1
                    
                # Small delay between emails
                await asyncio.sleep(0.1)
                
            except Exception as e:
                failed_sends += 1
                logger.error(f"Failed to send to {user['email']}: {str(e)}")
        
        return BulkEmailResponse(
            success=True,
            message=f"Sent weekly reminders to {successful_sends} users, {failed_sends} failed",
            total_sent=successful_sends,
            failed_count=failed_sends
        )
        
    except Exception as e:
        logger.error(f"Error sending weekly reminders: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def email_service_health():
    """Check email service health"""
    try:
        email_service = get_email_service()
        return {
            "status": "healthy",
            "service": "email",
            "resend_configured": bool(email_service.api_key)
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "email",
            "error": str(e)
        }