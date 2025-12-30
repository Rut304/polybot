import { NextResponse } from 'next/server';

// AWS Lightsail API to get container status
// Region is us-east-1 for the polyparlay container service

export async function GET() {
  try {
    // Get status directly from the bot
    const botUrl = process.env.BOT_URL || 'https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com';
    
    const [healthResponse, statusResponse] = await Promise.allSettled([
      fetch(`${botUrl}/health`, { 
        signal: AbortSignal.timeout(5000),
        cache: 'no-store' 
      }),
      fetch(`${botUrl}/status`, { 
        signal: AbortSignal.timeout(5000),
        cache: 'no-store' 
      })
    ]);
    
    const healthOk = healthResponse.status === 'fulfilled' && healthResponse.value.ok;
    
    let statusData = null;
    if (statusResponse.status === 'fulfilled' && statusResponse.value.ok) {
      statusData = await statusResponse.value.json();
    }
    
    return NextResponse.json({
      success: true,
      container: {
        serviceName: 'polyparlay',
        region: 'us-east-1',
        health: healthOk ? 'healthy' : 'unhealthy',
        status: statusData?.status || 'unknown',
        version: statusData?.version || 'unknown',
        build: statusData?.build || 'unknown',
        fullVersion: statusData?.fullVersion || 'unknown',
        url: botUrl
      },
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking Lightsail status:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      container: {
        serviceName: 'polyparlay',
        region: 'us-east-1',
        health: 'error',
        status: 'unreachable'
      },
      checkedAt: new Date().toISOString()
    }, { status: 500 });
  }
}
