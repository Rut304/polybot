import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAwsSecrets } from '@/lib/aws-secrets';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// GitHub credentials - try env vars first
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'Rut304';
const GITHUB_REPO = process.env.GITHUB_REPO || 'polybot';

const hasServiceKey = supabaseUrl && supabaseServiceKey;
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Helper to get GitHub token - AWS is primary source
async function getGitHubToken(): Promise<string> {
  // Check env vars first
  if (process.env.MY_GITHUB_TOKEN) return process.env.MY_GITHUB_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  
  // Fall back to AWS Secrets Manager (PRIMARY)
  try {
    const awsSecrets = await getAwsSecrets();
    return awsSecrets['MY_GITHUB_TOKEN'] || awsSecrets['GITHUB_TOKEN'] || '';
  } catch (err) {
    console.error('Failed to get GitHub token from AWS:', err);
    return '';
  }
}

// Helper to categorize secrets
function getCategoryForKey(keyName: string): string {
  if (keyName.includes('KALSHI') || keyName.includes('POLYMARKET')) return 'prediction_markets';
  if (keyName.includes('BINANCE') || keyName.includes('COINBASE') || keyName.includes('BYBIT') || keyName.includes('OKX') || keyName.includes('KRAKEN') || keyName.includes('KUCOIN')) return 'crypto_exchanges';
  if (keyName.includes('ALPACA') || keyName.includes('IBKR') || keyName.includes('WEBULL')) return 'stock_brokers';
  if (keyName.includes('FINNHUB') || keyName.includes('NEWS') || keyName.includes('TWITTER') || keyName.includes('X_')) return 'news_sentiment';
  if (keyName.includes('SUPABASE') || keyName.includes('GITHUB') || keyName.includes('AWS') || keyName.includes('AMAZON')) return 'infrastructure';
  return 'other';
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
    // Fetch all secrets from AWS (PRIMARY SOURCE)
    const awsSecrets = await getAwsSecrets();
    
    // Convert to array format for iteration
    const secrets = Object.entries(awsSecrets)
      .filter(([_, value]) => value && value.length > 0)
      .map(([key_name, key_value]) => ({
        key_name,
        key_value,
        category: getCategoryForKey(key_name),
      }));
    
    if (secrets.length === 0) {
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
