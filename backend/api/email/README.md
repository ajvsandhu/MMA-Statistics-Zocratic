# Zocratic MMA Email System

## Overview
Complete email system using Resend for user notifications, weekly reminders, and marketing communications.

## Setup

### 1. Environment Variables
Add to your `.env` file:
```
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@zocraticmma.com
```

### 2. Install Dependencies
```bash
pip install resend
```

## Features

### ✅ Completed
- **Welcome Emails**: Automatic welcome email for new signups (if they opt-in)
- **Email Preferences**: Signup checkbox for email notifications
- **Weekly Reminders**: Thursday picks reminder system
- **Beautiful Templates**: Professional HTML email templates
- **Admin Controls**: Manual email sending and statistics

### 📧 Email Types

1. **Welcome Email** (`welcome_template.py`)
   - Sent immediately after signup confirmation
   - Features overview and welcome bonus info
   - Beautiful branded design

2. **Weekly Picks Reminder** (`weekly_reminder_template.py`)
   - Sent every Thursday (via cron)
   - Shows upcoming events and deadlines
   - Encourages user engagement

3. **Fight Results** (`results_template.py`)
   - Shows user's prediction accuracy
   - Displays coins earned
   - Ready for future implementation

4. **Deadline Reminders** (`deadline_reminder_template.py`)
   - Urgent reminders before event lockout
   - Ready for future implementation

## Usage

### Automatic Signup Emails
Users who check the email notifications box during signup will automatically receive:
- Welcome email after email confirmation
- Weekly Thursday reminders (if they keep notifications on)

### Manual Operations

#### Weekly Reminder Script
```bash
# Run manually
python backend/scripts/weekly_reminder.py

# Add to crontab for automatic Thursday reminders
0 10 * * 4 cd /path/to/zocraticmma && python backend/scripts/weekly_reminder.py
```

#### Admin API Endpoints
- `GET /api/v1/email-admin/stats` - Email statistics
- `POST /api/v1/email-admin/send-test` - Send test emails
- `POST /api/v1/email-admin/send-weekly-reminders` - Manual weekly reminders
- `GET /api/v1/email-admin/health` - Service health check

### Test Email Example
```bash
curl -X POST "http://localhost:8000/api/v1/email-admin/send-test" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "email_type": "welcome"}'
```

## File Structure
```
backend/api/email/
├── __init__.py
├── README.md
├── services/
│   ├── __init__.py
│   └── resend_service.py      # Main email service
├── templates/
│   ├── __init__.py
│   ├── welcome_template.py           # Welcome email
│   ├── weekly_reminder_template.py   # Thursday reminders  
│   ├── results_template.py          # Fight results
│   └── deadline_reminder_template.py # Deadline alerts
└── scripts/
    └── weekly_reminder.py     # Cron script for weekly emails
```

## User Email Preferences

Users can control email notifications through these settings (stored in `user_settings.settings`):

- `email_notifications`: Master email toggle
- `weekly_reminders`: Thursday picks reminders
- `marketing_emails`: Promotional content
- `notifications_enabled`: App notifications

## Cron Setup

For automated Thursday reminders, add to your server's crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs every Thursday at 10 AM)
0 10 * * 4 cd /path/to/your/zocraticmma && /usr/bin/python3 backend/scripts/weekly_reminder.py >> /var/log/zocratic_email.log 2>&1

# For different times:
# 0 9 * * 4   # 9 AM Thursday
# 30 14 * * 4 # 2:30 PM Thursday
```

## Email Analytics

The system tracks:
- Total users with email enabled
- Weekly reminder subscribers
- Email send success/failure rates
- User engagement preferences

## Future Enhancements

- **Fight Results**: Automatic post-event result emails
- **Deadline Reminders**: Pre-event cutoff notifications  
- **Email Templates**: More event-specific templates
- **Analytics Dashboard**: Email performance metrics
- **A/B Testing**: Template optimization
- **Segmentation**: User-based email targeting

## Troubleshooting

### Common Issues

1. **Emails not sending**
   - Check `RESEND_API_KEY` environment variable
   - Verify Resend account status
   - Check logs in `backend/logs/weekly_reminder.log`

2. **Users not receiving emails**
   - Verify user has `email_notifications: true` in settings
   - Check spam folders
   - Confirm email address is valid

3. **Cron job not running**
   - Check cron service is running: `sudo service cron status`
   - Verify file permissions: `chmod +x backend/scripts/weekly_reminder.py`
   - Check cron logs: `sudo tail -f /var/log/cron`

### Logs
- Weekly reminder: `backend/logs/weekly_reminder.log`
- API logs: Check your main application logs
- Resend dashboard: Monitor delivery in Resend console