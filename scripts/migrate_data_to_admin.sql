-- ============================================
-- MIGRATE EXISTING DATA TO ADMIN USER
-- ============================================
-- Run this AFTER add_multi_tenant_columns.sql
-- This assigns all existing data to rutrohd@gmail.com
-- ============================================

-- Get the admin user's UUID
DO $$ 
DECLARE
    admin_user_id UUID;
    row_count INTEGER;
BEGIN
    -- Find the admin user
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'rutrohd@gmail.com' 
    LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Admin user rutrohd@gmail.com not found! Please sign in first.';
    END IF;
    
    RAISE NOTICE 'Found admin user: %', admin_user_id;
    
    -- Migrate polybot_simulated_trades
    UPDATE polybot_simulated_trades SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_simulated_trades', row_count;
    
    -- Migrate polybot_opportunities
    UPDATE polybot_opportunities SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_opportunities', row_count;
    
    -- Migrate polybot_positions
    UPDATE polybot_positions SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_positions', row_count;
    
    -- Migrate polybot_simulation_stats
    UPDATE polybot_simulation_stats SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_simulation_stats', row_count;
    
    -- Migrate polybot_disabled_markets
    UPDATE polybot_disabled_markets SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_disabled_markets', row_count;
    
    -- Migrate polybot_tracked_traders
    UPDATE polybot_tracked_traders SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_tracked_traders', row_count;
    
    -- Migrate polybot_copy_signals
    UPDATE polybot_copy_signals SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_copy_signals', row_count;
    
    -- Migrate polybot_overlap_opportunities
    UPDATE polybot_overlap_opportunities SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_overlap_opportunities', row_count;
    
    -- Migrate polybot_market_alerts
    UPDATE polybot_market_alerts SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_market_alerts', row_count;
    
    -- Migrate polybot_manual_trades
    UPDATE polybot_manual_trades SET user_id = admin_user_id WHERE user_id IS NULL;
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Updated % rows in polybot_manual_trades', row_count;
    
    RAISE NOTICE '✅ Migration complete! All data assigned to %', admin_user_id;
END $$;

-- Verification query
SELECT 
    'polybot_simulated_trades' as table_name,
    COUNT(*) as total,
    COUNT(user_id) as with_user_id,
    COUNT(*) - COUNT(user_id) as without_user_id
FROM polybot_simulated_trades
UNION ALL
SELECT 
    'polybot_opportunities',
    COUNT(*),
    COUNT(user_id),
    COUNT(*) - COUNT(user_id)
FROM polybot_opportunities
UNION ALL
SELECT 
    'polybot_positions',
    COUNT(*),
    COUNT(user_id),
    COUNT(*) - COUNT(user_id)
FROM polybot_positions;
