import { NextResponse } from 'next/server';

// AWS IAM credentials for Lightsail (AMAZON_* prefix, not AWS_*)
const AMAZON_ACCESS_KEY_ID = process.env.AMAZON_ACCESS_KEY_ID || '';
const AMAZON_SECRET_ACCESS_KEY = process.env.AMAZON_SECRET_ACCESS_KEY || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

export async function POST() {
  if (!AMAZON_ACCESS_KEY_ID || !AMAZON_SECRET_ACCESS_KEY) {
    return NextResponse.json(
      { error: 'AWS credentials not configured. Set AMAZON_ACCESS_KEY_ID and AMAZON_SECRET_ACCESS_KEY.' },
      { status: 500 }
    );
  }

  try {
    // Step 1: Get the current container image from Lightsail
    const getServiceUrl = `https://lightsail.${AWS_REGION}.amazonaws.com/`;
    
    // AWS Signature V4 would be needed here for production
    // For now, we'll use a simpler approach via AWS CLI on the server
    // This endpoint serves as a trigger - actual redeployment happens via Lambda or direct CLI
    
    // Alternative: Use AWS SDK
    const { LightsailClient, CreateContainerServiceDeploymentCommand, GetContainerServicesCommand } = await import('@aws-sdk/client-lightsail');
    
    const client = new LightsailClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AMAZON_ACCESS_KEY_ID,
        secretAccessKey: AMAZON_SECRET_ACCESS_KEY,
      },
    });

    // Get current service to find the latest image
    const getServiceCmd = new GetContainerServicesCommand({
      serviceName: 'polyparlay',
    });
    const serviceResponse = await client.send(getServiceCmd);
    const service = serviceResponse.containerServices?.[0];
    
    if (!service) {
      return NextResponse.json(
        { error: 'Lightsail service "polyparlay" not found' },
        { status: 404 }
      );
    }

    // Get current deployment's image
    const currentImage = service.currentDeployment?.containers?.polybot?.image || ':polyparlay.polybot.1';
    
    // Get secrets from AWS Secrets Manager
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    const smClient = new SecretsManagerClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    const secretNames = [
      'polybot/supabase-url',
      'polybot/supabase-key',
      'polybot/polymarket-api-key',
      'polybot/polymarket-secret',
      'polybot/kalshi-api-key',
      'polybot/kalshi-private-key',
      'polybot/wallet-address',
    ];

    const environment: Record<string, string> = {};
    
    for (const secretName of secretNames) {
      try {
        const cmd = new GetSecretValueCommand({ SecretId: secretName });
        const response = await smClient.send(cmd);
        const envKey = secretName.split('/')[1].toUpperCase().replace(/-/g, '_');
        environment[envKey] = response.SecretString || '';
      } catch (e) {
        console.warn(`Could not fetch secret ${secretName}:`, e);
      }
    }

    // Create new deployment with updated environment
    const deployCmd = new CreateContainerServiceDeploymentCommand({
      serviceName: 'polyparlay',
      containers: {
        polybot: {
          image: currentImage,
          environment,
        },
      },
    });

    await client.send(deployCmd);

    return NextResponse.json({
      success: true,
      message: 'Redeployment triggered. Bot will restart with updated secrets in ~2 minutes.',
      image: currentImage,
    });
  } catch (error: any) {
    console.error('Redeploy error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger redeployment' },
      { status: 500 }
    );
  }
}
