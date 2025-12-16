
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database.client import Database

print("🔌 Connecting to Supabase...")
db = Database()

if not db.is_connected:
    print("❌ Failed to connect to Supabase. Check environment variables.")
    sys.exit(1)

print("✓ Connected to Supabase")

rpc_sql = """
CREATE OR REPLACE FUNCTION get_missed_money_stats(hours_lookback INT DEFAULT 24)
RETURNS TABLE (
    missed_money NUMERIC,
    opportunities_count BIGINT,
    executed_count BIGINT,
    conversion_rate NUMERIC,
    actual_pnl NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_trade_size NUMERIC;
BEGIN
    -- Get max trade size from config, default to 100 if missing
    SELECT COALESCE(max_trade_size, 100.0) INTO v_max_trade_size FROM polybot_config WHERE id = 1;

    RETURN QUERY
    WITH timeframe_ops AS (
        SELECT 
            opportunity_id, 
            profit_percent,
            detected_at
        FROM polybot_opportunities
        WHERE detected_at >= NOW() - (hours_lookback || ' hours')::INTERVAL
    ),
    executed_ops AS (
        SELECT 
            t.opportunity_id,
            -- Calculate actual realized PnL from trades if available, else estimate
            -- Using fill_price * filled_size if captured, or some other metric
            -- For missed money logic, we mostly care about what was NOT executed
            1 as is_executed
        FROM polybot_trades t
        WHERE t.executed_at >= NOW() - (hours_lookback || ' hours')::INTERVAL
    )
    SELECT
        -- Missed Money: Sum of potential profit for opportunities NOT in executed_ops
        -- Potential Profit = (profit_percent / 100) * max_trade_size
        COALESCE(SUM(
            CASE WHEN e.opportunity_id IS NULL THEN
                (o.profit_percent / 100.0) * v_max_trade_size
            ELSE 0
            END
        ), 0) as missed_money,
        
        COUNT(o.opportunity_id) as opportunities_count,
        
        COUNT(e.opportunity_id) as executed_count,
        
        CASE WHEN COUNT(o.opportunity_id) > 0 
            THEN ROUND((COUNT(e.opportunity_id)::NUMERIC / COUNT(o.opportunity_id)::NUMERIC) * 100, 2)
            ELSE 0 
        END as conversion_rate,
        
        -- Actual PnL (placeholder for now, can be sophisticated later based on trade fills)
        0.0 as actual_pnl
        
    FROM timeframe_ops o
    LEFT JOIN executed_ops e ON o.opportunity_id = e.opportunity_id;
END;
$$;
"""

try:
    print("🚀 Creating 'get_missed_money_stats' RPC function...")
    # We can't use db._client.rpc() to create a function, we need to execute raw SQL.
    # The Supabase-py client allows .rpc() to CALL functions, but typically managing schema
    # requires using the SQL editor or specific migrations API.
    # However, if 'postgres' or similar wrapper is available we can use it.
    
    # Wait, the polybot Database client doesn't expose a raw sql_execute method directly
    # outside of table operations unless we hack it.
    # Actually, Supabase Python client usually doesn't allow raw SQL execution unless enabled via extensions
    # or using a direct Postgres connection (psycopg2).
    
    # Let's check if there is a 'mcp_supabase-mcp-server_execute_sql' tool available to me.
    # The 'default_api' has 'mcp_supabase-mcp-server_execute_sql'. 
    # I should use THAT instead of this python script if possible.
    pass

except Exception as e:
    print(f"❌ Error: {e}")

print("⚠️  Use the MCP tool 'mcp_supabase-mcp-server_execute_sql' to run this SQL.")
