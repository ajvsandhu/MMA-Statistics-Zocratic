from fastapi import FastAPI, Depends, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
from contextlib import asynccontextmanager
import logging
import traceback
import json
import time
from fastapi.exceptions import RequestValidationError
from starlette.responses import RedirectResponse
from typing import Callable, Any, Dict, Union
from mangum import Mangum
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.status import HTTP_503_SERVICE_UNAVAILABLE

# Added imports for new ML components and utilities
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from backend.ml_new.utils.data_loader import DataLoader
from backend.ml_new.models.trainer import UFCTrainer
from backend.ml_new.utils.advanced_features import FighterProfiler, MatchupAnalyzer
from backend.ml_new.config.settings import DATA_DIR

from backend.constants import (
    APP_TITLE, 
    APP_DESCRIPTION, 
    APP_VERSION, 
    API_V1_STR,
    CORS_ORIGINS,
    CORS_METHODS,
    CORS_HEADERS,
    CORS_CREDENTIALS,
    DEBUG_MODE
)
from backend.utils import sanitize_json
from backend.api.database import get_db_connection, test_connection
from backend.api.routes import fighters, predictions, upcoming_events, predictions_game

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

# Reduce httpx logging level to prevent URL exposure
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Removed old global predictor instance
# predictor = None

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events"""
    # Log startup
    logger.info("--- Starting UFC Fighter Prediction API ---")
    logger.info(f"Initializing {APP_TITLE} v{APP_VERSION}")
    
    # Setup ML components and database connection
    logger.info("Setting up dependencies (DB Connection & ML Components)...")
    await setup_dependencies(app) # Pass app to store state
    
    # Log startup complete
    logger.info("--- Application startup complete ---")
    
    # Add rate limiter to the application
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    yield
    
    # Cleanup on shutdown
    logger.info("--- Application shutting down... ---")

async def setup_dependencies(app: FastAPI):
    """Load ML components and test DB connection, store in app.state."""
    # Initialize state variables
    app.state.data_loader = None
    app.state.profiler = None
    app.state.analyzer = None
    app.state.trainer = None
    ml_components_loaded = False
    db_connected = False

    try:
        logger.info("--- Loading ML Components --- ")
        # 1. Load DataLoader
        logger.info("Loading DataLoader...")
        app.state.data_loader = DataLoader()
        logger.info("DataLoader loaded.")

        # 2. Load Data using DataLoader
        logger.info("Loading fighters and fights data...")
        fighters_df = app.state.data_loader.load_fighters()
        fights_df = app.state.data_loader.load_fights()
        logger.info(f"Loaded {len(fighters_df)} fighters and {len(fights_df)} fights.")
        
        # Preprocess fights_df date column (important for profiler/analyzer)
        logger.info("Preprocessing fight dates...")
        fights_df['fight_date'] = pd.to_datetime(fights_df['fight_date'], errors='coerce')
        if fights_df['fight_date'].dt.tz is None:
            fights_df['fight_date'] = fights_df['fight_date'].dt.tz_localize(timezone.utc)
        else:
            fights_df['fight_date'] = fights_df['fight_date'].dt.tz_convert(timezone.utc)
        fights_df.dropna(subset=['fight_date'], inplace=True) # Drop rows missing critical date info
        logger.info("Fight dates preprocessed.")

        # 3. Load Profiler & Analyzer
        logger.info("Initializing FighterProfiler...")
        app.state.profiler = FighterProfiler(fighters_df, fights_df)
        logger.info("FighterProfiler initialized.")
        logger.info("Initializing MatchupAnalyzer...")
        app.state.analyzer = MatchupAnalyzer(app.state.profiler, fights_df)
        logger.info("MatchupAnalyzer initialized.")

        # 4. Load Model Trainer
        logger.info("Initializing UFCTrainer...")
        app.state.trainer = UFCTrainer()
        
        # Try to load from bucket first
        try:
            logger.info("🪣 Attempting to load model from Supabase bucket...")
            model_info = app.state.trainer.load_model_from_bucket("advanced_leakproof_model")
            logger.info(f"✅ Model loaded from bucket: version {model_info['model_version']}")
            logger.info(f"📊 Training accuracy: {model_info.get('training_accuracy', 'N/A')}")
            logger.info(f"📊 Validation accuracy: {model_info.get('validation_accuracy', 'N/A')}")
            logger.info(f"📊 Test accuracy: {model_info.get('test_accuracy', 'N/A')}")
            logger.info(f"💾 File size: {model_info.get('file_size', 0) / 1024 / 1024:.2f} MB")
        except Exception as bucket_error:
            logger.warning(f"❌ Failed to load model from bucket: {str(bucket_error)}")
            logger.info("⬇️ Falling back to file-based model loading...")
            
            # Fallback to file-based loading
            try:
                model_path = os.path.join(DATA_DIR, 'advanced_leakproof_model.pkl')
                logger.info(f"Loading model from {model_path}...")
                app.state.trainer.load_model(model_path)
                logger.info("✅ Model loaded from file")
            except Exception as file_error:
                logger.error(f"❌ Failed to load model from file: {str(file_error)}")
                raise RuntimeError("Could not load model from bucket or file")
        
        logger.info("UFCTrainer initialized and model loaded.")
        if app.state.trainer.features is None:
            logger.warning("Loaded model does not contain feature names.")
        else:
            logger.info(f"Model expects {len(app.state.trainer.features)} features.")
            
        ml_components_loaded = True
        logger.info("--- ML Components Loaded Successfully ---")

    except Exception as e:
        logger.error(f"!!! Error loading ML components: {str(e)} !!!", exc_info=True)
        # Allow app to start, but predictions will fail
        ml_components_loaded = False 

    # Test database connection
    try:
        logger.info("--- Checking Database Connection --- ")
        for attempt in range(3):  # Try up to 3 times
            logger.info(f"Checking database connection attempt {attempt+1}/3...")
            if test_connection():
                logger.info("Database connection successful!")
                db_connected = True
                break
            else:
                logger.warning("Database connection check failed. Retrying...")
                time.sleep(2)  # Wait a bit before retrying
        
        if not db_connected:
            logger.error("!!! All database connection attempts failed. !!!")
    except Exception as e:
        logger.error(f"!!! Error checking database connection: {str(e)} !!!", exc_info=True)
        db_connected = False
    
    # Log dependency status
    logger.info(f"--- Dependency Status: ML Loaded = {ml_components_loaded}, DB Connected = {db_connected} ---")

# Create FastAPI app
app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    lifespan=lifespan
)

# Add CORS middleware with configured origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # Use configured origins from constants
    allow_credentials=CORS_CREDENTIALS,
    allow_methods=CORS_METHODS,
    allow_headers=CORS_HEADERS,
    expose_headers=["X-Process-Time", "X-Request-ID"],
    max_age=3600,  # 1 hour for browsers to cache CORS response
)

# Log CORS configuration
logger.info(f"CORS configured with origins: {CORS_ORIGINS}")

def sanitize_value(value: Any) -> Union[str, int, float, bool, Dict, list, None]:
    """Sanitize a single value."""
    if value is None:
        return ""
    elif isinstance(value, (int, float, bool)):
        return value
    elif isinstance(value, dict):
        return {k: sanitize_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [sanitize_value(item) for item in value if item is not None]
    else:
        # Convert to string and handle special cases
        str_value = str(value).strip()
        if str_value.lower() in ["null", "undefined", "none"]:
            return ""
        return str_value

@app.middleware("http")
async def sanitize_json_response(request: Request, call_next) -> Response:
    """Middleware to sanitize all JSON responses."""
    response = await call_next(request)
    
    # Only process JSON responses
    if response.headers.get("content-type", "").startswith("application/json"):
        try:
            # Handle different response types
            if hasattr(response, "body"):
                # Standard response with body
                body = await response.body()
                if body:
                    data = json.loads(body)
                    sanitized_data = sanitize_value(data)
                    return JSONResponse(
                        content=sanitized_data,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=response.media_type
                    )
            elif hasattr(response, "raw"):
                # Streaming response
                body = b""
                async for chunk in response.raw:
                    body += chunk
                if body:
                    data = json.loads(body)
                    sanitized_data = sanitize_value(data)
                    return JSONResponse(
                        content=sanitized_data,
                        status_code=response.status_code,
                        headers=dict(response.headers),
                        media_type=response.media_type
                    )
        except Exception as e:
            logger.error(f"Error sanitizing response: {str(e)}")
            logger.error(traceback.format_exc())
    
    return response

# Include routers
app.include_router(fighters.router)
app.include_router(predictions.router)
app.include_router(upcoming_events.router, prefix="/api/v1")

# Import and include Zobot router
from backend.api.routes import zobot
app.include_router(zobot.router)

# Import and include Odds router
from backend.api.routes import odds
app.include_router(odds.router)

# Import and include Fight Results router
from backend.api.routes import fight_results
app.include_router(fight_results.router)

# Include Predictions Game router
app.include_router(predictions_game.router)

@app.get("/")
def read_root():
    """Root endpoint that checks database connection."""
    try:
        supabase = get_db_connection()
        if supabase:
            return {"status": "ok", "message": "Database connection successful"}
        return {"status": "error", "message": "Database connection failed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health")
def health_check(request: Request): # Pass request to access app.state
    """Health check endpoint - returns status of model and database"""
    # Check ML components loaded via app.state
    model_loaded = (request.app.state.trainer is not None and 
                    request.app.state.trainer.model is not None)
    analyzer_loaded = request.app.state.analyzer is not None
    profiler_loaded = request.app.state.profiler is not None
    data_loader_loaded = request.app.state.data_loader is not None
    all_ml_loaded = model_loaded and analyzer_loaded and profiler_loaded and data_loader_loaded
    
    # Check DB
    db_connected = test_connection()
    
    response_data = {
        "status": "healthy" if all_ml_loaded and db_connected else "degraded",
        "ml_components_loaded": {
            "model": model_loaded,
            "analyzer": analyzer_loaded,
            "profiler": profiler_loaded,
            "data_loader": data_loader_loaded
        },
        "database_connected": db_connected
    }
    # Use the existing sanitize_json if needed, or return directly
    # return sanitize_json(response_data) 
    return response_data # Direct return is fine for this structure

# Add exception handlers for better error responses
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions and return a consistent error response."""
    logger.error(f"Unhandled exception: {str(exc)}")
    logger.error(traceback.format_exc())
    
    # Add request path to help with debugging
    path = request.url.path
    method = request.method
    
    response_data = {
        "detail": f"Internal server error: {str(exc)}",
        "path": path,
        "method": method,
        "type": type(exc).__name__
    }
    
    # Sanitize the response data
    sanitized_data = sanitize_json(response_data)
    
    return JSONResponse(
        status_code=500,
        content=sanitized_data
    )

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handler for Starlette HTTP exceptions."""
    logger.warning(f"HTTP exception: {exc.status_code} - {exc.detail}")
    
    # Add request path to help with debugging
    path = request.url.path
    method = request.method
    
    response_data = {
        "detail": exc.detail,
        "path": path,
        "method": method
    }
    
    # Sanitize the response data
    sanitized_data = sanitize_json(response_data)
    
    return JSONResponse(
        status_code=exc.status_code,
        content=sanitized_data
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Handle validation errors and return a clean error message."""
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=sanitize_json({"detail": str(exc)}),
    )

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
        return response

# Add custom middleware to handle database connection errors
class ConnectionErrorMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            # Check for database connection errors
            error_message = str(e).lower()
            if "connection" in error_message or "timeout" in error_message or "database" in error_message:
                logger.error(f"Database connection error: {str(e)}")
                return JSONResponse(
                    status_code=HTTP_503_SERVICE_UNAVAILABLE,
                    content={"detail": "Database connection error, please try again later"}
                )
            # Let other exceptions be handled by FastAPI
            raise

# Add security headers middleware and connection error middleware after they're defined
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(ConnectionErrorMiddleware)

# Run the API with uvicorn when script is executed directly
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)

# AWS Lambda handler
handler = Mangum(app)