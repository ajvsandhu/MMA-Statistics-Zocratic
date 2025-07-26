#!/usr/bin/env python3
"""
Manual settlement script to force settlement of pending bets
"""

import sys
import os
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

try:
    from backend.api.database import get_supabase_client
    supabase = get_supabase_client()
    print("✅ Connected to Supabase")
except Exception as e:
    print(f"❌ Failed to connect to Supabase: {e}")
    exit(1)

def manual_settle_bets():
    """Manually settle all pending bets for event 5"""
    print("🔧 Starting manual bet settlement...")
    
    # Get all pending bets for event 5
    print("📋 Fetching pending bets...")
    bets_response = supabase.table('bets')\
        .select('*')\
        .eq('event_id', 5)\
        .eq('status', 'pending')\
        .execute()
    
    if not bets_response.data:
        print("❌ No pending bets found for event 5")
        return False
    
    pending_bets = bets_response.data
    print(f"📊 Found {len(pending_bets)} pending bets")
    
    # Get event data
    print("📋 Fetching event data...")
    event_response = supabase.table('upcoming_events')\
        .select('*')\
        .eq('id', 5)\
        .execute()
    
    if not event_response.data:
        print("❌ Event 5 not found")
        return False
    
    event_data = event_response.data[0]
    fights = event_data.get('fights', [])
    print(f"📊 Event has {len(fights)} fights")
    
    # Check fight statuses
    completed_fights = [f for f in fights if f.get('status') == 'completed']
    print(f"📊 {len(completed_fights)} fights are completed")
    
    # Show sample fight data for debugging
    if completed_fights:
        sample_fight = completed_fights[0]
        print(f"📝 Sample completed fight:")
        print(f"   Fight ID: {sample_fight.get('fight_id')}")
        print(f"   Fighter 1: {sample_fight.get('fighter1_name')} (ID: {sample_fight.get('fighter1_id')})")
        print(f"   Fighter 2: {sample_fight.get('fighter2_name')} (ID: {sample_fight.get('fighter2_id')})")
        print(f"   Status: {sample_fight.get('status')}")
        print(f"   Result: {sample_fight.get('result')}")
    
    settled_count = 0
    
    # Process each bet
    for bet in pending_bets:
        print(f"\n🎯 Processing bet {bet['id']}")
        print(f"   Fight: {bet['fight_id']}")
        print(f"   Fighter: {bet['fighter_name']} (ID: {bet['fighter_id']})")
        print(f"   Stake: ${bet['stake']}")
        print(f"   Potential Payout: ${bet['potential_payout']}")
        
        # Find the fight
        fight = None
        for f in fights:
            if f.get('fight_id') == bet['fight_id']:
                fight = f
                break
        
        if not fight:
            print(f"   ❌ Fight {bet['fight_id']} not found")
            continue
        
        print(f"   Fight Status: {fight.get('status')}")
        
        # Check if fight has result
        fight_result = fight.get('result')
        if not fight_result or not fight_result.get('winner_name'):
            print(f"   ⏳ Fight not completed yet")
            continue
        
        winner_name = fight_result.get('winner_name', '').lower().strip()
        print(f"   🏆 Winner: {winner_name}")
        
        # Get fighter names for comparison
        fighter1_name = fight.get('fighter1_name', '').lower().strip()
        fighter2_name = fight.get('fighter2_name', '').lower().strip()
        fighter1_id = fight.get('fighter1_id')
        fighter2_id = fight.get('fighter2_id')
        
        print(f"   Fighter 1: {fighter1_name} (ID: {fighter1_id})")
        print(f"   Fighter 2: {fighter2_name} (ID: {fighter2_id})")
        
        # Determine winner
        winner_fighter_id = None
        if winner_name and fighter1_name and (winner_name in fighter1_name or fighter1_name in winner_name):
            winner_fighter_id = fighter1_id
        elif winner_name and fighter2_name and (winner_name in fighter2_name or fighter2_name in winner_name):
            winner_fighter_id = fighter2_id
        
        if not winner_fighter_id:
            print(f"   ❌ Could not determine winner: '{winner_name}' vs '{fighter1_name}' / '{fighter2_name}'")
            continue
        
        print(f"   🎯 Winner Fighter ID: {winner_fighter_id}")
        print(f"   🎲 Bet Fighter ID: {bet['fighter_id']}")
        
        # Check if bet won
        won = (winner_fighter_id == bet['fighter_id'])
        print(f"   {'✅ BET WON!' if won else '❌ BET LOST'}")
        
        # Calculate payout
        payout_amount = bet['potential_payout'] if won else 0
        new_status = 'won' if won else 'lost'
        current_timestamp = datetime.now().isoformat()
        
        print(f"   💰 Payout: ${payout_amount}")
        
        # Update bet
        bet_update_response = supabase.table('bets')\
            .update({
                'status': new_status,
                'payout': payout_amount,
                'settled_at': current_timestamp
            })\
            .eq('id', bet['id'])\
            .execute()
        
        if not bet_update_response.data:
            print(f"   ❌ Failed to update bet")
            continue
        
        print(f"   ✅ Updated bet status to: {new_status}")
        
        # Update user balance if they won
        if won and payout_amount > 0:
            print(f"   💳 Updating user balance...")
            
            # Get current balance
            balance_response = supabase.table('coin_accounts')\
                .select('balance, total_won')\
                .eq('user_id', bet['user_id'])\
                .execute()
            
            if balance_response.data:
                current_balance = balance_response.data[0]['balance']
                current_total_won = balance_response.data[0]['total_won'] or 0
                
                new_balance = current_balance + payout_amount
                new_total_won = current_total_won + payout_amount
                
                print(f"      Old balance: ${current_balance}")
                print(f"      New balance: ${new_balance}")
                
                balance_update_response = supabase.table('coin_accounts')\
                    .update({
                        'balance': new_balance,
                        'total_won': new_total_won
                    })\
                    .eq('user_id', bet['user_id'])\
                    .execute()
                
                if balance_update_response.data:
                    # Create transaction record
                    transaction_data = {
                        'user_id': bet['user_id'],
                        'amount': payout_amount,
                        'type': 'bet_won',
                        'reason': f'Won bet on {bet["fighter_name"]} vs Fight {bet["fight_id"]}',
                        'ref_table': 'bets',
                        'ref_id': bet['id'],
                        'balance_before': current_balance,
                        'balance_after': new_balance
                    }
                    
                    supabase.table('coin_transactions').insert(transaction_data).execute()
                    print(f"   ✅ Balance updated and transaction recorded")
                else:
                    print(f"   ❌ Failed to update balance")
        
        settled_count += 1
    
    print(f"\n🎉 Settlement complete!")
    print(f"📊 Settled {settled_count} bets")
    return True

if __name__ == "__main__":
    manual_settle_bets() 