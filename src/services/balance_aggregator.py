"""
Balance Aggregator Service

Collects and aggregates balances from all connected trading platforms:
- Prediction Markets: Polymarket, Kalshi
- Crypto Exchanges: Binance, Bybit, OKX, Kraken, Coinbase, KuCoin (via CCXT)
- Stock Brokers: Alpaca, IBKR

Stores aggregated balances in Supabase for Admin UI display.
"""

import asyncio
import logging
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from decimal import Decimal
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PlatformBalance:
    """Balance for a single platform."""
    platform: str
    platform_type: str  # 'prediction_market', 'crypto_exchange', 'stock_broker'
    total_usd: Decimal
    cash_balance: Decimal
    positions_value: Decimal
    positions_count: int
    starting_balance: Decimal = Decimal('0')  # For P&L calculation
    currency: str = 'USD'
    details: Dict[str, Any] = field(default_factory=dict)
    last_updated: datetime = field(default_factory=datetime.now)
    error: Optional[str] = None
    
    @property
    def pnl(self) -> Decimal:
        """Calculate P&L from starting balance."""
        if self.starting_balance > 0:
            return self.total_usd - self.starting_balance
        return Decimal('0')
    
    @property
    def pnl_percent(self) -> float:
        """Calculate P&L percentage."""
        if self.starting_balance > 0:
            return float((self.pnl / self.starting_balance) * 100)
        return 0.0


@dataclass
class AggregatedBalance:
    """Aggregated balance across all platforms."""
    total_portfolio_usd: Decimal
    total_cash_usd: Decimal
    total_positions_usd: Decimal
    total_starting_balance: Decimal = Decimal('0')  # Sum of all starting balances
    platforms: List[PlatformBalance] = field(default_factory=list)
    last_updated: datetime = field(default_factory=datetime.now)
    
    @property
    def total_pnl(self) -> Decimal:
        """Total P&L across all platforms."""
        return self.total_portfolio_usd - self.total_starting_balance
    
    @property
    def total_pnl_percent(self) -> float:
        """Total P&L percentage."""
        if self.total_starting_balance > 0:
            return float((self.total_pnl / self.total_starting_balance) * 100)
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'total_portfolio_usd': float(self.total_portfolio_usd),
            'total_cash_usd': float(self.total_cash_usd),
            'total_positions_usd': float(self.total_positions_usd),
            'total_starting_balance': float(self.total_starting_balance),
            'total_pnl': float(self.total_pnl),
            'total_pnl_percent': self.total_pnl_percent,
            'platform_count': len(self.platforms),
            'platforms': [
                {
                    'platform': p.platform,
                    'platform_type': p.platform_type,
                    'total_usd': float(p.total_usd),
                    'cash_balance': float(p.cash_balance),
                    'positions_value': float(p.positions_value),
                    'positions_count': p.positions_count,
                    'starting_balance': float(p.starting_balance),
                    'pnl': float(p.pnl),
                    'pnl_percent': p.pnl_percent,
                    'currency': p.currency,
                    'details': p.details,
                    'last_updated': p.last_updated.isoformat(),
                    'error': p.error,
                }
                for p in self.platforms
            ],
            'last_updated': self.last_updated.isoformat(),
        }


