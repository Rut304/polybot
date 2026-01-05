/**
 * AWS Secrets Manager helper for admin app
 * 
 * This module provides a unified way to fetch secrets from AWS Secrets Manager.
 * All API keys should be stored in AWS, not in Supabase (which only stores metadata).
 * 
 * Required env vars:
 * - AMAZON_ACCESS_KEY_ID (NOT AWS_ACCESS_KEY_ID)
 * - AMAZON_SECRET_ACCESS_KEY  
 * - AWS_REGION (must be plain value like "us-east-1", no quotes in Vercel)
 */
import { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } from '@aws-sdk/client-secrets-manager';

// Singleton client
let secretsClient: SecretsManagerClient | null = null;

// Cache for secrets (expires after 5 minutes)
let secretsCache: Record<string, string> = {};
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the AWS Secrets Manager client
 */
function getSecretsClient(): SecretsManagerClient | null {
  if (secretsClient) return secretsClient;
  
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AMAZON_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AMAZON_SECRET_ACCESS_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    console.warn('AWS credentials not configured (AMAZON_ACCESS_KEY_ID, AMAZON_SECRET_ACCESS_KEY)');
    return null;
  }
  
  secretsClient = new SecretsManagerClient({ 
    region,
    credentials: { accessKeyId, secretAccessKey }
  });
  
  return secretsClient;
}

/**
 * Fetch all secrets from AWS Secrets Manager (polybot/trading-keys bundle)
 * Returns a map of key_name -> key_value
 */
export async function getAwsSecrets(forceRefresh = false): Promise<Record<string, string>> {
  // Check cache
  const now = Date.now();
  if (!forceRefresh && secretsCache && Object.keys(secretsCache).length > 0) {
    if (now - cacheTimestamp < CACHE_TTL_MS) {
      console.log(`[AWS] Using cached secrets (${Object.keys(secretsCache).length} keys)`);
      return secretsCache;
    }
  }
  
  const client = getSecretsClient();
  if (!client) {
    console.error('[AWS] Secrets Manager not available - missing AMAZON_ACCESS_KEY_ID or AMAZON_SECRET_ACCESS_KEY');
    return {};
  }
  
  // Debug: Log AWS config
  const region = process.env.AWS_REGION || 'us-east-1';
  console.log(`[AWS] Region: "${region}", Length: ${region.length}`);
  console.log(`[AWS] Access Key present: ${!!process.env.AMAZON_ACCESS_KEY_ID}`);
  
  try {
    const command = new GetSecretValueCommand({
      SecretId: 'polybot/trading-keys'
    });
    
    console.log('[AWS] Sending GetSecretValueCommand...');
    const response = await client.send(command);
    
    if (response.SecretString) {
      secretsCache = JSON.parse(response.SecretString);
      cacheTimestamp = now;
      console.log(`[AWS] ✓ Loaded ${Object.keys(secretsCache).length} secrets from AWS`);
      return secretsCache;
    } else {
      console.error('[AWS] No SecretString in response');
    }
  } catch (error: any) {
    console.error('[AWS] Failed to fetch secrets:', error.message);
    if (error.name) console.error('[AWS] Error name:', error.name);
  }
  
  return {};
}

/**
 * Get a single secret by key name
 */
export async function getAwsSecret(keyName: string): Promise<string | null> {
  const secrets = await getAwsSecrets();
  return secrets[keyName] || null;
}

/**
 * Check if AWS Secrets Manager is configured
 */
export function isAwsConfigured(): boolean {
  return !!(process.env.AMAZON_ACCESS_KEY_ID && process.env.AMAZON_SECRET_ACCESS_KEY);
}

/**
 * Clear the secrets cache (useful for testing)
 */
export function clearSecretsCache(): void {
  secretsCache = {};
  cacheTimestamp = 0;
}

/**
 * Update a single secret in AWS Secrets Manager
 * This merges the new key into the existing polybot/trading-keys bundle
 */
export async function updateAwsSecret(keyName: string, keyValue: string): Promise<{ success: boolean; error?: string }> {
  const client = getSecretsClient();
  if (!client) {
    return { success: false, error: 'AWS Secrets Manager not configured' };
  }

  try {
    // Get current secrets bundle
    const currentSecrets = await getAwsSecrets(true); // Force refresh
    
    // Update or add the new key
    const updatedSecrets = {
      ...currentSecrets,
      [keyName]: keyValue,
    };
    
    // Write back to AWS
    const command = new UpdateSecretCommand({
      SecretId: 'polybot/trading-keys',
      SecretString: JSON.stringify(updatedSecrets),
    });
    
    await client.send(command);
    
    // Update local cache
    secretsCache = updatedSecrets;
    cacheTimestamp = Date.now();
    
    console.log(`[AWS] ✓ Updated secret: ${keyName}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[AWS] Failed to update secret ${keyName}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update multiple secrets at once (more efficient than individual updates)
 */
export async function updateAwsSecrets(secrets: Record<string, string>): Promise<{ success: boolean; error?: string; updated: string[] }> {
  const client = getSecretsClient();
  if (!client) {
    return { success: false, error: 'AWS Secrets Manager not configured', updated: [] };
  }

  try {
    // Get current secrets bundle
    const currentSecrets = await getAwsSecrets(true); // Force refresh
    
    // Merge new secrets
    const updatedSecrets = {
      ...currentSecrets,
      ...secrets,
    };
    
    // Write back to AWS
    const command = new UpdateSecretCommand({
      SecretId: 'polybot/trading-keys',
      SecretString: JSON.stringify(updatedSecrets),
    });
    
    await client.send(command);
    
    // Update local cache
    secretsCache = updatedSecrets;
    cacheTimestamp = Date.now();
    
    const updatedKeys = Object.keys(secrets);
    console.log(`[AWS] ✓ Updated ${updatedKeys.length} secrets: ${updatedKeys.join(', ')}`);
    return { success: true, updated: updatedKeys };
  } catch (error: any) {
    console.error('[AWS] Failed to update secrets:', error.message);
    return { success: false, error: error.message, updated: [] };
  }
}
