"""
PolyBot - Prediction Market Arbitrage Bot

Main entry point for the arbitrage bot.
Supports:
1. Single-user mode (User ID or legacy global)
2. Multi-tenant Manager mode (orchestrates multiple bots)
"""

import asyncio
import logging
import signal
import sys
import os
import argparse
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.bot_runner import PolybotRunner
from src.manager import BotManager
from src.logging_handler import setup_database_logging
from src.utils.cleanup import cleanup_stale_data

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


async def run_single_instance(user_id: Optional[str] = None, live_mode: bool = False):
    """Run a single instance of PolyBot."""
    # Setup logging with user context
    setup_database_logging(user_id=user_id)

    mode_str = "LIVE 💰" if live_mode else "PAPER 📝"
    logger.info(f"🚀 Starting PolyBot single instance (User: {user_id or 'Global'}, Mode: {mode_str})...")

    if live_mode:
        logger.warning("⚠️  LIVE TRADING ENABLED - Real money at risk!")

    # Run Startup Cleanup to remove zombie records
    await cleanup_stale_data()

    runner = PolybotRunner(user_id=user_id, simulation_mode=not live_mode)

    # Handle shutdown
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def signal_handler():
        logger.info("Shutdown signal received")
        stop_event.set()
        asyncio.create_task(runner.shutdown())

    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, signal_handler)

    try:
        # runner.run() is an infinite loop that waits for shutdown
        await runner.run()
    except asyncio.CancelledError:
        logger.info("Main loop cancelled")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info("Instance stopped")


async def main():
    parser = argparse.ArgumentParser(description="PolyBot Entry Point")
    parser.add_argument("--user-id", type=str, help="Run for specific User ID")
    parser.add_argument("--manager", action="store_true", help="Run in Multi-Tenant Manager mode")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--live", action="store_true", help="Enable LIVE trading (real money!)")

    args = parser.parse_args()

    # Also check environment variable for live mode
    live_mode = args.live or os.getenv("LIVE_TRADING", "").lower() in ("true", "1", "yes")

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.manager:
        logger.info("🔵 Starting Bot Manager Service...")
        manager = BotManager()

        # Handle shutdown for manager
        loop = asyncio.get_running_loop()
        def signal_handler():
            logger.info("Manager shutdown signal received")
            manager.stop()

        for sig in (signal.SIGINT, signal.SIGTERM):
            loop.add_signal_handler(sig, signal_handler)

        await manager.run()

    else:
        await run_single_instance(user_id=args.user_id, live_mode=live_mode)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
