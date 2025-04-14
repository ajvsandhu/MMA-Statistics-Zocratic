import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from backend.ml_new.config.settings import DATA_DIR, RANDOM_STATE, TEST_SIZE, VAL_SIZE

class UFCTrainer:
    def __init__(self):
        self.model = XGBClassifier(
            n_estimators=100,
            learning_rate=0.1,
            max_depth=5,
            random_state=RANDOM_STATE,
            use_label_encoder=False,
            eval_metric='logloss'
        )
        self.scaler = StandardScaler()
        self.features = None # Initialize features attribute
        
    def prepare_data(self, X, y):
        """
        Split data into train, validation, and test sets.
        Also captures feature names before scaling.
        """
        # Capture feature names before splitting/scaling if X is a DataFrame
        if isinstance(X, pd.DataFrame):
            self.features = X.columns.tolist()
        elif self.features is None:
            # If X is not a DataFrame and features haven't been set, log a warning or error
            # For now, assume features might be set elsewhere or raise an error
            raise ValueError("Feature names could not be determined. Input X must be a pandas DataFrame initially.")

        # First split into temp and test
        X_temp, X_test, y_temp, y_test = train_test_split(
            X, y,
            test_size=TEST_SIZE,
            random_state=RANDOM_STATE
        )
        
        # Split temp into train and validation
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp,
            test_size=VAL_SIZE,
            random_state=RANDOM_STATE
        )
        
        # Scale the features
        # Note: fit_transform requires numpy array, features must be captured before this
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)
        
        return X_train_scaled, X_val_scaled, X_test_scaled, y_train, y_val, y_test
    
    def train(self, X_train, y_train, X_val, y_val):
        """
        Train the model. Assumes X_train is already scaled.
        """
        # Feature names should have been captured in prepare_data
        if self.features is None:
             raise RuntimeError("Features not set. Call prepare_data first or ensure X input to prepare_data was a DataFrame.")
             
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_train, y_train), (X_val, y_val)],
            verbose=True
        )
    
    def evaluate(self, X, y):
        """
        Evaluate the model
        """
        return self.model.score(X, y)
    
    def predict(self, X):
        """
        Make predictions
        """
        # Ensure X is a DataFrame with correct columns before scaling
        if isinstance(X, pd.DataFrame):
            X = X.reindex(columns=self.features, fill_value=0)
        else: # Assume X is numpy array already in correct order 
            pass 
            
        X_scaled = self.scaler.transform(X)
        return self.model.predict(X_scaled) # Changed predict_proba to predict
    
    def predict_proba(self, X):
        """
        Make probability predictions
        """
        # Ensure X is a DataFrame with correct columns before scaling
        if isinstance(X, pd.DataFrame):
            X = X.reindex(columns=self.features, fill_value=0)
        else: # Assume X is numpy array already in correct order
             pass
             
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)
    
    def save_model(self, model_path):
        """
        Save the model, scaler, and feature list
        """
        if self.features is None:
             raise RuntimeError("Cannot save model without feature list. Train the model first.")
             
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        # Save model, scaler, and features
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'features': self.features # Add features to save
        }
        joblib.dump(model_data, model_path)
    
    def load_model(self, model_path):
        """
        Load the model, scaler, and feature list
        """
        model_data = joblib.load(model_path)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.features = model_data['features'] # Load features 