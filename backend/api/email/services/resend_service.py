import os
import logging
from typing import Optional, Dict, Any, List
import resend
from datetime import datetime

logger = logging.getLogger(__name__)

class ResendEmailService:
    """Email service using Resend API for Zocratic MMA"""
    
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY")
        if not self.api_key:
            logger.error("RESEND_API_KEY environment variable not set")
            raise ValueError("RESEND_API_KEY environment variable is required")
        
        resend.api_key = self.api_key
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "noreply@zocraticmma.com")
        
        logger.info("ResendEmailService initialized successfully")
    
    async def send_email(
        self,
        to: str | List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        tags: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Send an email using Resend API"""
        try:
            # Prepare email data
            email_data = {
                "from": self.from_email,
                "to": to if isinstance(to, list) else [to],
                "subject": subject,
                "html": html_content,
            }
            
            # Add optional fields
            if text_content:
                email_data["text"] = text_content
            if reply_to:
                email_data["reply_to"] = reply_to
            if cc:
                email_data["cc"] = cc
            if bcc:
                email_data["bcc"] = bcc
            if tags:
                email_data["tags"] = tags
            
            # Send email
            response = resend.Emails.send(email_data)
            
            logger.info(f"Email sent successfully to {to}, ID: {response.get('id', 'unknown')}")
            return {
                "success": True,
                "message_id": response.get("id"),
                "response": response
            }
            
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_welcome_email(self, to: str, username: str, email_preferences: bool = True) -> Dict[str, Any]:
        """Send welcome email to new users"""
        from backend.api.email.templates.welcome_template import get_welcome_email_html
        
        html_content = get_welcome_email_html(username)
        
        tags = [
            {"name": "category", "value": "welcome"},
            {"name": "user_type", "value": "new_signup"}
        ]
        
        return await self.send_email(
            to=to,
            subject="Welcome to Zocratic MMA - Your Fight Prediction Journey Begins! 🥊",
            html_content=html_content,
            tags=tags
        )
    
    async def send_weekly_picks_reminder(self, to: str, username: str, upcoming_events: List[Dict]) -> Dict[str, Any]:
        """Send weekly Thursday reminder to place picks"""
        from backend.api.email.templates.weekly_reminder_template import get_weekly_reminder_html
        
        html_content = get_weekly_reminder_html(username, upcoming_events)
        
        tags = [
            {"name": "category", "value": "weekly_reminder"},
            {"name": "day", "value": "thursday"}
        ]
        
        return await self.send_email(
            to=to,
            subject="🥊 Weekly Picks Reminder - Don't Miss This Week's Fights!",
            html_content=html_content,
            tags=tags
        )
    
    async def send_fight_results_notification(self, to: str, username: str, results: List[Dict]) -> Dict[str, Any]:
        """Send fight results to users who placed picks"""
        from backend.api.email.templates.results_template import get_results_email_html
        
        html_content = get_results_email_html(username, results)
        
        tags = [
            {"name": "category", "value": "fight_results"},
            {"name": "notification_type", "value": "results"}
        ]
        
        return await self.send_email(
            to=to,
            subject="🏆 Fight Results - See How Your Picks Performed!",
            html_content=html_content,
            tags=tags
        )
    
    async def send_picks_deadline_reminder(self, to: str, username: str, event_name: str, hours_left: int) -> Dict[str, Any]:
        """Send deadline reminder for upcoming event"""
        from backend.api.email.templates.deadline_reminder_template import get_deadline_reminder_html
        
        html_content = get_deadline_reminder_html(username, event_name, hours_left)
        
        tags = [
            {"name": "category", "value": "deadline_reminder"},
            {"name": "urgency", "value": "high" if hours_left <= 2 else "medium"}
        ]
        
        return await self.send_email(
            to=to,
            subject=f"⏰ Last Chance - {event_name} Picks Close in {hours_left} Hours!",
            html_content=html_content,
            tags=tags
        )

# Singleton instance
email_service = None

def get_email_service() -> ResendEmailService:
    """Get singleton instance of email service"""
    global email_service
    if email_service is None:
        email_service = ResendEmailService()
    return email_service