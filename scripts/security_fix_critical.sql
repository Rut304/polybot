-- ============================================
-- CRITICAL SECURITY FIX - RUN NOW
-- ============================================
-- Fixes all security issues from Supabase Security Advisor
-- December 27, 2025
-- ============================================

-- ============================================
-- STEP 1: Enable RLS on ALL Tables (Fixes 30+ issues)
-- ============================================

-- Tables with policies but RLS disabled (CRITICAL)
ALTER TABLE IF EXISTS polybot_disabled_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_simulated_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_simulation_stats ENABLE ROW LEVEL SECURITY;

-- Tables without RLS at all (CRITICAL)
ALTER TABLE IF EXISTS polybot_market_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_market_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_arbitrage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_news_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_mm_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_config_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_config_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_markets_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS polybot_scalp_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bot_status ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: Add Basic RLS Policies to New Tables
-- ============================================

-- polybot_market_pairs (shared data - read only)
DROP POLICY IF EXISTS "Allow authenticated read market_pairs" ON polybot_market_pairs;
CREATE POLICY "Allow authenticated read market_pairs" ON polybot_market_pairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role market_pairs" ON polybot_market_pairs FOR ALL USING (auth.role() = 'service_role');

-- polybot_trades (user data)
DROP POLICY IF EXISTS "Users read own trades" ON polybot_trades;
CREATE POLICY "Users read own trades" ON polybot_trades FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role trades" ON polybot_trades FOR ALL USING (auth.role() = 'service_role');

-- polybot_watchlist (user data)
DROP POLICY IF EXISTS "Users manage own watchlist" ON polybot_watchlist;
CREATE POLICY "Users manage own watchlist" ON polybot_watchlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role watchlist" ON polybot_watchlist FOR ALL USING (auth.role() = 'service_role');

-- polybot_market_scans (shared data)
DROP POLICY IF EXISTS "Allow authenticated read scans" ON polybot_market_scans;
CREATE POLICY "Allow authenticated read scans" ON polybot_market_scans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role scans" ON polybot_market_scans FOR ALL USING (auth.role() = 'service_role');

-- polybot_arbitrage_analytics (user data)
DROP POLICY IF EXISTS "Users read own analytics" ON polybot_arbitrage_analytics;
CREATE POLICY "Users read own analytics" ON polybot_arbitrage_analytics FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role analytics" ON polybot_arbitrage_analytics FOR ALL USING (auth.role() = 'service_role');

-- polybot_news_signals (shared data)
DROP POLICY IF EXISTS "Allow authenticated read news_signals" ON polybot_news_signals;
CREATE POLICY "Allow authenticated read news_signals" ON polybot_news_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role news_signals" ON polybot_news_signals FOR ALL USING (auth.role() = 'service_role');

-- polybot_mm_activity (shared data)
DROP POLICY IF EXISTS "Allow authenticated read mm_activity" ON polybot_mm_activity;
CREATE POLICY "Allow authenticated read mm_activity" ON polybot_mm_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role mm_activity" ON polybot_mm_activity FOR ALL USING (auth.role() = 'service_role');

-- polybot_balances (user data - CRITICAL)
DROP POLICY IF EXISTS "Users read own balances" ON polybot_balances;
CREATE POLICY "Users read own balances" ON polybot_balances FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role balances" ON polybot_balances FOR ALL USING (auth.role() = 'service_role');

-- polybot_balance_history (user data - CRITICAL)
DROP POLICY IF EXISTS "Users read own balance_history" ON polybot_balance_history;
CREATE POLICY "Users read own balance_history" ON polybot_balance_history FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role balance_history" ON polybot_balance_history FOR ALL USING (auth.role() = 'service_role');

-- polybot_rate_limits (system data - service role only)
DROP POLICY IF EXISTS "Service role rate_limits" ON polybot_rate_limits;
CREATE POLICY "Service role rate_limits" ON polybot_rate_limits FOR ALL USING (auth.role() = 'service_role');

-- polybot_config_history (user data)
DROP POLICY IF EXISTS "Users read own config_history" ON polybot_config_history;
CREATE POLICY "Users read own config_history" ON polybot_config_history FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role config_history" ON polybot_config_history FOR ALL USING (auth.role() = 'service_role');

-- polybot_admin_audit_log (admin only)
DROP POLICY IF EXISTS "Service role audit_log" ON polybot_admin_audit_log;
CREATE POLICY "Service role audit_log" ON polybot_admin_audit_log FOR ALL USING (auth.role() = 'service_role');

-- polybot_config_changes (user data)
DROP POLICY IF EXISTS "Users read own config_changes" ON polybot_config_changes;
CREATE POLICY "Users read own config_changes" ON polybot_config_changes FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role config_changes" ON polybot_config_changes FOR ALL USING (auth.role() = 'service_role');

-- polybot_markets_cache (shared data)
DROP POLICY IF EXISTS "Allow authenticated read markets_cache" ON polybot_markets_cache;
CREATE POLICY "Allow authenticated read markets_cache" ON polybot_markets_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role markets_cache" ON polybot_markets_cache FOR ALL USING (auth.role() = 'service_role');

