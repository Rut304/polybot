import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// AWS credentials for Lightsail Container Service
const AWS_ACCESS_KEY_ID = (process.env.AWS_ACCESS_KEY_ID || '').trim();
const AWS_SECRET_ACCESS_KEY = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
const AWS_REGION = (process.env.AWS_REGION || 'us-east-1').trim();
const LIGHTSAIL_SERVICE_NAME = (process.env.LIGHTSAIL_SERVICE_NAME || 'polyparlay').trim();

export async function POST(request: Request) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'restart'; // restart, status

    // Log the action attempt
    try {
      await supabase.from('audit_log').insert({
        action: `bot.${action}`,
        details: { action, service: LIGHTSAIL_SERVICE_NAME, timestamp: new Date().toISOString() },
        performed_by: 'admin-ui',
      });
    } catch (e) {
      // Don't fail if audit log doesn't exist
      console.log('Audit log not available:', e);
    }

    // Check if AWS credentials are configured
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({
        success: false,
        error: 'AWS credentials not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env.local',
      }, { status: 500 });
    }

    // Use Lightsail Container Service API
    const { LightsailClient, GetContainerServicesCommand, CreateContainerServiceDeploymentCommand } = 
      await import('@aws-sdk/client-lightsail');

    const client = new LightsailClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    // Get current service configuration
    const getServiceCmd = new GetContainerServicesCommand({
      serviceName: LIGHTSAIL_SERVICE_NAME,
    });
    
    const serviceResponse = await client.send(getServiceCmd);
    const service = serviceResponse.containerServices?.[0];

    if (!service) {
      return NextResponse.json({
        success: false,
        error: `Lightsail Container Service "${LIGHTSAIL_SERVICE_NAME}" not found`,
      }, { status: 404 });
    }

    if (action === 'status') {
      return NextResponse.json({
        success: true,
        status: service.state,
        url: service.url,
        currentDeployment: service.currentDeployment?.state,
        createdAt: service.createdAt,
        power: service.power,
        scale: service.scale,
      });
    }

    // For restart: Create a new deployment with the same config
    // This effectively restarts the container
    const currentDeployment = service.currentDeployment;
    
    // Fetch latest secrets from Supabase to inject into the container
    const { data: secrets } = await supabase
      .from('polybot_secrets')
      .select('key_name, key_value')
      .eq('is_configured', true);

    // Build environment variables from secrets
    const environment: Record<string, string> = {};
    if (secrets) {
      for (const secret of secrets) {
        if (secret.key_value) {
          environment[secret.key_name] = secret.key_value;
        }
      }
    }

    let updatedContainers: Record<string, any> = {};
    let publicEndpoint: any = undefined;

    if (currentDeployment?.containers) {
      // Use existing deployment config
      const containers = currentDeployment.containers;
      publicEndpoint = currentDeployment.publicEndpoint;

      // Update the container config with new environment
      for (const [containerName, containerConfig] of Object.entries(containers)) {
        updatedContainers[containerName] = {
          ...containerConfig,
          environment: {
            ...((containerConfig as any).environment || {}),
            ...environment,
          },
        };
      }
    } else {
      // No current deployment - create fresh deployment with latest image
      const { GetContainerImagesCommand } = await import('@aws-sdk/client-lightsail');
      
      const imagesCmd = new GetContainerImagesCommand({
        serviceName: LIGHTSAIL_SERVICE_NAME,
      });
      const imagesResponse = await client.send(imagesCmd);
      const latestImage = imagesResponse.containerImages?.[0]?.image;

      if (!latestImage) {
        return NextResponse.json({
          success: false,
          error: 'No container images found. Push a Docker image first using: aws lightsail push-container-image',
        }, { status: 400 });
      }

      // Create container config with the latest image
      updatedContainers = {
        polybot: {
          image: latestImage,
          environment,
          ports: {
            '8080': 'HTTP',
          },
        },
      };

      // Set up public endpoint
      publicEndpoint = {
        containerName: 'polybot',
        containerPort: 8080,
        healthCheck: {
          healthyThreshold: 2,
          unhealthyThreshold: 2,
          timeoutSeconds: 5,
          intervalSeconds: 10,
          path: '/health',
          successCodes: '200-499',
        },
      };
    }

    // Create new deployment (this restarts the container with updated config)
    const deployCmd = new CreateContainerServiceDeploymentCommand({
      serviceName: LIGHTSAIL_SERVICE_NAME,
      containers: updatedContainers,
      publicEndpoint: publicEndpoint ? {
        containerName: publicEndpoint.containerName,
        containerPort: publicEndpoint.containerPort,
        healthCheck: publicEndpoint.healthCheck,
      } : undefined,
    });

    const deployResponse = await client.send(deployCmd);

    return NextResponse.json({
      success: true,
      message: 'Bot restart triggered! New deployment is being created.',
      deployment: {
        state: deployResponse.containerService?.nextDeployment?.state || 'ACTIVATING',
        version: deployResponse.containerService?.nextDeployment?.version,
      },
      note: 'The bot will restart within 1-2 minutes. Check status on the dashboard.',
      serviceUrl: service.url,
    });

  } catch (error: any) {
    console.error('Bot restart error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to restart bot',
    }, { status: 500 });
  }
}

// GET endpoint to check bot/service status
export async function GET() {
  try {
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({
        status: 'unknown',
        error: 'AWS credentials not configured',
      });
    }

    const { LightsailClient, GetContainerServicesCommand } = 
      await import('@aws-sdk/client-lightsail');

    const client = new LightsailClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    const getServiceCmd = new GetContainerServicesCommand({
      serviceName: LIGHTSAIL_SERVICE_NAME,
    });

    const serviceResponse = await client.send(getServiceCmd);
    const service = serviceResponse.containerServices?.[0];

    if (!service) {
      return NextResponse.json({
        status: 'not_found',
        error: `Service "${LIGHTSAIL_SERVICE_NAME}" not found`,
      });
    }

    return NextResponse.json({
      status: (service.state === 'READY' || service.state === 'RUNNING') ? 'running' : service.state?.toLowerCase(),
      serviceState: service.state,
      deploymentState: service.currentDeployment?.state,
      url: service.url,
      power: service.power,
      scale: service.scale,
      containers: Object.keys(service.currentDeployment?.containers || {}),
      createdAt: service.createdAt,
      isHealthy: (service.state === 'READY' || service.state === 'RUNNING') && service.currentDeployment?.state === 'ACTIVE',
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
