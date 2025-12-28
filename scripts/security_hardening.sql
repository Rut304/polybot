-- ============================================
-- SECURITY HARDENING SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor to verify and fix security
-- Created: December 27, 2025
-- ============================================

-- ============================================
-- STEP 1: Verify RLS is Enabled on All Tables
-- ============================================

DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'polybot_%'
        AND NOT rowsecurity
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
        RAISE NOTICE 'Enabled RLS on: %', tbl.tablename;
    END LOOP;
END $$;

-- ============================================
-- STEP 2: Create Missing RLS Policies
-- ============================================

-- Generic function to add standard policies
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'polybot_simulated_trades',
        'polybot_opportunities', 
        'polybot_positions',
        'polybot_simulation_stats',
        'polybot_disabled_markets',
        'polybot_tracked_traders',
        'polybot_copy_signals',
        'polybot_market_alerts',
        'polybot_manual_trades',
        'polybot_key_vault',
        'polybot_config',
        'polybot_status',
        'polybot_bot_logs',
        'polybot_tracked_politicians'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl) THEN
            -- Drop any overly permissive policies
            EXECUTE format('DROP POLICY IF EXISTS "Allow public access" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow public read" ON %I;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Allow anon access" ON %I;', tbl);
            
            -- Ensure user can only see their own data
            EXECUTE format(
                'CREATE POLICY IF NOT EXISTS "Users read own data" ON %I FOR SELECT USING (auth.uid() = user_id OR auth.role() = ''service_role'');',
                tbl
            );
            
            -- Service role gets full access for bot operations
            EXECUTE format(
                'CREATE POLICY IF NOT EXISTS "Service role full access" ON %I FOR ALL USING (auth.role() = ''service_role'');',
                tbl
            );
            
            RAISE NOTICE 'Secured table: %', tbl;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- STEP 3: Secure User Profiles (special case)
-- ============================================

-- Profiles table uses 'id' not 'user_id'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'polybot_profiles') THEN
        DROP POLICY IF EXISTS "Users can view own profile" ON polybot_profiles;
        DROP POLICY IF EXISTS "Users can update own profile" ON polybot_profiles;
        
        CREATE POLICY "Users can view own profile" ON polybot_profiles 
            FOR SELECT USING (auth.uid() = id);
        CREATE POLICY "Users can update own profile" ON polybot_profiles 
            FOR UPDATE USING (auth.uid() = id);
        CREATE POLICY "Service role profiles access" ON polybot_profiles 
            FOR ALL USING (auth.role() = 'service_role');
            
        RAISE NOTICE 'Secured: polybot_profiles';
    END IF;
END $$;

-- ============================================
-- STEP 4: Secure Audit/Security Logs (Admin Only)
-- ============================================

-- Create security alerts table if not exists
CREATE TABLE IF NOT EXISTS polybot_security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    user_id UUID,
    ip_address TEXT,
    details JSONB,
    severity TEXT DEFAULT 'info', -- info, warning, critical
    acknowledged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE polybot_security_alerts ENABLE ROW LEVEL SECURITY;

-- Only service role can access security alerts
DROP POLICY IF EXISTS "Service role only alerts" ON polybot_security_alerts;
CREATE POLICY "Service role only alerts" ON polybot_security_alerts
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- STEP 5: Create Indexes for Performance
-- ============================================

-- Essential indexes for user queries
CREATE INDEX IF NOT EXISTS idx_trades_user_created 
ON polybot_simulated_trades(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trades_user_outcome 
ON polybot_simulated_trades(user_id, outcome);

CREATE INDEX IF NOT EXISTS idx_positions_user_status 
ON polybot_positions(user_id, status);

CREATE INDEX IF NOT EXISTS idx_opportunities_user_active 
ON polybot_opportunities(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_alerts_user_ack 
ON polybot_market_alerts(user_id, acknowledged);

-- ============================================
-- STEP 6: Verify No Orphaned Data
-- ============================================

-- Report orphaned records (run as verification)
SELECT 
    'ORPHANED DATA REPORT' as report_type,
    table_name,
    orphaned_count,
    CASE 
        WHEN orphaned_count = 0 THEN '✅ Clean'
        ELSE '⚠️ Needs migration'
    END as status
FROM (
    SELECT 'polybot_simulated_trades' as table_name, COUNT(*) FILTER (WHERE user_id IS NULL) as orphaned_count FROM polybot_simulated_trades
    UNION ALL SELECT 'polybot_opportunities', COUNT(*) FILTER (WHERE user_id IS NULL) FROM polybot_opportunities
    UNION ALL SELECT 'polybot_positions', COUNT(*) FILTER (WHERE user_id IS NULL) FROM polybot_positions
    UNION ALL SELECT 'polybot_disabled_markets', COUNT(*) FILTER (WHERE user_id IS NULL) FROM polybot_disabled_markets
    UNION ALL SELECT 'polybot_tracked_traders', COUNT(*) FILTER (WHERE user_id IS NULL) FROM polybot_tracked_traders
) subq
WHERE orphaned_count > 0 OR table_name = 'polybot_simulated_trades';

-- ============================================
-- STEP 7: Final Verification Report
-- ============================================

SELECT 
    '============================================' as report;
SELECT 
    'SECURITY VERIFICATION REPORT' as report;
SELECT 
    '============================================' as report;

-- RLS Status
SELECT 
    tablename as "Table",
    CASE WHEN rowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END as "RLS Status"
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'polybot_%'
ORDER BY rowsecurity DESC, tablename;

-- Policy Count
SELECT 
    tablename as "Table",
    COUNT(*) as "Policy Count"
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename LIKE 'polybot_%'
GROUP BY tablename
ORDER BY tablename;

SELECT '✅ Security hardening complete!' as result;
