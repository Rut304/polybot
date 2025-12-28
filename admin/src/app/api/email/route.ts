import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '@/lib/audit';
import {
  sendEmail,
  sendWelcomeEmail,
  sendTradeAlertEmail,
  sendDailySummaryEmail,
  sendAlertEmail,
  TradeAlertData,
  DailySummaryData,
  AlertData,
} from '@/lib/email';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Initialize Supabase admin client
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ============================================================================
// POST - Send an email
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get the auth token from cookies
    const authCookie = request.cookies.get('sb-access-token')?.value;
    
    if (!authCookie && !process.env.ALLOW_UNAUTHENTICATED_EMAILS) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user if authenticated
    let userEmail: string | undefined;
    if (authCookie && supabaseAdmin) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(authCookie);
      if (error || !user) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
      userEmail = user.email;
    }

    const body = await request.json();
    const { type, to, data } = body;

    if (!type) {
      return NextResponse.json({ error: 'Email type is required' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'custom': {
        // Custom email with full control
        const { subject, html, text, replyTo } = data;
        if (!to || !subject || !html) {
          return NextResponse.json(
            { error: 'to, subject, and html are required for custom emails' },
            { status: 400 }
          );
        }
        result = await sendEmail({ to, subject, html, text, replyTo });
        break;
      }

      case 'welcome': {
        // Welcome email
        const { name } = data;
        if (!to || !name) {
          return NextResponse.json(
            { error: 'to and name are required for welcome emails' },
            { status: 400 }
          );
        }
        result = await sendWelcomeEmail(to, name);
        break;
      }

      case 'trade_alert': {
        // Trade alert email
        const tradeData: TradeAlertData = data;
        if (!to || !tradeData.action || !tradeData.market) {
          return NextResponse.json(
            { error: 'to and trade data are required for trade alerts' },
            { status: 400 }
          );
        }
        result = await sendTradeAlertEmail(to, tradeData);
        break;
      }

      case 'daily_summary': {
        // Daily summary email
        const summaryData: DailySummaryData = data;
        if (!to || !summaryData.date) {
          return NextResponse.json(
            { error: 'to and summary data are required for daily summaries' },
            { status: 400 }
          );
        }
        result = await sendDailySummaryEmail(to, summaryData);
        break;
      }

      case 'alert': {
        // Alert/warning email
        const alertData: AlertData = data;
        if (!to || !alertData.title || !alertData.message) {
          return NextResponse.json(
            { error: 'to, title, and message are required for alerts' },
            { status: 400 }
          );
        }
        result = await sendAlertEmail(to, alertData);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown email type: ${type}` },
          { status: 400 }
        );
    }

    // Log the email send
    if (supabaseAdmin) {
      await logAuditEvent({
        user_email: userEmail,
        action: 'user.update', // Closest available action
        resource_type: 'user',
        resource_id: to,
        details: {
          email_type: type,
          success: result.success,
          email_id: result.id,
        },
        severity: 'info',
      });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.id,
    });
  } catch (error: any) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Test email configuration
// ============================================================================

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const hasResendKey = !!process.env.RESEND_API_KEY;
  const hasFromEmail = !!process.env.FROM_EMAIL;

  return NextResponse.json({
    configured: hasResendKey,
    settings: {
      hasResendKey,
      hasFromEmail,
      fromEmail: process.env.FROM_EMAIL || 'noreply@polyparlay.io',
    },
  });
}
