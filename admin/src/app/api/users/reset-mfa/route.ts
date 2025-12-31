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

// POST - Reset MFA for a user (admin only)
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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Reset MFA factors for the user
    // Supabase Admin API - clear MFA factors
    const { data: factors, error: listError } = await supabase.auth.admin.mfa.listFactors({
      userId,
    });

    if (listError) {
      console.error('Error listing MFA factors:', listError);
      return NextResponse.json(
        { error: `Failed to list MFA factors: ${listError.message}` },
        { status: 500 }
      );
    }

    // Delete each MFA factor
    const deletionErrors: string[] = [];
    for (const factor of factors?.factors || []) {
      const { error: deleteError } = await supabase.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId,
      });
      if (deleteError) {
        deletionErrors.push(`Failed to delete factor ${factor.id}: ${deleteError.message}`);
      }
    }

    if (deletionErrors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Some MFA factors could not be deleted',
        errors: deletionErrors,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `MFA reset successfully. ${factors?.factors?.length || 0} factor(s) removed.`,
      factorsRemoved: factors?.factors?.length || 0,
    });
  } catch (error) {
    console.error('Error resetting MFA:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
