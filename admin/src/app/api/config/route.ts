import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { SubscriptionTier } from '@/lib/privy';
import { 
  STRATEGY_TIER_REQUIREMENTS, 
  tierMeetsRequirement, 
  validateStrategyUpdates,
  getStrategyTierMap 
} from '@/lib/tier-validation';

export const dynamic = 'force-dynamic';

// Helper to get user's subscription tier
async function getUserTier(supabase: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<SubscriptionTier> {
  if (!supabase) return 'free';
  
  // Check polybot_profiles first
  const { data: profile } = await supabase
    .from('polybot_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();
  
  if (profile?.subscription_tier) {
    return profile.subscription_tier as SubscriptionTier;
  }
  
  // Fallback to polybot_user_profiles  
  const { data: userProfile } = await supabase
    .from('polybot_user_profiles')
    .select('subscription_tier')
    .eq('user_id', userId)
    .single();
  
  return (userProfile?.subscription_tier as SubscriptionTier) || 'free';
}

// Admin client to bypass RLS for config updates if needed, 
// though we usually prefer user-context. 
// Given the issues with RLS on config, using Service Role for reliability 
// while validating user ID is a safer bet for "System Settings".
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let userId = searchParams.get('userId');

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // If no userId, try to get from auth token
    if (!userId) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (user && !error) {
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId or valid auth token' }, { status: 400 });
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

    const supabaseAdmin = getSupabaseAdmin();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Get user's subscription tier for validation
    const userTier = await getUserTier(supabaseAdmin, user_id);
    
    // Validate strategy updates against user's tier
    const { valid: validUpdates, blocked } = validateStrategyUpdates(updates, userTier);
    
    // If any strategies were blocked, return error
    if (blocked.length > 0) {
      return NextResponse.json({ 
        error: 'Subscription upgrade required',
        message: `Your ${userTier} tier cannot enable: ${blocked.join(', ')}`,
        blocked,
        userTier,
      }, { status: 403 });
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
        .update(validUpdates)
        .eq('user_id', user_id);
      error = res.error;
    } else {
      // Create
      const res = await supabaseAdmin
        .from('polybot_config')
        .insert([{ user_id, ...validUpdates }]);
      error = res.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Config POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH - Update config with auth token support
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    let userId = body.user_id;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // If no userId in body, try to get from auth token
    if (!userId) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (user && !error) {
          userId = user.id;
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing user_id or valid auth token' }, { status: 400 });
    }

    // Remove user_id from updates
    const { user_id: _, ...updates } = body;

    // Get user's subscription tier for validation
    const userTier = await getUserTier(supabaseAdmin, userId);
    
    // Validate strategy updates against user's tier
    const { valid: validUpdates, blocked } = validateStrategyUpdates(updates, userTier);
    
    // If any strategies were blocked, return error
    if (blocked.length > 0) {
      return NextResponse.json({ 
        error: 'Subscription upgrade required',
        message: `Your ${userTier} tier cannot enable: ${blocked.join(', ')}`,
        blocked,
        userTier,
      }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('polybot_config')
      .update(validUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Config PATCH Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Config PATCH Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
