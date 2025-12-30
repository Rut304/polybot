/**
 * Admin Redeploy API
 * Triggers a redeployment of the admin dashboard via Vercel Deploy Hook
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, logAuditEvent, getRequestMetadata } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const metadata = await getRequestMetadata(request);
  
  // Auth verification - admin only
  const authResult = await verifyAuth(request);
  if (!authResult?.is_admin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    
    if (!deployHookUrl) {
      return NextResponse.json({ 
        error: 'Deploy hook not configured. Add VERCEL_DEPLOY_HOOK_URL to environment variables.',
        instructions: 'Go to Vercel Project Settings > Git > Deploy Hooks to create one.'
      }, { status: 500 });
    }

    // Trigger the deploy hook
    const response = await fetch(deployHookUrl, { method: 'POST' });
    
    if (!response.ok) {
      throw new Error(`Vercel responded with ${response.status}`);
    }

    const result = await response.json();

    // Log the action
    await logAuditEvent({
      user_id: authResult.user_id,
      user_email: authResult.user_email,
      action: 'admin.redeploy_dashboard',
      resource_type: 'deployment',
      resource_id: result.job?.id || 'unknown',
      details: { 
        triggered_by: authResult.user_email,
        deploy_hook_response: result 
      },
      ip_address: metadata.ip_address,
      user_agent: metadata.user_agent,
      severity: 'warning',
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Deployment triggered successfully',
      job: result.job 
    });
  } catch (error: any) {
    console.error('Redeploy error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to trigger deployment' 
    }, { status: 500 });
  }
}
