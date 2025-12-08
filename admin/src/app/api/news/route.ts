import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const source = searchParams.get('source');
    const sentiment = searchParams.get('sentiment');

    const ITEMS_PER_PAGE = Math.min(limit, 50); // Cap at 50
    const offset = (page - 1) * ITEMS_PER_PAGE;

    let query = supabase
      .from('polybot_news_items')
      .select('*', { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + ITEMS_PER_PAGE - 1);

    if (source && source !== 'all') {
      query = query.eq('source', source);
    }
    if (sentiment && sentiment !== 'all') {
      query = query.eq('sentiment', sentiment);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching news:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      news: data || [],
      total: count || 0,
      page,
      limit: ITEMS_PER_PAGE,
    });
  } catch (error: any) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
