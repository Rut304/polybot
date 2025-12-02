"""
Supabase database client for PolyBot.
Handles persistence of opportunities, trades, and bot state.
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# Optional Supabase import
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    logger.warning("supabase package not installed - database features unavailable")


class Database:
    """
    Supabase database client for PolyBot.
    
    Tables:
    - polybot_opportunities: Detected arbitrage opportunities
    - polybot_trades: Executed trades
    - polybot_status: Bot status and configuration
    """
    
    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        self.url = url
        self.key = key
        self._client: Optional[Client] = None
        
        if url and key and SUPABASE_AVAILABLE:
            try:
                self._client = create_client(url, key)
                logger.info("Supabase client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
    
    @property
    def is_connected(self) -> bool:
        return self._client is not None
    
    # ==================== Opportunities ====================
    
    def log_opportunity(self, opportunity: Dict[str, Any]) -> Optional[int]:
        """
        Log a detected arbitrage opportunity.
        
        Args:
            opportunity: Opportunity dict from Opportunity.to_dict()
            
        Returns:
            Inserted row ID or None if failed
        """
        if not self._client:
            logger.debug("Database not connected, skipping opportunity log")
            return None
        
        try:
            result = self._client.table("polybot_opportunities").insert({
                "opportunity_id": opportunity.get("id"),
                "detected_at": opportunity.get("detected_at"),
                "buy_platform": opportunity.get("buy_platform"),
                "sell_platform": opportunity.get("sell_platform"),
                "buy_market_id": opportunity.get("buy_market_id"),
                "sell_market_id": opportunity.get("sell_market_id"),
                "buy_market_name": opportunity.get("buy_market_name"),
                "sell_market_name": opportunity.get("sell_market_name"),
                "buy_price": opportunity.get("buy_price"),
                "sell_price": opportunity.get("sell_price"),
                "profit_percent": opportunity.get("profit_percent"),
                "max_size": opportunity.get("max_size"),
                "total_profit": opportunity.get("total_profit"),
                "confidence": opportunity.get("confidence"),
                "strategy": opportunity.get("strategy"),
                "status": "detected",
            }).execute()
            
            if result.data:
                return result.data[0].get("id")
            return None
            
        except Exception as e:
            logger.error(f"Failed to log opportunity: {e}")
            return None
    
    def update_opportunity_status(
        self,
        opportunity_id: str,
        status: str,
        executed_at: Optional[datetime] = None,
    ) -> bool:
        """Update opportunity status (detected, executed, missed, failed)."""
        if not self._client:
            return False
        
        try:
            update_data = {"status": status}
            if executed_at:
                update_data["executed_at"] = executed_at.isoformat()
            
            self._client.table("polybot_opportunities").update(
                update_data
            ).eq("opportunity_id", opportunity_id).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update opportunity status: {e}")
            return False
    
    def get_recent_opportunities(self, limit: int = 50) -> List[Dict]:
        """Get recent opportunities."""
        if not self._client:
            return []
        
        try:
            result = self._client.table("polybot_opportunities").select(
                "*"
            ).order(
                "detected_at", desc=True
            ).limit(limit).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get opportunities: {e}")
            return []
    
    # ==================== Trades ====================
    
    def log_trade(self, trade: Dict[str, Any]) -> Optional[int]:
        """
        Log an executed trade.
        
        Args:
            trade: Trade dict from Trade.to_dict()
            
        Returns:
            Inserted row ID or None if failed
        """
        if not self._client:
            logger.debug("Database not connected, skipping trade log")
            return None
        
        try:
            result = self._client.table("polybot_trades").insert({
                "trade_id": trade.get("id"),
                "opportunity_id": trade.get("opportunity_id"),
                "platform": trade.get("platform"),
                "market_id": trade.get("market_id"),
                "side": trade.get("side"),
                "price": trade.get("price"),
                "size": trade.get("size"),
                "status": trade.get("status"),
                "executed_at": trade.get("executed_at"),
                "filled_size": trade.get("filled_size"),
                "fill_price": trade.get("fill_price"),
                "tx_hash": trade.get("tx_hash"),
                "order_id": trade.get("order_id"),
                "error_message": trade.get("error_message"),
                "fees": trade.get("fees"),
            }).execute()
            
            if result.data:
                return result.data[0].get("id")
            return None
            
        except Exception as e:
            logger.error(f"Failed to log trade: {e}")
            return None
    
    def get_recent_trades(self, limit: int = 50) -> List[Dict]:
        """Get recent trades."""
        if not self._client:
            return []
        
        try:
            result = self._client.table("polybot_trades").select(
                "*"
            ).order(
                "executed_at", desc=True
            ).limit(limit).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to get trades: {e}")
            return []
    
    def get_daily_pnl(self) -> float:
        """Calculate today's P&L from trades."""
        if not self._client:
            return 0.0
        
        try:
            today = datetime.utcnow().date().isoformat()
            
            result = self._client.table("polybot_trades").select(
                "side, fill_price, filled_size, fees"
            ).gte(
                "executed_at", today
            ).eq(
                "status", "filled"
            ).execute()
            
            pnl = 0.0
            for trade in result.data or []:
                value = trade["fill_price"] * trade["filled_size"]
                fees = trade.get("fees", 0) or 0
                
                if trade["side"] == "sell":
                    pnl += value - fees
                else:
                    pnl -= value + fees
            
            return pnl
            
        except Exception as e:
            logger.error(f"Failed to calculate daily P&L: {e}")
            return 0.0
    
    # ==================== Bot Status ====================
    
    def update_bot_status(
        self,
        is_running: bool = True,
        dry_run: bool = True,
        max_trade_size: float = None,
        min_profit_threshold: float = None,
        **kwargs,
    ) -> bool:
        """Update bot status record."""
        if not self._client:
            return False
        
        try:
            update_data = {
                "is_running": is_running,
                "dry_run_mode": dry_run,  # Match table column name
                "last_heartbeat_at": datetime.utcnow().isoformat(),
            }
            if max_trade_size is not None:
                update_data["max_trade_size"] = max_trade_size
            if min_profit_threshold is not None:
                update_data["min_profit_threshold"] = min_profit_threshold
            
            # Update the first (and only) status row
            result = self._client.table("polybot_status").select("id").limit(1).execute()
            if result.data:
                self._client.table("polybot_status").update(
                    update_data
                ).eq("id", result.data[0]["id"]).execute()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update bot status: {e}")
            return False
    
    def get_bot_status(self) -> Optional[Dict]:
        """Get current bot status."""
        if not self._client:
            return None
        
        try:
            result = self._client.table("polybot_status").select(
                "*"
            ).eq("id", 1).single().execute()
            
            return result.data
            
        except Exception as e:
            logger.error(f"Failed to get bot status: {e}")
            return None
    
    def heartbeat(self):
        """Update heartbeat timestamp."""
        if not self._client:
            return
        
        try:
            result = self._client.table("polybot_status").select("id").limit(1).execute()
            if result.data:
                self._client.table("polybot_status").update({
                    "last_heartbeat_at": datetime.utcnow().isoformat(),
                }).eq("id", result.data[0]["id"]).execute()
            
        except Exception as e:
            logger.debug(f"Heartbeat failed: {e}")
    
    # ==================== Generic Async Operations ====================
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Optional[Dict]:
        """
        Insert a row into a table (async-compatible wrapper).
        
        Args:
            table: Table name
            data: Data to insert
            
        Returns:
            Inserted row or None if failed
        """
        if not self._client:
            logger.debug(f"Database not connected, skipping insert to {table}")
            return None
        
        try:
            result = self._client.table(table).insert(data).execute()
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to insert into {table}: {e}")
            return None
    
    async def update(
        self,
        table: str,
        data: Dict[str, Any],
        filters: Dict[str, Any],
    ) -> bool:
        """
        Update rows in a table (async-compatible wrapper).
        
        Args:
            table: Table name
            data: Data to update
            filters: Column filters (equality matches)
            
        Returns:
            True if successful, False otherwise
        """
        if not self._client:
            logger.debug(f"Database not connected, skipping update to {table}")
            return False
        
        try:
            query = self._client.table(table).update(data)
            for col, val in filters.items():
                query = query.eq(col, val)
            query.execute()
            return True
            
        except Exception as e:
            logger.error(f"Failed to update {table}: {e}")
            return False
    
    async def upsert(
        self,
        table: str,
        data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        """
        Upsert a row into a table (insert or update on conflict).
        
        Args:
            table: Table name
            data: Data to upsert (must include primary key)
            
        Returns:
            Upserted row or None if failed
        """
        if not self._client:
            logger.debug(f"Database not connected, skipping upsert to {table}")
            return None
        
        try:
            result = self._client.table(table).upsert(data).execute()
            if result.data:
                return result.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to upsert into {table}: {e}")
            return None
    
    async def select(
        self,
        table: str,
        columns: str = "*",
        filters: Optional[Dict[str, Any]] = None,
        order_by: Optional[str] = None,
        desc: bool = True,
        limit: int = 100,
    ) -> List[Dict]:
        """
        Select rows from a table (async-compatible wrapper).
        
        Args:
            table: Table name
            columns: Columns to select
            filters: Optional equality filters
            order_by: Optional column to order by
            desc: Descending order if True
            limit: Max rows to return
            
        Returns:
            List of matching rows
        """
        if not self._client:
            return []
        
        try:
            query = self._client.table(table).select(columns)
            
            if filters:
                for col, val in filters.items():
                    query = query.eq(col, val)
            
            if order_by:
                query = query.order(order_by, desc=desc)
            
            query = query.limit(limit)
            result = query.execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Failed to select from {table}: {e}")
            return []


# SQL to create tables (run this in Supabase SQL Editor)
SCHEMA_SQL = """
-- PolyBot Opportunities Table
CREATE TABLE IF NOT EXISTS polybot_opportunities (
    id BIGSERIAL PRIMARY KEY,
    opportunity_id TEXT UNIQUE NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    buy_platform TEXT NOT NULL,
    sell_platform TEXT NOT NULL,
    buy_market_id TEXT,
    sell_market_id TEXT,
    buy_market_name TEXT,
    sell_market_name TEXT,
    buy_price NUMERIC(10, 6),
    sell_price NUMERIC(10, 6),
    profit_percent NUMERIC(10, 4),
    max_size NUMERIC(10, 2),
    total_profit NUMERIC(10, 2),
    confidence NUMERIC(5, 4),
    strategy TEXT,
    status TEXT DEFAULT 'detected',
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for recent opportunities
CREATE INDEX IF NOT EXISTS idx_polybot_opportunities_detected 
    ON polybot_opportunities(detected_at DESC);

-- PolyBot Trades Table
CREATE TABLE IF NOT EXISTS polybot_trades (
    id BIGSERIAL PRIMARY KEY,
    trade_id TEXT UNIQUE NOT NULL,
    opportunity_id TEXT REFERENCES polybot_opportunities(opportunity_id),
    platform TEXT NOT NULL,
    market_id TEXT,
    side TEXT NOT NULL,
    price NUMERIC(10, 6),
    size NUMERIC(10, 4),
    status TEXT NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    filled_size NUMERIC(10, 4),
    fill_price NUMERIC(10, 6),
    tx_hash TEXT,
    order_id TEXT,
    error_message TEXT,
    fees NUMERIC(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for recent trades
CREATE INDEX IF NOT EXISTS idx_polybot_trades_executed 
    ON polybot_trades(executed_at DESC);

-- PolyBot Status Table (single row)
CREATE TABLE IF NOT EXISTS polybot_status (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_running BOOLEAN DEFAULT false,
    dry_run BOOLEAN DEFAULT true,
    last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_opportunities_detected INTEGER DEFAULT 0,
    total_trades_executed INTEGER DEFAULT 0,
    total_profit NUMERIC(12, 2) DEFAULT 0,
    daily_profit NUMERIC(12, 2) DEFAULT 0,
    max_trade_size NUMERIC(10, 2) DEFAULT 100,
    min_profit_threshold NUMERIC(5, 2) DEFAULT 1.0,
    is_paused BOOLEAN DEFAULT false,
    pause_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initialize status row
INSERT INTO polybot_status (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE polybot_opportunities ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE polybot_trades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE polybot_status ENABLE ROW LEVEL SECURITY;

-- PolyBot Simulated Trades Table (Paper Trading)
CREATE TABLE IF NOT EXISTS polybot_simulated_trades (
    id BIGSERIAL PRIMARY KEY,
    position_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Market info
    polymarket_token_id TEXT,
    polymarket_market_title TEXT,
    kalshi_ticker TEXT,
    kalshi_market_title TEXT,
    
    -- Prices at detection
    polymarket_yes_price NUMERIC(10, 6),
    polymarket_no_price NUMERIC(10, 6),
    kalshi_yes_price NUMERIC(10, 6),
    kalshi_no_price NUMERIC(10, 6),
    
    -- Trade details
    trade_type TEXT,
    position_size_usd NUMERIC(10, 2),
    expected_profit_usd NUMERIC(10, 4),
    expected_profit_pct NUMERIC(10, 4),
    
    -- Resolution
    outcome TEXT DEFAULT 'pending',
    actual_profit_usd NUMERIC(10, 4),
    resolved_at TIMESTAMP WITH TIME ZONE,
    market_result TEXT,
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_polybot_simulated_trades_created 
    ON polybot_simulated_trades(created_at DESC);

-- PolyBot Simulation Stats Snapshots
CREATE TABLE IF NOT EXISTS polybot_simulation_stats (
    id BIGSERIAL PRIMARY KEY,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    stats_json JSONB,
    simulated_balance NUMERIC(12, 2),
    total_pnl NUMERIC(12, 2),
    total_trades INTEGER,
    win_rate NUMERIC(5, 2)
);

CREATE INDEX IF NOT EXISTS idx_polybot_simulation_stats_snapshot 
    ON polybot_simulation_stats(snapshot_at DESC);

-- PolyBot Market Pairs (matched markets between platforms)
CREATE TABLE IF NOT EXISTS polybot_market_pairs (
    id BIGSERIAL PRIMARY KEY,
    polymarket_token_id TEXT NOT NULL,
    polymarket_question TEXT,
    kalshi_ticker TEXT NOT NULL,
    kalshi_title TEXT,
    match_confidence NUMERIC(5, 4) DEFAULT 1.0,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(polymarket_token_id, kalshi_ticker)
);
"""
