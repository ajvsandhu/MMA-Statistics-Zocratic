"""
Utility functions used across the application.
"""
from typing import Any, Dict, List, Union, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def parse_float(value: Any) -> float:
    """
    Safely parse a value to float.
    
    Args:
        value: Any value that might be convertible to float
        
    Returns:
        float: The parsed float value or 0.0 if parsing fails
    """
    try:
        if isinstance(value, str):
            # Remove any non-numeric characters except decimal point and negative sign
            clean_value = ''.join(c for c in value if c.isdigit() or c in '.-')
            return float(clean_value) if clean_value else 0.0
        return float(value) if value is not None else 0.0
    except (ValueError, TypeError):
        return 0.0

def parse_percentage(value: Any) -> float:
    """
    Parse a percentage string to float.
    
    Args:
        value: A string potentially containing a percentage
        
    Returns:
        float: The percentage as a float between 0 and 100
    """
    try:
        if isinstance(value, str):
            # Remove the % symbol and any whitespace
            clean_value = value.strip().rstrip('%')
            return parse_float(clean_value)
        return parse_float(value)
    except (ValueError, TypeError):
        return 0.0

def format_date(date_str: Optional[str]) -> str:
    """
    Format a date string to a consistent format.
    
    Args:
        date_str: A string representing a date
        
    Returns:
        str: Formatted date string or empty string if invalid
    """
    if not date_str:
        return ""
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        return date_obj.strftime("%B %d, %Y")
    except (ValueError, TypeError):
        return date_str if date_str else ""

def sanitize_value(value: Any) -> Any:
    """
    Sanitize a single value to prevent client-side errors.
    
    Args:
        value: Any value that needs sanitization
        
    Returns:
        Any: The sanitized value
    """
    if value is None:
        return ""
    
    if isinstance(value, (int, float)):
        return str(value)
    
    if isinstance(value, bool):
        return str(value).lower()
    
    if isinstance(value, str):
        value = value.strip()
        if value.lower() in ("null", "undefined", "none", "nan"):
            return ""
        return value
    
    if isinstance(value, (list, tuple)):
        return [sanitize_value(item) for item in value]
    
    if isinstance(value, dict):
        return {k: sanitize_value(v) for k, v in value.items()}
    
    return str(value)

def sanitize_json(data: Any) -> Any:
    """
    Recursively sanitize JSON values to prevent client-side errors.
    
    Args:
        data: Any JSON-serializable data structure
        
    Returns:
        Any: The sanitized data structure
    """
    try:
        return sanitize_value(data)
    except Exception as e:
        logger.error(f"Error sanitizing JSON: {str(e)}")
        return data

def clean_fighter_name(name: str) -> str:
    """
    Clean a fighter name by removing special characters and extra whitespace.
    
    Args:
        name: The fighter name to clean
        
    Returns:
        str: The cleaned fighter name
    """
    if not name:
        return ""
    try:
        # Remove special characters and normalize whitespace
        cleaned = ' '.join(name.split())
        return cleaned
    except Exception as e:
        logger.error(f"Error cleaning fighter name: {str(e)}")
        return name

def parse_record(record: str) -> tuple[int, int, int]:
    """
    Parse a fighter's record string into wins, losses, and draws.
    
    Args:
        record: A string in the format "W-L-D"
        
    Returns:
        tuple[int, int, int]: A tuple of (wins, losses, draws)
    """
    try:
        if not record or not isinstance(record, str):
            return (0, 0, 0)
        
        parts = record.split('-')
        if len(parts) != 3:
            return (0, 0, 0)
        
        wins = int(parts[0]) if parts[0].isdigit() else 0
        losses = int(parts[1]) if parts[1].isdigit() else 0
        draws = int(parts[2]) if parts[2].isdigit() else 0
        
        return (wins, losses, draws)
    except Exception as e:
        logger.error(f"Error parsing record: {str(e)}")
        return (0, 0, 0)

def set_parent_key(key):
    """Set the current parent key for context in nested sanitization."""
    sanitize_json.current_key = key 