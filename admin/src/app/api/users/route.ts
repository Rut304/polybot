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

    // Fetch profile data
    const { data: profiles, error: profileError } = await supabase
      .from('polybot_user_profiles')
      .select('*');

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
    }

    // Create a map of profiles by user ID
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Merge auth users with profile data
    const users = (authUsers?.users || []).map(user => {
      const profile = profileMap.get(user.id);
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

      const { data, error } = await supabase
        .from('polybot_user_profiles')
        .upsert({
          id: userId,
          ...profileUpdates,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        return NextResponse.json(
          { error: `Failed to update profile: ${error.message}` },
          { status: 500 }
        );
      }
      results.profile = data;
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
