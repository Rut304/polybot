import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to get API key from Supabase secrets
async function getSecret(keyName: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('polybot_secrets')
      .select('key_value')
      .eq('key_name', keyName)
      .single();
    
    if (error || !data) return null;
    return data.key_value;
  } catch {
    return null;
  }
}

// Analyze sentiment using keywords
function analyzeSentiment(text: string): { sentiment: string; score: number } {
  const lowerText = text.toLowerCase();
  
  const positiveWords = [
    'win', 'wins', 'winning', 'success', 'surge', 'soar', 'rise', 'gain',
    'bullish', 'positive', 'approve', 'pass', 'confirm', 'breakthrough',
    'record', 'best', 'rally', 'boost', 'strong', 'growth', 'profit',
    'up', 'higher', 'beat', 'exceed', 'outperform', 'upgrade'
  ];
  
  const negativeWords = [
    'lose', 'loss', 'fail', 'crash', 'plunge', 'drop', 'fall', 'decline',
    'bearish', 'negative', 'reject', 'block', 'concern', 'risk', 'worst',
    'scandal', 'down', 'lower', 'miss', 'underperform', 'downgrade',
    'warning', 'fear', 'crisis', 'collapse', 'bankrupt', 'fraud'
  ];
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeCount++;
  }
  
  const score = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1);
  
  if (score > 0.5) return { sentiment: 'very_bullish', score };
  if (score > 0.2) return { sentiment: 'bullish', score };
  if (score < -0.5) return { sentiment: 'very_bearish', score };
  if (score < -0.2) return { sentiment: 'bearish', score };
  return { sentiment: 'neutral', score: 0 };
}

// Extract keywords from text
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const lowerText = text.toLowerCase();
  
  const keywordMap: Record<string, string[]> = {
    politics: ['trump', 'biden', 'election', 'congress', 'senate', 'democrat', 'republican'],
    crypto: ['bitcoin', 'ethereum', 'btc', 'eth', 'crypto', 'blockchain', 'defi'],
    ai: ['openai', 'chatgpt', 'gpt', 'claude', 'anthropic', 'gemini', 'ai', 'artificial intelligence'],
    stocks: ['stock', 'market', 'nasdaq', 'dow', 's&p', 'earnings', 'ipo'],
    economics: ['fed', 'interest rate', 'inflation', 'gdp', 'unemployment', 'recession'],
    sec: ['sec', 'regulation', 'compliance', 'lawsuit', 'investigation'],
  };
  
  for (const [category, words] of Object.entries(keywordMap)) {
    for (const word of words) {
      if (lowerText.includes(word)) {
        keywords.push(category);
        break;
      }
    }
  }
  
  return [...new Set(keywords)];
}

