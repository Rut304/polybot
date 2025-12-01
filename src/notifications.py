"""
PolyBot Notifications

Discord and Telegram notification handlers for trade alerts.
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional
import requests

logger = logging.getLogger("polybot.notifications")


@dataclass
class NotificationConfig:
    """Notification configuration."""
    discord_webhook: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    
    @classmethod
    def from_env(cls) -> "NotificationConfig":
        return cls(
            discord_webhook=os.getenv("DISCORD_WEBHOOK"),
            telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN"),
            telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID"),
        )
    
    @property
    def discord_enabled(self) -> bool:
        return bool(self.discord_webhook)
    
    @property
    def telegram_enabled(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id)


class Notifier:
    """
    Multi-channel notification handler.
    
    Supports Discord webhooks and Telegram bot messages.
    """
    
    def __init__(self, config: Optional[NotificationConfig] = None):
        self.config = config or NotificationConfig.from_env()
    
    def send_opportunity(
        self,
        buy_platform: str,
        sell_platform: str,
        market: str,
        profit_percent: float,
        trade_size: float,
    ):
        """Send opportunity alert."""
        message = (
            f"🎯 **Arbitrage Opportunity Found**\n"
            f"Market: {market}\n"
            f"Buy: {buy_platform} | Sell: {sell_platform}\n"
            f"Profit: {profit_percent:.2f}%\n"
            f"Size: ${trade_size:.2f}"
        )
        self._send(message, color=0x00FF00)  # Green
    
    def send_trade_executed(
        self,
        platform: str,
        market: str,
        side: str,
        size: float,
        price: float,
        is_dry_run: bool = False,
    ):
        """Send trade execution alert."""
        prefix = "🔵 [DRY RUN]" if is_dry_run else "✅"
        message = (
            f"{prefix} **Trade Executed**\n"
            f"Platform: {platform}\n"
            f"Market: {market}\n"
            f"Side: {side.upper()}\n"
            f"Size: ${size:.2f}\n"
            f"Price: ${price:.4f}"
        )
        self._send(message, color=0x0099FF if is_dry_run else 0x00FF00)
    
    def send_trade_failed(
        self,
        platform: str,
        market: str,
        reason: str,
    ):
        """Send trade failure alert."""
        message = (
            f"❌ **Trade Failed**\n"
            f"Platform: {platform}\n"
            f"Market: {market}\n"
            f"Reason: {reason}"
        )
        self._send(message, color=0xFF0000)  # Red
    
    def send_circuit_breaker(self, reason: str):
        """Send circuit breaker alert."""
        message = (
            f"🚨 **CIRCUIT BREAKER ACTIVATED**\n"
            f"Bot trading has been paused.\n"
            f"Reason: {reason}"
        )
        self._send(message, color=0xFF0000)  # Red
    
    def send_daily_summary(
        self,
        trades_count: int,
        profitable_count: int,
        total_profit: float,
        opportunities_found: int,
    ):
        """Send daily summary."""
        emoji = "📈" if total_profit >= 0 else "📉"
        message = (
            f"{emoji} **Daily Summary**\n"
            f"Trades: {trades_count} ({profitable_count} profitable)\n"
            f"P&L: ${total_profit:+.2f}\n"
            f"Opportunities Found: {opportunities_found}"
        )
        color = 0x00FF00 if total_profit >= 0 else 0xFF6600
        self._send(message, color=color)
    
    def send_startup(self, dry_run: bool, max_trade_size: float):
        """Send bot startup notification."""
        mode = "🔵 DRY RUN" if dry_run else "🟢 LIVE"
        message = (
            f"🤖 **PolyBot Started**\n"
            f"Mode: {mode}\n"
            f"Max Trade: ${max_trade_size:.2f}"
        )
        self._send(message, color=0x0099FF)
    
    def send_shutdown(self, reason: str = "User requested"):
        """Send bot shutdown notification."""
        message = f"⚫ **PolyBot Stopped**\nReason: {reason}"
        self._send(message, color=0x888888)
    
    def _send(self, message: str, color: int = 0x0099FF):
        """Send message to all configured channels."""
        if self.config.discord_enabled:
            self._send_discord(message, color)
        
        if self.config.telegram_enabled:
            self._send_telegram(message)
    
    def _send_discord(self, message: str, color: int):
        """Send message to Discord webhook."""
        try:
            # Convert markdown to Discord embed
            embed = {
                "description": message,
                "color": color,
                "footer": {"text": "PolyBot"},
            }
            
            payload = {"embeds": [embed]}
            
            response = requests.post(
                self.config.discord_webhook,
                json=payload,
                timeout=10,
            )
            response.raise_for_status()
            logger.debug("Discord notification sent")
        except Exception as e:
            logger.error(f"Discord notification failed: {e}")
    
    def _send_telegram(self, message: str):
        """Send message to Telegram."""
        try:
            # Convert markdown to Telegram format
            text = message.replace("**", "*")
            
            url = (
                f"https://api.telegram.org/"
                f"bot{self.config.telegram_bot_token}/sendMessage"
            )
            
            payload = {
                "chat_id": self.config.telegram_chat_id,
                "text": text,
                "parse_mode": "Markdown",
            }
            
            response = requests.post(url, json=payload, timeout=10)
            response.raise_for_status()
            logger.debug("Telegram notification sent")
        except Exception as e:
            logger.error(f"Telegram notification failed: {e}")


# Global notifier instance
notifier = Notifier()
