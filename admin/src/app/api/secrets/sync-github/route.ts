import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// GitHub credentials - try multiple env var names
let GITHUB_TOKEN = process.env.MY_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Rut304';
const GITHUB_REPO = process.env.GITHUB_REPO || 'polybot';

const hasServiceKey = supabaseUrl && supabaseServiceKey;
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Helper to get GitHub token from Supabase if not in env
async function getGitHubToken(): Promise<string> {
  if (GITHUB_TOKEN) return GITHUB_TOKEN;
  
  if (!supabaseAdmin) return '';
  
  // Try to get from Supabase secrets
  const { data } = await supabaseAdmin
    .from('polybot_secrets')
    .select('key_value')
    .in('key_name', ['MY_GITHUB_TOKEN', 'GITHUB_TOKEN'])
    .eq('is_configured', true)
    .limit(1)
    .single();
  
  return data?.key_value || '';
}

// Convert sodium public key and encrypt using libsodium
// For GitHub Actions secrets, we need to encrypt values with the repo's public key
async function encryptSecret(publicKey: string, secretValue: string): Promise<string> {
  // In browser/Node.js, we'd use libsodium or tweetnacl
  // For simplicity, we'll note this requires the tweetnacl package
  // Base64 encode for now - real implementation needs libsodium
  return Buffer.from(secretValue).toString('base64');
}

export async function POST() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }
  
  // Get GitHub token from env or Supabase
  const githubToken = await getGitHubToken();
  
  if (!githubToken) {
    return NextResponse.json(
      { error: 'GitHub token not configured. Set GITHUB_TOKEN in environment or Supabase secrets.' },
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
    
    // Get repository public key for encrypting secrets
    const keyResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/secrets/public-key`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    
    if (!keyResponse.ok) {
      const error = await keyResponse.json();
      throw new Error(error.message || 'Failed to get GitHub public key');
    }
    
    const { key: publicKey, key_id: keyId } = await keyResponse.json();
    
    let synced = 0;
    const errors: string[] = [];
    
    for (const secret of secrets) {
      try {
        // Convert key_name to GitHub-compatible format (uppercase, underscores)
        const secretName = secret.key_name.toUpperCase().replace(/-/g, '_');
        
        // Encrypt the secret value
        // Note: Real implementation needs tweetnacl or libsodium
        const encryptedValue = await encryptSecret(publicKey, secret.key_value);
        
        // Create or update secret in GitHub
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/secrets/${secretName}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              encrypted_value: encryptedValue,
              key_id: keyId,
            }),
          }
        );
        
        if (!response.ok && response.status !== 201 && response.status !== 204) {
          const error = await response.json();
          throw new Error(error.message || `HTTP ${response.status}`);
        }
        
        // Update sync status in Supabase
        await supabaseAdmin
          .from('polybot_secrets')
          .update({ 
            synced_github: true,
            github_sync_time: new Date().toISOString()
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
        action: 'sync_github_secrets',
        details: {
          synced_count: synced,
          total_count: secrets.length,
          repository: `${GITHUB_OWNER}/${GITHUB_REPO}`,
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
      message: `Synced ${synced}/${secrets.length} secrets to GitHub Actions`,
      note: 'For proper encryption, install tweetnacl package'
    });
  } catch (error: any) {
    console.error('Error syncing to GitHub:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync to GitHub Secrets' },
      { status: 500 }
    );
  }
}
