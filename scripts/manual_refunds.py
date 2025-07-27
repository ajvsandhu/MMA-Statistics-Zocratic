#!/usr/bin/env python3
"""
Manual Refund Administration Script
Industry Best Practice Implementation for Emergency Refund Situations

This script provides administrators with tools to:
1. View pending bets for specific fights/events
2. Process emergency refunds for cancelled/changed fights
3. Generate refund reports and audit trails
4. Handle edge cases that the automated system might miss

Usage:
    python scripts/manual_refunds.py --fight-id FIGHT_123 --reason "Fighter injured"
    python scripts/manual_refunds.py --event-id 5 --check-only
    python scripts/manual_refunds.py --list-pending --event-id 5
"""

import sys
import os
import argparse
from datetime import datetime
import json

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

try:
    from backend.api.database import get_supabase_client
    supabase = get_supabase_client()
    
    if not supabase:
        print("❌ Could not connect to database")
        sys.exit(1)
        
except Exception as e:
    print(f"❌ Database connection error: {e}")
    sys.exit(1)


def list_pending_bets(event_id=None, fight_id=None):
    """List all pending bets for an event or specific fight"""
    print("\n📋 PENDING BETS ANALYSIS")
    print("=" * 50)
    
    query = supabase.table('bets').select('*').eq('status', 'pending')
    
    if event_id:
        query = query.eq('event_id', event_id)
        print(f"🎯 Filtering by Event ID: {event_id}")
    
    if fight_id:
        query = query.eq('fight_id', fight_id)
        print(f"🥊 Filtering by Fight ID: {fight_id}")
    
    response = query.execute()
    
    if not response.data:
        print("✅ No pending bets found")
        return []
    
    bets = response.data
    print(f"📊 Found {len(bets)} pending bets")
    
    # Group by fight_id
    fight_groups = {}
    total_stake = 0
    
    for bet in bets:
        fight_id = bet['fight_id']
        if fight_id not in fight_groups:
            fight_groups[fight_id] = {
                'bets': [],
                'total_stake': 0,
                'unique_users': set()
            }
        
        fight_groups[fight_id]['bets'].append(bet)
        fight_groups[fight_id]['total_stake'] += bet['stake']
        fight_groups[fight_id]['unique_users'].add(bet['user_id'])
        total_stake += bet['stake']
    
    print(f"\n💰 Total stake at risk: {total_stake} coins")
    print(f"🥊 Fights with pending bets: {len(fight_groups)}")
    
    for fight_id, data in fight_groups.items():
        print(f"\n  Fight {fight_id}:")
        print(f"    Bets: {len(data['bets'])}")
        print(f"    Unique users: {len(data['unique_users'])}")
        print(f"    Total stake: {data['total_stake']} coins")
        
        # Show fighter distribution
        fighter_bets = {}
        for bet in data['bets']:
            fighter = bet['fighter_name']
            if fighter not in fighter_bets:
                fighter_bets[fighter] = {'count': 0, 'stake': 0}
            fighter_bets[fighter]['count'] += 1
            fighter_bets[fighter]['stake'] += bet['stake']
        
        for fighter, stats in fighter_bets.items():
            print(f"      {fighter}: {stats['count']} bets, {stats['stake']} coins")
    
    return bets


