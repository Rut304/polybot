import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail, sendPasswordResetEmail, sendMagicLinkEmail } from '@/lib/email';

// Webhook secret for verification
const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;

// ============================================================================
// POST - Handle Supabase Auth webhooks
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
        console.error('Invalid webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const { type, record, old_record } = body;

    console.log(`Auth webhook received: ${type}`, { email: record?.email });

    switch (type) {
      case 'INSERT': {
        // New user signup - send welcome email
        if (record?.email) {
          const name = record.raw_user_meta_data?.name || 
                       record.raw_user_meta_data?.full_name ||
                       record.email.split('@')[0];
          
          const result = await sendWelcomeEmail(record.email, name);
          
          if (!result.success) {
            console.error('Failed to send welcome email:', result.error);
          } else {
            console.log(`Welcome email sent to ${record.email}`);
          }
        }
        break;
      }

      case 'UPDATE': {
        // User updated - could be password reset, email change, etc.
        // For now, just log it
        console.log('User updated:', record?.email);
        break;
      }

      case 'DELETE': {
        // User deleted
        console.log('User deleted:', old_record?.email);
        break;
      }

      default:
        console.log('Unknown webhook type:', type);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Auth webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
