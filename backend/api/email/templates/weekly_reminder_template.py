from typing import List, Dict

def get_weekly_reminder_html(username: str, upcoming_events: List[Dict]) -> str:
    """Generate weekly Thursday picks reminder email HTML"""
    
    # Generate events HTML
    events_html = ""
    if upcoming_events:
        for event in upcoming_events[:3]:  # Show max 3 upcoming events
            event_date = event.get('date', 'TBD')
            event_name = event.get('name', 'UFC Event')
            main_event = event.get('main_event', 'Main Event TBD')
            
            events_html += f"""
            <div class="event-card">
                <div class="event-header">
                    <h3 class="event-name">{event_name}</h3>
                    <div class="event-date">📅 {event_date}</div>
                </div>
                <div class="main-event">
                    <strong>Main Event:</strong> {main_event}
                </div>
                <div class="event-actions">
                    <a href="https://zocraticmma.com/fight-predictions/events" class="event-button">
                        Make Predictions 🎯
                    </a>
                </div>
            </div>
            """
    else:
        events_html = """
        <div class="no-events">
            <p>No upcoming events this week, but check back soon for new fights to predict!</p>
        </div>
        """

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Picks Reminder - Zocratic MMA</title>
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
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 10px;
        }}
        .header p {{
            font-size: 16px;
            opacity: 0.95;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .greeting {{
            font-size: 18px;
            margin-bottom: 25px;
            color: #2c3e50;
        }}
        .reminder-box {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            margin: 30px 0;
        }}
        .reminder-box h2 {{
            font-size: 24px;
            margin-bottom: 15px;
        }}
        .reminder-box p {{
            font-size: 16px;
            opacity: 0.95;
        }}
        .events-section {{
            margin: 40px 0;
        }}
        .section-title {{
            font-size: 22px;
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 25px;
            text-align: center;
        }}
        .event-card {{
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            background-color: #ffffff;
            transition: all 0.3s ease;
        }}
        .event-card:hover {{
            border-color: #ff6b35;
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
        }}
        .event-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }}
        .event-name {{
            font-size: 20px;
            font-weight: 600;
            color: #2c3e50;
            margin: 0;
        }}
        .event-date {{
            background-color: #ff6b35;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }}
        .main-event {{
            margin-bottom: 20px;
            color: #495057;
            font-size: 16px;
        }}
        .event-actions {{
            text-align: center;
        }}
        .event-button {{
            display: inline-block;
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            transition: transform 0.2s ease;
        }}
        .event-button:hover {{
            transform: translateY(-2px);
        }}
        .no-events {{
            text-align: center;
            padding: 40px 20px;
            color: #6c757d;
            font-style: italic;
        }}
        .cta-section {{
            background-color: #f8f9fa;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            margin: 40px 0;
        }}
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 18px 36px;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            font-size: 18px;
            transition: transform 0.2s ease;
            margin-top: 15px;
        }}
        .cta-button:hover {{
            transform: translateY(-2px);
        }}
        .stats-section {{
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
            padding: 25px;
            background-color: #f8f9fa;
            border-radius: 12px;
        }}
        .stat-item {{
            text-align: center;
        }}
        .stat-number {{
            font-size: 24px;
            font-weight: 700;
            color: #ff6b35;
        }}
        .stat-label {{
            font-size: 14px;
            color: #6c757d;
            margin-top: 5px;
        }}
        .footer {{
            background-color: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .footer p {{
            margin-bottom: 10px;
            opacity: 0.8;
        }}
        @media (max-width: 600px) {{
            .container {{
                margin: 0;
                border-radius: 0;
            }}
            .header, .content, .footer {{
                padding: 25px 20px;
            }}
            .event-header {{
                flex-direction: column;
                align-items: flex-start;
            }}
            .event-date {{
                margin-top: 10px;
            }}
            .stats-section {{
                flex-direction: column;
                gap: 20px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🗓️ Thursday Picks Reminder</h1>
            <p>Don't miss out on this week's fight predictions!</p>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                <strong>Hey {username}!</strong> 👋
                <br><br>
                It's Thursday, which means it's time to make your weekly fight predictions! Check out the upcoming events and place your picks before the deadlines.
            </div>

            <div class="reminder-box">
                <h2>⏰ Weekly Reminder</h2>
                <p>Your predictions help you climb the leaderboard and earn valuable coins. Don't let this week slip by without making your picks!</p>
            </div>

            <!-- Upcoming Events -->
            <div class="events-section">
                <h2 class="section-title">🥊 Upcoming Events</h2>
                {events_html}
            </div>

            <!-- Stats Section -->
            <div class="stats-section">
                <div class="stat-item">
                    <div class="stat-number">🏆</div>
                    <div class="stat-label">Climb the<br>Leaderboard</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">💰</div>
                    <div class="stat-label">Earn<br>Coins</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">🎯</div>
                    <div class="stat-label">Improve Your<br>Accuracy</div>
                </div>
            </div>

            <!-- Call to Action -->
            <div class="cta-section">
                <h3 style="color: #2c3e50; margin-bottom: 15px;">Ready to Make Your Picks?</h3>
                <p style="color: #6c757d; margin-bottom: 20px;">
                    Join thousands of MMA fans who trust their instincts and knowledge every week!
                </p>
                <a href="https://zocraticmma.com/fight-predictions" class="cta-button">
                    View All Upcoming Fights 🚀
                </a>
            </div>

            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h4 style="color: #0c5460; margin-bottom: 10px;">💡 Pro Tips for Better Predictions</h4>
                <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
                    <li>Check fighter stats and recent performance</li>
                    <li>Consider fighting styles and matchup advantages</li>
                    <li>Use our AI insights for additional analysis</li>
                    <li>Don't forget to set prediction amounts wisely</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>Zocratic MMA</strong> - Your Weekly Fight Prediction Hub</p>
            <p>We send these reminders every Thursday to keep you in the game!</p>
            
            <p style="margin-top: 20px; font-size: 12px; opacity: 0.6;">
                Don't want weekly reminders? <a href="https://zocraticmma.com/settings" style="color: white;">Update your email preferences</a>
            </p>
        </div>
    </div>
</body>
</html>
"""