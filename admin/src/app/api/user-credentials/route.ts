/**
 * API Route: User Exchange Credentials
 * 
 * Multi-tenant API key management.
 * Each user stores their own exchange credentials separate from global secrets.
 * 
 * Table: user_exchange_credentials
 * Columns: user_id, exchange, access_token (api_key), refresh_token (api_secret), etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth, logAuditEvent, checkRateLimit, getRequestMetadata, rateLimitResponse, unauthorizedResponse } from '@/lib/audit';

// Supported exchanges
const SUPPORTED_EXCHANGES = [
  'alpaca',
  'binance',
  'bybit',
  'okx',
  'kraken',
  'coinbase',
  'kucoin',
  'ibkr',
  'robinhood',
  'webull',
];

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  const metadata = await getRequestMetadata(request);

  // Rate limiting
  const rateLimitResult = await checkRateLimit(metadata.ip_address, 'user-credentials.get', 60, 60);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.resetAt);
  }

  // Auth verification - get user_id
  const authResult = await verifyAuth(request);
  if (!authResult?.user_id) {
    return unauthorizedResponse();
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_exchange_credentials')
      .select('exchange, account_id, is_paper, last_authenticated, created_at')
      .eq('user_id', authResult.user_id)
      .order('exchange');

    if (error) throw error;

    // Return list of connected exchanges (no secrets exposed)
    const connections = (data || []).map((cred: any) => ({
      exchange: cred.exchange,
      account_id: cred.account_id,
      is_paper: cred.is_paper,
      connected: true,
      last_authenticated: cred.last_authenticated,
      created_at: cred.created_at,
    }));

    // Add unconnected exchanges
    const connectedExchanges = new Set(connections.map((c: any) => c.exchange));
    for (const exchange of SUPPORTED_EXCHANGES) {
      if (!connectedExchanges.has(exchange)) {
        connections.push({
          exchange,
          account_id: null,
          is_paper: true,
          connected: false,
          last_authenticated: null,
          created_at: null,
        });
      }
    }

    // Sort alphabetically
    connections.sort((a: any, b: any) => a.exchange.localeCompare(b.exchange));

    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'user_credentials.view',
      resource_type: 'user_exchange_credentials',
      resource_id: 'all',
      details: { connected_count: data?.length || 0 },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({ credentials: connections });
  } catch (error: any) {
    console.error('Error fetching user credentials:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch credentials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  const metadata = await getRequestMetadata(request);

  // Rate limiting (stricter for writes)
  const rateLimitResult = await checkRateLimit(metadata.ip_address, 'user-credentials.post', 10, 60);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.resetAt);
  }

  // Auth verification
  const authResult = await verifyAuth(request);
  if (!authResult?.user_id) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    const { exchange, api_key, api_secret, password, account_id, is_paper } = body;

    // Validate exchange
    if (!exchange || !SUPPORTED_EXCHANGES.includes(exchange.toLowerCase())) {
      return NextResponse.json(
        { error: `Invalid exchange. Supported: ${SUPPORTED_EXCHANGES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!api_key) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Upsert credentials (insert or update)
    const credentialData = {
      user_id: authResult.user_id,
      exchange: exchange.toLowerCase(),
      access_token: api_key,  // Store API key here
      refresh_token: api_secret || null,  // Store API secret here
      consumer_key: password || null,  // Store passphrase here (OKX, KuCoin)
      account_id: account_id || null,
      is_paper: is_paper !== false,  // Default to paper trading
      last_authenticated: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('user_exchange_credentials')
      .upsert(credentialData, { onConflict: 'user_id,exchange' })
      .select()
      .single();

    if (error) throw error;

    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'user_credentials.create',
      resource_type: 'user_exchange_credentials',
      resource_id: exchange,
      details: { 
        exchange, 
        is_paper, 
        has_password: !!password,
        has_secret: !!api_secret,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({
      success: true,
      message: `${exchange} credentials saved successfully`,
      credential: {
        exchange: data.exchange,
        account_id: data.account_id,
        is_paper: data.is_paper,
        connected: true,
        last_authenticated: data.last_authenticated,
      },
    });
  } catch (error: any) {
    console.error('Error saving user credentials:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save credentials' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  const metadata = await getRequestMetadata(request);

  // Rate limiting
  const rateLimitResult = await checkRateLimit(metadata.ip_address, 'user-credentials.delete', 10, 60);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.resetAt);
  }

  // Auth verification
  const authResult = await verifyAuth(request);
  if (!authResult?.user_id) {
    return unauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange');

    if (!exchange) {
      return NextResponse.json(
        { error: 'Exchange parameter is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('user_exchange_credentials')
      .delete()
      .eq('user_id', authResult.user_id)
      .eq('exchange', exchange.toLowerCase());

    if (error) throw error;

    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'user_credentials.delete',
      resource_type: 'user_exchange_credentials',
      resource_id: exchange,
      details: { exchange },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({
      success: true,
      message: `${exchange} credentials deleted`,
    });
  } catch (error: any) {
    console.error('Error deleting user credentials:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete credentials' },
      { status: 500 }
    );
  }
}
