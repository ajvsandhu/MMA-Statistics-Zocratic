#!/usr/bin/env python3

import requests
import json
import sys
import os
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"  # Adjust if your backend runs on a different port
API_BASE = f"{BASE_URL}/api/v1"

# Test data from current active event
EVENT_ID = 5
FIGHT_ID = "fight_1"
FIGHTER1_ID = 8618
FIGHTER2_ID = 7669
FIGHTER1_NAME = "Robert Whittaker"
FIGHTER2_NAME = "Reinier de Ridder"
FIGHTER1_ODDS = -155
FIGHTER2_ODDS = 130

# Mock user ID for testing (in production this comes from Cognito JWT)
# You'll need to replace this with a real user ID from your Cognito setup
TEST_USER_ID = "2a667fe1-0820-475a-9305-3ae81b3ea3d7"

def test_headers():
    """Return headers with mock authorization"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer mock-jwt-token",
        "X-User-ID": TEST_USER_ID  # Using the simple auth method for testing
    }

def print_response(response, endpoint_name):
    """Pretty print response"""
    print(f"\n{'='*60}")
    print(f"Testing: {endpoint_name}")
    print(f"Status Code: {response.status_code}")
    print(f"Response:")
    try:
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)
    print(f"{'='*60}")

def test_health_check():
    """Test the predictions game health endpoint"""
    url = f"{API_BASE}/predictions-game/health"
    response = requests.get(url)
    print_response(response, "Health Check")
    return response.status_code == 200

def test_get_balance():
    """Test getting user's coin balance"""
    url = f"{API_BASE}/predictions-game/balance"
    response = requests.get(url, headers=test_headers())
    print_response(response, "Get Coin Balance")
    
    if response.status_code == 200:
        data = response.json()
        print(f"User Balance: {data.get('balance', 'N/A')} coins")
        return True
    return False

def test_place_pick():
    """Test placing a prediction pick"""
    url = f"{API_BASE}/predictions-game/place-pick"
    
    # Test placing a pick on fighter 1
    pick_data = {
        "event_id": EVENT_ID,
        "fight_id": FIGHT_ID,
        "fighter_id": FIGHTER1_ID,
        "fighter_name": FIGHTER1_NAME,
        "stake": 100,  # Betting 100 coins
        "odds_american": FIGHTER1_ODDS
    }
    
    response = requests.post(url, json=pick_data, headers=test_headers())
    print_response(response, f"Place Pick on {FIGHTER1_NAME}")
    
    return response.status_code == 200

def test_get_my_picks():
    """Test getting user's picks"""
    url = f"{API_BASE}/predictions-game/my-picks"
    response = requests.get(url, headers=test_headers())
    print_response(response, "Get My Picks (All)")
    
    # Test filtering by event
    url_filtered = f"{API_BASE}/predictions-game/my-picks?event_id={EVENT_ID}"
    response_filtered = requests.get(url_filtered, headers=test_headers())
    print_response(response_filtered, f"Get My Picks (Event {EVENT_ID})")
    
    return response.status_code == 200

def test_get_transaction_history():
    """Test getting transaction history"""
    url = f"{API_BASE}/predictions-game/transaction-history"
    response = requests.get(url, headers=test_headers())
    print_response(response, "Get Transaction History")
    
    return response.status_code == 200

def test_get_event_pick_stats():
    """Test getting event pick statistics"""
    url = f"{API_BASE}/predictions-game/event-picks/{EVENT_ID}"
    response = requests.get(url, headers=test_headers())
    print_response(response, f"Get Event Pick Stats (Event {EVENT_ID})")
    
    return response.status_code == 200

def test_place_multiple_picks():
    """Test placing picks on multiple fighters"""
    url = f"{API_BASE}/predictions-game/place-pick"
    
    # Get current balance first
    balance_response = requests.get(f"{API_BASE}/predictions-game/balance", headers=test_headers())
    if balance_response.status_code != 200:
        print("Could not get balance for multiple picks test")
        return False
    
    current_balance = balance_response.json().get('balance', 0)
    print(f"\nCurrent balance: {current_balance} coins")
    
    if current_balance < 200:
        print("Insufficient balance for multiple picks test (need at least 200 coins)")
        return False
    
    # Pick 2: Place a smaller bet on fighter 2 
    pick_data_2 = {
        "event_id": EVENT_ID,
        "fight_id": FIGHT_ID,
        "fighter_id": FIGHTER2_ID,
        "fighter_name": FIGHTER2_NAME,
        "stake": 50,  # Betting 50 coins
        "odds_american": FIGHTER2_ODDS
    }
    
    response2 = requests.post(url, json=pick_data_2, headers=test_headers())
    print_response(response2, f"Place Pick on {FIGHTER2_NAME}")
    
    # Note: This should fail since you can only pick one fighter per fight
    # But let's test it to see the error handling
    
    return True

