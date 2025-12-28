import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Static help articles (used as fallback if DB not available)
const STATIC_ARTICLES = [
  {
    id: '1',
    slug: 'getting-started',
    title: 'Getting Started with PolyParlay',
    category: 'getting-started',
    excerpt: 'Learn how to set up your PolyParlay account and start trading predictions.',
    content: `# Getting Started with PolyParlay

Welcome to PolyParlay! This guide will help you set up your account and start trading.

## Step 1: Create Your Account

Sign up at [polyparlay.io/signup](/signup) with your email. You'll receive a verification email.

## Step 2: Complete Onboarding

After verifying your email, you'll see our onboarding wizard that helps you:
- Set up your embedded wallet (Privy)
- Connect your trading platforms (Polymarket, Kalshi, Alpaca)
- Choose your initial strategies

## Step 3: Start Paper Trading

Everyone starts with **unlimited paper trading** - no real money required! This lets you:
- Test strategies risk-free
- Learn how the platform works
- Build confidence before going live

## Step 4: Configure Strategies

Go to Settings → Strategies to enable the trading strategies you want to use.

## Need Help?

- Check our [FAQ](/help/faq)
- Contact support via live chat`,
    view_count: 0,
  },
  {
    id: '2',
    slug: 'paper-trading',
    title: 'Paper Trading Guide',
    category: 'getting-started',
    excerpt: 'Learn how paper trading works and practice risk-free.',
    content: `# Paper Trading Guide

Paper trading lets you practice with simulated money using real market data.

## How It Works

1. **Real Market Data**: All prices and opportunities are real
2. **Simulated Execution**: Trades are simulated, not executed
3. **Track Performance**: Full analytics and P&L tracking
4. **No Risk**: Learn and experiment without losing money

## Benefits

- Test strategies before risking real capital
- Understand market dynamics
- Build confidence in your approach
- Identify what works for your trading style

## Switching to Live Trading

When you're ready to trade with real money:
1. Go to Settings → Trading Mode
2. Toggle "Live Trading" on
3. Ensure your platform API keys are connected
4. Set appropriate position sizes and risk limits

**Note**: Live trading requires a Pro or Elite subscription.`,
    view_count: 0,
  },
  {
    id: '3',
    slug: 'connecting-platforms',
    title: 'Connecting Trading Platforms',
    category: 'integrations',
    excerpt: 'How to connect Polymarket, Kalshi, Alpaca, and crypto exchanges.',
    content: `# Connecting Trading Platforms

PolyParlay supports multiple trading platforms. Here's how to connect each one.

## Polymarket

1. Create a Polymarket account at [polymarket.com](https://polymarket.com)
2. Get your API credentials from Settings
3. In PolyParlay: Settings → API Keys → Polymarket
4. Enter your API Key and Private Key

## Kalshi

1. Create a Kalshi account at [kalshi.com](https://kalshi.com)
2. Go to API Settings in your Kalshi dashboard
3. Generate an API key
4. In PolyParlay: Settings → API Keys → Kalshi

## Alpaca (Stocks)

1. Sign up at [alpaca.markets](https://alpaca.markets)
2. Go to Paper Trading or Live Trading
3. Get your API Key and Secret
4. In PolyParlay: Settings → API Keys → Alpaca

## Crypto Exchanges

We support Binance, Coinbase, Kraken, KuCoin via API keys:
1. Generate API keys on your exchange
2. Enable trading permissions (not withdrawal!)
3. Add to PolyParlay Settings → API Keys

## Security Notes

- Never share your API keys
- Use IP whitelisting when available
- Disable withdrawal permissions
- Rotate keys periodically`,
    view_count: 0,
  },
  {
    id: '4',
    slug: 'strategies-overview',
    title: 'Trading Strategies Overview',
    category: 'strategies',
    excerpt: 'Overview of all available trading strategies.',
    content: `# Trading Strategies Overview

PolyParlay offers multiple automated trading strategies.

## Prediction Market Strategies

### Polymarket Single
Trade individual prediction markets based on probability analysis.
- Good for: News-driven events, elections, sports
- Risk: Medium

### Kalshi Events
Trade regulated prediction markets on Kalshi.
- Good for: Weather, economic indicators, Fed decisions
- Risk: Medium

### Cross-Platform Arbitrage
Find price discrepancies between Polymarket and Kalshi.
- Good for: Risk-free profits when spreads exist
- Risk: Low (but opportunities are rare)

## Stock Strategies

### Congressional Tracker
Mirror trades from US Congress members (45-day delay).
- Good for: Long-term stock picks
- Risk: Medium

### RSI Strategy
Buy oversold stocks, sell overbought ones.
- Good for: Mean reversion plays
- Risk: Medium-High

## Configuring Strategies

1. Go to Settings → Strategies
2. Enable the strategies you want
3. Set position sizes and risk limits
4. Monitor performance on Dashboard`,
    view_count: 0,
  },
  {
    id: '5',
    slug: 'faq',
    title: 'Frequently Asked Questions',
    category: 'faq',
    excerpt: 'Common questions and answers.',
    content: `# Frequently Asked Questions

## General

**Is PolyParlay legal?**
Yes! Polymarket and Kalshi are legal prediction markets. We simply help you trade more efficiently.

**How much does it cost?**
- Free tier: Unlimited paper trading
- Pro ($29/mo): 1,000 live trades
- Elite ($99/mo): Unlimited trading + all features

**Can I cancel anytime?**
Yes, cancel with one click. No questions asked.

## Trading

**How does paper trading work?**
Paper trading uses real market data but simulated money. Perfect for learning.

**What's the minimum to start live trading?**
That depends on the platform. Polymarket has no minimum, Kalshi requires $1.

**How accurate are the strategies?**
Our Kalshi strategy achieved 78% win rate in beta (606 trades). Past performance doesn't guarantee future results.

## Technical

**Why isn't my trade executing?**
Check: 1) API keys are valid, 2) Sufficient balance, 3) Market is open, 4) Bot is running.

**How do I reset my simulation?**
Settings → Simulation → Reset Simulation Data.

**Is my data secure?**
Yes. We use Supabase with row-level security. API keys are encrypted.`,
    view_count: 0,
  },
  {
    id: '6',
    slug: 'billing',
    title: 'Billing & Subscriptions',
    category: 'billing',
    excerpt: 'Manage your subscription and billing information.',
    content: `# Billing & Subscriptions

## Plans

### Free Tier
- Unlimited paper trading
- 3 basic strategies
- Dashboard & analytics
- Discord community

### Pro ($29/month)
- Everything in Free
- 1,000 live trades/month
- All 10+ strategies
- AI market insights
- Email support

### Elite ($99/month)
- Everything in Pro
- Unlimited live trades
- Whale tracker
- Congress tracker
- Tax reports
- Priority support

## Managing Your Subscription

1. Go to Settings → Subscription
2. View current plan and usage
3. Upgrade or downgrade anytime
4. Cancel with one click

## Billing FAQ

**When am I charged?**
Monthly on the day you subscribed.

**What payment methods do you accept?**
Credit/debit cards via Stripe.

**Do you offer refunds?**
Yes, within 7 days of purchase.`,
    view_count: 0,
  },
];

