def get_welcome_email_html(username: str) -> str:
    """Generate welcome email HTML for new users"""
    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Zocratic MMA</title>
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
            padding: 0;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 28px;
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
        .welcome-message {{
            font-size: 18px;
            margin-bottom: 30px;
            color: #2c3e50;
        }}
        .features {{
            margin: 30px 0;
        }}
        .feature {{
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #d32f2f;
        }}
        .feature-icon {{
            font-size: 24px;
            margin-right: 15px;
            width: 40px;
            text-align: center;
        }}
        .feature-text {{
            flex: 1;
        }}
        .feature-title {{
            font-weight: 600;
            color: #2c3e50;
            margin-bottom: 5px;
        }}
        .feature-desc {{
            color: #6c757d;
            font-size: 14px;
        }}
        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #d32f2f 0%, #f44336 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s ease;
        }}
        .cta-button:hover {{
            transform: translateY(-2px);
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
        .social-links {{
            margin-top: 20px;
        }}
        .social-links a {{
            color: white;
            text-decoration: none;
            margin: 0 10px;
            opacity: 0.8;
        }}
        .social-links a:hover {{
            opacity: 1;
        }}
        @media (max-width: 600px) {{
            .container {{
                margin: 0;
                border-radius: 0;
            }}
            .header, .content, .footer {{
                padding: 25px 20px;
            }}
            .feature {{
                flex-direction: column;
                text-align: center;
            }}
            .feature-icon {{
                margin-bottom: 10px;
                margin-right: 0;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>🥊 Welcome to Zocratic MMA!</h1>
            <p>Your ultimate MMA prediction platform</p>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="welcome-message">
                <strong>Hey {username}!</strong> 👋
                <br><br>
                Welcome to the most exciting MMA prediction community! You've just joined thousands of fight fans who love to test their MMA knowledge and compete for glory.
            </div>

            <div class="features">
                <div class="feature">
                    <div class="feature-icon">🎯</div>
                    <div class="feature-text">
                        <div class="feature-title">Smart Predictions</div>
                        <div class="feature-desc">Use our AI-powered insights to make informed picks on upcoming fights</div>
                    </div>
                </div>

                <div class="feature">
                    <div class="feature-icon">🏆</div>
                    <div class="feature-text">
                        <div class="feature-title">Compete & Win</div>
                        <div class="feature-desc">Climb the leaderboard and earn coins for accurate predictions</div>
                    </div>
                </div>

                <div class="feature">
                    <div class="feature-icon">📊</div>
                    <div class="feature-text">
                        <div class="feature-title">Fighter Analytics</div>
                        <div class="feature-desc">Deep dive into fighter stats, records, and performance metrics</div>
                    </div>
                </div>

                <div class="feature">
                    <div class="feature-icon">🤖</div>
                    <div class="feature-text">
                        <div class="feature-title">Zobot AI Assistant</div>
                        <div class="feature-desc">Chat with our AI for fight analysis and predictions</div>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin: 40px 0;">
                <a href="https://zocraticmma.com/fight-predictions" class="cta-button">
                    Start Making Predictions 🚀
                </a>
            </div>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <h3 style="color: #856404; margin-bottom: 10px;">🎁 Welcome Bonus!</h3>
                <p style="color: #856404; margin: 0;">You've received <strong>100 free coins</strong> to start making predictions. Use them wisely!</p>
            </div>

            <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                <strong>Pro Tip:</strong> Check back every Thursday for our weekly picks reminder email. We'll keep you updated on all the upcoming fights so you never miss a prediction opportunity!
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p><strong>Zocratic MMA</strong> - Where MMA Knowledge Meets Prediction Mastery</p>
            <p>Follow us for the latest updates and fight insights</p>
            
            <div class="social-links">
                <a href="https://twitter.com/zocraticmma">Twitter</a>
                <a href="https://zocraticmma.com">Website</a>
                <a href="https://zocraticmma.com/contact">Contact</a>
            </div>
            
            <p style="margin-top: 20px; font-size: 12px; opacity: 0.6;">
                You're receiving this email because you signed up for Zocratic MMA.<br>
                <a href="https://zocraticmma.com/settings" style="color: white;">Manage email preferences</a>
            </p>
        </div>
    </div>
</body>
</html>
"""