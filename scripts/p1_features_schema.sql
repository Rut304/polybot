-- P1 Features Database Schema
-- Run this in Supabase SQL Editor

-- =============================================================================
-- 1. REFERRAL PROGRAM
-- =============================================================================

-- Referral codes table
CREATE TABLE IF NOT EXISTS polybot_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0, -- Users who upgraded to paid
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral tracking (who referred whom)
CREATE TABLE IF NOT EXISTS polybot_referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code VARCHAR(20) NOT NULL,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'clicked', -- clicked, signed_up, converted
  reward_amount DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

-- RLS for referrals
ALTER TABLE polybot_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_referral_clicks ENABLE ROW LEVEL SECURITY;

-- Users can read their own referral data
CREATE POLICY "Users can view own referrals" ON polybot_referrals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own referrals" ON polybot_referrals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referrals" ON polybot_referrals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their referral clicks
CREATE POLICY "Users can view own referral clicks" ON polybot_referral_clicks
  FOR SELECT USING (auth.uid() = referrer_id);

-- Service role can do everything
CREATE POLICY "Service role full access referrals" ON polybot_referrals
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access clicks" ON polybot_referral_clicks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON polybot_referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON polybot_referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON polybot_referral_clicks(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_referrer ON polybot_referral_clicks(referrer_id);

-- =============================================================================
-- 2. BACKTESTING
-- =============================================================================

-- Backtest runs
CREATE TABLE IF NOT EXISTS polybot_backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  strategy_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed
  
  -- Configuration
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  initial_capital DECIMAL(12,2) DEFAULT 10000.00,
  position_size DECIMAL(5,2) DEFAULT 5.00, -- % of capital
  stop_loss DECIMAL(5,2),
  take_profit DECIMAL(5,2),
  strategy_params JSONB DEFAULT '{}',
  
  -- Results (populated after completion)
  total_trades INTEGER,
  winning_trades INTEGER,
  losing_trades INTEGER,
  total_pnl DECIMAL(12,2),
  max_drawdown DECIMAL(5,2),
  sharpe_ratio DECIMAL(5,2),
  win_rate DECIMAL(5,2),
  avg_trade_return DECIMAL(5,2),
  results JSONB, -- Full results with equity curve, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Backtest trades (individual trades within a backtest)
