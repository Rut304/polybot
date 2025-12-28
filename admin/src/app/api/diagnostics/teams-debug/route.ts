import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('[teams-debug] URL:', url);
  console.log('[teams-debug] Service Key exists:', !!serviceKey);
  console.log('[teams-debug] Key length:', serviceKey?.length);
  
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Missing config', url: !!url, key: !!serviceKey });
  }
  
  // Try with global headers to ensure service role is passed
  const supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${serviceKey}`
      }
    }
  });
  
  // Now try SDK with explicit headers
  const { data: sdkData, error: sdkError } = await supabase
    .from('polybot_teams')
    .select('*');
    
  console.log('[teams-debug] SDK data:', sdkData);
  console.log('[teams-debug] SDK error:', sdkError);
  
  // Also try with auth session override
  const supabase2 = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  // Set the session to use service role
  const { data: sdkData2, error: sdkError2 } = await supabase2
    .from('polybot_teams')
    .select('*')
    .limit(100);
    
  console.log('[teams-debug] SDK2 data:', sdkData2);
  
  return NextResponse.json({
    sdkWithGlobalHeaders: {
      count: sdkData?.length || 0,
      data: sdkData,
      error: sdkError?.message
    },
    sdkWithoutGlobalHeaders: {
      count: sdkData2?.length || 0,
      data: sdkData2,
      error: sdkError2?.message
    }
  });
}
