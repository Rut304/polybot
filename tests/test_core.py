"""
PolyBot Test Suite

Basic tests for core functionality.
"""

import pytest
from unittest.mock import MagicMock, patch
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestArbitrageDetector:
    """Tests for arbitrage detection logic."""
    
    def test_calculate_profit_percent(self):
        """Test profit percentage calculation."""
        from src.arbitrage.detector import ArbitrageDetector
        
        detector = ArbitrageDetector(min_profit_percent=1.0)
        
        # Buy at $0.45, sell at $0.48 = 6.67% profit
        profit = detector._calculate_profit_percent(0.45, 0.48)
        assert profit == pytest.approx(6.67, rel=0.01)
        
        # No profit case
        profit = detector._calculate_profit_percent(0.50, 0.50)
        assert profit == 0.0
        
        # Negative case (would be a loss)
        profit = detector._calculate_profit_percent(0.50, 0.45)
        assert profit < 0


class TestTradeExecutor:
    """Tests for trade execution and risk management."""
    
    def test_dry_run_mode(self):
        """Test that dry run mode doesn't execute real trades."""
        from src.arbitrage.executor import TradeExecutor
        
        executor = TradeExecutor(
            dry_run=True,
            max_trade_size=100,
            max_daily_loss=50,
        )
        
        can_trade, reason = executor.can_trade()
        assert can_trade is True
        assert "Dry run" not in reason
    
    def test_circuit_breaker(self):
        """Test circuit breaker activates after consecutive failures."""
        from src.arbitrage.executor import TradeExecutor
        
        executor = TradeExecutor(
            dry_run=True,
            max_trade_size=100,
            max_daily_loss=50,
            max_consecutive_failures=3,
        )
        
        # Simulate 3 consecutive failures
        executor._risk.consecutive_failures = 3
        
        can_trade, reason = executor.can_trade()
        assert can_trade is False
        assert "circuit breaker" in reason.lower()
    
    def test_daily_loss_limit(self):
        """Test daily loss limit stops trading."""
        from src.arbitrage.executor import TradeExecutor
        
        executor = TradeExecutor(
            dry_run=True,
            max_trade_size=100,
            max_daily_loss=50,
        )
        
        # Simulate exceeding daily loss
        executor._risk.daily_loss = 51.0
        
        can_trade, reason = executor.can_trade()
        assert can_trade is False
        assert "daily loss" in reason.lower()


class TestConfig:
    """Tests for configuration management."""
    
    @patch.dict(os.environ, {}, clear=True)
    def test_default_config(self):
        """Test default configuration values."""
        # Re-import to get fresh config
        import importlib
        import src.config
        importlib.reload(src.config)
        
        from src.config import config
        
        assert config.trading.dry_run is True
        assert config.trading.max_trade_size == 100.0
    
    @patch.dict(os.environ, {
        "DRY_RUN": "false",
        "MAX_TRADE_SIZE": "500",
    })
    def test_env_override(self):
        """Test environment variable overrides."""
        import importlib
        import src.config
        importlib.reload(src.config)
        
        from src.config import config
        
        assert config.trading.dry_run is False
        assert config.trading.max_trade_size == 500.0


class TestNotifications:
    """Tests for notification system."""
    
    def test_notifier_disabled(self):
        """Test notifier gracefully handles missing config."""
        from src.notifications import Notifier, NotificationConfig
        
        config = NotificationConfig()  # No webhooks configured
        notifier = Notifier(config)
        
        # Should not raise
        notifier.send_opportunity(
            buy_platform="Polymarket",
            sell_platform="Kalshi",
            market="Test",
            profit_percent=2.5,
            trade_size=50,
        )
    
    @patch('requests.post')
    def test_discord_notification(self, mock_post):
        """Test Discord notification sends correctly."""
        from src.notifications import Notifier, NotificationConfig
        
        mock_post.return_value.raise_for_status = MagicMock()
        
        config = NotificationConfig(
            discord_webhook="https://discord.com/api/webhooks/test"
        )
        notifier = Notifier(config)
        
        notifier.send_startup(dry_run=True, max_trade_size=100)
        
        assert mock_post.called
        call_args = mock_post.call_args
        assert "embeds" in call_args.kwargs.get("json", {})


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
