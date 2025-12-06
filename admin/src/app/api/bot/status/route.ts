import { NextResponse } from 'next/server';

const BOT_URL = process.env.BOT_URL || 'https://polyparlay.p3ww4fvp9w2se.us-east-1.cs.amazonlightsail.com';

export async function GET() {
  try {
    const response = await fetch(`${BOT_URL}/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Don't cache this
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Bot returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching bot status:', error);
    return NextResponse.json(
      { 
        status: 'offline',
        version: 'unknown',
        error: error instanceof Error ? error.message : 'Failed to fetch bot status'
      },
      { status: 200 } // Return 200 so the UI can handle it gracefully
    );
  }
}
