import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * IBKR OAuth Start Endpoint
 *
 * This endpoint initiates the IBKR OAuth flow for connecting
 * a user's Interactive Brokers account.
 *
 * Two modes:
 * 1. OAuth (Web API) - For users who want seamless integration
 * 2. Manual (TWS API) - For users running IB Gateway locally
 *
 * NOTE: IBKR OAuth requires:
 * - Registered application with IBKR
 * - Consumer Key and Secret
 * - OAuth redirect URI configured
 */

// Lazy-initialize Supabase admin client
let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (!supabase && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

// IBKR OAuth Configuration
// These would be obtained from IBKR's Developer Portal
const IBKR_OAUTH_CONFIG = {
  // OAuth 1.0a endpoints (IBKR uses OAuth 1.0a, not 2.0)
  requestTokenUrl: 'https://api.ibkr.com/oauth/request_token',
  authorizeUrl: 'https://api.ibkr.com/oauth/authorize',
  accessTokenUrl: 'https://api.ibkr.com/oauth/access_token',

  // These need to be set in your environment
  consumerKey: process.env.IBKR_CONSUMER_KEY,
  consumerSecret: process.env.IBKR_CONSUMER_SECRET,
  callbackUrl: process.env.IBKR_CALLBACK_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/ibkr/oauth/callback`,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, returnUrl } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if OAuth is configured
    if (!IBKR_OAUTH_CONFIG.consumerKey || !IBKR_OAUTH_CONFIG.consumerSecret) {
      // OAuth not configured - return message to use manual setup
      return NextResponse.json({
        message:
          'IBKR OAuth is not configured. Please use Manual Setup to ' +
          'connect your account. You will need to run IB Gateway or TWS locally.',
        manualSetupRequired: true,
        instructions: [
          'Download IB Gateway or TWS from interactivebrokers.com',
          'Enable API access in Gateway/TWS settings',
          'Set socket port to 4001 (live) or 4002 (paper)',
          'Allow connections from localhost',
          'Enter your Account ID in the form',
        ],
      });
    }

    // OAuth IS configured - start the flow
    // Step 1: Get request token from IBKR
    // This is OAuth 1.0a, which requires a more complex flow

    // For now, we'll use a simplified placeholder
    // In production, you'd implement full OAuth 1.0a here
    // using a library like oauth-1.0a

    // Store the pending auth state
    const stateToken = crypto.randomUUID();
    
    const supabaseClient = getSupabase();
    if (!supabaseClient) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    await supabaseClient
      .from('oauth_states')
      .insert({
        state: stateToken,
        user_id: userId,
        provider: 'ibkr',
        return_url: returnUrl,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    // TODO: Implement full OAuth 1.0a flow
    // For now, return a message about manual setup

    return NextResponse.json({
      message:
        'IBKR OAuth flow is being implemented. ' +
        'For now, please use Manual Setup.',
      manualSetupRequired: true,
      // When OAuth is ready:
      // authUrl: `${IBKR_OAUTH_CONFIG.authorizeUrl}?...`,
    });
  } catch (error) {
    console.error('Error starting IBKR OAuth:', error);
    return NextResponse.json(
      {
        error: 'Failed to start IBKR connection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
