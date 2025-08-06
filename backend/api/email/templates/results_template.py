from typing import List, Dict

def get_results_email_html(username: str, results: List[Dict]) -> str:
    """Generate fight results email HTML"""
    
    # Generate results HTML
    results_html = ""
    total_picks = len(results)
    correct_picks = sum(1 for r in results if r.get('correct', False))
    accuracy = (correct_picks / total_picks * 100) if total_picks > 0 else 0
    
    for result in results:
        fight_name = result.get('fight', 'Fight')
        your_pick = result.get('your_pick', 'Unknown')
        actual_winner = result.get('winner', 'Unknown')
        is_correct = result.get('correct', False)
        coins_won = result.get('coins_won', 0)
        
        status_class = "correct" if is_correct else "incorrect"
        status_icon = "✅" if is_correct else "❌"
        
        results_html += f"""
        <div class="result-card {status_class}">
            <div class="result-header">
                <h3 class="fight-name">{fight_name}</h3>
                <div class="result-status">{status_icon}</div>
            </div>
            <div class="result-details">
                <div class="pick-info">
                    <span class="label">Your Pick:</span>
                    <span class="value">{your_pick}</span>
                </div>
                <div class="pick-info">
                    <span class="label">Winner:</span>
                    <span class="value">{actual_winner}</span>
                </div>
                {f'<div class="coins-won">+{coins_won} coins</div>' if coins_won > 0 else ''}
            </div>
        </div>
        """

    return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fight Results - Zocratic MMA</title>
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
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 26px;
            font-weight: 700;
            margin-bottom: 10px;
        }}
        .content {{
            padding: 40px 30px;
        }}
        .summary-card {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            text-align: center;
            margin: 30px 0;
        }}
        .summary-stats {{
            display: flex;
            justify-content: space-around;
            margin-top: 20px;
        }}
        .stat {{
            text-align: center;
        }}
        .stat-number {{
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 5px;
        }}
        .stat-label {{
            font-size: 14px;
            opacity: 0.9;
        }}
        .result-card {{
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 15px;
            transition: all 0.3s ease;
        }}
        .result-card.correct {{
            border-color: #28a745;
            background-color: #f8fff9;
        }}
        .result-card.incorrect {{
            border-color: #dc3545;
            background-color: #fff8f8;
        }}
        .result-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }}
        .fight-name {{
            font-size: 18px;
            font-weight: 600;
            color: #2c3e50;
        }}
        .result-status {{
            font-size: 24px;
        }}
        .result-details {{
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .pick-info {{
            flex: 1;
        }}
        .label {{
            font-size: 14px;
            color: #6c757d;
            display: block;
        }}
        .value {{
            font-size: 16px;
            font-weight: 600;
            color: #2c3e50;
        }}
        .coins-won {{
            background-color: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            font-size: 14px;
        }}
        .footer {{
            background-color: #2c3e50;
            color: white;
            padding: 30px;
            text-align: center;
        }}
        @media (max-width: 600px) {{
            .summary-stats {{
                flex-direction: column;
                gap: 20px;
            }}
            .result-details {{
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏆 Fight Results Are In!</h1>
            <p>See how your predictions performed</p>
        </div>

        <div class="content">
            <div class="summary-card">
                <h2>Your Performance Summary</h2>
                <div class="summary-stats">
                    <div class="stat">
                        <div class="stat-number">{correct_picks}</div>
                        <div class="stat-label">Correct Picks</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">{total_picks}</div>
                        <div class="stat-label">Total Picks</div>
                    </div>
                    <div class="stat">
                        <div class="stat-number">{accuracy:.1f}%</div>
                        <div class="stat-label">Accuracy</div>
                    </div>
                </div>
            </div>

            <h2 style="color: #2c3e50; margin-bottom: 20px;">Detailed Results</h2>
            {results_html}

            <div style="text-align: center; margin: 40px 0;">
                <a href="https://zocraticmma.com/leaderboard" style="display: inline-block; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
                    Check Leaderboard 🏆
                </a>
            </div>
        </div>

        <div class="footer">
            <p><strong>Zocratic MMA</strong> - Track Your Prediction Success</p>
            <p>Keep improving your MMA knowledge and prediction skills!</p>
        </div>
    </div>
</body>
</html>
"""