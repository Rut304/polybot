import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, logAuditEvent, checkRateLimit, getRequestMetadata, rateLimitResponse, unauthorizedResponse } from '@/lib/audit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Check if we have the required environment variables
const hasServiceKey = supabaseUrl && supabaseServiceKey;

// Server-side Supabase client with admin privileges (only if key exists)
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }

  const metadata = await getRequestMetadata(request);

  // Rate limiting
  const rateLimitResult = await checkRateLimit(metadata.ip_address, 'secrets.get', 60, 60);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.resetAt);
  }

  // Auth verification
  const authResult = await verifyAuth(request);
  if (!authResult) {
    await logAuditEvent({
      action: 'secret.view',
      resource_type: 'secret',
      resource_id: 'all',
      details: { error: 'Unauthorized access attempt' },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'warning',
    });
    return unauthorizedResponse();
  }
  
  try {
    const { data, error } = await supabaseAdmin
      .from('polybot_secrets')
      .select('*')
      .order('category')
      .order('key_name');

    if (error) throw error;

    // Mask sensitive values for frontend
    const maskedData = (data || []).map((secret: any) => ({
      ...secret,
      key_value: secret.key_value 
        ? (secret.key_value.length <= 8 
            ? '********' 
            : `${secret.key_value.substring(0, 4)}...${secret.key_value.substring(secret.key_value.length - 4)}`)
        : null,
      is_configured: !!secret.key_value,
    }));

    // Log successful view
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'secret.view',
      resource_type: 'secret',
      resource_id: 'all',
      details: { count: maskedData.length },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({ secrets: maskedData });
  } catch (error: any) {
    console.error('Error fetching secrets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch secrets' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }

  const metadata = await getRequestMetadata(request);

  // Rate limiting
  const rateLimitResult = await checkRateLimit(metadata.ip_address, 'secrets.put', 30, 60);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.resetAt);
  }

  // Auth verification
  const authResult = await verifyAuth(request);
  if (!authResult) {
    await logAuditEvent({
      action: 'secret.update',
      resource_type: 'secret',
      resource_id: 'unknown',
      details: { error: 'Unauthorized update attempt' },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'warning',
    });
    return unauthorizedResponse();
  }
  
  try {
    const body = await request.json();
    const { key_name, key_value } = body;

    if (!key_name) {
      return NextResponse.json(
        { error: 'key_name is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('polybot_secrets')
      .update({
        key_value: key_value || null,
        is_configured: !!key_value,
        last_updated: new Date().toISOString(),
      })
      .eq('key_name', key_name);

    if (error) throw error;

    // Log successful update
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'secret.update',
      resource_type: 'secret',
      resource_id: key_name,
      details: { 
        key_name,
        has_value: !!key_value,
        value_length: key_value?.length || 0,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({ 
      success: true, 
      message: `${key_name} updated successfully` 
    });
  } catch (error: any) {
    console.error('Error updating secret:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update secret' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }

  const metadata = await getRequestMetadata(request);

  // Rate limiting
  const rateLimitResult = await checkRateLimit(metadata.ip_address, 'secrets.post', 30, 60);
  if (!rateLimitResult.allowed) {
    return rateLimitResponse(rateLimitResult.resetAt);
  }

  // Auth verification
  const authResult = await verifyAuth(request);
  if (!authResult) {
    await logAuditEvent({
      action: 'secret.update',
      resource_type: 'secret',
      resource_id: 'unknown',
      details: { error: 'Unauthorized create attempt' },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'warning',
    });
    return unauthorizedResponse();
  }
  
  try {
    const body = await request.json();
    const { key_name, key_value, description, category } = body;

    if (!key_name) {
      return NextResponse.json(
        { error: 'key_name is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('polybot_secrets')
      .upsert({
        key_name,
        key_value: key_value || null,
        description: description || '',
        category: category || 'general',
        is_configured: !!key_value,
        last_updated: new Date().toISOString(),
      });

    if (error) throw error;

    // Log successful create
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'secret.update',
      resource_type: 'secret',
      resource_id: key_name,
      details: { 
        key_name,
        category,
        has_value: !!key_value,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({ 
      success: true, 
      message: `${key_name} saved successfully` 
    });
  } catch (error: any) {
    console.error('Error saving secret:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save secret' },
      { status: 500 }
    );
  }
}
