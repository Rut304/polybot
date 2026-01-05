import { NextRequest, NextResponse } from 'next/server';
import { getAwsSecrets, updateAwsSecrets } from '@/lib/aws-secrets';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

/**
 * Sync secrets between AWS and Supabase
 * 
 * AWS Secrets Manager is the SOURCE OF TRUTH.
 * This endpoint:
 * 1. Reads all secrets from AWS
 * 2. Updates Supabase metadata to reflect what's in AWS
 * 3. Optionally syncs any Supabase-only keys TO AWS (for keys entered via old UI)
 */
export async function POST() {
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }
  
  try {
    // Step 1: Get all secrets from AWS (source of truth)
    const awsSecrets = await getAwsSecrets(true); // Force refresh
    const awsKeyCount = Object.keys(awsSecrets).length;
    
    if (awsKeyCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'No secrets found in AWS. Check AWS credentials.',
      }, { status: 500 });
    }
    
    // Step 2: Get current Supabase metadata
    const { data: supabaseSecrets, error: fetchError } = await supabaseAdmin
      .from('polybot_secrets')
      .select('key_name, key_value, is_configured');
    
    if (fetchError) throw fetchError;
    
    const supabaseMap = new Map(
      (supabaseSecrets || []).map(s => [s.key_name, s])
    );
    
    // Step 3: Check for any Supabase-only keys that need to go to AWS
    const supabaseOnlyKeys: string[] = [];
    const keysToSyncToAws: Record<string, string> = {};
    
    for (const [keyName, secret] of supabaseMap) {
      if (secret.key_value && !awsSecrets[keyName]) {
        supabaseOnlyKeys.push(keyName);
        keysToSyncToAws[keyName] = secret.key_value;
      }
    }
    
    // Step 4: Sync Supabase-only keys TO AWS
    let syncedToAws = 0;
    if (Object.keys(keysToSyncToAws).length > 0) {
      try {
        await updateAwsSecrets(keysToSyncToAws);
        syncedToAws = Object.keys(keysToSyncToAws).length;
        console.log(`[sync-aws] Synced ${syncedToAws} keys from Supabase to AWS`);
      } catch (err) {
        console.error('[sync-aws] Failed to sync keys to AWS:', err);
      }
    }
    
    // Step 5: Update Supabase metadata to reflect AWS state
    let updatedInSupabase = 0;
    const errors: string[] = [];
    
    // Refresh AWS secrets after potential sync
    const finalAwsSecrets = syncedToAws > 0 ? await getAwsSecrets(true) : awsSecrets;
    
    for (const [keyName, value] of Object.entries(finalAwsSecrets)) {
      if (!value) continue;
      
      try {
        // Upsert metadata in Supabase (but NOT the value - AWS is source of truth)
        const { error: upsertError } = await supabaseAdmin
          .from('polybot_secrets')
          .upsert({
            key_name: keyName,
            is_configured: true,
            synced_aws: true,
            aws_sync_time: new Date().toISOString(),
            last_updated: new Date().toISOString(),
          }, {
            onConflict: 'key_name',
            ignoreDuplicates: false,
          });
        
        if (upsertError) throw upsertError;
        updatedInSupabase++;
      } catch (err: any) {
        errors.push(`${keyName}: ${err.message}`);
      }
    }
    
    // Step 6: Mark keys NOT in AWS as not configured
    for (const [keyName, secret] of supabaseMap) {
      if (!finalAwsSecrets[keyName] && secret.is_configured) {
        try {
          await supabaseAdmin
            .from('polybot_secrets')
            .update({ is_configured: false, synced_aws: false })
            .eq('key_name', keyName);
        } catch (err: any) {
          errors.push(`${keyName}: ${err.message}`);
        }
      }
    }
    
    // Log activity
    try {
      await supabaseAdmin
        .from('polybot_activity_log')
        .insert({
          action: 'sync_aws_secrets',
          details: {
            aws_key_count: Object.keys(finalAwsSecrets).length,
            synced_to_aws: syncedToAws,
            updated_in_supabase: updatedInSupabase,
            supabase_only_keys: supabaseOnlyKeys,
            errors: errors.length > 0 ? errors : undefined,
          },
          created_at: new Date().toISOString(),
        });
    } catch (logErr) {
      console.error('[sync-aws] Failed to log activity:', logErr);
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'AWS ↔ Supabase sync complete',
      details: {
        aws_secrets_count: Object.keys(finalAwsSecrets).length,
        synced_to_aws: syncedToAws,
        synced_to_aws_keys: supabaseOnlyKeys,
        updated_supabase_metadata: updatedInSupabase,
      },
      // Legacy field for UI compatibility
      synced: updatedInSupabase,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error in AWS sync:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync with AWS Secrets Manager' },
      { status: 500 }
    );
  }
}
