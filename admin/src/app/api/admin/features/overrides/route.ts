import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized admin client with service key for full access
let supabaseAdmin: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdmin && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseAdmin;
}

// Get user overrides (optionally filtered by user_id)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    let query = supabase
      .from('polybot_user_feature_overrides')
      .select(`
        *,
        polybot_profiles!inner(email, full_name)
      `)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: overrides, error } = await query;

    if (error) {
      console.error('Error fetching user overrides:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ overrides: overrides || [] });
  } catch (error: any) {
    console.error('User overrides API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create or update a user override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, flag_key, enabled, reason, granted_by, expires_at } = body;

    if (!user_id || !flag_key || enabled === undefined) {
      return NextResponse.json({ error: 'user_id, flag_key, and enabled required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Upsert the override
    const { data, error } = await supabase
      .from('polybot_user_feature_overrides')
      .upsert({
        user_id,
        flag_key,
        enabled,
        reason: reason || null,
        granted_by: granted_by || null,
        expires_at: expires_at || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,flag_key',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user override:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, override: data });
  } catch (error: any) {
    console.error('User override create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete a user override
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const flagKey = searchParams.get('flagKey');

    if (!userId || !flagKey) {
      return NextResponse.json({ error: 'userId and flagKey required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const { error } = await supabase
      .from('polybot_user_feature_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('flag_key', flagKey);

    if (error) {
      console.error('Error deleting user override:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('User override delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