// Fetch from Finnhub
async function fetchFinnhub(apiKey: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`,
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) {
      console.error('Finnhub API error:', response.status);
      return [];
    }
    
    const articles = await response.json();
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    return articles
      .filter((a: any) => (a.datetime * 1000) > cutoff)
      .slice(0, 20)
      .map((article: any) => {
        const text = `${article.headline || ''} ${article.summary || ''}`;
        const { sentiment, score } = analyzeSentiment(text);
        
        return {
          id: `finnhub_${article.id || Date.now()}_${Math.random().toString(36).slice(2)}`,
          source: 'finnhub',
          title: article.headline || 'Untitled',
          content: article.summary || null,
          url: article.url || null,
          author: article.source || null,
          sentiment,
          sentiment_score: score,
          keywords: extractKeywords(text),
          published_at: new Date(article.datetime * 1000).toISOString(),
          fetched_at: new Date().toISOString(),
        };
      });
  } catch (error) {
    console.error('Finnhub fetch error:', error);
    return [];
  }
}

// Fetch from NewsAPI
async function fetchNewsAPI(apiKey: string): Promise<any[]> {
  try {
    const queries = ['stock market', 'cryptocurrency', 'federal reserve'];
    const allArticles: any[] = [];
    
    for (const query of queries) {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`,
        { next: { revalidate: 60 } }
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      for (const article of data.articles || []) {
        const text = `${article.title || ''} ${article.description || ''}`;
        const { sentiment, score } = analyzeSentiment(text);
        
        allArticles.push({
          id: `newsapi_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          source: 'news_api',
          title: article.title || 'Untitled',
          content: article.description || null,
          url: article.url || null,
          author: article.author || article.source?.name || null,
          sentiment,
          sentiment_score: score,
          keywords: extractKeywords(text),
          published_at: article.publishedAt || new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        });
      }
    }
    
    return allArticles.slice(0, 20);
  } catch (error) {
    console.error('NewsAPI fetch error:', error);
    return [];
  }
}

// Fetch from Polymarket activity
async function fetchPolymarketActivity(): Promise<any[]> {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/events?closed=false&limit=30&order=volume24hr&ascending=false',
      { next: { revalidate: 60 } }
    );
    
    if (!response.ok) return [];
    
    const events = await response.json();
    
    return events
      .filter((e: any) => parseFloat(e.volume24hr || 0) > 10000)
      .slice(0, 15)
      .map((event: any) => {
        const text = `${event.title || ''} ${event.description || ''}`;
        const { sentiment, score } = analyzeSentiment(text);
        const volume = parseFloat(event.volume24hr || 0);
        
        return {
          id: `polymarket_${event.id || Date.now()}_${Math.random().toString(36).slice(2)}`,
          source: 'polymarket',
          title: `High activity: ${event.title || 'Unknown Market'}`,
          content: event.description || `$${(volume / 1000).toFixed(1)}K volume in 24h`,
          url: `https://polymarket.com/event/${event.slug || event.id}`,
          author: null,
          sentiment,
          sentiment_score: score,
          keywords: extractKeywords(text),
          published_at: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        };
      });
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return [];
  }
}

// Fetch from Alpha Vantage
async function fetchAlphaVantage(apiKey: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=technology,finance&apikey=${apiKey}`,
      { next: { revalidate: 300 } }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    if (!data.feed) return [];
    
    return data.feed.slice(0, 15).map((article: any) => {
      const text = `${article.title || ''} ${article.summary || ''}`;
      
      // Alpha Vantage provides its own sentiment
      let sentiment = 'neutral';
      const avSentiment = article.overall_sentiment_label?.toLowerCase();
      if (avSentiment?.includes('bullish')) sentiment = avSentiment.includes('somewhat') ? 'bullish' : 'very_bullish';
      else if (avSentiment?.includes('bearish')) sentiment = avSentiment.includes('somewhat') ? 'bearish' : 'very_bearish';
      
      return {
        id: `alphavantage_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        source: 'alphavantage',
        title: article.title || 'Untitled',
        content: article.summary || null,
        url: article.url || null,
        author: article.authors?.join(', ') || article.source || null,
        sentiment,
        sentiment_score: parseFloat(article.overall_sentiment_score || 0),
        keywords: extractKeywords(text),
        published_at: article.time_published 
          ? new Date(article.time_published.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')).toISOString()
          : new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('Alpha Vantage fetch error:', error);
    return [];
  }
}

