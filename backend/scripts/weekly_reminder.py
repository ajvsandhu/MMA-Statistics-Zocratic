#!/usr/bin/env python3
"""
Weekly Picks Reminder Script for Zocratic MMA
Run this script every Thursday to send weekly picks reminders to users.

Usage:
    python scripts/weekly_reminder.py

Cron example (every Thursday at 10 AM):
    0 10 * * 4 cd /path/to/zocraticmma && python backend/scripts/weekly_reminder.py
"""

import os
import sys
import logging
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(backend_dir / 'logs' / 'weekly_reminder.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

async def get_users_with_email_notifications():
    """Get all users who have email notifications enabled"""
    try:
        from backend.api.database import get_db_connection
        
        supabase = get_db_connection()
        if not supabase:
            logger.error("Failed to get database connection")
            return []
        
        # Query users with email notifications enabled
        result = supabase.table('user_settings')\
            .select('user_id, settings')\
            .execute()
        
        if not result.data:
            logger.warning("No user settings found")
            return []
        
        users_with_emails = []
        for user in result.data:
            settings = user.get('settings', {})
            
            # Check if user wants weekly reminders and email notifications
            email_notifications = settings.get('email_notifications', False)
            weekly_reminders = settings.get('weekly_reminders', False)
            email = settings.get('email')
            preferred_username = settings.get('preferred_username', 'Fighter')
            
            if email and email_notifications and weekly_reminders:
                users_with_emails.append({
                    'user_id': user['user_id'],
                    'email': email,
                    'username': preferred_username
                })
        
        logger.info(f"Found {len(users_with_emails)} users with email notifications enabled")
        return users_with_emails
        
    except Exception as e:
        logger.error(f"Error fetching users with email notifications: {str(e)}")
        return []

async def get_upcoming_events():
    """Get upcoming UFC events for the next 2 weeks"""
    try:
        from backend.api.database import get_db_connection
        
        supabase = get_db_connection()
        if not supabase:
            logger.error("Failed to get database connection")
            return []
        
        # Get events in the next 14 days
        today = datetime.now().date()
        two_weeks_later = today + timedelta(days=14)
        
        result = supabase.table('upcoming_events')\
            .select('id, name, date, main_event, location')\
            .gte('date', today.isoformat())\
            .lte('date', two_weeks_later.isoformat())\
            .order('date', desc=False)\
            .limit(5)\
            .execute()
        
        if result.data:
            logger.info(f"Found {len(result.data)} upcoming events")
            return result.data
        else:
            logger.info("No upcoming events found")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching upcoming events: {str(e)}")
        return []

async def send_weekly_reminders():
    """Send weekly reminder emails to all eligible users"""
    try:
        # Get users who want email notifications
        users = await get_users_with_email_notifications()
        if not users:
            logger.warning("No users found for weekly reminders")
            return
        
        # Get upcoming events
        upcoming_events = await get_upcoming_events()
        
        # Initialize email service
        from backend.api.email.services.resend_service import get_email_service
        email_service = get_email_service()
        
        # Send emails
        successful_sends = 0
        failed_sends = 0
        
        for user in users:
            try:
                result = await email_service.send_weekly_picks_reminder(
                    to=user['email'],
                    username=user['username'],
                    upcoming_events=upcoming_events
                )
                
                if result.get('success'):
                    successful_sends += 1
                    logger.info(f"✅ Sent weekly reminder to {user['email']}")
                else:
                    failed_sends += 1
                    logger.error(f"❌ Failed to send to {user['email']}: {result.get('error')}")
                
                # Small delay between emails to avoid rate limiting
                await asyncio.sleep(0.1)
                
            except Exception as e:
                failed_sends += 1
                logger.error(f"❌ Exception sending to {user['email']}: {str(e)}")
        
        # Log summary
        total_users = len(users)
        logger.info(f"""
📊 Weekly Reminder Summary:
   Total Users: {total_users}
   Successful Sends: {successful_sends}
   Failed Sends: {failed_sends}
   Success Rate: {(successful_sends/total_users*100):.1f}%
   Upcoming Events: {len(upcoming_events)}
""")
        
        return {
            'total_users': total_users,
            'successful_sends': successful_sends,
            'failed_sends': failed_sends,
            'upcoming_events': len(upcoming_events)
        }
        
    except Exception as e:
        logger.error(f"Error in send_weekly_reminders: {str(e)}")
        raise

async def main():
    """Main function for the weekly reminder script"""
    logger.info("🗓️ Starting weekly picks reminder job")
    
    try:
        # Check if it's Thursday (weekday 3)
        today = datetime.now()
        if today.weekday() != 3:  # 0=Monday, 3=Thursday
            logger.warning(f"Today is {today.strftime('%A')}, not Thursday. Running anyway...")
        
        # Check environment variables
        resend_key = os.getenv('RESEND_API_KEY')
        if not resend_key:
            logger.error("RESEND_API_KEY environment variable not set!")
            return False
        
        # Send reminders
        result = await send_weekly_reminders()
        
        logger.info("✅ Weekly reminder job completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"❌ Weekly reminder job failed: {str(e)}")
        return False

if __name__ == "__main__":
    # Create logs directory if it doesn't exist
    log_dir = Path(__file__).resolve().parent.parent / 'logs'
    log_dir.mkdir(exist_ok=True)
    
    # Run the main function
    success = asyncio.run(main())
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)