import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Lazy initialization to avoid build-time errors
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase config missing');
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// News source configuration
const NEWS_SOURCES = [
  { key: 'FINNHUB_API_KEY', name: 'Finnhub', description: 'Real-time market news (60 calls/min free)', required: true },
  { key: 'NEWS_API_KEY', name: 'NewsAPI', description: 'General news aggregator (100 req/day free)', required: true },
  { key: 'NEWSAPI_KEY', name: 'NewsAPI (alt)', description: 'Alternate key name for NewsAPI', required: false },
  { key: 'ALPHAVANTAGE_API_KEY', name: 'Alpha Vantage', description: 'News with sentiment scores (25 req/day)', required: false },
  { key: 'ALPHA_VANTAGE_API_KEY', name: 'Alpha Vantage (alt)', description: 'Alternate key name', required: false },
  { key: 'TWITTER_BEARER_TOKEN', name: 'Twitter/X', description: 'Social sentiment & breaking news', required: true },
  { key: 'TWITTER_API_KEY', name: 'Twitter API Key', description: 'Twitter OAuth API key', required: false },
  { key: 'TWITTER_API_SECRET', name: 'Twitter API Secret', description: 'Twitter OAuth API secret', required: false },
  { key: 'POLYGON_API_KEY', name: 'Polygon.io', description: 'Financial data & news', required: false },
  { key: 'BENZINGA_API_KEY', name: 'Benzinga', description: 'Professional financial news', required: false },
];

// Free sources (no API key needed)
const FREE_SOURCES = [
  { name: 'Polymarket Activity', description: 'Market volume spikes as news proxy', status: 'always_available' },
  { name: 'Reddit', description: 'r/wallstreetbets, r/stocks, r/cryptocurrency', status: 'always_available' },
  { name: 'RSS Feeds', description: 'CoinDesk, Politico', status: 'always_available' },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    
    // Fetch all news-related secrets
    const { data: secrets, error } = await supabase
      .from('polybot_secrets')
      .select('key_name, is_configured, category')
      .in('key_name', NEWS_SOURCES.map(s => s.key));
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    // Build status map
    const secretsMap = new Map(
      (secrets || []).map(s => [s.key_name, s.is_configured])
    );
    
    // Check each source
    const apiSources = NEWS_SOURCES.map(source => {
      const isConfigured = secretsMap.get(source.key) === true;
      return {
        key: source.key,
        name: source.name,
        description: source.description,
        required: source.required,
        status: isConfigured ? 'configured' : 'not_configured',
        emoji: isConfigured ? '✅' : (source.required ? '❌' : '⚪'),
      };
    });
    
    // Summary stats
    const configured = apiSources.filter(s => s.status === 'configured').length;
    const requiredConfigured = apiSources.filter(s => s.required && s.status === 'configured').length;
    const requiredTotal = apiSources.filter(s => s.required).length;
    
    // Dedupe by primary key name (NEWS_API_KEY vs NEWSAPI_KEY)
    const uniqueSources = apiSources.filter(s => !s.key.includes('(alt)') && !s.key.startsWith('TWITTER_API_'));
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_api_sources: uniqueSources.length,
        configured: requiredConfigured,
        required_missing: requiredTotal - requiredConfigured,
        free_sources: FREE_SOURCES.length,
        health: requiredConfigured >= 2 ? 'good' : (requiredConfigured >= 1 ? 'partial' : 'needs_setup'),
      },
      api_sources: apiSources,
      free_sources: FREE_SOURCES,
      recommendations: [
        requiredConfigured < requiredTotal ? '⚠️ Some required news sources are not configured. Add API keys in Admin > Settings > Secrets.' : null,
        !secretsMap.get('FINNHUB_API_KEY') ? '💡 Get a free Finnhub API key at https://finnhub.io (60 calls/min)' : null,
        !secretsMap.get('NEWS_API_KEY') && !secretsMap.get('NEWSAPI_KEY') ? '💡 Get a free NewsAPI key at https://newsapi.org (100 req/day)' : null,
        !secretsMap.get('TWITTER_BEARER_TOKEN') ? '💡 Get Twitter API access at https://developer.twitter.com (for social sentiment)' : null,
      ].filter(Boolean),
    });
    
  } catch (error: any) {
    console.error('News status error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check news status' },
      { status: 500 }
    );
  }
}
