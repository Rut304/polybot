import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

// Helper to get admin supabase client
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Generate a unique referral code
function generateReferralCode(): string {
  return nanoid(8).toUpperCase(); // 8-char alphanumeric code
}

// GET - Get user's referral data
export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get or create referral record
    let { data: referral, error } = await supabase
      .from('polybot_referrals')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No referral record exists, create one
      const newCode = generateReferralCode();
      const { data: newReferral, error: insertError } = await supabase
        .from('polybot_referrals')
        .insert({
          user_id: userId,
          referral_code: newCode,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating referral:', insertError);
        return NextResponse.json({ error: 'Failed to create referral code' }, { status: 500 });
      }
      referral = newReferral;
    } else if (error) {
      console.error('Error fetching referral:', error);
      return NextResponse.json({ error: 'Failed to fetch referral data' }, { status: 500 });
    }

    // Get recent referral clicks/signups
    const { data: recentReferrals } = await supabase
      .from('polybot_referral_clicks')
      .select('id, status, created_at, converted_at, reward_amount')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      referral_code: referral?.referral_code,
      total_referrals: referral?.total_referrals || 0,
      total_conversions: referral?.total_conversions || 0,
      total_earnings: referral?.total_earnings || 0,
      referral_link: `https://polyparlay.io/?ref=${referral?.referral_code}`,
      recent_referrals: recentReferrals || [],
    });
  } catch (error: any) {
    console.error('Referral API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Track a referral click or conversion
export async function POST(req: NextRequest) {
  try {
    const { action, referral_code, referred_user_id } = await req.json();
    
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    if (action === 'click') {
      // Track a referral link click
      if (!referral_code) {
        return NextResponse.json({ error: 'Missing referral_code' }, { status: 400 });
      }

      // Find the referrer
      const { data: referral } = await supabase
        .from('polybot_referrals')
        .select('user_id')
        .eq('referral_code', referral_code)
        .single();

      if (!referral) {
        return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
      }

      // Record the click
      const { error: clickError } = await supabase
        .from('polybot_referral_clicks')
        .insert({
          referral_code,
          referrer_id: referral.user_id,
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          user_agent: req.headers.get('user-agent'),
          status: 'clicked',
        });

      if (clickError) {
        console.error('Error recording click:', clickError);
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'signup') {
      // Track a successful signup from referral
      if (!referral_code || !referred_user_id) {
        return NextResponse.json({ error: 'Missing referral_code or referred_user_id' }, { status: 400 });
      }

      // Find the referrer
      const { data: referral } = await supabase
        .from('polybot_referrals')
        .select('user_id')
        .eq('referral_code', referral_code)
        .single();

      if (!referral) {
        return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
      }

      // Update the most recent click to mark as signed up
      const { error: updateError } = await supabase
        .from('polybot_referral_clicks')
        .update({
          referred_user_id,
          status: 'signed_up',
        })
        .eq('referral_code', referral_code)
        .eq('status', 'clicked')
        .order('created_at', { ascending: false })
        .limit(1);

      // Increment total referrals
      try {
        await supabase.rpc('increment_referral_count', {
          p_referral_code: referral_code,
        });
      } catch {
        // Fallback if RPC doesn't exist - use raw update
        const currentCount = (referral as any).total_referrals || 0;
        await supabase
          .from('polybot_referrals')
          .update({ total_referrals: currentCount + 1 })
          .eq('referral_code', referral_code);
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'convert') {
      // Track a conversion (upgrade to paid)
      if (!referred_user_id) {
        return NextResponse.json({ error: 'Missing referred_user_id' }, { status: 400 });
      }

      // Find the referral click record
      const { data: click } = await supabase
        .from('polybot_referral_clicks')
        .select('id, referrer_id, referral_code')
        .eq('referred_user_id', referred_user_id)
        .eq('status', 'signed_up')
        .single();

      if (!click) {
        return NextResponse.json({ error: 'No referral found for this user' }, { status: 404 });
      }

      // Calculate reward (e.g., $5 per conversion)
      const rewardAmount = 5.00;

      // Update click status
      await supabase
        .from('polybot_referral_clicks')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
          reward_amount: rewardAmount,
        })
        .eq('id', click.id);

      // Update referral totals
      await supabase
        .from('polybot_referrals')
        .update({
          total_conversions: supabase.rpc('increment', { x: 1 }),
          total_earnings: supabase.rpc('increment', { x: rewardAmount }),
        })
        .eq('referral_code', click.referral_code);

      return NextResponse.json({ success: true, reward: rewardAmount });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Referral POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
