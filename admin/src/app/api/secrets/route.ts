import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Check if we have the required environment variables
const hasServiceKey = supabaseUrl && supabaseServiceKey;

// Server-side Supabase client with admin privileges (only if key exists)
const supabaseAdmin = hasServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }
  
  try {
    const { data, error } = await supabaseAdmin
      .from('polybot_secrets')
      .select('*')
      .order('category')
      .order('key_name');

    if (error) throw error;

    // Mask sensitive values for frontend
    const maskedData = (data || []).map((secret: any) => ({
      ...secret,
      key_value: secret.key_value 
        ? (secret.key_value.length <= 8 
            ? '********' 
            : `${secret.key_value.substring(0, 4)}...${secret.key_value.substring(secret.key_value.length - 4)}`)
        : null,
      is_configured: !!secret.key_value,
    }));

    return NextResponse.json({ secrets: maskedData });
  } catch (error: any) {
    console.error('Error fetching secrets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch secrets' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }
  
  try {
    const body = await request.json();
    const { key_name, key_value } = body;

    if (!key_name) {
      return NextResponse.json(
        { error: 'key_name is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('polybot_secrets')
      .update({
        key_value: key_value || null,
        is_configured: !!key_value,
        last_updated: new Date().toISOString(),
      })
      .eq('key_name', key_name);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `${key_name} updated successfully` 
    });
  } catch (error: any) {
    console.error('Error updating secret:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update secret' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server not configured. SUPABASE_SERVICE_KEY is required.' },
      { status: 500 }
    );
  }
  
  try {
    const body = await request.json();
    const { key_name, key_value, description, category } = body;

    if (!key_name) {
      return NextResponse.json(
        { error: 'key_name is required' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('polybot_secrets')
      .upsert({
        key_name,
        key_value: key_value || null,
        description: description || '',
        category: category || 'general',
        is_configured: !!key_value,
        last_updated: new Date().toISOString(),
      });

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: `${key_name} saved successfully` 
    });
  } catch (error: any) {
    console.error('Error saving secret:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save secret' },
      { status: 500 }
    );
  }
}
