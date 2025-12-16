import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Need admin access to get user email reliably if not passed, 
// though typically we trust the auth header for the user ID.
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
    const { priceId, successUrl, cancelUrl, userId, userEmail } = body;

    if (!userId || !priceId) {
      return NextResponse.json({ error: 'Missing userId or priceId' }, { status: 400 });
    }

    // Optional: Get or Create Stripe Customer 
    // For MVP, we can let Stripe create a new customer for every checkout 
    // OR look up if we have one in DB. 
    // Implementation: Look up profile, check if stripe_customer_id exists.

    const supabase = getSupabaseAdmin();
    let customerId = undefined;

    if (supabase) {
        const { data: profile } = await supabase
            .from('polybot_profiles')
            .select('stripe_customer_id')
            .eq('id', userId) // profiles table is keyed by user_id
            .single();
        
        if (profile?.stripe_customer_id) {
            customerId = profile.stripe_customer_id;
        }
    }

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId,
      metadata: {
        userId: userId,
      },
    };
    
    // If we have a customer ID, attach it
    if (customerId) {
        sessionConfig.customer = customerId;
        // customer_update policy if needed
    } else {
        // If no customer ID, pass email to prefill/create
        if (userEmail) {
            sessionConfig.customer_email = userEmail;
        }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
