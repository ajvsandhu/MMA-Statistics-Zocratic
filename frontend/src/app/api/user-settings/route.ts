import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Check environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase environment variables');
}

// Initialize Supabase client using same env vars as backend
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

export async function GET(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    // Simple JWT parsing to get user_id - Lambda already validated the user
    const user_id = getUserIdFromToken(token);
    
    if (!user_id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user_id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data?.settings || {} });
  } catch (error: any) {
    console.error('Settings API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    // Simple JWT parsing to get user_id - Lambda already validated the user
    const user_id = getUserIdFromToken(token);
    
    if (!user_id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let requestBody;
    try {
      requestBody = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { settings } = requestBody;

    // Update settings (Lambda already created the row)
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id, settings }, { onConflict: 'user_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Settings API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Simple JWT parsing (just extract user_id from sub claim)
function getUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = parts[1];
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = Buffer.from(paddedPayload, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    
    // Check expiration
    if (parsed.exp && Date.now() >= parsed.exp * 1000) {
      return null;
    }
    
    return parsed.sub || null;
  } catch {
    return null;
  }
} 