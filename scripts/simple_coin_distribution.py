#!/usr/bin/env python3
"""
Simple Coin Distribution Script
Just connects to your DB and gives everyone coins. No API, no auth, just simple.
"""

import sys
import os
from datetime import datetime

# Add the parent directory to sys.path to import from backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from backend.api.database import get_db_connection

def distribute_coins(amount=500, reason="Weekly bonus"):
    """Give coins to everyone. Simple."""
    
    print(f"🪙 Giving {amount} coins to everyone...")
    print(f"Reason: {reason}")
    print()
    
    # Connect to database
    supabase = get_db_connection()
    if not supabase:
        print("❌ Can't connect to database")
        return
    
    try:
        # Get all coin accounts
        accounts_response = supabase.table('coin_accounts').select('user_id, balance').execute()
        
        if not accounts_response.data:
            print("❌ No accounts found")
            return
        
        accounts = accounts_response.data
        print(f"Found {len(accounts)} accounts")
        
        successful = 0
        failed = 0
        
        for account in accounts:
            try:
                user_id = account['user_id']
                current_balance = account['balance']
                new_balance = current_balance + amount
                
                # Update balance
                update_response = supabase.table('coin_accounts')\
                    .update({'balance': new_balance})\
                    .eq('user_id', user_id)\
                    .execute()
                
                if update_response.data:
                    successful += 1
                    print(f"✅ {user_id[:8]}... got {amount} coins (balance: {current_balance} → {new_balance})")
                else:
                    failed += 1
                    print(f"❌ Failed to update {user_id[:8]}...")
                    
            except Exception as e:
                failed += 1
                print(f"❌ Error with {user_id[:8]}...: {e}")
        
        print()
        print(f"✅ Done! {successful} successful, {failed} failed")
        print(f"Total distributed: {successful * amount} coins")
        
    except Exception as e:
        print(f"❌ Script failed: {e}")

if __name__ == "__main__":
    # Default values - change here if needed
    amount = 500
    reason = "Weekly bonus"
    
    distribute_coins(amount, reason) 