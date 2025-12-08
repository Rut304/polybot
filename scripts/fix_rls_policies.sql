-- Fix RLS policies for admin UI access
-- The admin UI uses anon key, so we need SELECT policies for public read access

-- polybot_news_items - Allow public read access
ALTER TABLE polybot_news_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to news items" ON polybot_news_items;
CREATE POLICY "Allow public read access to news items" 
    ON polybot_news_items 
    FOR SELECT 
    USING (true);

-- polybot_simulated_trades - Allow public read access  
ALTER TABLE polybot_simulated_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to simulated trades" ON polybot_simulated_trades;
CREATE POLICY "Allow public read access to simulated trades" 
    ON polybot_simulated_trades 
    FOR SELECT 
    USING (true);

-- polybot_simulation_stats - Allow public read access
ALTER TABLE polybot_simulation_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to simulation stats" ON polybot_simulation_stats;
CREATE POLICY "Allow public read access to simulation stats" 
    ON polybot_simulation_stats 
    FOR SELECT 
    USING (true);

-- polybot_config - Allow public read access (no secrets here)
ALTER TABLE polybot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to config" ON polybot_config;
CREATE POLICY "Allow public read access to config" 
    ON polybot_config 
    FOR SELECT 
    USING (true);

-- polybot_opportunities - Allow public read access
ALTER TABLE polybot_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to opportunities" ON polybot_opportunities;
CREATE POLICY "Allow public read access to opportunities" 
    ON polybot_opportunities 
    FOR SELECT 
    USING (true);

-- polybot_balances - Allow public read access
ALTER TABLE polybot_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to balances" ON polybot_balances;
CREATE POLICY "Allow public read access to balances" 
    ON polybot_balances 
    FOR SELECT 
    USING (true);

-- polybot_secrets - KEEP RESTRICTED (service_role only)
-- This table should NOT have public read access!
ALTER TABLE polybot_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to secrets" ON polybot_secrets;
CREATE POLICY "Service role full access to secrets"
    ON polybot_secrets
    FOR ALL
    USING (auth.role() = 'service_role');

-- Summary of changes
SELECT 'RLS policies updated for admin UI access' AS status;
