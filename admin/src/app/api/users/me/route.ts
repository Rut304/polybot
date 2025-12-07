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

// GET - Get current user's role by email
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      );
    }

    // Get email from query params or auth header
    const email = request.nextUrl.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    // Fetch user profile by email
    const { data: profile, error } = await supabase
      .from('polybot_user_profiles')
      .select('id, role, display_name')
      .eq('id', (
        await supabase.auth.admin.listUsers()
      ).data.users.find(u => u.email === email)?.id || '')
      .single();

    if (error || !profile) {
      // Check auth.users table directly
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const authUser = authUsers?.users?.find(u => u.email === email);
      
      if (authUser) {
        // Check if there's a profile for this user
        const { data: userProfile } = await supabase
          .from('polybot_user_profiles')
          .select('role')
          .eq('id', authUser.id)
          .single();
        
        return NextResponse.json({
          id: authUser.id,
          email: authUser.email,
          role: userProfile?.role || 'viewer',
        });
      }
      
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      role: profile.role,
      display_name: profile.display_name,
    });
  } catch (error) {
    console.error('Error in users/me API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
