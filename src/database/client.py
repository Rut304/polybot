"""
Supabase database client for PolyBot.
Handles persistence of opportunities, trades, and bot state.
"""

import logging
import os
import random
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone
from decimal import Decimal

from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from src.utils.vault import Vault

logger = logging.getLogger(__name__)


def _get_supabase_credentials():
    """
    Get Supabase credentials from environment variables.
    Works in both Docker (Lightsail) and local development.
    
    NOTE: Only uses SUPABASE_SERVICE_ROLE_KEY (not SUPABASE_KEY/anon key)
    to ensure full database access with RLS bypass.
    """
    url = os.environ.get("SUPABASE_URL", "")
    # ONLY use SERVICE_ROLE_KEY - anon key causes permission issues
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    return url, key


class Database:
    """
    Supabase database client for PolyBot.
    
    Tables:
    - polybot_opportunities: Detected arbitrage opportunities
    - polybot_trades: Executed trades
    - polybot_status: Bot status and configuration
    """
    
    def __init__(self, url: Optional[str] = None, key: Optional[str] = None, user_id: Optional[str] = None):
        """
        Initialize Supabase database client.
        
        Args:
            url: Supabase URL (falls back to env var SUPABASE_URL)
            key: Supabase key (falls back to env var SUPABASE_SERVICE_ROLE_KEY)
            user_id: UUID of the user context (for multi-tenancy)
        
        NOTE: Always uses SERVICE_ROLE_KEY for full database access.
        The anon key (SUPABASE_KEY) is NOT supported as it causes RLS issues.
        """
        # Get credentials - prefer params, fallback to env vars
        self.url = url or os.getenv("SUPABASE_URL", "")
        self.key = key or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.user_id = user_id
        
        if not self.url or not self.key:
            logger.warning("Supabase credentials not found in environment variables")
            self._client = None
            return

        try:
            self._client = create_client(self.url, self.key)
            logger.info("✓ Supabase client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            self._client = None
        
        # Secrets cache (loaded once, refreshed on demand)
        self._secrets_cache: Dict[str, str] = {}
        self._secrets_loaded = False
    
    @property
    def is_connected(self) -> bool:
        return self._client is not None
    
    # ==================== Secrets Management ====================
    # Single source of truth for all API keys - reads from polybot_secrets table
    
    def load_secrets(self, force_refresh: bool = False) -> Dict[str, str]:
        """
        Load all secrets from Supabase polybot_secrets table.
        Caches results to avoid repeated DB calls.
        
        Args:
            force_refresh: If True, bypass cache and reload from DB
            
        Returns:
            Dict of key_name -> key_value for all configured secrets
        """
        if self._secrets_loaded and not force_refresh:
            return self._secrets_cache
        
        if not self._client:
            logger.warning("Database not connected, falling back to environment variables")
            return {}
        
        try:
            # Table: polybot_key_vault (SaaS) or polybot_secrets (Legacy)
            # Prefer Vault if user_id is present
            if self.user_id:
                query = self._client.table("polybot_key_vault").select(
                    "key_name, encrypted_value"
                ).eq("user_id", self.user_id)
                
                result = query.execute()
                
                # Decrypt values
                self._secrets_cache = {}
                for row in (result.data or []):
                    key_name = row["key_name"]
                    enc_value = row["encrypted_value"]
                    try:
                        decrypted = self.vault.decrypt(enc_value)
                        self._secrets_cache[key_name] = decrypted
                    except Exception as e:
                        logger.error(f"Failed to decrypt secret {key_name}: {e}")
                        
            else:
                # Legacy fallback
                query = self._client.table("polybot_secrets").select(
                    "key_name, key_value"
                ).eq("is_configured", True)
                
                result = query.execute()
                
                self._secrets_cache = {
                    row["key_name"]: row["key_value"]
                    for row in (result.data or [])
                    if row.get("key_value")
                }
                
            self._secrets_loaded = True
            logger.info(f"✓ Loaded {len(self._secrets_cache)} secrets from Supabase (User: {self.user_id or 'Global'})")
            return self._secrets_cache
            
        except Exception as e:
            logger.error(f"Failed to load secrets from Supabase: {e}")
            return {}
    
    def get_secret(self, key_name: str, default: Optional[str] = None) -> Optional[str]:
        """
        Get a single secret by key name.
        Falls back to environment variable if not in Supabase.
        
        Args:
            key_name: The secret key name (e.g., 'BINANCE_API_KEY')
            default: Default value if not found
            
        Returns:
            The secret value or default
        """
        # Load secrets if not already loaded
        if not self._secrets_loaded:
            self.load_secrets()
        
        # Check Supabase cache first
        value = self._secrets_cache.get(key_name)
        if value:
            return value
        
        # Fall back to environment variable
        env_value = os.getenv(key_name)
        if env_value:
            logger.debug(f"Secret {key_name} loaded from environment (not in Supabase)")
            return env_value
        
        return default
    
    def get_alpaca_credentials(self, is_paper: bool = True) -> Dict[str, Optional[str]]:
        """
        Get Alpaca API credentials based on trading mode.
        
        Args:
            is_paper: If True, return paper trading keys; else return live keys
            
        Returns:
            Dict with 'api_key', 'api_secret', 'base_url'
        """
        if is_paper:
            return {
                'api_key': (
                    self.get_secret('ALPACA_PAPER_API_KEY') or 
                    self.get_secret('ALPACA_API_KEY')
                ),
                'api_secret': (
                    self.get_secret('ALPACA_PAPER_API_SECRET') or 
                    self.get_secret('ALPACA_API_SECRET')
                ),
                'base_url': 'https://paper-api.alpaca.markets',
            }
        else:
            return {
                'api_key': (
                    self.get_secret('ALPACA_LIVE_API_KEY') or 
                    self.get_secret('ALPACA_API_KEY')
                ),
                'api_secret': (
                    self.get_secret('ALPACA_LIVE_API_SECRET') or 
                    self.get_secret('ALPACA_API_SECRET')
                ),
                'base_url': 'https://api.alpaca.markets',
            }
    
    def get_binance_credentials(self) -> Dict[str, Optional[str]]:
        """Get Binance API credentials."""
        return {
            'api_key': self.get_secret('BINANCE_API_KEY'),
            'api_secret': self.get_secret('BINANCE_API_SECRET'),
        }
    
    def get_bybit_credentials(self) -> Dict[str, Optional[str]]:
        """Get Bybit API credentials."""
        return {
            'api_key': self.get_secret('BYBIT_API_KEY'),
            'api_secret': self.get_secret('BYBIT_API_SECRET'),
        }
    
    def get_okx_credentials(self) -> Dict[str, Optional[str]]:
        """Get OKX API credentials."""
        return {
            'api_key': self.get_secret('OKX_API_KEY'),
            'api_secret': self.get_secret('OKX_API_SECRET'),
            'password': self.get_secret('OKX_PASSPHRASE'),
        }
    
    def get_kraken_credentials(self) -> Dict[str, Optional[str]]:
        """Get Kraken API credentials."""
        return {
            'api_key': self.get_secret('KRAKEN_API_KEY'),
            'api_secret': self.get_secret('KRAKEN_API_SECRET'),
        }
    
    def get_coinbase_credentials(self) -> Dict[str, Optional[str]]:
        """Get Coinbase API credentials."""
        return {
            'api_key': self.get_secret('COINBASE_API_KEY'),
            'api_secret': self.get_secret('COINBASE_API_SECRET'),
        }
    
    def get_kucoin_credentials(self) -> Dict[str, Optional[str]]:
        """Get KuCoin API credentials."""
        return {
            'api_key': self.get_secret('KUCOIN_API_KEY'),
            'api_secret': self.get_secret('KUCOIN_API_SECRET'),
            'password': self.get_secret('KUCOIN_PASSPHRASE'),
        }
    
    def get_exchange_credentials(self, exchange: str) -> Dict[str, Optional[str]]:
        """Get API credentials for any supported exchange."""
        exchange = exchange.lower()
        credentials_map = {
            'binance': self.get_binance_credentials,
            'bybit': self.get_bybit_credentials,
            'okx': self.get_okx_credentials,
            'kraken': self.get_kraken_credentials,
            'coinbase': self.get_coinbase_credentials,
            'kucoin': self.get_kucoin_credentials,
        }
        if exchange in credentials_map:
            return credentials_map[exchange]()
        return {'api_key': None, 'api_secret': None}
    
    def get_polymarket_credentials(self) -> Dict[str, Optional[str]]:
        """Get Polymarket API credentials."""
        return {
            'api_key': self.get_secret('POLYMARKET_API_KEY'),
            'api_secret': self.get_secret('POLYMARKET_SECRET'),
            'private_key': self.get_secret('POLYMARKET_PRIVATE_KEY'),
            'wallet_address': self.get_secret('WALLET_ADDRESS'),
        }
    
    def get_kalshi_credentials(self) -> Dict[str, Optional[str]]:
        """Get Kalshi API credentials."""
        return {
            'api_key': self.get_secret('KALSHI_API_KEY'),
            'private_key': self.get_secret('KALSHI_PRIVATE_KEY'),
        }
    
    def get_news_api_credentials(self) -> Dict[str, Optional[str]]:
        """Get news/sentiment API credentials."""
        return {
            'finnhub_key': self.get_secret('FINNHUB_API_KEY'),
            'newsapi_key': self.get_secret('NEWSAPI_KEY') or self.get_secret('NEWS_API_KEY'),
            'twitter_bearer': self.get_secret('TWITTER_BEARER_TOKEN'),
        }
    
    def refresh_secrets(self) -> Dict[str, str]:
        """Force refresh secrets from database."""
        return self.load_secrets(force_refresh=True)

    # ==================== Configuration ====================
    # Settings that can be changed via Admin UI (not secrets)
    # The polybot_config table uses a single-row structure with id=1
    
    _config_cache: Dict[str, Any] = {}
    _config_loaded = False
    
    def load_config(self, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Load configuration from polybot_config table.
        Uses single-row structure with id=1 (matching admin UI).
        """
        if self._config_loaded and not force_refresh:
            return self._config_cache
        
        if not self._client:
            return {}
        
        try:
            # Multi-tenant config: Filter by user_id
            query = self._client.table("polybot_config").select("*")
            
            if self.user_id:
                query = query.eq("user_id", self.user_id)
            else:
                # Legacy: id=1
                query = query.eq("id", 1)
                
            result = query.limit(1).single().execute()
            
            if result.data:
                self._config_cache = result.data
            self._config_loaded = True
            return self._config_cache
            
        except Exception as e:
            logger.debug(f"Config table not available: {e}")
            return {}
    
    def get_config(self, key: str, default: Any = None) -> Any:
        """Get a config value by key from the single-row config."""
        if not self._config_loaded:
            self.load_config()
        return self._config_cache.get(key, default)
    
    def set_config(self, key: str, value: Any) -> bool:
        """Set a config value in the single-row config."""
        if not self._client:
            return False
        
        try:
            # Update config row
            query = self._client.table("polybot_config").update({
                key: value,
            })
            
            if self.user_id:
                query = query.eq("user_id", self.user_id)
            else:
                query = query.eq("id", 1)
                
            query.execute()
            self._config_cache[key] = value
            return True
        except Exception as e:
            logger.error(f"Failed to set config {key}: {e}")
            return False

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
            insert_data = {
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
                "status": opportunity.get("status", "detected"),
                "skip_reason": opportunity.get("skip_reason"),
            }
            
            if self.user_id:
                insert_data["user_id"] = self.user_id
                
            result = self._client.table("polybot_opportunities").insert(insert_data).execute()
            
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
        skip_reason: Optional[str] = None,
        execution_result: Optional[str] = None,
    ) -> bool:
        """Update opportunity status (detected, executed, missed, failed)."""
        if not self._client:
            return False
        
        try:
            update_data = {"status": status}
            if executed_at:
                update_data["executed_at"] = executed_at.isoformat()
            if skip_reason:
                update_data["skip_reason"] = skip_reason
            if execution_result:
                update_data["execution_result"] = execution_result
            
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
            query = self._client.table("polybot_opportunities").select(
                "*"
            )
            
            if self.user_id:
                query = query.eq("user_id", self.user_id)
            
            result = query.order(
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
            insert_data = {
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
            }
            
            if self.user_id:
                insert_data["user_id"] = self.user_id
                
            result = self._client.table("polybot_trades").insert(insert_data).execute()
            
            if result.data:
                return result.data[0].get("id")
            return None
            
        except Exception as e:
            logger.error(f"Failed to log trade: {e}")
            return None

    def log_live_trade(self, trade_data: Dict[str, Any]) -> Optional[int]:
        """
        Log a LIVE (non-simulation) trade execution.
        
        This is separate from log_trade which is used for paper trading.
        Live trades need additional tracking for order management.
        
        Args:
            trade_data: Dict with keys:
                - opportunity_id: str
                - platform: str
                - market_id: str
                - market_title: str
                - position_size_usd: float
                - expected_profit_pct: float
                - order_ids: List[str]
                - status: str ("open", "filled", "partial", "cancelled")
            
        Returns:
            Inserted row ID or None if failed
        """
        if not self._client:
            logger.debug("Database not connected, skipping live trade log")
            return None
        
        try:
            import json
            
            insert_data = {
                "opportunity_id": trade_data.get("opportunity_id"),
                "platform": trade_data.get("platform"),
                "market_id": trade_data.get("market_id"),
                "market_title": trade_data.get("market_title", "")[:200],
                "position_size_usd": trade_data.get("position_size_usd", 0),
                "expected_profit_pct": trade_data.get("expected_profit_pct", 0),
                "order_ids": json.dumps(trade_data.get("order_ids", [])),
                "status": trade_data.get("status", "open"),
                "created_at": datetime.utcnow().isoformat(),
                "is_simulation": False,
            }
            
            if self.user_id:
                insert_data["user_id"] = self.user_id
                
            result = self._client.table(
                "polybot_live_trades"
            ).insert(insert_data).execute()
            
            if result.data:
                return result.data[0].get("id")
            return None
            
        except Exception as e:
            logger.error(f"Failed to log live trade: {e}")
            return None
    
    def get_recent_trades(self, limit: int = 50) -> List[Dict]:
        """Get recent trades."""
        if not self._client:
            return []
        
        try:
            query = self._client.table("polybot_trades").select(
                "*"
            )
            
            if self.user_id:
                query = query.eq("user_id", self.user_id)
                
            result = query.order(
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
    
    # ==================== Audit Logs ====================

    def log_audit_event(
        self, 
        action: str, 
        details: Dict[str, Any], 
        user_id: str = "system"
    ) -> None:
        """
        Log an administrative action or critical system event.
        
        Args:
            action: Type of action (e.g. "SETTINGS_UPDATE", "BOT_STOPPED")
            details: JSON-serializable details
            user_id: User who performed the action (default: system)
        """
        if not self._client:
            return

        try:
            entry = {
                "user_id": user_id,
                "action": action,
                "details": details,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            # Fire and forget - don't block main thread too long
            self._client.table("polybot_audit_logs").insert(entry).execute()
        except Exception as e:
            # Audit log failure should not crash the bot
            logger.warning(f"Failed to log audit event: {e}")

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
                    "last_heartbeat_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", result.data[0]["id"]).execute()
            
        except Exception as e:
            logger.debug(f"Heartbeat failed: {e}")
    
    # ==================== Trading Config ====================
    
    def get_trading_config(self) -> Optional[Dict]:
        """
        Get trading configuration from polybot_config table.
        
        Returns:
            Config dict with trading parameters, or None if not available
        """
        if not self._client:
            logger.debug("Database not connected, using default config")
            return None
        
        try:
            result = self._client.table("polybot_config").select(
                "*"
            ).eq("id", 1).single().execute()
            
            if result.data:
                logger.info("✓ Loaded trading config from database")
                return result.data
            return None
            
        except Exception as e:
            logger.warning(f"Failed to get trading config: {e}")
            return None
    
    def update_trading_config(self, config_data: Dict[str, Any]) -> bool:
        """
        Update trading configuration in polybot_config table.
        
        Args:
            config_data: Dict of config fields to update
            
        Returns:
            True if successful, False otherwise
        """
        if not self._client:
            return False
        
        try:
            # Add updated_at timestamp
            config_data["updated_at"] = datetime.utcnow().isoformat()
            
            self._client.table("polybot_config").update(
                config_data
            ).eq("id", 1).execute()
            
            logger.info("✓ Updated trading config in database")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update trading config: {e}")
            return False    # ==================== Generic Async Operations ====================
    
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
