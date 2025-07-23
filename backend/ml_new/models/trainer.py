import os
import joblib
import numpy as np
import pandas as pd
import tempfile
import logging
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
from backend.ml_new.config.settings import DATA_DIR, RANDOM_STATE, TEST_SIZE, VAL_SIZE

logger = logging.getLogger(__name__)

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
        """Split data into train, validation, and test sets."""
        # Capture feature names from DataFrame
        if isinstance(X, pd.DataFrame):
            self.features = X.columns.tolist()
        elif self.features is None:
            raise ValueError("Feature names missing. Input X must be a pandas DataFrame.")

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
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)
        
        return X_train_scaled, X_val_scaled, X_test_scaled, y_train, y_val, y_test
    
    def train(self, X_train, y_train, X_val, y_val):
        """Train the XGBoost model with validation."""
        if self.features is None:
             raise RuntimeError("Features not set. Call prepare_data first.")
             
        self.model.fit(
            X_train, y_train,
            eval_set=[(X_train, y_train), (X_val, y_val)],
            verbose=True
        )
    
    def evaluate(self, X, y):
        """Evaluate model accuracy."""
        return self.model.score(X, y)
    
    def predict(self, X):
        """Make class predictions."""
        if isinstance(X, pd.DataFrame):
            X = X.reindex(columns=self.features, fill_value=0)
            
        X_scaled = self.scaler.transform(X)
        return self.model.predict(X_scaled)
    
    def predict_proba(self, X):
        """Make probability predictions."""
        if isinstance(X, pd.DataFrame):
            X = X.reindex(columns=self.features, fill_value=0)
             
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)
    
    def save_model_to_bucket(self, model_name: str, model_version: str, training_scores: dict = None):
        """Save model to Supabase storage bucket."""
        if self.features is None:
            raise RuntimeError("Cannot save model without feature list.")
        
        # Import here to avoid circular imports
        from backend.api.database import get_supabase_client
        
        # Prepare model data
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'features': self.features
        }
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as temp_file:
            joblib.dump(model_data, temp_file.name)
            temp_file_path = temp_file.name
        
        try:
            # Connect to database
            supabase = get_supabase_client()
            if not supabase:
                raise RuntimeError("Database connection failed")
            
            # Upload to bucket
            bucket_path = f"{model_name}/{model_version}.pkl"
            
            with open(temp_file_path, 'rb') as f:
                response = supabase.storage.from_('ml-models').upload(
                    file=f,
                    path=bucket_path,
                    file_options={"upsert": "true"}
                )
            
            # Check if upload failed (response will be None or have error attribute)
            if response is None:
                raise RuntimeError("Failed to upload model: No response from storage")
            if hasattr(response, 'error') and response.error:
                raise RuntimeError(f"Failed to upload model: {response.error}")
            
            # Get file size
            file_size = os.path.getsize(temp_file_path)
            
            # Set all existing models of this name to inactive
            supabase.table('ml_models').update({
                'is_active': False
            }).eq('model_name', model_name).execute()
            
            # Save metadata to database
            model_record = {
                'model_name': model_name,
                'model_version': model_version,
                'bucket_path': bucket_path,
                'model_type': 'xgboost',
                'features': self.features,
                'is_active': True,
                'file_size': file_size,
                'model_metadata': {
                    'feature_count': len(self.features),
                    'model_params': self.model.get_params()
                }
            }
            
            # Add training scores if provided
            if training_scores:
                model_record.update({
                    'training_accuracy': training_scores.get('train_accuracy'),
                    'validation_accuracy': training_scores.get('val_accuracy'),
                    'test_accuracy': training_scores.get('test_accuracy')
                })
            
            # Insert metadata
            db_response = supabase.table('ml_models').insert(model_record).execute()
            
            if db_response.data:
                logger.info(f"✅ Model '{model_name}' v{model_version} saved to bucket successfully")
                logger.info(f"📁 File size: {file_size / 1024 / 1024:.2f} MB")
                return db_response.data[0]['id']
            else:
                raise RuntimeError("Failed to save model metadata to database")
                
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    
    def load_latest_model_from_bucket_direct(self):
        """Load the latest model directly from bucket by listing files (fallback method)."""
        # Import here to avoid circular imports
        from backend.api.database import get_supabase_client
        
        supabase = get_supabase_client()
        if not supabase:
            raise RuntimeError("Database connection failed")
        
        try:
            # First, list all folders in the ml-models bucket
            logger.info("🔍 Listing folders in bucket...")
            response = supabase.storage.from_('ml-models').list()
            
            if not response:
                raise RuntimeError("Failed to list files in bucket")
            
            # Look for the model folder
            model_folder = None
            for item in response:
                if item.get('name') == 'advanced_leakproof_model':
                    model_folder = item['name']
                    logger.info(f"📂 Found model folder: {model_folder}")
                    break
            
            if not model_folder:
                # If no subfolder, try listing .pkl files in root
                pkl_files = [f for f in response if f.get('name', '').endswith('.pkl')]
                if pkl_files:
                    logger.info(f"📁 Found {len(pkl_files)} .pkl files in root")
                    # Sort by name in descending order (latest timestamp first)
                    pkl_files.sort(key=lambda x: x.get('name', ''), reverse=True)
                    latest_file = pkl_files[0]
                    file_path = latest_file['name']
                else:
                    raise RuntimeError("No model folder or .pkl files found in bucket")
            else:
                # List files in the model folder
                logger.info(f"🔍 Listing files in {model_folder} folder...")
                folder_response = supabase.storage.from_('ml-models').list(model_folder)
                
                if not folder_response:
                    raise RuntimeError(f"Failed to list files in {model_folder} folder")
                
                # Filter for .pkl files and sort by name (which contains timestamp)
                pkl_files = [f for f in folder_response if f.get('name', '').endswith('.pkl')]
                
                if not pkl_files:
                    raise RuntimeError(f"No .pkl model files found in {model_folder} folder")
                
                # Sort by name in descending order (latest timestamp first)
                pkl_files.sort(key=lambda x: x.get('name', ''), reverse=True)
                latest_file = pkl_files[0]
                file_path = f"{model_folder}/{latest_file['name']}"
            
            logger.info(f"📁 Found {len(pkl_files)} model files")
            logger.info(f"🎯 Latest model file: {latest_file['name']}")
            
            # Download the latest model
            logger.info(f"⬇️ Downloading model from: {file_path}")
            file_response = supabase.storage.from_('ml-models').download(file_path)
            
            if not file_response:
                raise RuntimeError(f"Failed to download model from bucket: {file_path}")
            
            # Create temporary file and load model
            with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as temp_file:
                temp_file.write(file_response)
                temp_file_path = temp_file.name
            
            try:
                # Load model data
                model_data = joblib.load(temp_file_path)
                
                # Set trainer attributes
                self.model = model_data['model']
                self.scaler = model_data['scaler']
                self.features = model_data['features']
                
                logger.info(f"✅ Latest model '{latest_file['name']}' loaded successfully from bucket")
                logger.info(f"📊 Model features: {len(self.features) if self.features else 'Unknown'}")
                
                # Get file size from metadata
                file_size = latest_file.get('metadata', {}).get('size', 0)
                if file_size > 0:
                    logger.info(f"📁 File size: {file_size / 1024 / 1024:.2f} MB")
                
                # Return file info for compatibility
                return {
                    'model_version': latest_file['name'].replace('.pkl', ''),
                    'bucket_path': file_path,
                    'file_size': file_size,
                    'updated_at': latest_file.get('updated_at'),
                    'source': 'direct_bucket_listing'
                }
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"❌ Error loading latest model from bucket: {str(e)}")
            raise
    
    def load_model_from_bucket(self, model_name: str, model_version: str = None):
        """Load model from Supabase storage bucket."""
        # Import here to avoid circular imports
        from backend.api.database import get_supabase_client
        
        supabase = get_supabase_client()
        if not supabase:
            raise RuntimeError("Database connection failed")
        
        try:
            # Build query for metadata
            query = supabase.table('ml_models').select('*').eq('model_name', model_name)
            
            if model_version:
                query = query.eq('model_version', model_version)
            else:
                # Get the active model
                query = query.eq('is_active', True)
            
            # Order by creation date (newest first)
            query = query.order('created_at', desc=True).limit(1)
            
            response = query.execute()
            
            if not response.data:
                logger.warning(f"No model found with name '{model_name}' in ml_models table" + 
                             (f" version '{model_version}'" if model_version else ""))
                logger.info("🔄 Attempting to load latest model directly from bucket...")
                return self.load_latest_model_from_bucket_direct()
            
            model_record = response.data[0]
            bucket_path = model_record['bucket_path']
            
            # Download from bucket
            file_response = supabase.storage.from_('ml-models').download(bucket_path)
            
            if not file_response:
                raise RuntimeError(f"Failed to download model from bucket: {bucket_path}")
            
            # Create temporary file and load model
            with tempfile.NamedTemporaryFile(suffix='.pkl', delete=False) as temp_file:
                temp_file.write(file_response)
                temp_file_path = temp_file.name
            
            try:
                # Load model data
                model_data = joblib.load(temp_file_path)
                
                # Set trainer attributes
                self.model = model_data['model']
                self.scaler = model_data['scaler']
                self.features = model_data['features']
                
                logger.info(f"✅ Model '{model_name}' v{model_record['model_version']} loaded from bucket")
                logger.info(f"📁 File size: {model_record['file_size'] / 1024 / 1024:.2f} MB")
                
                return model_record
                
            finally:
                # Clean up temporary file
                if os.path.exists(temp_file_path):
                    os.unlink(temp_file_path)
                
        except Exception as e:
            logger.error(f"❌ Error loading model from bucket: {str(e)}")
            # If database lookup fails, try direct bucket listing as fallback
            if "No model found with name" in str(e):
                logger.info("🔄 Attempting to load latest model directly from bucket as fallback...")
                try:
                    return self.load_latest_model_from_bucket_direct()
                except Exception as fallback_error:
                    logger.error(f"❌ Fallback method also failed: {str(fallback_error)}")
                    raise fallback_error
            else:
                raise

    def save_model(self, model_path):
        """Save model, scaler and features to disk."""
        if self.features is None:
             raise RuntimeError("Cannot save model without feature list.")
             
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'features': self.features
        }
        joblib.dump(model_data, model_path)
    
    def load_model(self, model_path):
        """Load model from disk."""
        model_data = joblib.load(model_path)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.features = model_data['features'] 