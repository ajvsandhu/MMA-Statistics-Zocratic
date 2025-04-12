# UFC Fight Predictor ML Module

## Overview
This machine learning module is designed to predict the outcome of UFC fights based on fighter statistics and historical performance. It uses a Gradient Boosting classifier with calibrated probabilities, trained on fighter data from the database.

## Features Used in Prediction

The model uses the following features for prediction:

### Fighter Stats
- Significant Strikes Landed per Minute (SLpM)
- Striking Accuracy (str_acc)
- Significant Strikes Absorbed per Minute (SApM)
- Striking Defense (str_def)
- Takedown Average (td_avg)
- Takedown Accuracy (td_acc)
- Takedown Defense (td_def)
- Submission Average (sub_avg)
- Win/Loss Record
- Finish rates (KO, submission)
- Physical attributes (height, reach, weight)
- Recent performance metrics
- Fighter activity status (active vs. retired)
- Experience factors (total fights, days since last fight)
- Stylistic matchup indicators

## How It Works

1. **Data Collection**: The model pulls fighter statistics and their last 5 fights from the database.
2. **Feature Engineering**: Comprehensive features are extracted from fighter data, including status (active/retired), physical attributes, fight history, and fighting style indicators.
3. **Training**: A Gradient Boosting classifier is trained with probability calibration to ensure naturally calibrated predictions.
4. **Evaluation**: The model is evaluated using various metrics including Brier score to ensure prediction quality.
5. **Prediction**: When a prediction is requested, the model compares the stats of both fighters and predicts the winner with calibrated probability that reflects real-world odds.

## Fighter Activity Status

The model distinguishes between active and retired fighters:
- Active fighters: Competed within the last 2 years
- Retired fighters: No competition in over 2 years or explicitly marked as retired

This distinction helps the model make more accurate predictions for:
- Active vs. Active matchups
- Active vs. Retired matchups
- Retired vs. Retired matchups

## API Endpoints

- **GET /api/prediction/predict/{fighter1_name}/{fighter2_name}**: Predicts the winner between two fighters
- **GET /api/prediction/train**: Manually triggers model training/retraining
- **GET /api/prediction/status**: Returns the current status of the prediction model

## Future Improvements

The model can be further enhanced by:

1. Incorporating time-series analysis to better capture fighter evolution over time
2. Adding more detailed injury history and recovery patterns
3. Implementing fighter style clustering for better stylistic matchup analysis
4. Adding active learning capabilities to improve predictions with user feedback
5. Expanding the model to other MMA organizations beyond UFC 