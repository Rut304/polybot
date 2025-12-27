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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database config error' }, { status: 500 });
    }

    // Get customer ID and subscription info
    const { data: profile, error: profileError } = await supabase
      .from('polybot_profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found for this user.' },
        { status: 404 }
      );
    }

    // If we have a subscription ID, cancel it directly
    if (profile.stripe_subscription_id) {
      try {
        // Cancel at period end (user keeps access until billing period ends)
        await stripe.subscriptions.update(profile.stripe_subscription_id, {
          cancel_at_period_end: true,
        });

        // Update profile to reflect pending cancellation
        await supabase
          .from('polybot_profiles')
          .update({
            subscription_status: 'canceling',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        return NextResponse.json({
          success: true,
          message: 'Subscription will be cancelled at the end of the billing period.',
        });
      } catch (stripeError: any) {
        console.error('Stripe cancellation error:', stripeError);
        return NextResponse.json(
          { error: stripeError.message || 'Failed to cancel subscription' },
          { status: 500 }
        );
      }
    }

    // If no subscription ID stored, try to find it from Stripe
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return NextResponse.json(
          { error: 'No active subscription found.' },
          { status: 404 }
        );
      }

      const subscription = subscriptions.data[0];

      // Cancel at period end
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });

      // Update profile with subscription ID and canceling status
      await supabase
        .from('polybot_profiles')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: 'canceling',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      return NextResponse.json({
        success: true,
        message: 'Subscription will be cancelled at the end of the billing period.',
      });
    } catch (stripeError: any) {
      console.error('Stripe subscription lookup error:', stripeError);
      return NextResponse.json(
        { error: stripeError.message || 'Failed to find subscription' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Subscription cancellation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