def test_invalid_scenarios():
    """Test various invalid scenarios"""
    url = f"{API_BASE}/predictions-game/place-pick"
    
    # Test 1: Invalid stake (0 coins)
    invalid_pick_1 = {
        "event_id": EVENT_ID,
        "fight_id": FIGHT_ID,
        "fighter_id": FIGHTER1_ID,
        "fighter_name": FIGHTER1_NAME,
        "stake": 0,  # Invalid stake
        "odds_american": FIGHTER1_ODDS
    }
    
    response1 = requests.post(url, json=invalid_pick_1, headers=test_headers())
    print_response(response1, "Invalid Pick - Zero Stake")
    
    # Test 2: Missing required fields
    invalid_pick_2 = {
        "event_id": EVENT_ID,
        "fight_id": FIGHT_ID,
        # Missing fighter_id, fighter_name, stake, odds_american
    }
    
    response2 = requests.post(url, json=invalid_pick_2, headers=test_headers())
    print_response(response2, "Invalid Pick - Missing Fields")
    
    # Test 3: Non-existent event
    invalid_pick_3 = {
        "event_id": 99999,  # Non-existent event
        "fight_id": FIGHT_ID,
        "fighter_id": FIGHTER1_ID,
        "fighter_name": FIGHTER1_NAME,
        "stake": 50,
        "odds_american": FIGHTER1_ODDS
    }
    
    response3 = requests.post(url, json=invalid_pick_3, headers=test_headers())
    print_response(response3, "Invalid Pick - Non-existent Event")
    
    return True

def test_no_auth():
    """Test endpoints without authentication"""
    print(f"\n{'='*60}")
    print("Testing: Endpoints without authentication")
    
    # Test balance without auth
    url = f"{API_BASE}/predictions-game/balance"
    response = requests.get(url)  # No auth headers
    print(f"Balance without auth - Status: {response.status_code}")
    
    # Test place pick without auth
    url = f"{API_BASE}/predictions-game/place-pick"
    pick_data = {
        "event_id": EVENT_ID,
        "fight_id": FIGHT_ID,
        "fighter_id": FIGHTER1_ID,
        "fighter_name": FIGHTER1_NAME,
        "stake": 100,
        "odds_american": FIGHTER1_ODDS
    }
    response = requests.post(url, json=pick_data)  # No auth headers
    print(f"Place pick without auth - Status: {response.status_code}")
    
    print(f"{'='*60}")
    return True

def main():
    """Run all tests"""
    print("Starting Predictions Game API Tests")
    print(f"Base URL: {BASE_URL}")
    print(f"Event ID: {EVENT_ID}")
    print(f"Test Fight: {FIGHTER1_NAME} vs {FIGHTER2_NAME}")
    print(f"Test User ID: {TEST_USER_ID}")
    
    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to backend at {BASE_URL}: {e}")
        print("Make sure your FastAPI backend is running!")
        return False
    
    print("✅ Backend is running")
    
    # Run tests
    tests = [
        ("Health Check", test_health_check),
        ("Get Balance", test_get_balance),
        ("Place Pick", test_place_pick),
        ("Get My Picks", test_get_my_picks),
        ("Get Transaction History", test_get_transaction_history),
        ("Get Event Pick Stats", test_get_event_pick_stats),
        ("Place Multiple Picks", test_place_multiple_picks),
        ("Invalid Scenarios", test_invalid_scenarios),
        ("No Auth Tests", test_no_auth),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
            print(f"✅ {test_name}: {'PASSED' if result else 'FAILED'}")
        except Exception as e:
            results.append((test_name, False))
            print(f"❌ {test_name}: FAILED with exception: {e}")
    
    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
    else:
        print(f"⚠️  {total - passed} tests failed")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 