import logging
import requests
import geoip2.database
import geoip2.errors
from typing import Dict, Optional
from fastapi import Request
import os

logger = logging.getLogger(__name__)

def get_client_ip(request: Request) -> str:
    """Extract client IP from request headers with proper forwarding support"""
    # Check for forwarded headers first (behind proxy/load balancer)
    x_forwarded_for = request.headers.get('X-Forwarded-For')
    if x_forwarded_for:
        # Take the first IP in the chain (original client)
        return x_forwarded_for.split(',')[0].strip()
    
    x_real_ip = request.headers.get('X-Real-IP')
    if x_real_ip:
        return x_real_ip.strip()
    
    # Fallback to direct connection
    return request.client.host if request.client else "127.0.0.1"

def get_geo_data_from_ip(ip_address: str) -> Dict[str, Optional[str]]:
    """
    Get geographical data from IP address using multiple methods.
    First tries MaxMind GeoLite2 database, then falls back to online service.
    """
    geo_data = {
        "ip": ip_address,
        "country": None,
        "region": None,
        "city": None,
        "latitude": None,
        "longitude": None,
        "timezone": None,
        "isp": None
    }
    
    # For local/private IPs, provide mock data for testing
    if ip_address in ['127.0.0.1', 'localhost'] or ip_address.startswith('192.168.') or ip_address.startswith('10.'):
        logger.info(f"Using mock geo data for local IP: {ip_address}")
        geo_data.update({
            "country": "United States",
            "region": "Development",
            "city": "Localhost", 
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timezone": "America/New_York",
            "isp": "Local Development"
        })
        return geo_data
    
    # Method 1: Try MaxMind GeoLite2 database (if available)
    geo_data = try_maxmind_lookup(ip_address, geo_data)
    
    # Method 2: Fallback to online service if MaxMind failed
    if not geo_data.get("country"):
        geo_data = try_online_geo_lookup(ip_address, geo_data)
    
    return geo_data

def try_maxmind_lookup(ip_address: str, geo_data: Dict) -> Dict[str, Optional[str]]:
    """Try to get geo data using MaxMind GeoLite2 database"""
    try:
        # Look for GeoLite2 database file in common locations
        db_paths = [
            '/usr/share/GeoIP/GeoLite2-City.mmdb',
            '/var/lib/GeoIP/GeoLite2-City.mmdb',
            './GeoLite2-City.mmdb',
            os.path.expanduser('~/GeoLite2-City.mmdb')
        ]
        
        db_path = None
        for path in db_paths:
            if os.path.exists(path):
                db_path = path
                break
        
        if not db_path:
            logger.debug("MaxMind GeoLite2 database not found, skipping local lookup")
            return geo_data
            
        with geoip2.database.Reader(db_path) as reader:
            response = reader.city(ip_address)
            
            geo_data.update({
                "country": response.country.name,
                "region": response.subdivisions.most_specific.name,
                "city": response.city.name,
                "latitude": float(response.location.latitude) if response.location.latitude else None,
                "longitude": float(response.location.longitude) if response.location.longitude else None,
                "timezone": response.location.time_zone
            })
            
            logger.info(f"MaxMind geo lookup successful for IP: {ip_address}")
            
    except geoip2.errors.AddressNotFoundError:
        logger.debug(f"IP {ip_address} not found in MaxMind database")
    except Exception as e:
        logger.debug(f"MaxMind lookup failed for IP {ip_address}: {str(e)}")
    
    return geo_data

def try_online_geo_lookup(ip_address: str, geo_data: Dict) -> Dict[str, Optional[str]]:
    """Fallback to online geo lookup service"""
    try:
        # Use ip-api.com as a free fallback (alternative to ipapi.co)
        response = requests.get(
            f"http://ip-api.com/json/{ip_address}",
            timeout=5,
            headers={'User-Agent': 'ZocraticMMA/1.0'}
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('status') == 'success':
                geo_data.update({
                    "country": data.get('country'),
                    "region": data.get('regionName'),
                    "city": data.get('city'),
                    "latitude": float(data.get('lat')) if data.get('lat') else None,
                    "longitude": float(data.get('lon')) if data.get('lon') else None,
                    "timezone": data.get('timezone'),
                    "isp": data.get('isp')
                })
                
                logger.info(f"Online geo lookup successful for IP: {ip_address}")
            else:
                logger.warning(f"Online geo service returned error for IP {ip_address}: {data.get('message')}")
                
    except requests.RequestException as e:
        logger.warning(f"Online geo lookup failed for IP {ip_address}: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error in online geo lookup for IP {ip_address}: {str(e)}")
    
    return geo_data

def get_request_geo_data(request: Request) -> Dict[str, Optional[str]]:
    """
    Complete function to extract IP and get geo data from a FastAPI request
    """
    client_ip = get_client_ip(request)
    geo_data = get_geo_data_from_ip(client_ip)
    
    logger.info(f"Geo data collected for IP {client_ip}: {geo_data.get('country', 'Unknown')} - {geo_data.get('city', 'Unknown')}")
    
    return geo_data