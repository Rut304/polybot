"""
PolyBot - Prediction Market Arbitrage Bot

Main entry point for the arbitrage bot.
Orchestrates market data collection, opportunity detection, and trade execution.
"""

import asyncio
import logging
import signal
import sys
import os
from datetime import datetime

# Add src to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import config
from src.clients import PolymarketClient, KalshiClient
from src.arbitrage import ArbitrageDetector, TradeExecutor
from src.database import Database

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("polybot.log"),
    ]
)
logger = logging.getLogger("polybot")


class PolyBot:
    """
    Main bot orchestrator.
    
    Manages the lifecycle of:
    - Market data clients (Polymarket, Kalshi)
    - Arbitrage detector
    - Trade executor
    - Database persistence
    """
    
    def __init__(self):
        self.is_running = False
        self._shutdown_event = asyncio.Event()
        
        # Initialize components
        self.polymarket = PolymarketClient(
            ws_url=config.polymarket.ws_url,
            gamma_url=config.polymarket.gamma_url,
            api_key=config.polymarket.api_key,
            api_secret=config.polymarket.api_secret,
        )
        
        self.kalshi = KalshiClient(
            api_key=config.kalshi.api_key,
            private_key=config.kalshi.private_key,
            ws_url=config.kalshi.ws_url,
            api_url=config.kalshi.api_url,
        )
        
        self.detector = ArbitrageDetector(
            min_profit_percent=config.trading.min_profit_percent,
        )
        
        self.executor = TradeExecutor(
            dry_run=config.trading.dry_run,
            max_trade_size=config.trading.max_trade_size,
            max_daily_loss=config.trading.max_daily_loss,
            max_consecutive_failures=config.trading.max_consecutive_failures,
            slippage_tolerance=config.trading.slippage_tolerance / 100,
            manual_approval_trades=config.trading.manual_approval_trades,
        )
        
        self.database = Database(
            url=config.database.url,
            key=config.database.key,
        )
        
        # Market pairs to monitor (will be populated dynamically)
        self.market_pairs = []
    
    async def discover_markets(self):
        """Discover matching markets across platforms."""
        logger.info("Discovering markets...")
        
        # Discover Polymarket markets
        poly_markets = self.polymarket.discover_markets(
            active_only=True,
            limit=100,
        )
        logger.info(f"Found {len(poly_markets)} Polymarket tokens")
        
        # Discover Kalshi markets
        if self.kalshi.is_authenticated:
            kalshi_markets = self.kalshi.discover_markets(
                status="open",
                limit=100,
            )
            logger.info(f"Found {len(kalshi_markets)} Kalshi markets")
        else:
            logger.warning("Kalshi not authenticated - skipping Kalshi markets")
            kalshi_markets = []
        
        # TODO: Match markets across platforms
        # For now, we'll set up some known matching pairs manually
        # In production, this would use market matching algorithms
        
        return poly_markets, kalshi_markets
    
    async def run_kalshi_websocket(self):
        """Run Kalshi WebSocket in background."""
        if not self.kalshi.is_authenticated:
            logger.warning("Kalshi not authenticated - WebSocket disabled")
            return
        
        while not self._shutdown_event.is_set():
            try:
                await self.kalshi.run()
            except Exception as e:
                logger.error(f"Kalshi WebSocket error: {e}")
                await asyncio.sleep(5)  # Wait before reconnecting
    
    async def run_arbitrage_loop(self):
        """Main arbitrage detection and execution loop."""
        logger.info("Starting arbitrage loop...")
        
        while not self._shutdown_event.is_set():
            try:
                # Get current order books
                poly_books = self.polymarket.get_all_order_books()
                kalshi_books = self.kalshi.get_all_order_books()
                
                # Find opportunities
                opportunities = self.detector.find_all_opportunities(
                    polymarket_books=poly_books,
                    kalshi_books=kalshi_books,
                    market_pairs=self.market_pairs,
                )
                
                if opportunities:
                    logger.info(f"Found {len(opportunities)} opportunities")
                    
                    for opp in opportunities:
                        logger.info(f"  {opp}")
                        
                        # Log to database
                        self.database.log_opportunity(opp.to_dict())
                        
                        # Execute if conditions met
                        can_trade, reason = self.executor.can_trade()
                        if can_trade:
                            buy_trade, sell_trade, status = await self.executor.execute_opportunity(opp)
                            
                            if buy_trade:
                                self.database.log_trade(buy_trade.to_dict())
                            if sell_trade:
                                self.database.log_trade(sell_trade.to_dict())
                            
                            if status != "Success":
                                logger.warning(f"Execution result: {status}")
                        else:
                            logger.debug(f"Cannot trade: {reason}")
                
                # Update heartbeat
                self.database.heartbeat()
                
                # Wait before next scan
                await asyncio.sleep(config.trading.scan_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Arbitrage loop error: {e}")
                await asyncio.sleep(5)
    
    async def start(self):
        """Start the bot."""
        logger.info("=" * 50)
        logger.info("POLYBOT STARTING")
        logger.info("=" * 50)
        
        # Validate configuration
        errors = config.validate()
        if errors:
            for error in errors:
                logger.error(f"Config error: {error}")
            if not config.trading.dry_run:
                logger.error("Cannot start in live mode with config errors")
                return
        
        # Print configuration
        config.print_summary()
        
        # Update database status
        self.database.update_bot_status(
            is_running=True,
            dry_run=config.trading.dry_run,
            max_trade_size=config.trading.max_trade_size,
            min_profit_threshold=config.trading.min_profit_percent,
        )
        
        # Discover markets
        await self.discover_markets()
        
        # Start Polymarket WebSocket
        logger.info("Connecting to Polymarket...")
        if self.polymarket.start():
            logger.info("Polymarket connected")
        else:
            logger.error("Failed to connect to Polymarket")
        
        # Subscribe to markets (using discovered tokens)
        poly_tokens = list(self.polymarket._markets.keys())[:20]  # Limit for testing
        if poly_tokens:
            self.polymarket.subscribe(poly_tokens)
            logger.info(f"Subscribed to {len(poly_tokens)} Polymarket tokens")
        
        # Wait for initial data
        if not self.polymarket.wait_for_data(timeout=15):
            logger.warning("Timeout waiting for Polymarket data")
        
        self.is_running = True
        
        # Start background tasks
        tasks = [
            asyncio.create_task(self.run_kalshi_websocket()),
            asyncio.create_task(self.run_arbitrage_loop()),
        ]
        
        logger.info("Bot is running. Press Ctrl+C to stop.")
        
        try:
            await self._shutdown_event.wait()
        finally:
            # Cleanup
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            
            self.polymarket.stop()
            self.is_running = False
            
            self.database.update_bot_status(is_running=False)
            logger.info("Bot stopped")
    
    def stop(self):
        """Signal the bot to stop."""
        logger.info("Shutdown requested...")
        self._shutdown_event.set()


def main():
    """Main entry point."""
    bot = PolyBot()
    
    # Handle shutdown signals
    def signal_handler(sig, frame):
        bot.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the bot
    asyncio.run(bot.start())


if __name__ == "__main__":
    main()
