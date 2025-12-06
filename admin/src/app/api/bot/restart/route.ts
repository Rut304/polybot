import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// AWS credentials for SSM
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const LIGHTSAIL_INSTANCE_NAME = process.env.LIGHTSAIL_INSTANCE_NAME || 'polybot';

export async function POST(request: Request) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'restart'; // restart, stop, start, status
    
    // Log the action attempt
    await supabase.from('audit_log').insert({
      action: `bot.${action}`,
      details: { action, timestamp: new Date().toISOString() },
      performed_by: 'admin-ui',
    }).catch(() => {}); // Don't fail if audit log doesn't exist

    // Method 1: Try AWS Systems Manager (SSM) for direct command execution
    if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
      try {
        const result = await restartViaSSM(action);
        if (result.success) {
          return NextResponse.json(result);
        }
      } catch (ssmError: any) {
        console.log('SSM method failed, trying alternative:', ssmError.message);
      }
    }

    // Method 2: Set a flag in the database that the bot watches
    // The bot can check this flag and restart itself
    const { error: flagError } = await supabase
      .from('polybot_config')
      .update({ 
        restart_requested: true,
        restart_requested_at: new Date().toISOString(),
        restart_action: action,
      })
      .eq('id', 1);

    if (flagError) {
      // Try creating the column if it doesn't exist (first time)
      console.log('Could not set restart flag:', flagError.message);
    }

    // Method 3: Return instructions for manual restart
    return NextResponse.json({
      success: true,
      method: 'manual',
      message: `Bot ${action} requested. If SSM is not configured, restart manually via SSH.`,
      instructions: [
        `ssh -i keys/lightsail-key.pem ubuntu@<LIGHTSAIL_IP>`,
        `cd polybot`,
        action === 'restart' ? `docker-compose restart` : 
        action === 'stop' ? `docker-compose stop` :
        action === 'start' ? `docker-compose up -d` :
        `docker-compose ps`,
      ],
      note: 'Configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY for one-click restart via SSM.',
    });

  } catch (error: any) {
    console.error('Bot restart error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restart bot' },
      { status: 500 }
    );
  }
}

async function restartViaSSM(action: string): Promise<{ success: boolean; message: string; commandId?: string }> {
  const { SSMClient, SendCommandCommand, GetCommandInvocationCommand } = await import('@aws-sdk/client-ssm');
  const { LightsailClient, GetInstanceCommand } = await import('@aws-sdk/client-lightsail');
  
  const ssmClient = new SSMClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  const lightsailClient = new LightsailClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  // Get instance ID from Lightsail
  const instanceCmd = new GetInstanceCommand({ instanceName: LIGHTSAIL_INSTANCE_NAME });
  const instanceResponse = await lightsailClient.send(instanceCmd);
  
  if (!instanceResponse.instance) {
    throw new Error(`Lightsail instance "${LIGHTSAIL_INSTANCE_NAME}" not found`);
  }

  // Map action to docker-compose command
  const dockerCommand = 
    action === 'restart' ? 'docker-compose restart' :
    action === 'stop' ? 'docker-compose stop' :
    action === 'start' ? 'docker-compose up -d' :
    action === 'logs' ? 'docker-compose logs --tail=100' :
    'docker-compose ps';

  // SSM requires the instance to have the SSM agent installed and registered
  // For Lightsail, this might require additional setup
  const command = new SendCommandCommand({
    InstanceIds: [instanceResponse.instance.name!], // SSM uses instance IDs
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [
        'cd /home/ubuntu/polybot || cd ~/polybot',
        dockerCommand,
      ],
    },
  });

  const sendResult = await ssmClient.send(command);
  
  return {
    success: true,
    message: `Bot ${action} command sent successfully`,
    commandId: sendResult.Command?.CommandId,
  };
}

// GET endpoint to check bot status
export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    // Check last heartbeat from the bot
    const { data: status, error } = await supabase
      .from('polybot_status')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !status) {
      // Try polybot_config as fallback
      const { data: config } = await supabase
        .from('polybot_config')
        .select('updated_at, simulation_mode')
        .eq('id', 1)
        .single();

      return NextResponse.json({
        status: 'unknown',
        message: 'No status table found. Bot may be running but not reporting status.',
        lastConfig: config,
      });
    }

    const lastHeartbeat = new Date(status.updated_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60);

    return NextResponse.json({
      status: diffMinutes < 5 ? 'running' : diffMinutes < 30 ? 'stale' : 'stopped',
      lastHeartbeat: status.updated_at,
      minutesSinceHeartbeat: Math.round(diffMinutes),
      details: status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, status: 'error' },
      { status: 500 }
    );
  }
}