// Fetch from Reddit (public API, no key needed)
async function fetchReddit(): Promise<any[]> {
  try {
    const subreddits = ['wallstreetbets', 'stocks', 'cryptocurrency'];
    const allPosts: any[] = [];
    
    for (const sub of subreddits) {
      try {
        const response = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=8`,
          { 
            headers: { 
              'User-Agent': 'Mozilla/5.0 (compatible; PolyBot/1.0)',
              'Accept': 'application/json',
            },
          }
        );
        
        if (!response.ok) {
          console.log(`Reddit ${sub}: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        for (const post of data.data?.children || []) {
          const p = post.data;
          if (p.stickied || p.over_18) continue; // Skip stickied and NSFW
          
          const text = `${p.title || ''} ${p.selftext || ''}`.slice(0, 500);
          const { sentiment, score } = analyzeSentiment(text);
          
          allPosts.push({
            id: `reddit_${p.id || Date.now()}_${Math.random().toString(36).slice(2)}`,
            source: 'reddit',
            title: p.title?.slice(0, 200) || 'Untitled',
            content: (p.selftext || '').slice(0, 300) || `r/${sub} • ${p.score} upvotes • ${p.num_comments} comments`,
            url: `https://reddit.com${p.permalink}`,
            author: p.author || null,
            sentiment,
            sentiment_score: score,
            keywords: [...extractKeywords(text), sub],
            published_at: new Date(p.created_utc * 1000).toISOString(),
            fetched_at: new Date().toISOString(),
          });
        }
        
        // Small delay between requests to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      } catch (subError) {
        console.error(`Reddit ${sub} error:`, subError);
      }
    }
    
    return allPosts.slice(0, 15);
  } catch (error) {
    console.error('Reddit fetch error:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get API keys from Supabase (check multiple possible key names)
    const [finnhubKey, newsApiKey1, newsApiKey2, alphaVantageKey] = await Promise.all([
      getSecret('FINNHUB_API_KEY'),
      getSecret('NEWSAPI_KEY'),
      getSecret('NEWS_API_KEY'),
      getSecret('ALPHA_VANTAGE_API_KEY'),
    ]);
    
    const newsApiKey = newsApiKey1 || newsApiKey2;
    
    const results: { source: string; count: number; error?: string }[] = [];
    const allNews: any[] = [];
    
    // Fetch from all sources in parallel
    const [finnhubNews, newsApiNews, polymarketNews, alphaVantageNews, redditNews] = await Promise.all([
      finnhubKey ? fetchFinnhub(finnhubKey) : Promise.resolve([]),
      newsApiKey ? fetchNewsAPI(newsApiKey) : Promise.resolve([]),
      fetchPolymarketActivity(),
      alphaVantageKey ? fetchAlphaVantage(alphaVantageKey) : Promise.resolve([]),
      fetchReddit(),
    ]);
    
    // Collect results
    if (finnhubKey) {
      allNews.push(...finnhubNews);
      results.push({ source: 'finnhub', count: finnhubNews.length });
    } else {
      results.push({ source: 'finnhub', count: 0, error: 'API key not configured' });
    }
    
    if (newsApiKey) {
      allNews.push(...newsApiNews);
      results.push({ source: 'news_api', count: newsApiNews.length });
    } else {
      results.push({ source: 'news_api', count: 0, error: 'API key not configured' });
    }
    
    allNews.push(...polymarketNews);
    results.push({ source: 'polymarket', count: polymarketNews.length });
    
    if (alphaVantageKey) {
      allNews.push(...alphaVantageNews);
      results.push({ source: 'alphavantage', count: alphaVantageNews.length });
    } else {
      results.push({ source: 'alphavantage', count: 0, error: 'API key not configured' });
    }
    
    allNews.push(...redditNews);
    results.push({ source: 'reddit', count: redditNews.length });
    
    // Insert into database (upsert to avoid duplicates)
    if (allNews.length > 0) {
      // Delete old news (older than 48 hours)
      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('polybot_news_items')
        .delete()
        .lt('published_at', cutoff);
      
      // Insert new news
      const { error: insertError } = await supabase
        .from('polybot_news_items')
        .upsert(allNews, { 
          onConflict: 'id',
          ignoreDuplicates: true 
        });
      
      if (insertError) {
        console.error('Insert error:', insertError);
      }
    }
    
    return NextResponse.json({
      success: true,
      total: allNews.length,
      sources: results,
      message: `Fetched ${allNews.length} news items from ${results.filter(r => r.count > 0).length} sources`,
    });
    
  } catch (error: any) {
    console.error('News refresh error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh news' },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
