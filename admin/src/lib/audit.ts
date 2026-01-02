import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export type AuditAction = 
  | 'secret.view'
  | 'secret.reveal'
  | 'secret.update'
  | 'secret.delete'
  | 'secret.test'
  | 'secret.sync_aws'
  | 'secret.sync_github'
  | 'config.update'
  | 'config.view'
  | 'user.login'
  | 'user.logout'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user_credentials.view'
  | 'user_credentials.create'
  | 'user_credentials.delete'
  | 'bot.start'
  | 'bot.stop'
  | 'bot.redeploy'
  | 'simulation.reset'
  | 'simulation.analyze'
  | 'simulation.archive'
  | 'trade.manual'
  | 'trade.approve'
  | 'trade.reject';

export type ResourceType = 
  | 'secret'
  | 'config'
  | 'user'
  | 'user_exchange_credentials'
  | 'bot'
  | 'simulation'
  | 'simulation_session'
  | 'trade';

export type Severity = 'info' | 'warning' | 'error' | 'critical';

interface AuditLogEntry {
  user_id?: string;
  user_email?: string;
  action: AuditAction;
  resource_type: ResourceType;
  resource_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  severity?: Severity;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error('Supabase not configured for audit logging');
    return false;
  }

  try {
    const { error } = await supabaseAdmin
      .from('polybot_audit_log')
      .insert({
        user_id: entry.user_id,
        user_email: entry.user_email,
        action: entry.action,
        resource_type: entry.resource_type,
        resource_id: entry.resource_id,
        details: entry.details || {},
        ip_address: entry.ip_address,
        user_agent: entry.user_agent,
        severity: entry.severity || 'info',
      });

    if (error) {
      console.error('Failed to log audit event:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Audit logging error:', err);
    return false;
  }
}

/**
 * Extract request metadata for audit logging
 */
export async function getRequestMetadata(request: NextRequest): Promise<{
  ip_address: string;
  user_agent: string;
}> {
  const headersList = await headers();
  const forwarded = headersList.get('x-forwarded-for');
  const ip_address = forwarded?.split(',')[0]?.trim() || 
                     headersList.get('x-real-ip') || 
                     'unknown';
  const user_agent = headersList.get('user-agent') || 'unknown';
  
  return { ip_address, user_agent };
}

/**
 * Verify user is authenticated and get user info
 * Returns null if not authenticated
 */
export async function verifyAuth(request: NextRequest): Promise<{
  user_id: string;
  user_email: string;
  role: string;
} | null> {
  if (!supabaseAdmin) return null;

  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the JWT token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }

    // Get user role from profile
    // Note: Use polybot_profiles (not deprecated polybot_user_profiles)
    const { data: profile } = await supabaseAdmin
      .from('polybot_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return {
      user_id: user.id,
      user_email: user.email || '',
      role: profile?.role || 'viewer', // Default to viewer (non-admin)
    };
  } catch (err) {
    console.error('Auth verification error:', err);
    return null;
  }
}

/**
 * Check rate limit for an endpoint
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  maxRequests: number = 30,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  if (!supabaseAdmin) {
    return { allowed: true, remaining: maxRequests, resetAt: new Date() };
  }

  const windowStart = new Date(Date.now() - windowSeconds * 1000);

  try {
    // Get or create rate limit record
    const { data: existing } = await supabaseAdmin
      .from('polybot_rate_limits')
      .select('*')
      .eq('identifier', identifier)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart.toISOString())
      .single();

    if (existing) {
      // Update existing record
      if (existing.request_count >= maxRequests) {
        const resetAt = new Date(new Date(existing.window_start).getTime() + windowSeconds * 1000);
        return { allowed: false, remaining: 0, resetAt };
      }

      await supabaseAdmin
        .from('polybot_rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('id', existing.id);

      return {
        allowed: true,
        remaining: maxRequests - existing.request_count - 1,
        resetAt: new Date(new Date(existing.window_start).getTime() + windowSeconds * 1000),
      };
    } else {
      // Create new record (upsert to handle race conditions)
      await supabaseAdmin
        .from('polybot_rate_limits')
        .upsert({
          identifier,
          endpoint,
          request_count: 1,
          window_start: new Date().toISOString(),
        }, {
          onConflict: 'identifier,endpoint',
        });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(Date.now() + windowSeconds * 1000),
      };
    }
  } catch (err) {
    console.error('Rate limit check error:', err);
    // Allow request on error to avoid blocking legitimate requests
    return { allowed: true, remaining: maxRequests, resetAt: new Date() };
  }
}

/**
 * Rate limit response helper
 */
export function rateLimitResponse(resetAt: Date): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { 
      status: 429,
      headers: {
        'Retry-After': Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString(),
        'X-RateLimit-Reset': resetAt.toISOString(),
      }
    }
  );
}

/**
 * Unauthorized response helper
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized. Please log in.' },
    { status: 401 }
  );
}

/**
 * Forbidden response helper
 */
export function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Forbidden. Admin access required.' },
    { status: 403 }
  );
}
/**
 * Get the Supabase Admin client for server-side operations
 * Returns null if not configured (missing env vars)
 */
export function getSupabaseAdmin() {
  return supabaseAdmin;
}