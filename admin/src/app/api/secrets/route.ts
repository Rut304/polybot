import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth, logAuditEvent, checkRateLimit, getRequestMetadata, rateLimitResponse, unauthorizedResponse } from '@/lib/audit';
import { getAwsSecrets, updateAwsSecrets, clearSecretsCache } from '@/lib/aws-secrets';

import { getSupabaseAdmin } from '../../../lib/supabase-admin';

// Removed top-level initialization to prevent build crashes
// using getSupabaseAdmin() inside handlers instead.

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  
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
    // Get metadata from Supabase (key_name, description, category)
    console.log('[/api/secrets] Fetching secrets metadata from Supabase...');
    const { data, error } = await supabaseAdmin
      .from('polybot_secrets')
      .select('*')
      .order('category')
      .order('key_name');

    if (error) {
      console.error('[/api/secrets] Supabase query error:', error);
      throw error;
    }
    console.log(`[/api/secrets] Got ${data?.length || 0} secrets from Supabase`);

    // Get actual secrets from AWS Secrets Manager (PRIMARY SOURCE)
    console.log('[/api/secrets] Fetching from AWS Secrets Manager...');
    const awsSecrets = await getAwsSecrets();
    const awsKeyCount = Object.keys(awsSecrets).length;
    console.log(`[/api/secrets] Got ${awsKeyCount} secrets from AWS`);
    
    // Merge: use Supabase for metadata, AWS for is_configured status
    const maskedData = (data || []).map((secret: any) => {
      const hasAwsValue = !!awsSecrets[secret.key_name];
      const maskedValue = hasAwsValue ? '••••••••' : null;
      
      return {
        ...secret,
        key_value: maskedValue,
        is_configured: hasAwsValue,
      };
    });
    
    // Count configured vs not configured
    const configuredCount = maskedData.filter((s: any) => s.is_configured).length;
    console.log(`[/api/secrets] ${configuredCount}/${maskedData.length} secrets are configured`);

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
  const supabaseAdmin = getSupabaseAdmin();

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
  const supabaseAdmin = getSupabaseAdmin();

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
    
    // Handle both formats:
    // 1. { secrets: { KEY1: 'value1', KEY2: 'value2' } } - from wizard
    // 2. { key_name: 'KEY', key_value: 'value' } - from API keys page
    
    let secretsToSave: Record<string, string> = {};
    
    if (body.secrets && typeof body.secrets === 'object') {
      // Wizard format: { secrets: { KEY1: 'val1', KEY2: 'val2' } }
      secretsToSave = body.secrets;
    } else if (body.key_name) {
      // Single key format: { key_name: 'KEY', key_value: 'value' }
      secretsToSave = { [body.key_name]: body.key_value || '' };
    } else {
      return NextResponse.json(
        { error: 'Invalid request format. Expected { secrets: {...} } or { key_name, key_value }' },
        { status: 400 }
      );
    }
    
    // Filter out empty values
    const nonEmptySecrets: Record<string, string> = {};
    for (const [key, value] of Object.entries(secretsToSave)) {
      if (value && value.trim()) {
        nonEmptySecrets[key] = value.trim();
      }
    }
    
    if (Object.keys(nonEmptySecrets).length === 0) {
      return NextResponse.json(
        { error: 'No secrets to save - all values are empty' },
        { status: 400 }
      );
    }
    
    console.log(`[POST /api/secrets] Saving ${Object.keys(nonEmptySecrets).length} secrets to AWS:`, Object.keys(nonEmptySecrets));
    
    // PRIMARY: Save to AWS Secrets Manager (source of truth)
    const awsResult = await updateAwsSecrets(nonEmptySecrets);
    
    if (!awsResult.success) {
      console.error('[POST /api/secrets] AWS save failed:', awsResult.error);
      return NextResponse.json(
        { error: `Failed to save to AWS: ${awsResult.error}` },
        { status: 500 }
      );
    }
    
    // SECONDARY: Update metadata in Supabase for each key
    for (const keyName of Object.keys(nonEmptySecrets)) {
      await supabaseAdmin
        .from('polybot_secrets')
        .upsert({
          key_name: keyName,
          is_configured: true,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'key_name' });
    }

    // Log successful create
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'secret.update',
      resource_type: 'secret',
      resource_id: awsResult.updated.join(','),
      details: { 
        keys_saved: awsResult.updated,
        count: awsResult.updated.length,
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'info',
    });

    return NextResponse.json({ 
      success: true, 
      message: `Successfully saved ${awsResult.updated.length} API key(s)`,
      saved: awsResult.updated,
    });
  } catch (error: any) {
    console.error('Error saving secret:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save secret' },
      { status: 500 }
    );
  }
}
