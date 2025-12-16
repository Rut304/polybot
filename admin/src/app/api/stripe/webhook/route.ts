import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

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

                if (userId) {
                    // Update user profile with customer ID and active status
                    await supabase
                        .from('polybot_profiles')
                        .upsert({ 
                            id: userId, 
                            stripe_customer_id: customerId,
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

                // Map Stripe status to our internal status
                // active, trialing -> active
                // past_due, canceled, unpaid -> inactive
                const isActive = ['active', 'trialing'].includes(status);
                const internalStatus = isActive ? 'active' : 'inactive';

                // Find user by customer ID
                const { data: profiles } = await supabase
                    .from('polybot_profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId);
                
                if (profiles && profiles.length > 0) {
                    await supabase
                        .from('polybot_profiles')
                        .update({ 
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

                const { data: profiles } = await supabase
                    .from('polybot_profiles')
                    .select('id')
                    .eq('stripe_customer_id', customerId);

                if (profiles && profiles.length > 0) {
                     await supabase
                        .from('polybot_profiles')
                        .update({ 
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
