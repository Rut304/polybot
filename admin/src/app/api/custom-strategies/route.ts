import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// GET - Fetch user's custom strategies
export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('polybot_custom_strategies')
      .select('*')
      .eq('user_id', authResult.user_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching custom strategies:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, strategies: data || [] });
  } catch (error) {
    console.error('Error in custom-strategies GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new custom strategy
export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, conditions, actions } = body;

    if (!name || !conditions || !actions) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('polybot_custom_strategies')
      .insert({
        user_id: authResult.user_id,
        name,
        description: description || '',
        conditions: conditions,
        actions: actions,
        is_active: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating custom strategy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, strategy: data });
  } catch (error) {
    console.error('Error in custom-strategies POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a custom strategy
export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, conditions, actions, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'Strategy ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (conditions !== undefined) updateData.conditions = conditions;
    if (actions !== undefined) updateData.actions = actions;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabaseAdmin
      .from('polybot_custom_strategies')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', authResult.user_id) // Ensure user owns this strategy
      .select()
      .single();

    if (error) {
      console.error('Error updating custom strategy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, strategy: data });
  } catch (error) {
    console.error('Error in custom-strategies PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a custom strategy
export async function DELETE(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authResult = await verifyAuth(request);
    if (!authResult?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Strategy ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('polybot_custom_strategies')
      .delete()
      .eq('id', id)
      .eq('user_id', authResult.user_id); // Ensure user owns this strategy

    if (error) {
      console.error('Error deleting custom strategy:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in custom-strategies DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
