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

export async function GET(request: NextRequest) {
  try {
    // Verify admin auth (you should add proper auth check here)
    const authHeader = request.headers.get('authorization');
    
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }
    
    // Fetch all customer profiles
    const { data: customers, error } = await supabase
      .from('polybot_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: customers || [] });
  } catch (error: any) {
    console.error('Admin customers API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, updates } = body;

    if (!userId || !updates) {
      return NextResponse.json({ error: 'userId and updates required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Update customer profile
    const { data, error } = await supabase
      .from('polybot_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log admin action for audit (ignore errors if table doesn't exist)
    try {
      await supabase.from('polybot_admin_audit_log').insert({
        action: 'customer_update',
        target_user_id: userId,
        changes: updates,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Audit log table may not exist
    }

    return NextResponse.json({ success: true, customer: data });
  } catch (error: any) {
    console.error('Admin customers update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
