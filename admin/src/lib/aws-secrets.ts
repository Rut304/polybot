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
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

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
