#!/usr/bin/env python3
"""
Quick script to check UFC automation system status
"""
import sys
import os
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.api.database import get_supabase_client
    supabase = get_supabase_client()
    
    print("🏟️  UFC AUTOMATION SYSTEM STATUS")
    print("=" * 50)
    
    # Check active events
    response = supabase.table('upcoming_events').select('*').eq('is_active', True).execute()
    active_events = response.data
    
    if active_events:
        event = active_events[0]
        print(f"✅ Active Event: {event['event_name']}")
        print(f"📅 Date: {event['event_date']}")
        print(f"📊 Status: {event['status']}")
        print(f"🥊 Fights: {event.get('completed_fights', 0)}/{event.get('total_fights', 0)}")
        print(f"🕐 Last Update: {event.get('results_updated_at', 'Never')}")
        print(f"🔗 URL: {event['event_url']}")
    else:
        print("⚠️  No active events found")
    
    print("\n📋 RECENT ACTIVITY")
    print("-" * 30)
    
    # Check recent events (last 5)
    recent_response = supabase.table('upcoming_events').select('*').order('scraped_at', desc=True).limit(5).execute()
    recent_events = recent_response.data
    
    for i, event in enumerate(recent_events, 1):
        status_icon = "🟢" if event['is_active'] else "🔴"
        print(f"{i}. {status_icon} {event['event_name']} ({event['status']})")
        print(f"   Scraped: {event['scraped_at']}")
    
    print(f"\n📈 TOTAL EVENTS IN DATABASE: {len(recent_events)}")
    
    # Check if storage bucket has historical events
    try:
        bucket_response = supabase.storage.from_('fight-events').list()
        if bucket_response:
            print(f"📦 HISTORICAL EVENTS IN BUCKET: {len(bucket_response)}")
        else:
            print("📦 No historical events in bucket yet")
    except Exception as e:
        print(f"📦 Could not check bucket: {e}")
    
    print("\n✅ Database connection working!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1) 