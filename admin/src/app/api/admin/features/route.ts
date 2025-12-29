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

// Get all feature flags
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Fetch all feature flags
    const { data: flags, error: flagsError } = await supabase
      .from('polybot_feature_flags')
      .select('*')
      .order('category', { ascending: true })
      .order('flag_name', { ascending: true });

    if (flagsError) {
      console.error('Error fetching feature flags:', flagsError);
      return NextResponse.json({ error: flagsError.message }, { status: 500 });
    }

    // Fetch admin settings
    const { data: settings, error: settingsError } = await supabase
      .from('polybot_admin_settings')
      .select('*');

    // Fetch beta testers count
    const { count: betaCount } = await supabase
      .from('polybot_beta_testers')
      .select('*', { count: 'exact', head: true });

    // Fetch user overrides count
    const { count: overridesCount } = await supabase
      .from('polybot_user_feature_overrides')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      flags: flags || [],
      settings: settings || [],
      stats: {
        totalFlags: flags?.length || 0,
        enabledFlags: flags?.filter(f => f.enabled).length || 0,
        betaTesters: betaCount || 0,
        userOverrides: overridesCount || 0,
      }
    });
  } catch (error: any) {
    console.error('Feature flags API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update a feature flag
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { flagKey, updates } = body;

    if (!flagKey) {
      return NextResponse.json({ error: 'flagKey required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Update the feature flag
    const { data, error } = await supabase
      .from('polybot_feature_flags')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('flag_key', flagKey)
      .select()
      .single();

    if (error) {
      console.error('Error updating feature flag:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, flag: data });
  } catch (error: any) {
    console.error('Feature flag update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create a new feature flag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flag_key, flag_name, description, enabled, category, rollout_percentage } = body;

    if (!flag_key || !flag_name) {
      return NextResponse.json({ error: 'flag_key and flag_name required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Insert new feature flag
    const { data, error } = await supabase
      .from('polybot_feature_flags')
      .insert({
        flag_key,
        flag_name,
        description: description || '',
        enabled: enabled ?? false,
        category: category || 'general',
        rollout_percentage: rollout_percentage ?? 100,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating feature flag:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, flag: data });
  } catch (error: any) {
    console.error('Feature flag create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete a feature flag
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const flagKey = searchParams.get('flagKey');

    if (!flagKey) {
      return NextResponse.json({ error: 'flagKey required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Delete the feature flag
    const { error } = await supabase
      .from('polybot_feature_flags')
      .delete()
      .eq('flag_key', flagKey);

    if (error) {
      console.error('Error deleting feature flag:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Feature flag delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
