def get_deadline_reminder_html(username: str, event_name: str, hours_left: int) -> str:
    """Generate deadline reminder email HTML"""
    
    urgency_color = "#dc3545" if hours_left <= 2 else "#ff6b35"
    urgency_text = "URGENT" if hours_left <= 2 else "REMINDER"
    
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Picks Deadline Reminder - Zocratic MMA</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8f9fa;
        }}
        .container {{
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, {urgency_color} 0%, #f7931e 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .urgent-badge {{
            background-color: rgba(255, 255, 255, 0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 1px;
            margin-bottom: 15px;
            display: inline-block;
        }}
        .countdown {{
            background-color: rgba(255, 255, 255, 0.15);
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
        }}
        .countdown-number {{
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 5px;
        }}
        .countdown-label {{
            font-size: 16px;
            opacity: 0.9;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, {urgency_color} 0%, #f7931e 100%);
            color: white;
            padding: 18px 36px;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 18px;
            transition: transform 0.2s ease;
            animation: pulse 2s infinite;
        }}
        @keyframes pulse {{
            0% {{ transform: scale(1); }}
            50% {{ transform: scale(1.05); }}
            100% {{ transform: scale(1); }}
        }}
        .event-info {{
            background-color: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            margin: 30px 0;
            border-left: 4px solid {urgency_color};
        }}
        .footer {{
            background-color: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="urgent-badge">{urgency_text}</div>
            <h1>⏰ Picks Deadline Approaching!</h1>
            <div class="countdown">
                <div class="countdown-number">{hours_left}</div>
                <div class="countdown-label">Hours Left</div>
            </div>
        </div>

        <div class="content">
            <p style="font-size: 18px; margin-bottom: 25px;">
                <strong>Hey {username}!</strong> 👋
            </p>
            
            <div class="event-info">
                <h2 style="color: #2c3e50; margin-bottom: 15px;">{event_name}</h2>
                <p style="color: #6c757d;">
                    The prediction window closes in <strong style="color: {urgency_color};">{hours_left} hours</strong>! 
                    Don't miss your chance to make picks and earn coins.
                </p>
            </div>

            <div style="text-align: center; margin: 40px 0;">
                <p style="font-size: 16px; margin-bottom: 20px; color: #2c3e50;">
                    {'⚡ Last chance to get your predictions in!' if hours_left <= 2 else '🎯 Make your predictions now!'}
                </p>
                <a href="https://zocraticmma.com/fight-predictions/events" class="cta-button">
                    Place Your Picks Now! 🚀
                </a>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #856404; margin-bottom: 10px;">⚠️ Important Reminder</h3>
                <p style="color: #856404; margin: 0;">
                    Predictions lock when the first fight starts. Make sure to submit all your picks before the deadline!
                </p>
            </div>
        </div>

        <div class="footer">
            <p><strong>Zocratic MMA</strong> - Never Miss a Prediction Opportunity</p>
        </div>
    </div>
</body>
</html>
"""