CREATE TABLE IF NOT EXISTS polybot_backtest_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_id UUID NOT NULL REFERENCES polybot_backtests(id) ON DELETE CASCADE,
  trade_date TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(100),
  market_title TEXT,
  side VARCHAR(10), -- buy, sell
  entry_price DECIMAL(12,4),
  exit_price DECIMAL(12,4),
  position_size DECIMAL(12,2),
  pnl DECIMAL(12,2),
  pnl_percent DECIMAL(5,2),
  exit_reason VARCHAR(50), -- signal, stop_loss, take_profit, end_of_period
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for backtests
ALTER TABLE polybot_backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_backtest_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own backtests" ON polybot_backtests
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own backtest trades" ON polybot_backtest_trades
  FOR SELECT USING (
    backtest_id IN (SELECT id FROM polybot_backtests WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access backtests" ON polybot_backtests
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access backtest trades" ON polybot_backtest_trades
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backtests_user_id ON polybot_backtests(user_id);
CREATE INDEX IF NOT EXISTS idx_backtests_status ON polybot_backtests(status);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_backtest_id ON polybot_backtest_trades(backtest_id);

-- =============================================================================
-- 3. HELP DOCS / KNOWLEDGE BASE
-- =============================================================================

-- Help articles
CREATE TABLE IF NOT EXISTS polybot_help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- getting-started, strategies, integrations, billing, faq
  content TEXT NOT NULL, -- Markdown content
  excerpt TEXT, -- Short description for listings
  search_keywords TEXT[], -- For full-text search
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Help article feedback
CREATE TABLE IF NOT EXISTS polybot_help_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES polybot_help_articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_helpful BOOLEAN NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS - Help articles are public read
ALTER TABLE polybot_help_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE polybot_help_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published help articles" ON polybot_help_articles
  FOR SELECT USING (is_published = true);

CREATE POLICY "Authenticated users can submit feedback" ON polybot_help_feedback
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access help" ON polybot_help_articles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access feedback" ON polybot_help_feedback
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_help_articles_search ON polybot_help_articles 
  USING gin(to_tsvector('english', title || ' ' || content));

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON polybot_help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_slug ON polybot_help_articles(slug);

-- =============================================================================
-- 4. LIVE CHAT SESSIONS (for Crisp/Intercom integration tracking)
-- =============================================================================

CREATE TABLE IF NOT EXISTS polybot_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  external_session_id VARCHAR(255), -- ID from Crisp/Intercom
  provider VARCHAR(50) DEFAULT 'crisp', -- crisp, intercom
  status VARCHAR(20) DEFAULT 'open', -- open, resolved, pending
  subject TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  rating INTEGER, -- 1-5 satisfaction rating
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE polybot_chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions" ON polybot_chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access chats" ON polybot_chat_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================================================
-- 5. Insert default help articles
-- =============================================================================

INSERT INTO polybot_help_articles (slug, title, category, content, excerpt, search_keywords, sort_order) VALUES
-- Getting Started
('getting-started', 'Getting Started with PolyParlay', 'getting-started', 
'# Getting Started with PolyParlay

Welcome to PolyParlay! This guide will help you set up your account and start trading.

## Step 1: Create Your Account

Sign up at [polyparlay.io/signup](/signup) with your email. You''ll receive a verification email.

## Step 2: Complete Onboarding

After verifying your email, you''ll see our onboarding wizard that helps you:
- Set up your embedded wallet (Privy)
- Connect your trading platforms (Polymarket, Kalshi, Alpaca)
- Choose your initial strategies

## Step 3: Start Paper Trading

Everyone starts with **unlimited paper trading** - no real money required! This lets you:
- Test strategies risk-free
- Learn how the platform works
- Build confidence before going live

## Step 4: Configure Strategies

Go to Settings → Strategies to enable the trading strategies you want to use:
- **Polymarket Single**: Single-market prediction betting
- **Kalshi Events**: Event-based prediction markets
- **Cross-Platform Arbitrage**: Find price discrepancies
- **Congressional Tracker**: Follow politician trades

## Need Help?

- Check our [FAQ](/help/faq)
- Join our [Discord community](https://discord.gg/polyparlay)
- Contact support via live chat
', 'Learn how to set up your PolyParlay account and start trading predictions.', 
ARRAY['setup', 'start', 'begin', 'account', 'onboarding', 'new user'], 1),

-- Paper Trading
('paper-trading', 'Paper Trading Guide', 'getting-started',
'# Paper Trading Guide

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

When you''re ready to trade with real money:
1. Go to Settings → Trading Mode
2. Toggle "Live Trading" on
3. Ensure your platform API keys are connected
4. Set appropriate position sizes and risk limits

**Note**: Live trading requires a Pro or Elite subscription.
', 'Learn how paper trading works and practice risk-free.', 
ARRAY['paper', 'simulation', 'practice', 'demo', 'test', 'fake money'], 2),

-- Connecting Platforms
('connecting-platforms', 'Connecting Trading Platforms', 'integrations',
'# Connecting Trading Platforms

PolyParlay supports multiple trading platforms. Here''s how to connect each one.

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
- Rotate keys periodically
', 'How to connect Polymarket, Kalshi, Alpaca, and crypto exchanges.', 
ARRAY['connect', 'api', 'keys', 'polymarket', 'kalshi', 'alpaca', 'binance', 'exchange'], 1),

-- Strategies Overview
('strategies-overview', 'Trading Strategies Overview', 'strategies',
'# Trading Strategies Overview

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
4. Monitor performance on Dashboard
', 'Overview of all available trading strategies.', 
ARRAY['strategy', 'strategies', 'polymarket', 'kalshi', 'arbitrage', 'congressional', 'rsi'], 1),

-- FAQ
('faq', 'Frequently Asked Questions', 'faq',
'# Frequently Asked Questions

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

**What''s the minimum to start live trading?**
That depends on the platform. Polymarket has no minimum, Kalshi requires $1.

**How accurate are the strategies?**
Our Kalshi strategy achieved 78% win rate in beta (606 trades). Past performance doesn''t guarantee future results.

## Technical

**Why isn''t my trade executing?**
Check: 1) API keys are valid, 2) Sufficient balance, 3) Market is open, 4) Bot is running.

**How do I reset my simulation?**
Settings → Simulation → Reset Simulation Data.

**Is my data secure?**
Yes. We use Supabase with row-level security. API keys are encrypted.
', 'Common questions and answers.', 
ARRAY['faq', 'question', 'help', 'support', 'problem'], 1)

ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  excerpt = EXCLUDED.excerpt,
  search_keywords = EXCLUDED.search_keywords,
  updated_at = NOW();

-- =============================================================================
-- 6. Update user profiles to track referral source
-- =============================================================================

ALTER TABLE polybot_user_profiles 
  ADD COLUMN IF NOT EXISTS referred_by VARCHAR(20),
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);

-- Generate referral code for existing users (if not already set)
-- This would be done via application logic, not SQL

COMMIT;