def process_emergency_refund(fight_id, reason, refund_type='full_refund', dry_run=False):
    """Process emergency refund for a specific fight"""
    print(f"\n🚨 EMERGENCY REFUND PROCESS")
    print("=" * 50)
    print(f"Fight ID: {fight_id}")
    print(f"Reason: {reason}")
    print(f"Refund Type: {refund_type}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE EXECUTION'}")
    
    # Get pending bets for this fight
    response = supabase.table('bets')\
        .select('*')\
        .eq('fight_id', fight_id)\
        .eq('status', 'pending')\
        .execute()
    
    if not response.data:
        print("✅ No pending bets found for this fight")
        return
    
    bets = response.data
    print(f"\n📊 Found {len(bets)} pending bets to refund")
    
    total_refund_amount = 0
    unique_users = set()
    
    for bet in bets:
        stake = bet['stake']
        refund_amount = stake if refund_type == 'full_refund' else int(stake * 0.5)
        total_refund_amount += refund_amount
        unique_users.add(bet['user_id'])
        
        print(f"  📝 Bet {bet['id']}: User {bet['user_id']}, Fighter: {bet['fighter_name']}")
        print(f"      Stake: {stake} → Refund: {refund_amount} coins")
    
    print(f"\n💰 Total refund amount: {total_refund_amount} coins")
    print(f"👥 Affected users: {len(unique_users)}")
    
    if dry_run:
        print("\n🔍 DRY RUN COMPLETE - No changes made")
        return
    
    # Confirm before proceeding
    confirmation = input(f"\n⚠️  Proceed with refunding {total_refund_amount} coins to {len(unique_users)} users? (yes/no): ")
    if confirmation.lower() != 'yes':
        print("❌ Refund cancelled by administrator")
        return
    
    # Process refunds
    print("\n🔄 Processing refunds...")
    successful_refunds = 0
    
    for bet in bets:
        user_id = bet['user_id']
        bet_id = bet['id']
        stake = bet['stake']
        refund_amount = stake if refund_type == 'full_refund' else int(stake * 0.5)
        
        try:
            # Get current user balance
            balance_response = supabase.table('coin_accounts')\
                .select('balance, total_wagered')\
                .eq('user_id', user_id)\
                .execute()
            
            if not balance_response.data:
                print(f"❌ User account not found: {user_id}")
                continue
            
            current_balance = balance_response.data[0]['balance']
            current_total_wagered = balance_response.data[0]['total_wagered'] or 0
            
            new_balance = current_balance + refund_amount
            new_total_wagered = max(0, current_total_wagered - stake)
            
            # Update bet status
            current_timestamp = datetime.now().isoformat()
            bet_update_response = supabase.table('bets')\
                .update({
                    'status': 'refunded',
                    'payout': refund_amount,
                    'settled_at': current_timestamp,
                    'refund_reason': f'MANUAL REFUND: {reason}'
                })\
                .eq('id', bet_id)\
                .execute()
            
            if not bet_update_response.data:
                print(f"❌ Failed to update bet {bet_id}")
                continue
            
            # Update user balance
            balance_update_response = supabase.table('coin_accounts')\
                .update({
                    'balance': new_balance,
                    'total_wagered': new_total_wagered
                })\
                .eq('user_id', user_id)\
                .execute()
            
            if not balance_update_response.data:
                print(f"❌ Failed to update balance for user {user_id}")
                continue
            
            # Create transaction record
            transaction_data = {
                'user_id': user_id,
                'amount': refund_amount,
                'type': 'bet_refunded',
                'reason': f'MANUAL REFUND: {reason} - {bet["fighter_name"]}',
                'ref_table': 'bets',
                'ref_id': bet_id,
                'balance_before': current_balance,
                'balance_after': new_balance
            }
            
            transaction_response = supabase.table('coin_transactions')\
                .insert(transaction_data)\
                .execute()
            
            if transaction_response.data:
                print(f"✅ Refunded {refund_amount} coins to user {user_id}")
                successful_refunds += 1
            else:
                print(f"❌ Failed to create transaction record for bet {bet_id}")
                
        except Exception as e:
            print(f"❌ Error processing refund for bet {bet_id}: {str(e)}")
    
    print(f"\n🎉 REFUND COMPLETE!")
    print(f"✅ Successfully processed: {successful_refunds}/{len(bets)} refunds")
    print(f"💰 Total amount refunded: {successful_refunds * (total_refund_amount // len(bets))} coins")


def generate_refund_report(event_id=None):
    """Generate comprehensive refund report"""
    print("\n📊 REFUND REPORT")
    print("=" * 50)
    
    query = supabase.table('bets').select('*').eq('status', 'refunded')
    
    if event_id:
        query = query.eq('event_id', event_id)
        print(f"Event ID: {event_id}")
    else:
        print("All Events")
    
    response = query.execute()
    
    if not response.data:
        print("✅ No refunds found")
        return
    
    refunds = response.data
    print(f"Total refunds: {len(refunds)}")
    
    total_refunded = sum(bet.get('payout', 0) for bet in refunds)
    total_original = sum(bet.get('stake', 0) for bet in refunds)
    unique_users = len(set(bet['user_id'] for bet in refunds))
    
    print(f"Total original stakes: {total_original} coins")
    print(f"Total refunded: {total_refunded} coins")
    print(f"Affected users: {unique_users}")
    
    # Group by reason
    reason_groups = {}
    for bet in refunds:
        reason = bet.get('refund_reason', 'Unknown')
        if reason not in reason_groups:
            reason_groups[reason] = {'count': 0, 'amount': 0}
        reason_groups[reason]['count'] += 1
        reason_groups[reason]['amount'] += bet.get('payout', 0)
    
    print("\nRefund Reasons:")
    for reason, data in reason_groups.items():
        print(f"  {reason}: {data['count']} bets, {data['amount']} coins")


def main():
    parser = argparse.ArgumentParser(description='Manual Refund Administration')
    parser.add_argument('--fight-id', type=str, help='Process refunds for specific fight')
    parser.add_argument('--event-id', type=int, help='Target specific event')
    parser.add_argument('--reason', type=str, help='Reason for refund')
    parser.add_argument('--refund-type', choices=['full_refund', 'partial_refund'], 
                       default='full_refund', help='Type of refund')
    parser.add_argument('--list-pending', action='store_true', help='List pending bets')
    parser.add_argument('--report', action='store_true', help='Generate refund report')
    parser.add_argument('--dry-run', action='store_true', help='Dry run (no changes)')
    parser.add_argument('--check-only', action='store_true', help='Check for potential refunds')
    
    args = parser.parse_args()
    
    if args.list_pending:
        list_pending_bets(args.event_id, args.fight_id)
    elif args.report:
        generate_refund_report(args.event_id)
    elif args.fight_id and args.reason:
        process_emergency_refund(args.fight_id, args.reason, args.refund_type, args.dry_run)
    elif args.check_only and args.event_id:
        print("Check-only mode: Analyzing potential refunds...")
        list_pending_bets(args.event_id)
    else:
        parser.print_help()


if __name__ == "__main__":
    main() 