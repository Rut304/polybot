import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '5';
  const active = searchParams.get('active') || 'true';
  const endpoint = `https://gamma-api.polymarket.com/markets?limit=${limit}&active=${active}`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PolyBot/1.0'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Gamma API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from Gamma API' },
      { status: 500 }
    );
  }
}
