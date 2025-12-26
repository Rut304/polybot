import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client (bypasses RLS)
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

// GET - List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
        { status: 500 }
      );
    }

    // Fetch from auth.users via admin API
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error listing auth users:', authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    // Fetch profile data from polybot_user_profiles
    const { data: profiles, error: profileError } = await supabase
      .from('polybot_user_profiles')
      .select('*');

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
    }

    // Also fetch from polybot_profiles for SaaS tier data
    const { data: saasProfiles, error: saasError } = await supabase
      .from('polybot_profiles')
      .select('id, subscription_tier, subscription_status, custom_price, discount_percent, admin_notes, monthly_trades_used, monthly_trades_limit');

    if (saasError) {
      console.error('Error fetching saas profiles:', saasError);
    }

    // Create maps by user ID
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const saasProfileMap = new Map((saasProfiles || []).map(p => [p.id, p]));

    // Merge auth users with profile data
    const users = (authUsers?.users || []).map(user => {
      const profile = profileMap.get(user.id);
      const saasProfile = saasProfileMap.get(user.id);
      // Normalize role: database uses 'admin' | 'viewer'
      const rawRole = profile?.role || user.user_metadata?.role || 'viewer';
      const role = rawRole === 'admin' ? 'admin' : 'viewer';
      return {
        id: user.id,
        email: user.email,
        role,
        display_name: profile?.display_name || user.email?.split('@')[0],
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at,
        phone: user.phone,
        app_metadata: user.app_metadata,
        user_metadata: user.user_metadata,
        // Profile-specific fields
        avatar_url: profile?.avatar_url,
        timezone: profile?.timezone,
        notifications_enabled: profile?.notifications_enabled ?? true,
        // SaaS tier fields
        subscription_tier: saasProfile?.subscription_tier || 'free',
        subscription_status: saasProfile?.subscription_status || 'active',
        custom_price: saasProfile?.custom_price,
        discount_percent: saasProfile?.discount_percent,
        notes: saasProfile?.admin_notes,
        monthly_trades_used: saasProfile?.monthly_trades_used || 0,
        monthly_trades_limit: saasProfile?.monthly_trades_limit || 0,
      };
    });

    return NextResponse.json({
      success: true,
      users,
      count: users.length,
    });
  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update a user (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { userId, updates } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const results: Record<string, any> = {};

    // Update auth user if email/password provided
    if (updates.email || updates.password) {
      const authUpdates: Record<string, any> = {};
      if (updates.email) authUpdates.email = updates.email;
      if (updates.password) authUpdates.password = updates.password;
      
      const { data, error } = await supabase.auth.admin.updateUserById(userId, authUpdates);
      if (error) {
        return NextResponse.json(
          { error: `Failed to update auth: ${error.message}` },
          { status: 500 }
        );
      }
      results.auth = data;
    }

    // Update profile if role/display_name provided
    if (updates.role || updates.display_name || updates.notifications_enabled !== undefined) {
      const profileUpdates: Record<string, any> = {};
      if (updates.role) profileUpdates.role = updates.role;
      if (updates.display_name) profileUpdates.display_name = updates.display_name;
      if (updates.notifications_enabled !== undefined) {
        profileUpdates.notifications_enabled = updates.notifications_enabled;
      }

      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('polybot_user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      let profileResult;
      if (existingProfile) {
        // Update existing profile
        const { data, error } = await supabase
          .from('polybot_user_profiles')
          .update({
            ...profileUpdates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select();
        
        if (error) {
          console.error('Profile update error:', error);
          return NextResponse.json(
            { error: `Failed to update profile: ${error.message}` },
            { status: 500 }
          );
        }
        profileResult = data;
      } else {
        // Insert new profile
        const { data, error } = await supabase
          .from('polybot_user_profiles')
          .insert({
            id: userId,
            ...profileUpdates,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();
        
        if (error) {
          console.error('Profile insert error:', error);
          return NextResponse.json(
            { error: `Failed to create profile: ${error.message}` },
            { status: 500 }
          );
        }
        profileResult = data;
      }
      results.profile = profileResult;
    }

    // Update SaaS tier/subscription in polybot_profiles
    if (updates.subscription_tier || updates.subscription_status || 
        updates.custom_price !== undefined || updates.discount_percent !== undefined || 
        updates.admin_notes !== undefined) {
      
      const tierUpdates: Record<string, any> = {};
      if (updates.subscription_tier) {
        tierUpdates.subscription_tier = updates.subscription_tier;
        // Update trade limits based on tier
        switch (updates.subscription_tier) {
          case 'free':
            tierUpdates.monthly_trades_limit = 0;
            break;
          case 'pro':
            tierUpdates.monthly_trades_limit = 1000;
            break;
          case 'elite':
            tierUpdates.monthly_trades_limit = -1; // Unlimited
            break;
        }
      }
      if (updates.subscription_status) tierUpdates.subscription_status = updates.subscription_status;
      if (updates.custom_price !== undefined) tierUpdates.custom_price = updates.custom_price;
      if (updates.discount_percent !== undefined) tierUpdates.discount_percent = updates.discount_percent;
      if (updates.admin_notes !== undefined) tierUpdates.admin_notes = updates.admin_notes;
      tierUpdates.updated_at = new Date().toISOString();

      // First check if saas profile exists
      const { data: existingSaas } = await supabase
        .from('polybot_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      let tierResult;
      if (existingSaas) {
        // Update existing
        const { data, error } = await supabase
          .from('polybot_profiles')
          .update(tierUpdates)
          .eq('id', userId)
          .select();
        
        if (error) {
          console.error('Tier update error:', error);
          return NextResponse.json(
            { error: `Failed to update tier: ${error.message}` },
            { status: 500 }
          );
        }
        tierResult = data;
      } else {
        // Insert new saas profile with defaults
        const { data, error } = await supabase
          .from('polybot_profiles')
          .insert({
            id: userId,
            subscription_tier: updates.subscription_tier || 'free',
            subscription_status: updates.subscription_status || 'active',
            custom_price: updates.custom_price,
            discount_percent: updates.discount_percent,
            admin_notes: updates.admin_notes,
            monthly_trades_used: 0,
            monthly_trades_limit: updates.subscription_tier === 'elite' ? -1 : 
                                   updates.subscription_tier === 'pro' ? 1000 : 0,
            is_simulation: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select();
        
        if (error) {
          console.error('Tier insert error:', error);
          return NextResponse.json(
            { error: `Failed to create tier profile: ${error.message}` },
            { status: 500 }
          );
        }
        tierResult = data;
      }
      results.tier = tierResult;
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      results,
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Delete from auth
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      return NextResponse.json(
        { error: `Failed to delete user: ${error.message}` },
        { status: 500 }
      );
    }

    // Profile should be deleted via CASCADE or RLS trigger
    // But let's clean up just in case
    await supabase
      .from('polybot_user_profiles')
      .delete()
      .eq('id', userId);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { email, password, role = 'viewer', display_name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'email and password are required' },
        { status: 400 }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { role },
    });

    if (authError) {
      return NextResponse.json(
        { error: `Failed to create user: ${authError.message}` },
        { status: 500 }
      );
    }

    // Create profile
    if (authData.user) {
      await supabase
        .from('polybot_user_profiles')
        .upsert({
          id: authData.user.id,
          email: email,
          role: role,
          display_name: display_name || email.split('@')[0],
          created_at: new Date().toISOString(),
        });
    }

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: authData.user,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
