import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Create Supabase admin client (bypasses RLS)
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

export async function GET(request: NextRequest) {
  try {
    // 1. Try to get user from auth header?
    // Since this is called by the frontend hook, we can rely on the frontend passing the user ID via query param
    // OR we can just fetch the "Global" status if we assume single tenant context for now,
    // BUT we want multi-tenant.
    
    // Check if query param userId exists
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // If no userId, we can't really know WHICH bot to check.
    // However, the previous implementation called `${BOT_URL}/status`.
    // That implied a single running bot instance at that URL.
    
    // New Logic: Query polybot_status table.
    // If userId provided, filter by it.
    // If not, maybe return the most recently updated one?

    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { 
          status: 'unknown', 
          version: 'unknown', 
          error: 'Supabase not configured' 
        },
        { status: 500 }
      );
    }

    let query = supabase.from('polybot_status').select('*');
    
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      // Fallback: Get valid running bot or most recent
      query = query.order('last_updated', { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error) {
      console.warn('Bot status query error:', error.message);
      // It's okay if no rows found
    }

    // Construct response compatible with frontend expectation
    return NextResponse.json({
      status: data?.is_running ? 'online' : 'offline',
      version: data?.version || 'unknown',
      mode: data?.mode || 'simulation',
      last_updated: data?.last_updated,
      user_id: data?.user_id
    });

  } catch (error) {
    console.error('Error fetching bot status:', error);
    return NextResponse.json(
      { 
        status: 'offline',
        version: 'unknown',
        error: error instanceof Error ? error.message : 'Failed to fetch bot status'
      },
      { status: 200 }
    );
  }
}
