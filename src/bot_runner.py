"""
PolyBot Unified Runner

Integrates all features into a single async runner:
- Copy Trading
- Overlapping Arbitrage Detection
- Position Management & Auto-Claim
- News/Sentiment Monitoring
- Cross-platform Arbitrage (Polymarket/Kalshi)
"""

import asyncio
import logging
import signal
import sys
import os
from datetime import datetime
from typing import Optional

# Add src to path for imports when running as module
src_dir = os.path.dirname(os.path.abspath(__file__))
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from src.database.client import Database
from src.features.copy_trading import CopyTradingEngine, CopySignal
from src.features.overlapping_arb import OverlappingArbDetector, OverlapOpportunity
from src.features.position_manager import PositionManager, ClaimResult, PortfolioSummary
from src.features.news_sentiment import NewsSentimentEngine, MarketAlert
from src.clients.polymarket_client import PolymarketClient
from src.clients.kalshi_client import KalshiClient
from src.simulation.paper_trader_realistic import RealisticPaperTrader
from src.arbitrage.detector import ArbitrageDetector
from decimal import Decimal

logger = logging.getLogger(__name__)


class PolybotRunner:
    """
    Unified runner that orchestrates all bot features.
    """
    
    def __init__(
        self,
        wallet_address: Optional[str] = None,
        private_key: Optional[str] = None,
        kalshi_api_key: Optional[str] = None,
        kalshi_private_key: Optional[str] = None,
        news_api_key: Optional[str] = None,
        tracked_traders: Optional[list] = None,
        enable_copy_trading: bool = True,
        enable_arb_detection: bool = True,
        enable_position_manager: bool = True,
        enable_news_sentiment: bool = True,
        simulation_mode: bool = True,
    ):
        self.wallet_address = wallet_address or os.getenv("WALLET_ADDRESS", "")
        self.private_key = private_key or os.getenv("PRIVATE_KEY")
        self.kalshi_api_key = kalshi_api_key or os.getenv("KALSHI_API_KEY")
        self.kalshi_private_key = kalshi_private_key or os.getenv("KALSHI_PRIVATE_KEY")
        self.news_api_key = news_api_key or os.getenv("NEWS_API_KEY")
        self.simulation_mode = simulation_mode
        
        # Feature flags
        self.enable_copy_trading = enable_copy_trading
        self.enable_arb_detection = enable_arb_detection
        self.enable_position_manager = enable_position_manager
        self.enable_news_sentiment = enable_news_sentiment
        
        # Initialize database
        self.db = Database()
        
        # Initialize API clients for balance tracking
        self.polymarket_client = PolymarketClient()
        self.kalshi_client = KalshiClient(
            api_key=self.kalshi_api_key,
            private_key=self.kalshi_private_key,
        )
        
        # Initialize feature engines
        self.copy_trading: Optional[CopyTradingEngine] = None
        self.arb_detector: Optional[OverlappingArbDetector] = None
        self.position_manager: Optional[PositionManager] = None
        self.news_engine: Optional[NewsSentimentEngine] = None
        self.cross_platform_detector: Optional[ArbitrageDetector] = None
        
        # Paper trading simulator (for simulation mode)
        self.paper_trader: Optional[RealisticPaperTrader] = None
        
        # Default tracked traders (can be updated from Supabase)
        self.tracked_traders = tracked_traders or []
        
        self._running = False
        self._tasks = []
    
    async def fetch_balances(self) -> dict:
        """Fetch balances from both Polymarket and Kalshi."""
        balances = {
            "polymarket": {"total_value": 0.0, "positions": []},
            "kalshi": {"total_value": 0.0, "positions": []},
            "combined_total": 0.0,
        }
        
        # Fetch Polymarket balance
        if self.wallet_address:
            try:
                pm_balance = self.polymarket_client.get_balance(self.wallet_address)
                balances["polymarket"] = pm_balance
                logger.info(
                    f"💰 Polymarket: ${pm_balance.get('total_value', 0):.2f} "
                    f"({pm_balance.get('position_count', 0)} positions)"
                )
            except Exception as e:
                logger.error(f"Failed to fetch Polymarket balance: {e}")
        
        # Fetch Kalshi balance
        if self.kalshi_client.is_authenticated:
            try:
                k_balance = self.kalshi_client.get_balance()
                balances["kalshi"] = k_balance
                logger.info(
                    f"💰 Kalshi: ${k_balance.get('total_value', 0):.2f} "
                    f"(${k_balance.get('balance', 0):.2f} cash, "
                    f"{k_balance.get('position_count', 0)} positions)"
                )
            except Exception as e:
                logger.error(f"Failed to fetch Kalshi balance: {e}")
        
        # Calculate combined total
        pm_total = balances["polymarket"].get("total_value", 0) or 0
        k_total = balances["kalshi"].get("total_value", 0) or 0
        balances["combined_total"] = pm_total + k_total
        
        logger.info(f"💎 Combined Portfolio Value: ${balances['combined_total']:.2f}")
        
        return balances

    async def initialize(self):
        """Initialize all enabled features."""
        logger.info("Initializing PolyBot features...")
        
        # Fetch initial balances
        logger.info("Fetching wallet balances...")
        await self.fetch_balances()
        
        if self.enable_copy_trading:
            self.copy_trading = CopyTradingEngine(
                max_copy_size=100.0,
                min_copy_size=5.0,
                check_interval=60,
            )
            # Add tracked traders
            for trader in self.tracked_traders:
                if isinstance(trader, dict):
                    self.copy_trading.add_trader(
                        trader.get('address', ''),
                        trader.get('name', 'Unknown'),
                        trader.get('multiplier', 0.1),
                    )
                else:
                    self.copy_trading.add_trader(trader, 'Trader', 0.1)
            logger.info("✓ Copy Trading Engine initialized")
        
        if self.enable_arb_detection:
            self.arb_detector = OverlappingArbDetector(
                min_liquidity=5000,
                min_deviation=3.0,
                check_interval=120,
            )
            logger.info("✓ Overlapping Arbitrage Detector initialized")
        
        if self.enable_position_manager and self.wallet_address:
            self.position_manager = PositionManager(
                wallet_address=self.wallet_address,
                private_key=self.private_key if not self.simulation_mode else None,
                auto_claim=not self.simulation_mode,
                check_interval=300,
            )
            logger.info("✓ Position Manager initialized")
        
        if self.enable_news_sentiment:
            self.news_engine = NewsSentimentEngine(
                news_api_key=self.news_api_key,
                check_interval=300,
            )
            logger.info("✓ News/Sentiment Engine initialized")
        
        # Initialize cross-platform arbitrage detector
        self.cross_platform_detector = ArbitrageDetector(
            min_profit_percent=0.5,  # 0.5% minimum profit to consider
            min_confidence=0.3,
        )
        logger.info("✓ Cross-Platform Arbitrage Detector initialized")
        
        # Initialize paper trader for simulation mode
        if self.simulation_mode:
            self.paper_trader = RealisticPaperTrader(
                db_client=self.db,
                starting_balance=Decimal("1000.00"),
            )
            logger.info("✓ Realistic Paper Trader initialized")
            logger.info("📊 Starting balance: $1,000.00")
            logger.info("📉 Slippage, partial fills, failures enabled")
        
        logger.info("All features initialized!")
    
    async def on_copy_signal(self, signal: CopySignal):
        """Handle copy trading signals."""
        logger.info(
            f"[COPY] Signal: {signal.action.upper()} {signal.size:.2f} shares "
            f"of {signal.outcome} @ ${signal.price:.3f} - "
            f"Market: {signal.market_slug}"
        )
        
        # Log to database
        try:
            self.db.log_opportunity({
                "type": "copy_trade",
                "source": "polymarket",
                "trader": signal.trader_address[:10] + "...",
                "market_slug": signal.market_slug,
                "action": signal.action,
                "outcome": signal.outcome,
                "price": signal.price,
                "size": signal.size,
                "detected_at": signal.detected_at.isoformat(),
            })
        except Exception as e:
            logger.error(f"Error logging copy signal: {e}")
        
        if not self.simulation_mode:
            # TODO: Execute actual trade
            pass
    
    async def on_arb_opportunity(self, opp: OverlapOpportunity):
        """Handle overlapping arbitrage opportunities."""
        logger.info(
            f"[ARB] {opp.relationship} opportunity: "
            f"{opp.deviation:.1f}% deviation, "
            f"${opp.profit_potential:.4f} potential profit"
        )
        
        # Log to database
        try:
            self.db.log_opportunity({
                "type": "overlapping_arb",
                "source": "polymarket",
                "market_a": opp.market_a.question[:100],
                "market_b": opp.market_b.question[:100],
                "relationship": opp.relationship,
                "deviation": opp.deviation,
                "profit_potential": opp.profit_potential,
                "confidence": opp.confidence,
                "detected_at": opp.detected_at.isoformat(),
            })
        except Exception as e:
            logger.error(f"Error logging arb opportunity: {e}")
        
        # Paper trade if in simulation mode
        if self.simulation_mode and self.paper_trader:
            try:
                await self.paper_trader.simulate_opportunity(
                    market_a_id=opp.market_a.condition_id or "unknown",
                    market_a_title=opp.market_a.question[:200],
                    market_b_id=opp.market_b.condition_id or "overlapping",
                    market_b_title=opp.market_b.question[:200],
                    platform_a="polymarket",
                    platform_b="polymarket",
                    price_a=Decimal(str(opp.market_a.yes_price or 0.5)),
                    price_b=Decimal(str(opp.market_b.yes_price or 0.5)),
                    spread_pct=Decimal(str(opp.deviation)),
                    trade_type=f"overlapping_{opp.relationship}",
                )
            except Exception as e:
                logger.error(f"Error paper trading arb: {e}")
    
    async def on_position_claim(self, result: ClaimResult):
        """Handle position claim results."""
        if result.success:
            logger.info(
                f"[CLAIM] Successfully claimed ${result.amount_claimed:.2f} "
                f"from position {result.position_id}"
            )
        else:
            logger.warning(
                f"[CLAIM] Failed to claim position {result.position_id}: "
                f"{result.error}"
            )
    
    async def on_portfolio_update(self, summary: PortfolioSummary):
        """Handle portfolio updates."""
        logger.info(
            f"[PORTFOLIO] {summary.open_positions} open, "
            f"{summary.resolved_unclaimed} unclaimed, "
            f"PnL: ${summary.total_unrealized_pnl + summary.total_realized_pnl:.2f}, "
            f"Win rate: {summary.win_rate:.1f}%"
        )
    
    async def on_news_alert(self, alert: MarketAlert):
        """Handle news/sentiment alerts."""
        logger.info(
            f"[NEWS] {alert.alert_type}: {alert.news_item.title[:60]}... "
            f"-> {alert.suggested_action.upper()} confidence: {alert.confidence:.0%}"
        )
        
        # Log to database
        try:
            self.db.log_opportunity({
                "type": "news_alert",
                "source": alert.news_item.source.value,
                "title": alert.news_item.title[:200],
                "market_id": alert.market_condition_id,
                "market_question": alert.market_question[:200],
                "alert_type": alert.alert_type,
                "suggested_action": alert.suggested_action,
                "confidence": alert.confidence,
                "sentiment_score": alert.news_item.sentiment_score,
                "detected_at": alert.created_at.isoformat(),
            })
        except Exception as e:
            logger.error(f"Error logging news alert: {e}")
    
    async def run_copy_trading(self):
        """Run copy trading engine."""
        if self.copy_trading:
            await self.copy_trading.run(callback=self.on_copy_signal)
    
    async def run_arb_detection(self):
        """Run arbitrage detection."""
        if self.arb_detector:
            await self.arb_detector.run(callback=self.on_arb_opportunity)
    
    async def run_position_manager(self):
        """Run position manager."""
        if self.position_manager:
            await self.position_manager.run(
                on_claim=self.on_position_claim,
                on_update=self.on_portfolio_update,
            )
    
    async def run_news_sentiment(self):
        """Run news/sentiment engine."""
        if self.news_engine:
            # Fetch markets for matching
            markets = []
            if self.arb_detector:
                await self.arb_detector.fetch_active_markets()
                markets = [
                    {"conditionId": m.condition_id, "question": m.question}
                    for m in self.arb_detector.markets_cache.values()
                ]
            
            await self.news_engine.run(
                markets=markets,
                on_alert=self.on_news_alert,
            )

    async def run_balance_tracker(self):
        """Periodically fetch and log balances."""
        while self._running:
            try:
                await self.fetch_balances()
            except Exception as e:
                logger.error(f"Error fetching balances: {e}")
            
            # Check every 5 minutes
            await asyncio.sleep(300)

    async def run_paper_trading_stats(self):
        """Periodically save paper trading stats and print summary."""
        while self._running:
            await asyncio.sleep(60)  # Save stats every minute
            
            if self.paper_trader:
                try:
                    # Save stats to database
                    await self.paper_trader.save_stats_to_db()
                    
                    # Log summary
                    stats = self.paper_trader.stats
                    if stats.opportunities_seen > 0:
                        logger.info(
                            f"📊 REALISTIC SIM: "
                            f"Balance: ${stats.current_balance:.2f} | "
                            f"P&L: ${stats.total_pnl:+.2f} ({stats.roi_pct:+.1f}%) | "
                            f"Trades: {stats.opportunities_traded} | "
                            f"Win: {stats.win_rate:.0f}% | "
                            f"Exec: {stats.execution_success_rate:.0f}%"
                        )
                except Exception as e:
                    logger.error(f"Error saving paper trading stats: {e}")

    async def run(self):
        """Run all enabled features concurrently."""
        await self.initialize()
        
        self._running = True
        logger.info("=" * 60)
        logger.info("PolyBot Starting!")
        logger.info(f"Mode: {'SIMULATION' if self.simulation_mode else 'LIVE'}")
        logger.info(f"Features enabled:")
        logger.info(f"  - Copy Trading: {self.enable_copy_trading}")
        logger.info(f"  - Arb Detection: {self.enable_arb_detection}")
        logger.info(f"  - Position Manager: {self.enable_position_manager}")
        logger.info(f"  - News/Sentiment: {self.enable_news_sentiment}")
        logger.info("=" * 60)
        
        # Create tasks for each enabled feature
        tasks = []
        
        if self.enable_copy_trading and self.copy_trading:
            tasks.append(asyncio.create_task(self.run_copy_trading()))
        
        if self.enable_arb_detection and self.arb_detector:
            tasks.append(asyncio.create_task(self.run_arb_detection()))
        
        if self.enable_position_manager and self.position_manager:
            tasks.append(asyncio.create_task(self.run_position_manager()))
        
        if self.enable_news_sentiment and self.news_engine:
            tasks.append(asyncio.create_task(self.run_news_sentiment()))
        
        # Always run balance tracker
        tasks.append(asyncio.create_task(self.run_balance_tracker()))
        
        # Run paper trading stats saver if in simulation mode
        if self.simulation_mode and self.paper_trader:
            tasks.append(asyncio.create_task(self.run_paper_trading_stats()))
        
        self._tasks = tasks
        
        if not tasks:
            logger.warning("No features enabled! Exiting.")
            return
        
        try:
            # Run all tasks concurrently
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            logger.info("Tasks cancelled, shutting down...")
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            raise
    
    async def shutdown(self):
        """Gracefully shutdown all features."""
        logger.info("Shutting down PolyBot...")
        self._running = False
        
        if self.copy_trading:
            self.copy_trading.stop()
        if self.arb_detector:
            self.arb_detector.stop()
        if self.position_manager:
            self.position_manager.stop()
        if self.news_engine:
            self.news_engine.stop()
        
        # Cancel all running tasks
        for task in self._tasks:
            task.cancel()
        
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        logger.info("PolyBot shutdown complete")


def setup_signal_handlers(runner: PolybotRunner, loop: asyncio.AbstractEventLoop):
    """Setup graceful shutdown on SIGINT/SIGTERM."""
    def signal_handler():
        logger.info("Received shutdown signal")
        asyncio.create_task(runner.shutdown())
    
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)


async def main():
    """Main entry point."""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    
    # Example tracked traders (these are whale addresses on Polymarket)
    tracked_traders = [
        # Add trader addresses to copy here
    ]
    
    runner = PolybotRunner(
        tracked_traders=tracked_traders,
        enable_copy_trading=True,
        enable_arb_detection=True,
        enable_position_manager=True,
        enable_news_sentiment=True,
        simulation_mode=True,
    )
    
    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    setup_signal_handlers(runner, loop)
    
    try:
        await runner.run()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        await runner.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