-- polybot_ai_forecasts (shared data)
DROP POLICY IF EXISTS "Allow authenticated read ai_forecasts" ON polybot_ai_forecasts;
CREATE POLICY "Allow authenticated read ai_forecasts" ON polybot_ai_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role ai_forecasts" ON polybot_ai_forecasts FOR ALL USING (auth.role() = 'service_role');

-- polybot_scalp_trades (user data)
DROP POLICY IF EXISTS "Users read own scalp_trades" ON polybot_scalp_trades;
CREATE POLICY "Users read own scalp_trades" ON polybot_scalp_trades FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role scalp_trades" ON polybot_scalp_trades FOR ALL USING (auth.role() = 'service_role');

-- bot_status (user data)
DROP POLICY IF EXISTS "Users read own bot_status" ON bot_status;
CREATE POLICY "Users read own bot_status" ON bot_status FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY "Service role bot_status" ON bot_status FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STEP 3: Fix SECURITY DEFINER Views
-- ============================================

-- Recreate views with SECURITY INVOKER (default, safer)
DROP VIEW IF EXISTS whale_leaderboard;
DROP VIEW IF EXISTS polybot_strategy_performance_user;
DROP VIEW IF EXISTS user_stats;
DROP VIEW IF EXISTS polybot_strategy_performance;
DROP VIEW IF EXISTS polybot_daily_pnl;
DROP VIEW IF EXISTS recent_activity;
DROP VIEW IF EXISTS polybot_politician_performance;

-- Recreate whale_leaderboard as SECURITY INVOKER
CREATE OR REPLACE VIEW whale_leaderboard 
WITH (security_invoker = true) AS
SELECT 
    wallet_address,
    nickname,
    total_pnl,
    win_rate,
    total_trades
FROM polybot_tracked_traders
WHERE is_active = true
ORDER BY total_pnl DESC
LIMIT 100;

-- Recreate polybot_strategy_performance_user  
CREATE OR REPLACE VIEW polybot_strategy_performance_user 
WITH (security_invoker = true) AS
SELECT 
    user_id,
    trading_mode,
    COALESCE(strategy_type, arbitrage_type, trade_type, 'unknown') as strategy,
    COUNT(*) as total_trades,
    COUNT(*) FILTER (WHERE outcome = 'won') as winning_trades,
    COUNT(*) FILTER (WHERE outcome = 'lost') as losing_trades,
    SUM(actual_profit_usd) as total_pnl,
    AVG(actual_profit_usd) as avg_trade_pnl
FROM polybot_simulated_trades
WHERE outcome != 'failed_execution'
GROUP BY user_id, trading_mode, COALESCE(strategy_type, arbitrage_type, trade_type, 'unknown');

-- Recreate polybot_daily_pnl
CREATE OR REPLACE VIEW polybot_daily_pnl 
WITH (security_invoker = true) AS
SELECT 
    user_id,
    DATE(created_at) as trade_date,
    SUM(actual_profit_usd) as daily_pnl,
    COUNT(*) as trade_count
FROM polybot_simulated_trades
WHERE outcome IN ('won', 'lost')
GROUP BY user_id, DATE(created_at)
ORDER BY trade_date DESC;

-- Simple user_stats view
CREATE OR REPLACE VIEW user_stats 
WITH (security_invoker = true) AS
SELECT 
    user_id,
    COUNT(*) as total_trades,
    SUM(actual_profit_usd) as total_pnl,
    COUNT(*) FILTER (WHERE outcome = 'won') as wins,
    COUNT(*) FILTER (WHERE outcome = 'lost') as losses
FROM polybot_simulated_trades
GROUP BY user_id;

-- Recent activity view
CREATE OR REPLACE VIEW recent_activity 
WITH (security_invoker = true) AS
SELECT 
    id,
    user_id,
    market_question,
    outcome,
    actual_profit_usd,
    created_at
FROM polybot_simulated_trades
ORDER BY created_at DESC
LIMIT 50;

-- Strategy performance (global)
CREATE OR REPLACE VIEW polybot_strategy_performance 
WITH (security_invoker = true) AS
SELECT 
    COALESCE(strategy_type, arbitrage_type, 'unknown') as strategy,
    COUNT(*) as total_trades,
    SUM(actual_profit_usd) as total_pnl,
    AVG(actual_profit_usd) as avg_pnl
FROM polybot_simulated_trades
WHERE outcome IN ('won', 'lost')
GROUP BY COALESCE(strategy_type, arbitrage_type, 'unknown');

-- Politician performance
CREATE OR REPLACE VIEW polybot_politician_performance 
WITH (security_invoker = true) AS
SELECT 
    politician_name,
    COUNT(*) as trade_count,
    SUM(CASE WHEN profit > 0 THEN 1 ELSE 0 END) as profitable_trades
FROM polybot_tracked_politicians
GROUP BY politician_name;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ Security fixes applied! Re-run Security Advisor to verify.' as status;
