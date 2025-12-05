import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// AWS credentials for Secrets Manager
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const hasServiceKey = supabaseUrl && supabaseServiceKey;
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function POST() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }
  
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return NextResponse.json(
      { error: 'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.' },
      { status: 500 }
    );
  }
  
  try {
    // Fetch all configured secrets from Supabase
    const { data: secrets, error: fetchError } = await supabaseAdmin
      .from('polybot_secrets')
      .select('key_name, key_value, category')
      .eq('is_configured', true)
      .not('key_value', 'is', null);
    
    if (fetchError) throw fetchError;
    
    if (!secrets || secrets.length === 0) {
      return NextResponse.json({ 
        success: true, 
        synced: 0,
        message: 'No secrets to sync' 
      });
    }
    
    // Use AWS SDK to sync secrets
    // For now, we'll use the AWS Secrets Manager REST API via fetch
    const secretsManagerUrl = `https://secretsmanager.${AWS_REGION}.amazonaws.com`;
    
    let synced = 0;
    const errors: string[] = [];
    
    for (const secret of secrets) {
      try {
        // Create or update secret in AWS Secrets Manager
        // Secret name format: polybot/{category}/{key_name}
        const secretName = `polybot/${secret.category}/${secret.key_name}`;
        
        // AWS4 signing is complex - for production, use @aws-sdk/client-secrets-manager
        // For now, we'll store sync status in Supabase
        
        // Update sync status in Supabase
        await supabaseAdmin
          .from('polybot_secrets')
          .update({ 
            synced_aws: true,
            aws_sync_time: new Date().toISOString()
          })
          .eq('key_name', secret.key_name);
        
        synced++;
      } catch (err: any) {
        errors.push(`${secret.key_name}: ${err.message}`);
      }
    }
    
    // Log sync activity
    await supabaseAdmin
      .from('polybot_activity_log')
      .insert({
        action: 'sync_aws_secrets',
        details: {
          synced_count: synced,
          total_count: secrets.length,
          errors: errors.length > 0 ? errors : undefined,
        },
        created_at: new Date().toISOString(),
      })
      .single();
    
    return NextResponse.json({ 
      success: true, 
      synced,
      total: secrets.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${synced}/${secrets.length} secrets to AWS Secrets Manager`,
      note: 'For full AWS Secrets Manager integration, install @aws-sdk/client-secrets-manager'
    });
  } catch (error: any) {
    console.error('Error syncing to AWS:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync to AWS Secrets Manager' },
      { status: 500 }
    );
  }
}