// GET - Get help articles or single article
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const supabase = getSupabaseAdmin();
    
    // If DB not available, use static articles
    if (!supabase) {
      let articles = STATIC_ARTICLES;
      
      if (slug) {
        const article = articles.find(a => a.slug === slug);
        return article 
          ? NextResponse.json(article)
          : NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }
      
      if (category) {
        articles = articles.filter(a => a.category === category);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        articles = articles.filter(a => 
          a.title.toLowerCase().includes(searchLower) ||
          a.content.toLowerCase().includes(searchLower)
        );
      }
      
      return NextResponse.json({ articles });
    }

    // Try to use DB
    if (slug) {
      const { data: article, error } = await supabase
        .from('polybot_help_articles')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error || !article) {
        // Fallback to static
        const staticArticle = STATIC_ARTICLES.find(a => a.slug === slug);
        return staticArticle 
          ? NextResponse.json(staticArticle)
          : NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }

      // Increment view count
      await supabase
        .from('polybot_help_articles')
        .update({ view_count: (article.view_count || 0) + 1 })
        .eq('id', article.id);

      return NextResponse.json(article);
    }

    // Get all articles
    let query = supabase
      .from('polybot_help_articles')
      .select('id, slug, title, category, excerpt, view_count, created_at')
      .eq('is_published', true)
      .order('sort_order', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: articles, error } = await query;

    if (error || !articles || articles.length === 0) {
      // Fallback to static
      let staticList = STATIC_ARTICLES.map(a => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        view_count: a.view_count,
      }));
      
      if (category) {
        staticList = staticList.filter(a => a.category === category);
      }
      
      return NextResponse.json({ articles: staticList });
    }

    return NextResponse.json({ articles });
  } catch (error: any) {
    console.error('Help API error:', error);
    // Return static articles on error
    return NextResponse.json({ articles: STATIC_ARTICLES.map(a => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      category: a.category,
      excerpt: a.excerpt,
    }))});
  }
}

// POST - Submit feedback for an article
export async function POST(req: NextRequest) {
  try {
    const { article_id, is_helpful, feedback } = await req.json();
    const userId = req.headers.get('x-user-id');

    if (!article_id || is_helpful === undefined) {
      return NextResponse.json({ error: 'Missing article_id or is_helpful' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      // Just acknowledge without storing
      return NextResponse.json({ success: true, message: 'Feedback received' });
    }

    // Store feedback
    const { error: feedbackError } = await supabase
      .from('polybot_help_feedback')
      .insert({
        article_id,
        user_id: userId || null,
        is_helpful,
        feedback,
      });

    if (feedbackError) {
      console.error('Error storing feedback:', feedbackError);
    }

    // Update article counts - try to increment but don't fail if RPC doesn't exist
    const column = is_helpful ? 'helpful_count' : 'not_helpful_count';
    try {
      await supabase.rpc('increment_help_count', {
        p_article_id: article_id,
        p_column: column,
      });
    } catch {
      // Ignore if RPC doesn't exist
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Help feedback error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
