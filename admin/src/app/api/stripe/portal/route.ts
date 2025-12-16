import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return null;
    }
    
    return createClient(supabaseUrl, supabaseServiceKey);
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, returnUrl } = body;

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json({ error: 'Database config error' }, { status: 500 });
    }

    // Get customer ID
    const { data: profile } = await supabase
        .from('polybot_profiles')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single();

    if (!profile?.stripe_customer_id) {
        return NextResponse.json(
            { error: 'No billing account found for this user.' }, 
            { status: 404 }
        );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Portal Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
