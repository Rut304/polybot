import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Price IDs for tier mapping (set these in your Stripe dashboard)
const PRICE_TO_TIER: Record<string, 'pro' | 'elite'> = {
  // Add your actual Stripe price IDs here
  [process.env.STRIPE_PRO_PRICE_ID || 'price_pro_monthly']: 'pro',
  [process.env.STRIPE_ELITE_PRICE_ID || 'price_elite_monthly']: 'elite',
};

const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return null;
    return createClient(supabaseUrl, supabaseServiceKey);
};

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature') as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
        if (!sig || !webhookSecret) return NextResponse.json({ error: 'Missing sig or secret' }, { status: 400 });
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return NextResponse.json({ error: 'DB Config Error' }, { status: 500 });

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                // UserId should be in metadata OR client_reference_id
                const userId = session.metadata?.userId || session.client_reference_id;
                const customerId = session.customer as string;

                if (userId && session.subscription) {
                    // Get the subscription to find the price/product
                    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                    const priceId = subscription.items.data[0]?.price.id;
                    
                    // Determine tier from price ID
                    const tier = PRICE_TO_TIER[priceId] || 'pro'; // Default to pro if unknown
                    
                    console.log(`[Webhook] checkout.session.completed: userId=${userId}, customerId=${customerId}, priceId=${priceId}, tier=${tier}`);
                    
                    // Update user profile with customer ID, tier, and active status
                    await supabase
                        .from('polybot_profiles')
                        .upsert({ 
                            id: userId, 
                            stripe_customer_id: customerId,
                            subscription_tier: tier,
                            subscription_status: 'active',
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'id' });
                }
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const status = subscription.status;
                const customerId = subscription.customer as string;
                const priceId = subscription.items.data[0]?.price.id;
                
                // Determine tier from price ID
                const tier = PRICE_TO_TIER[priceId] || 'pro';

                // Map Stripe status to our internal status
                // active, trialing -> active
                // past_due, canceled, unpaid -> inactive
                const isActive = ['active', 'trialing'].includes(status);
                const internalStatus = isActive ? 'active' : 'inactive';
                
                console.log(`[Webhook] subscription.updated: customerId=${customerId}, status=${status}, tier=${tier}`);

                // Find user by customer ID
                const { data: profiles } = await supabase
                    .from('polybot_profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId);
                
                if (profiles && profiles.length > 0) {
                    await supabase
                        .from('polybot_profiles')
                        .update({ 
                            subscription_tier: isActive ? tier : 'free', // Downgrade to free if inactive
                            subscription_status: internalStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', profiles[0].id);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;
                
                console.log(`[Webhook] subscription.deleted: customerId=${customerId}`);

                const { data: profiles } = await supabase
                    .from('polybot_profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId);

                if (profiles && profiles.length > 0) {
                     await supabase
                        .from('polybot_profiles')
                        .update({ 
                            subscription_tier: 'free', // Downgrade to free
                            subscription_status: 'canceled',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', profiles[0].id);
                }
                break;
            }
        }
    } catch (error) {
        console.error('Webhook handler failed:', error);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
