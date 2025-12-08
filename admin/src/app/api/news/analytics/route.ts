import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface NewsItem {
  id: string;
  source: string;
  title: string;
  content: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  keywords: string[] | null;
  published_at: string | null;
}

interface TrendAnalysis {
  topKeywords: { keyword: string; count: number; sentiment: string }[];
  sentimentBreakdown: { sentiment: string; count: number; percentage: number }[];
  sourceBreakdown: { source: string; count: number; avgSentiment: number }[];
  hotTopics: { topic: string; mentions: number; trend: 'rising' | 'stable' | 'falling'; sentiment: string }[];
  marketMoverAlerts: { title: string; reason: string; confidence: number }[];
  overallSentiment: { label: string; score: number; description: string };
  summary: string;
}

// Analyze sentiment distribution
function analyzeSentimentDistribution(news: NewsItem[]): TrendAnalysis['sentimentBreakdown'] {
  const counts: Record<string, number> = {
    very_bullish: 0,
    bullish: 0,
    neutral: 0,
    bearish: 0,
    very_bearish: 0,
  };
  
  for (const item of news) {
    const sentiment = item.sentiment || 'neutral';
    if (counts[sentiment] !== undefined) {
      counts[sentiment]++;
    }
  }
  
  const total = news.length || 1;
  
  return Object.entries(counts).map(([sentiment, count]) => ({
    sentiment,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

// Analyze keyword frequency
function analyzeKeywords(news: NewsItem[]): TrendAnalysis['topKeywords'] {
  const keywordCounts: Record<string, { count: number; sentiments: number[] }> = {};
  
  for (const item of news) {
    const keywords = item.keywords || [];
    const score = item.sentiment_score || 0;
    
    for (const keyword of keywords) {
      if (!keywordCounts[keyword]) {
        keywordCounts[keyword] = { count: 0, sentiments: [] };
      }
      keywordCounts[keyword].count++;
      keywordCounts[keyword].sentiments.push(score);
    }
  }
  
  return Object.entries(keywordCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([keyword, data]) => {
      const avgSentiment = data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length;
      let sentiment = 'neutral';
      if (avgSentiment > 0.2) sentiment = 'bullish';
      if (avgSentiment > 0.5) sentiment = 'very_bullish';
      if (avgSentiment < -0.2) sentiment = 'bearish';
      if (avgSentiment < -0.5) sentiment = 'very_bearish';
      
      return { keyword, count: data.count, sentiment };
    });
}

// Analyze sources
function analyzeSources(news: NewsItem[]): TrendAnalysis['sourceBreakdown'] {
  const sourceData: Record<string, { count: number; sentiments: number[] }> = {};
  
  for (const item of news) {
    const source = item.source || 'unknown';
    if (!sourceData[source]) {
      sourceData[source] = { count: 0, sentiments: [] };
    }
    sourceData[source].count++;
    sourceData[source].sentiments.push(item.sentiment_score || 0);
  }
  
  return Object.entries(sourceData)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([source, data]) => ({
      source,
      count: data.count,
      avgSentiment: data.sentiments.length > 0 
        ? data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length 
        : 0,
    }));
}

// Identify hot topics based on frequency and recency
function identifyHotTopics(news: NewsItem[]): TrendAnalysis['hotTopics'] {
  const topicPatterns: Record<string, RegExp> = {
    'Fed/Interest Rates': /\b(fed|federal reserve|interest rate|fomc|powell|rate cut|rate hike)\b/i,
    'Bitcoin/Crypto': /\b(bitcoin|btc|crypto|ethereum|eth)\b/i,
    'AI/Tech': /\b(ai|artificial intelligence|openai|chatgpt|nvidia|tech)\b/i,
    'Elections': /\b(trump|biden|election|vote|poll|democrat|republican)\b/i,
    'Stock Market': /\b(stock|nasdaq|dow|s&p|market|earnings)\b/i,
    'Economy': /\b(gdp|inflation|recession|unemployment|economy)\b/i,
    'SEC/Regulation': /\b(sec|regulation|lawsuit|compliance|investigation)\b/i,
  };
  
  const topicData: Record<string, { count: number; recentCount: number; sentiments: number[] }> = {};
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  for (const item of news) {
    const text = `${item.title} ${item.content || ''}`;
    const publishedAt = item.published_at ? new Date(item.published_at).getTime() : now;
    const isRecent = publishedAt > oneHourAgo;
    
    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      if (pattern.test(text)) {
        if (!topicData[topic]) {
          topicData[topic] = { count: 0, recentCount: 0, sentiments: [] };
        }
        topicData[topic].count++;
        if (isRecent) topicData[topic].recentCount++;
        topicData[topic].sentiments.push(item.sentiment_score || 0);
      }
    }
  }
  
  return Object.entries(topicData)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([topic, data]) => {
      // Determine trend based on recent vs total ratio
      const recentRatio = data.recentCount / Math.max(data.count, 1);
      let trend: 'rising' | 'stable' | 'falling' = 'stable';
      if (recentRatio > 0.4) trend = 'rising';
      else if (recentRatio < 0.1) trend = 'falling';
      
      const avgSentiment = data.sentiments.reduce((a, b) => a + b, 0) / data.sentiments.length;
      let sentiment = 'neutral';
      if (avgSentiment > 0.2) sentiment = 'bullish';
      if (avgSentiment < -0.2) sentiment = 'bearish';
      
      return { topic, mentions: data.count, trend, sentiment };
    });
}

// Identify potential market movers
function identifyMarketMovers(news: NewsItem[]): TrendAnalysis['marketMoverAlerts'] {
  const alerts: TrendAnalysis['marketMoverAlerts'] = [];
  
  // Look for high-impact keywords
  const highImpactPatterns = [
    { pattern: /\b(breaking|urgent|flash)\b/i, reason: 'Breaking news alert' },
    { pattern: /\b(surge|soar|plunge|crash|collapse)\b/i, reason: 'Significant price movement' },
    { pattern: /\b(sec|lawsuit|investigation|fraud)\b/i, reason: 'Regulatory action' },
    { pattern: /\b(fed|rate (cut|hike)|fomc)\b/i, reason: 'Federal Reserve action' },
    { pattern: /\b(earnings|beat|miss|guidance)\b/i, reason: 'Earnings announcement' },
    { pattern: /\b(acquisition|merger|deal|buyout)\b/i, reason: 'M&A activity' },
  ];
  
  for (const item of news) {
    const text = `${item.title} ${item.content || ''}`;
    const score = Math.abs(item.sentiment_score || 0);
    
    for (const { pattern, reason } of highImpactPatterns) {
      if (pattern.test(text) && score > 0.3) {
        alerts.push({
          title: item.title.slice(0, 100),
          reason,
          confidence: Math.min(0.9, score + 0.3),
        });
        break;
      }
    }
  }
  
  return alerts.slice(0, 5);
}

// Calculate overall sentiment
function calculateOverallSentiment(news: NewsItem[]): TrendAnalysis['overallSentiment'] {
  if (news.length === 0) {
    return { label: 'Neutral', score: 0, description: 'No news data available' };
  }
  
  const scores = news.map(n => n.sentiment_score || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  let label = 'Neutral';
  let description = 'Market sentiment is balanced with no clear direction.';
  
  if (avgScore > 0.5) {
    label = 'Very Bullish';
    description = 'Strong positive sentiment across news sources. Markets may see upward pressure.';
  } else if (avgScore > 0.2) {
    label = 'Bullish';
    description = 'Moderately positive news flow. Cautious optimism in the markets.';
  } else if (avgScore < -0.5) {
    label = 'Very Bearish';
    description = 'Significant negative sentiment detected. Expect potential market volatility.';
  } else if (avgScore < -0.2) {
    label = 'Bearish';
    description = 'Negative news trends emerging. Markets may face downward pressure.';
  }
  
  return { label, score: avgScore, description };
}

// Generate AI-like summary
function generateSummary(analysis: Partial<TrendAnalysis>, news: NewsItem[]): string {
  const parts: string[] = [];
  
  // Overall sentiment
  if (analysis.overallSentiment) {
    parts.push(`Overall market sentiment is ${analysis.overallSentiment.label.toLowerCase()}.`);
  }
  
  // Hot topics
  const risingTopics = analysis.hotTopics?.filter(t => t.trend === 'rising') || [];
  if (risingTopics.length > 0) {
    parts.push(`Trending topics: ${risingTopics.map(t => t.topic).join(', ')}.`);
  }
  
  // Top keywords
  const topKeywords = analysis.topKeywords?.slice(0, 3).map(k => k.keyword) || [];
  if (topKeywords.length > 0) {
    parts.push(`Most discussed themes: ${topKeywords.join(', ')}.`);
  }
  
  // Alerts
  if ((analysis.marketMoverAlerts?.length || 0) > 0) {
    parts.push(`${analysis.marketMoverAlerts!.length} potential market-moving news items detected.`);
  }
  
  // Source breakdown
  const sources = analysis.sourceBreakdown || [];
  if (sources.length > 0) {
    const total = sources.reduce((a, s) => a + s.count, 0);
    parts.push(`Analysis based on ${total} news items from ${sources.length} sources.`);
  }
  
  return parts.join(' ');
}

export async function GET(request: NextRequest) {
  try {
    // Fetch recent news from database
    const { data: news, error } = await supabase
      .from('polybot_news_items')
      .select('id, source, title, content, sentiment, sentiment_score, keywords, published_at')
      .order('published_at', { ascending: false })
      .limit(100);
    
    if (error) {
      throw new Error(error.message);
    }
    
    const newsItems = (news || []) as NewsItem[];
    
    // Perform analysis
    const sentimentBreakdown = analyzeSentimentDistribution(newsItems);
    const topKeywords = analyzeKeywords(newsItems);
    const sourceBreakdown = analyzeSources(newsItems);
    const hotTopics = identifyHotTopics(newsItems);
    const marketMoverAlerts = identifyMarketMovers(newsItems);
    const overallSentiment = calculateOverallSentiment(newsItems);
    
    const analysis: TrendAnalysis = {
      topKeywords,
      sentimentBreakdown,
      sourceBreakdown,
      hotTopics,
      marketMoverAlerts,
      overallSentiment,
      summary: '',
    };
    
    analysis.summary = generateSummary(analysis, newsItems);
    
    return NextResponse.json({
      success: true,
      analysis,
      newsCount: newsItems.length,
      lastUpdated: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze news' },
      { status: 500 }
    );
  }
}
