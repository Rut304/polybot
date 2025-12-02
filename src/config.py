"""
Configuration management for PolyBot.
All settings loaded from environment variables with sensible defaults.
"""

import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


@dataclass
class TradingConfig:
    """Trading parameters and risk limits."""
    
    # Dry run mode - no real trades executed
    dry_run: bool = True
    
    # Minimum profit threshold (percentage) to execute a trade
    min_profit_percent: float = 1.0
    
    # Maximum trade size in USD
    max_trade_size: float = 100.0
    
    # Maximum daily loss before circuit breaker triggers (USD)
    max_daily_loss: float = 50.0
    
    # Maximum number of consecutive failed trades before pause
    max_consecutive_failures: int = 3
    
    # Slippage tolerance - reject if price moved more than this (percentage)
    slippage_tolerance: float = 0.5
    
    # Time to wait between opportunity checks (seconds)
    scan_interval: float = 2.0
    
    # Require manual approval for first N trades (0 = fully autonomous)
    manual_approval_trades: int = 10


@dataclass
class PolymarketConfig:
    """Polymarket API configuration."""
    
    # WebSocket URL for order book updates
    ws_url: str = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
    
    # REST API base URL
    api_url: str = "https://clob.polymarket.com"
    
    # Gamma API for market discovery
    gamma_url: str = "https://gamma-api.polymarket.com"
    
    # Chain ID (Polygon mainnet)
    chain_id: int = 137
    
    # API credentials for CLOB API
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    
    # Optional: Private key for on-chain signing (wallet trades)
    private_key: Optional[str] = None
    
    def __post_init__(self):
        self.api_key = os.getenv("POLYMARKET_API_KEY")
        self.api_secret = os.getenv("POLYMARKET_SECRET")
        self.private_key = os.getenv("POLYMARKET_PRIVATE_KEY")


@dataclass  
class KalshiConfig:
    """Kalshi API configuration."""
    
    # WebSocket URL for order book updates
    ws_url: str = "wss://api.elections.kalshi.com/trade-api/ws/v2"
    
    # REST API base URL
    api_url: str = "https://api.elections.kalshi.com/trade-api/v2"
    
    # API Key ID (loaded from env)
    api_key: Optional[str] = None
    
    # Path to private key file or the key content itself
    private_key: Optional[str] = None
    
    def __post_init__(self):
        self.api_key = os.getenv("KALSHI_API_KEY")
        # Try direct key first, then file path
        self.private_key = os.getenv("KALSHI_PRIVATE_KEY")
        if not self.private_key:
            key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH")
            if key_path and os.path.exists(key_path):
                with open(key_path, "r") as f:
                    self.private_key = f.read()


@dataclass
class DatabaseConfig:
    """Supabase configuration."""
    
    url: Optional[str] = None
    key: Optional[str] = None
    
    def __post_init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
    
    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.key)


@dataclass
class NotificationsConfig:
    """Discord/Telegram notification configuration."""
    
    discord_webhook: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    
    def __post_init__(self):
        self.discord_webhook = os.getenv("DISCORD_WEBHOOK")
        self.telegram_bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")


class Config:
    """Main configuration container."""
    
    def __init__(self):
        self.trading = TradingConfig(
            dry_run=os.getenv("DRY_RUN", "true").lower() == "true",
            min_profit_percent=float(os.getenv("MIN_PROFIT_PERCENT", "1.0")),
            max_trade_size=float(os.getenv("MAX_TRADE_SIZE", "100.0")),
            max_daily_loss=float(os.getenv("MAX_DAILY_LOSS", "50.0")),
            max_consecutive_failures=int(os.getenv("MAX_CONSECUTIVE_FAILURES", "3")),
            slippage_tolerance=float(os.getenv("SLIPPAGE_TOLERANCE", "0.5")),
            scan_interval=float(os.getenv("SCAN_INTERVAL", "2.0")),
            manual_approval_trades=int(os.getenv("MANUAL_APPROVAL_TRADES", "10")),
        )
        self.polymarket = PolymarketConfig()
        self.kalshi = KalshiConfig()
        self.database = DatabaseConfig()
        self.notifications = NotificationsConfig()
    
    def validate(self) -> list[str]:
        """Validate configuration and return list of errors."""
        errors = []
        
        if not self.trading.dry_run:
            if not self.polymarket.private_key:
                errors.append("POLYMARKET_PRIVATE_KEY required for live trading")
            if not self.kalshi.api_key or not self.kalshi.private_key:
                errors.append("KALSHI_API_KEY and KALSHI_PRIVATE_KEY required for live trading")
        
        if self.trading.max_trade_size <= 0:
            errors.append("MAX_TRADE_SIZE must be positive")
        
        if self.trading.min_profit_percent < 0:
            errors.append("MIN_PROFIT_PERCENT cannot be negative")
        
        return errors
    
    def print_summary(self):
        """Print configuration summary (hiding sensitive values)."""
        print("=" * 50)
        print("POLYBOT CONFIGURATION")
        print("=" * 50)
        print(f"Mode: {'🔵 DRY RUN' if self.trading.dry_run else '🟢 LIVE TRADING'}")
        print(f"Min Profit: {self.trading.min_profit_percent}%")
        print(f"Max Trade Size: ${self.trading.max_trade_size}")
        print(f"Max Daily Loss: ${self.trading.max_daily_loss}")
        print(f"Slippage Tolerance: {self.trading.slippage_tolerance}%")
        print(f"Scan Interval: {self.trading.scan_interval}s")
        print(f"Manual Approval: First {self.trading.manual_approval_trades} trades")
        print("-" * 50)
        print(f"Polymarket Key: {'✅ Configured' if self.polymarket.private_key else '❌ Missing'}")
        print(f"Kalshi Key: {'✅ Configured' if self.kalshi.api_key else '❌ Missing'}")
        print(f"Database: {'✅ Configured' if self.database.is_configured else '❌ Missing'}")
        print(f"Discord: {'✅ Configured' if self.notifications.discord_webhook else '⚪ Not set'}")
        print("=" * 50)


# Global config instance
config = Config()
