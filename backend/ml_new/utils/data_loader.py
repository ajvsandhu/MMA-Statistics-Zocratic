from typing import Dict, List, Tuple
import pandas as pd
import numpy as np
from supabase import create_client
import os
from dotenv import load_dotenv
from backend.ml_new.config.settings import SUPABASE_URL, SUPABASE_KEY, RANDOM_STATE, TEST_SIZE, VAL_SIZE
import logging
from datetime import datetime
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../../.env'))

logger = logging.getLogger(__name__)

class DataLoader:
    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.label_encoders = {}
        self.fighters_df = None
        self.fights_df = None
        
    def fetch_all_data(self, table_name):
        """Fetch all data from a table using pagination."""
        all_data = []
        count = 1000
        start = 0
        
        while count == 1000:
            data = self.supabase.table(table_name).select("*").range(start, start + 999).execute()
            count = len(data.data)
            all_data.extend(data.data)
            start += 1000
            
        return pd.DataFrame(all_data)

    def load_data(self):
        """Load and preprocess fighter and fight data."""
        print("Loading fighter data...")
        self.fighters_df = self.fetch_all_data('fighters')
        print("Loading fight data...")
        self.fights_df = self.fetch_all_data('fighter_last_5_fights')
        
        # Clean and preprocess data
        self._preprocess_fighter_data()
        self._preprocess_fight_data()
        
        # Create feature matrix and labels
        X, y = self._create_features()
        
        # Split data into train, validation, and test sets
        X_temp, X_test, y_temp, y_test = train_test_split(X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE)
        X_train, X_val, y_train, y_val = train_test_split(X_temp, y_temp, test_size=VAL_SIZE, random_state=RANDOM_STATE)
        
        return X_train, X_val, X_test, y_train, y_val, y_test

    def _preprocess_fighter_data(self):
        """Clean and preprocess fighter data."""
        # Convert height to inches
        self.fighters_df['Height'] = self.fighters_df['Height'].apply(self._convert_height_to_inches)
        
        # Convert weight to float
        self.fighters_df['Weight'] = self.fighters_df['Weight'].str.replace(' lbs.', '').astype(float)
        
        # Convert reach to float
        self.fighters_df['Reach'] = self.fighters_df['Reach'].str.replace('"', '').astype(float)
        
        # Process record
        self.fighters_df[['Wins', 'Losses', 'Draws']] = self.fighters_df['Record'].apply(self._parse_record).apply(pd.Series)
        
        # Encode categorical variables
        categorical_cols = ['Stance']
        for col in categorical_cols:
            self.label_encoders[col] = LabelEncoder()
            self.fighters_df[col] = self.label_encoders[col].fit_transform(self.fighters_df[col].fillna('Unknown'))

    def _preprocess_fight_data(self):
        """Clean and preprocess fight data."""
        # Convert percentages to floats
        percentage_cols = ['Str_Acc', 'Str_Def', 'TD_Acc', 'TD_Def']
        for col in percentage_cols:
            self.fights_df[col] = self.fights_df[col].str.rstrip('%').astype(float) / 100
            
        # Convert time-based stats to float
        self.fights_df['Avg_Fight_Time'] = self.fights_df['Avg_Fight_Time'].apply(self._convert_time_to_minutes)
        
        # Encode fight results
        self.label_encoders['Result'] = LabelEncoder()
        self.fights_df['Result'] = self.label_encoders['Result'].fit_transform(self.fights_df['Result'])

    def _create_features(self):
        """Create feature matrix for training."""
        features = []
        labels = []
        
        # Group fights by fighter
        grouped_fights = self.fights_df.groupby('fighter_name')
        
        for fighter_name, fights in grouped_fights:
            fighter_stats = self.fighters_df[self.fighters_df['fighter_name'] == fighter_name].iloc[0]
            
            # Calculate fight history features
            recent_fights = fights.head(5)
            win_rate = (recent_fights['Result'] == 1).mean()
            finish_rate = len(recent_fights[recent_fights['method'].str.contains('KO|TKO|Submission', na=False)]) / len(recent_fights)
            
            # Create feature vector
            feature_vector = [
                fighter_stats['Height'],
                fighter_stats['Weight'],
                fighter_stats['Reach'],
                fighter_stats['Wins'],
                fighter_stats['Losses'],
                fighter_stats['Draws'],
                fighter_stats['Stance'],
                fights['Str_Acc'].mean(),
                fights['Str_Def'].mean(),
                fights['TD_Acc'].mean(),
                fights['TD_Def'].mean(),
                fights['Avg_Fight_Time'].mean(),
                win_rate,
                finish_rate
            ]
            
            features.append(feature_vector)
            labels.append(1 if win_rate > 0.5 else 0)
        
        return np.array(features), np.array(labels)

    @staticmethod
    def _convert_height_to_inches(height_str):
        """Convert height string to inches."""
        try:
            feet, inches = map(int, height_str.replace('"', '').split("' "))
            return feet * 12 + inches
        except:
            return None

    @staticmethod
    def _convert_time_to_minutes(time_str):
        """Convert time string to minutes."""
        try:
            minutes, seconds = map(int, time_str.split(':'))
            return minutes + seconds / 60
        except:
            return 0

    @staticmethod
    def _parse_record(record_str):
        """Parse fighter record string into wins, losses, draws."""
        try:
            w, l, d = map(int, record_str.split('-'))
            return pd.Series([w, l, d])
        except:
            return pd.Series([0, 0, 0])

    def load_fighters(self):
        """Load and clean fighter data from database"""
        fighters_df = self.fetch_all_data("fighters")
        
        # Log column names
        logger.info(f"Fighter columns: {fighters_df.columns.tolist()}")
        
        # Convert height to inches
        fighters_df['Height'] = fighters_df['Height'].apply(self._convert_height_to_inches)
        
        # Convert weight to float
        fighters_df['Weight'] = fighters_df['Weight'].apply(self._convert_weight)
        
        # Convert reach to inches
        fighters_df['Reach'] = fighters_df['Reach'].apply(self._convert_reach)
        
        # Parse record into wins, losses, draws
        fighters_df[['wins', 'losses', 'draws']] = fighters_df['Record'].apply(self._parse_record).apply(pd.Series)
        
        # Calculate win percentage
        total_fights = fighters_df['wins'] + fighters_df['losses'] + fighters_df['draws']
        fighters_df['win_percentage'] = fighters_df['wins'] / total_fights.where(total_fights > 0, 0)
        
        # Calculate age from DOB
        fighters_df['age'] = fighters_df['DOB'].apply(self._calculate_age)
        
        # Convert percentage strings to floats
        percentage_cols = ['Str. Acc.', 'Str. Def', 'TD Acc.', 'TD Def.']
        for col in percentage_cols:
            if col in fighters_df.columns:
                fighters_df[col] = fighters_df[col].apply(self._convert_percentage)
        
        # Convert numerical columns
        numerical_cols = ['SLpM', 'SApM', 'TD Avg.', 'Sub. Avg.']
        for col in numerical_cols:
            if col in fighters_df.columns:
                fighters_df[col] = fighters_df[col].apply(self._convert_float)
        
        return fighters_df
    
    def load_fights(self):
        """Load and clean fight data from database"""
        fights_df = self.fetch_all_data("fighter_last_5_fights")
        
        # Log column names
        logger.info(f"Fight columns: {fights_df.columns.tolist()}")
        
        # Convert fight stats to numerical values
        fights_df['sig_str_landed'], fights_df['sig_str_attempted'] = zip(*fights_df['sig_str'].apply(self._parse_strike_stats))
        fights_df['total_str_landed'], fights_df['total_str_attempted'] = zip(*fights_df['total_str'].apply(self._parse_strike_stats))
        fights_df['head_str_landed'], fights_df['head_str_attempted'] = zip(*fights_df['head_str'].apply(self._parse_strike_stats))
        fights_df['body_str_landed'], fights_df['body_str_attempted'] = zip(*fights_df['body_str'].apply(self._parse_strike_stats))
        fights_df['leg_str_landed'], fights_df['leg_str_attempted'] = zip(*fights_df['leg_str'].apply(self._parse_strike_stats))
        fights_df['takedowns_landed'], fights_df['takedowns_attempted'] = zip(*fights_df['takedowns'].apply(self._parse_strike_stats))
        
        # Convert control time to seconds
        fights_df['control_time_seconds'] = fights_df['ctrl'].apply(self._convert_control_time)
        
        # Convert fight date to datetime
        fights_df['fight_date'] = pd.to_datetime(fights_df['fight_date'])
        
        return fights_df
    
    def calculate_fight_features(self, fights_df, fighter_name):
        """Extract performance metrics from a fighter's recent history"""
        fighter_fights = fights_df[fights_df['fighter_name'] == fighter_name].sort_values('fight_date', ascending=False)
        
        if len(fighter_fights) == 0:
            return pd.Series({
                'last_5_win_percentage': 0,
                'win_streak': 0,
                'loss_streak': 0,
                'avg_sig_str_landed': 0,
                'avg_sig_str_accuracy': 0,
                'avg_takedowns_landed': 0,
                'avg_takedown_accuracy': 0,
                'avg_control_time': 0,
                'finish_rate': 0
            })
        
        # Calculate win percentage in last 5 fights
        last_5_results = fighter_fights['result'].head(5)
        last_5_win_percentage = (last_5_results == 'W').mean()
        
        # Calculate current streak
        streak_results = fighter_fights['result'].values
        win_streak = 0
        loss_streak = 0
        for result in streak_results:
            if result == 'W':
                win_streak += 1
                loss_streak = 0
            else:
                loss_streak += 1
                win_streak = 0
            if win_streak > 0 or loss_streak > 0:
                break
        
        # Calculate average stats from last 5 fights
        last_5_fights = fighter_fights.head(5)
        avg_sig_str_landed = last_5_fights['sig_str_landed'].mean()
        avg_sig_str_accuracy = (last_5_fights['sig_str_landed'] / last_5_fights['sig_str_attempted']).mean()
        avg_takedowns_landed = last_5_fights['takedowns_landed'].mean()
        avg_takedown_accuracy = (last_5_fights['takedowns_landed'] / last_5_fights['takedowns_attempted']).mean()
        avg_control_time = last_5_fights['control_time_seconds'].mean()
        
        # Calculate finish rate
        finishes = last_5_fights[last_5_fights['method'].str.contains('KO|TKO|Submission', na=False)]
        finish_rate = len(finishes) / len(last_5_fights)
        
        return pd.Series({
            'last_5_win_percentage': last_5_win_percentage,
            'win_streak': win_streak,
            'loss_streak': loss_streak,
            'avg_sig_str_landed': avg_sig_str_landed,
            'avg_sig_str_accuracy': avg_sig_str_accuracy,
            'avg_takedowns_landed': avg_takedowns_landed,
            'avg_takedown_accuracy': avg_takedown_accuracy,
            'avg_control_time': avg_control_time,
            'finish_rate': finish_rate
        })
    
    def _parse_record(self, record):
        """Parse fighter record (e.g., "17-2-0") into wins, losses, draws"""
        try:
            wins, losses, draws = map(int, record.split('-'))
            return wins, losses, draws
        except:
            return 0, 0, 0
    
    def _calculate_age(self, dob_str):
        """Calculate age from DOB string"""
        try:
            dob = datetime.strptime(dob_str, '%b %d, %Y')
            today = datetime.now()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            return age
        except:
            return None
    
    def _parse_strike_stats(self, stats_str):
        """Parse strike stats (e.g., "45 of 100") into landed and attempted"""
        try:
            if pd.isna(stats_str):
                return 0, 0
            landed, attempted = map(int, stats_str.split(' of '))
            return landed, attempted
        except:
            return 0, 0
    
    def _convert_control_time(self, time_str):
        """Convert control time (e.g., "4:30") to seconds"""
        try:
            if pd.isna(time_str):
                return 0
            minutes, seconds = map(int, time_str.split(':'))
            return minutes * 60 + seconds
        except:
            return 0
    
    def _convert_weight(self, weight_str):
        """Convert weight string (e.g., "185 lbs.") to float"""
        if pd.isna(weight_str) or weight_str == 'N/A':
            return None
            
        try:
            return float(weight_str.replace(' lbs.', ''))
        except:
            return None
    
    def _convert_reach(self, reach_str):
        """Convert reach string (e.g., "72"") to float"""
        if pd.isna(reach_str) or reach_str == 'N/A':
            return None
            
        try:
            return float(reach_str.replace('"', ''))
        except:
            return None
    
    def _convert_percentage(self, value):
        """Convert percentage string to float"""
        if pd.isna(value) or value == 'N/A':
            return None
            
        try:
            return float(value.replace('%', '')) / 100
        except:
            return None
    
    def _convert_float(self, value):
        """Convert string to float"""
        if pd.isna(value) or value == 'N/A':
            return None
            
        try:
            return float(value)
        except:
            return None
    
    def clean_numerical_data(self, df: pd.DataFrame, column: str) -> pd.Series:
        """Clean numerical data by removing % and converting to float"""
        return df[column].str.replace('%', '').astype(float)
    
    def parse_record(self, record: str) -> Tuple[int, int, int]:
        """Parse fighter record into wins, losses, draws"""
        try:
            wins, losses, draws = map(int, record.split('-'))
            return wins, losses, draws
        except:
            return 0, 0, 0
    
    def extract_striking_stats(self, df: pd.DataFrame, column: str) -> Tuple[pd.Series, pd.Series, pd.Series]:
        """Extract landed, attempted, and accuracy from striking stats"""
        values = df[column].str.extract(r'(\d+) of (\d+)')
        if not values.empty:
            landed = values[0].astype(float)
            attempted = values[1].astype(float)
            accuracy = landed / attempted * 100
            return landed, attempted, accuracy
        return pd.Series(0), pd.Series(0), pd.Series(0)
    
    def prepare_fighter_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare fighter features for model training"""
        features = df.copy()
        
        # Clean numerical features
        for col in ['Strikes_Landed_per_Min', 'Strikes_Absorbed_per_Min', 'Takedowns_Average', 'Submission_Average']:
            features[col] = self.clean_numerical_data(features, col)
        
        # Parse record
        features[['wins', 'losses', 'draws']] = features['Record'].apply(
            self.parse_record
        ).apply(pd.Series)
        
        # One-hot encode stance
        features = pd.get_dummies(features, columns=['STANCE'])
        
        return features
    
    def prepare_fight_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Prepare fight features for model training"""
        features = df.copy()
        
        # Extract striking stats
        for col in ['Striking_Accuracy', 'Striking_Defense', 'Takedown_Accuracy', 'Takedown_Defense']:
            landed, attempted, accuracy = self.extract_striking_stats(features, col)
            features[f'{col}_landed'] = landed
            features[f'{col}_attempted'] = attempted
            features[f'{col}_accuracy'] = accuracy
        
        # Extract takedown stats
        landed, attempted, accuracy = self.extract_striking_stats(features, 'takedowns')
        features['td_landed'] = landed
        features['td_attempted'] = attempted
        features['td_accuracy'] = accuracy
        
        # Convert result to binary
        features['result_binary'] = (features['result'] == 'W').astype(int)
        
        return features 