class BalanceAggregator:
    """
    Aggregates balances from all connected trading platforms.
    
    Starting balances are used to calculate P&L:
    - Set via database config (polybot_config table) or defaults
    - Each platform tracks its own starting balance
    - Total P&L = sum of all platform P&Ls
    
    Default: $100K total split evenly across 5 platforms ($20K each)
    """
    
    # Default starting balances for each platform (in USD)
    # $100K total / 5 platforms = $20K each
    # Can be overridden via polybot_config table in database
    DEFAULT_STARTING_BALANCES = {
        'Polymarket': Decimal('20000'),   # $20k prediction markets
        'Kalshi': Decimal('20000'),       # $20k prediction markets
        'Binance': Decimal('20000'),      # $20k crypto
        'Coinbase': Decimal('20000'),     # $20k crypto
        'Alpaca': Decimal('20000'),       # $20k stocks (paper)
    }
    
    def __init__(
        self,
        db_client=None,
        polymarket_client=None,
        kalshi_client=None,
        ccxt_clients: Optional[Dict[str, Any]] = None,
        alpaca_client=None,
        starting_balances: Optional[Dict[str, Decimal]] = None,
    ):
        self.db = db_client
        self.polymarket_client = polymarket_client
        self.kalshi_client = kalshi_client
        self.ccxt_clients = ccxt_clients or {}
        self.alpaca_client = alpaca_client
        
        # Starting balances for P&L calculation
        self.starting_balances = starting_balances or {}
        
        # Cached balances
        self._cached_balance: Optional[AggregatedBalance] = None
        self._cache_ttl = 60  # Cache for 60 seconds
        self._last_fetch: Optional[datetime] = None
    
    def get_starting_balance(self, platform: str) -> Decimal:
        """Get starting balance for a platform."""
        # First check instance config
        if platform in self.starting_balances:
            return self.starting_balances[platform]
        # Then check database config table (polybot_config)
        if self.db:
            try:
                val = self.db.get_config(f"{platform.lower()}_starting_balance")
                if val:
                    return Decimal(str(val))
            except Exception:
                pass
        # Fall back to defaults
        return self.DEFAULT_STARTING_BALANCES.get(
            platform, Decimal('20000')
        )
    
    async def fetch_all_balances(
        self,
        force_refresh: bool = False
    ) -> AggregatedBalance:
        """
        Fetch balances from all connected platforms.
        
        Args:
            force_refresh: Bypass cache and fetch fresh data
            
        Returns:
            AggregatedBalance with all platform balances
        """
        # Check cache
        if (
            not force_refresh 
            and self._cached_balance 
            and self._last_fetch
            and (datetime.now() - self._last_fetch).seconds < self._cache_ttl
        ):
            return self._cached_balance
        
        platforms: List[PlatformBalance] = []
        
        # Fetch in parallel
        tasks = []
        
        # Prediction Markets
        if self.polymarket_client:
            tasks.append(self._fetch_polymarket_balance())
        if self.kalshi_client:
            tasks.append(self._fetch_kalshi_balance())
        
        # Crypto Exchanges
        for exchange_id, client in self.ccxt_clients.items():
            tasks.append(self._fetch_ccxt_balance(exchange_id, client))
        
        # Stock Brokers
        if self.alpaca_client:
            tasks.append(self._fetch_alpaca_balance())
        
        # Execute all fetches
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for result in results:
                if isinstance(result, PlatformBalance):
                    platforms.append(result)
                elif isinstance(result, Exception):
                    logger.error(f"Error fetching balance: {result}")
        
        # Calculate totals
        total_portfolio = Decimal('0')
        total_cash = Decimal('0')
        total_positions = Decimal('0')
        total_starting = Decimal('0')
        
        for p in platforms:
            total_starting += p.starting_balance
            if p.error is None:
                total_portfolio += p.total_usd
                total_cash += p.cash_balance
                total_positions += p.positions_value
        
        aggregated = AggregatedBalance(
            total_portfolio_usd=total_portfolio,
            total_cash_usd=total_cash,
            total_positions_usd=total_positions,
            total_starting_balance=total_starting,
            platforms=platforms,
            last_updated=datetime.now(),
        )
        
        # Update cache
        self._cached_balance = aggregated
        self._last_fetch = datetime.now()
        
        # Save to database
        await self._save_to_db(aggregated)
        
        return aggregated
    
    async def _fetch_polymarket_balance(self) -> PlatformBalance:
        """Fetch balance from Polymarket."""
        try:
            # Try to get wallet address from db first, then env
            wallet_address = None
            if self.db:
                wallet_address = self.db.get_secret('POLYMARKET_WALLET_ADDRESS')
            if not wallet_address:
                wallet_address = os.getenv('WALLET_ADDRESS', '')
            
            if not wallet_address:
                return PlatformBalance(
                    platform='Polymarket',
                    platform_type='prediction_market',
                    total_usd=Decimal('0'),
                    cash_balance=Decimal('0'),
                    positions_value=Decimal('0'),
                    positions_count=0,
                    error='No wallet address configured'
                )
            
            balance = self.polymarket_client.get_balance(wallet_address)
            
            total_value = Decimal(str(balance.get('total_value', 0)))
            positions = balance.get('positions', [])
            
            return PlatformBalance(
                platform='Polymarket',
                platform_type='prediction_market',
                total_usd=total_value,
                cash_balance=Decimal('0'),  # Polymarket doesn't have cash balance
                positions_value=total_value,
                positions_count=len(positions),
                starting_balance=self.get_starting_balance('Polymarket'),
                currency='USDC',
                details={
                    'wallet': wallet_address[:10] + '...',
                    'positions': [
                        {
                            'market': p.get('market', 'Unknown')[:50],
                            'value': p.get('value', 0),
                        }
                        for p in positions[:10]  # Limit to 10 positions
                    ],
                }
            )
        except Exception as e:
            logger.error(f"Error fetching Polymarket balance: {e}")
            return PlatformBalance(
                platform='Polymarket',
                platform_type='prediction_market',
                total_usd=Decimal('0'),
                cash_balance=Decimal('0'),
                positions_value=Decimal('0'),
                positions_count=0,
                starting_balance=self.get_starting_balance('Polymarket'),
                error=str(e)
            )
    
    async def _fetch_kalshi_balance(self) -> PlatformBalance:
        """Fetch balance from Kalshi."""
        try:
            if not self.kalshi_client.is_authenticated:
                return PlatformBalance(
                    platform='Kalshi',
                    platform_type='prediction_market',
                    total_usd=Decimal('0'),
                    cash_balance=Decimal('0'),
                    positions_value=Decimal('0'),
                    positions_count=0,
                    starting_balance=self.get_starting_balance('Kalshi'),
                    error='Not authenticated'
                )
            
            balance = self.kalshi_client.get_balance()
            
            total = Decimal(str(balance.get('total_value', 0)))
            cash = Decimal(str(balance.get('balance', 0)))
            positions_value = total - cash
            positions_count = balance.get('position_count', 0)
            
            return PlatformBalance(
                platform='Kalshi',
                platform_type='prediction_market',
                total_usd=total,
                cash_balance=cash,
                positions_value=positions_value,
                positions_count=positions_count,
                starting_balance=self.get_starting_balance('Kalshi'),
                currency='USD',
                details={
                    'settled_balance': balance.get('balance', 0),
                    'available_balance': balance.get('available_balance', 0),
                }
            )
        except Exception as e:
            logger.error(f"Error fetching Kalshi balance: {e}")
            return PlatformBalance(
                platform='Kalshi',
                platform_type='prediction_market',
                total_usd=Decimal('0'),
                cash_balance=Decimal('0'),
                positions_value=Decimal('0'),
                positions_count=0,
                starting_balance=self.get_starting_balance('Kalshi'),
                error=str(e)
            )
    
    async def _fetch_ccxt_balance(
        self, 
        exchange_id: str, 
        client
    ) -> PlatformBalance:
        """Fetch balance from a CCXT-connected exchange."""
        exchange_name = exchange_id.replace('_', ' ').title()
        
        try:
            if not client._initialized:
                await client.initialize()
            
            balances = await client.get_balance()
            
            # Calculate total in USD (approximate for non-USD assets)
            total_usd = Decimal('0')
            cash_usd = Decimal('0')
            asset_details = {}
            
            # Get tickers for conversion
            try:
                tickers = await client.get_tickers()
            except Exception:
                tickers = {}
            
            for asset, balance in balances.items():
                if asset in ['USD', 'USDT', 'USDC', 'BUSD', 'DAI']:
                    # Stablecoins - count as cash
                    usd_value = Decimal(str(balance.total))
                    total_usd += usd_value
                    cash_usd += usd_value
                    asset_details[asset] = float(balance.total)
                else:
                    # Try to get USD value
                    symbol = f"{asset}/USDT"
                    if symbol in tickers:
                        price = Decimal(str(tickers[symbol].last))
                        usd_value = Decimal(str(balance.total)) * price
                        total_usd += usd_value
                        asset_details[asset] = {
                            'amount': float(balance.total),
                            'usd_value': float(usd_value),
                        }
                    else:
                        # Unknown asset - include raw amount
                        asset_details[asset] = float(balance.total)
            
            return PlatformBalance(
                platform=exchange_name,
                platform_type='crypto_exchange',
                total_usd=total_usd,
                cash_balance=cash_usd,
                positions_value=total_usd - cash_usd,
                positions_count=len(asset_details),
                currency='USDT',
                details={'assets': asset_details}
            )
            
        except Exception as e:
            logger.error(f"Error fetching {exchange_name} balance: {e}")
            return PlatformBalance(
                platform=exchange_name,
                platform_type='crypto_exchange',
                total_usd=Decimal('0'),
                cash_balance=Decimal('0'),
                positions_value=Decimal('0'),
                positions_count=0,
                error=str(e)
            )
    
    async def _fetch_alpaca_balance(self) -> PlatformBalance:
        """Fetch balance from Alpaca."""
        try:
            if not self.alpaca_client:
                return PlatformBalance(
                    platform='Alpaca',
                    platform_type='stock_broker',
                    total_usd=Decimal('0'),
                    cash_balance=Decimal('0'),
                    positions_value=Decimal('0'),
                    positions_count=0,
                    starting_balance=self.get_starting_balance('Alpaca'),
                    error='Client not configured'
                )
            
            account = await self.alpaca_client.get_account()
            positions = await self.alpaca_client.get_positions()
            
            total = Decimal(str(account.get('equity', 0)))
            cash = Decimal(str(account.get('cash', 0)))
            
            return PlatformBalance(
                platform='Alpaca',
                platform_type='stock_broker',
                total_usd=total,
                cash_balance=cash,
                positions_value=total - cash,
                positions_count=len(positions),
                starting_balance=self.get_starting_balance('Alpaca'),
                currency='USD',
                details={
                    'buying_power': float(account.get('buying_power', 0)),
                    'day_trade_count': account.get('daytrade_count', 0),
                    'positions': [
                        {
                            'symbol': p.get('symbol'),
                            'qty': float(p.get('qty', 0)),
                            'market_value': float(p.get('market_value', 0)),
                        }
                        for p in positions[:10]
                    ]
                }
            )
        except Exception as e:
            logger.error(f"Error fetching Alpaca balance: {e}")
            return PlatformBalance(
                platform='Alpaca',
                platform_type='stock_broker',
                total_usd=Decimal('0'),
                cash_balance=Decimal('0'),
                positions_value=Decimal('0'),
                positions_count=0,
                starting_balance=self.get_starting_balance('Alpaca'),
                error=str(e)
            )
    
    async def _save_to_db(self, balance: AggregatedBalance):
        """Save aggregated balance to Supabase."""
        if not self.db:
            return
        
        try:
            # Save to polybot_balances table
            if hasattr(self.db, '_client') and self.db._client:
                data = {
                    'id': 1,  # Single row for latest balance
                    'total_portfolio_usd': float(balance.total_portfolio_usd),
                    'total_cash_usd': float(balance.total_cash_usd),
                    'total_positions_usd': float(balance.total_positions_usd),
                    'platforms': balance.to_dict()['platforms'],
                    'updated_at': datetime.now().isoformat(),
                }
                # Add P&L fields (stored in platforms JSON, calculated on read)
                self.db._client.table('polybot_balances').upsert(data).execute()
                
                logger.debug("Saved aggregated balance to database")
        except Exception as e:
            logger.error(f"Error saving balance to DB: {e}")


# SQL to create the balances table
BALANCES_TABLE_SQL = """
-- Create table for storing aggregated balances
CREATE TABLE IF NOT EXISTS polybot_balances (
    id INTEGER PRIMARY KEY DEFAULT 1,
    total_portfolio_usd DECIMAL(20, 2) DEFAULT 0,
    total_cash_usd DECIMAL(20, 2) DEFAULT 0,
    total_positions_usd DECIMAL(20, 2) DEFAULT 0,
    platforms JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial row
INSERT INTO polybot_balances (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
"""
