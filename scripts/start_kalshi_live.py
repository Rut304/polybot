#!/usr/bin/env python3
"""
Start PolyBot in LIVE MODE for Kalshi Single Arb only.

This is a focused live trading mode that:
1. Only runs Kalshi single-platform arbitrage
2. Uses real money (your $100 balance)
3. Has safety limits ($25 max per trade)
4. Logs everything for analysis

Usage:
    python scripts/start_kalshi_live.py

CAUTION: This uses REAL MONEY! Start with small amounts.
"""
import os
import sys
import asyncio
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from src.bot_runner import PolybotRunner
from src.logging_handler import setup_database_logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("kalshi_live.log"),
    ]
)
logger = logging.getLogger("kalshi_live")


async def main():
    print("=" * 70)
    print("🔴 KALSHI LIVE TRADING MODE")
    print("=" * 70)
    
    # Verify Kalshi credentials
    api_key = os.getenv("KALSHI_API_KEY")
    key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH", "keys/kalshi_private.pem")
    
    if not api_key or not os.path.exists(key_path):
        print("❌ Missing Kalshi credentials!")
        print(f"   KALSHI_API_KEY: {'✅ Set' if api_key else '❌ Missing'}")
        print(f"   Key file: {'✅ Exists' if os.path.exists(key_path) else '❌ Missing'}")
        return
    
    # Test balance first
    print("\n📊 Checking Kalshi balance...")
    try:
        from src.clients.kalshi_client import KalshiClient
        with open(key_path, 'r') as f:
            private_key = f.read()
        
        client = KalshiClient(api_key=api_key, private_key=private_key)
        result = client.get_balance()
        balance = result.get("balance", 0)
        
        print(f"   💰 Live Balance: ${balance:.2f}")
        
        if balance < 10:
            print("   ⚠️  Balance too low for live trading (< $10)")
            return
    except Exception as e:
        print(f"   ❌ Error checking balance: {e}")
        return
    
    # Confirm with user
    print("\n⚠️  WARNING: LIVE TRADING ENABLED")
    print("   - Max position size: $25 per trade")
    print("   - Strategy: Kalshi Single-Platform Arb")
    print("   - Min profit threshold: 8%")
    print(f"   - Available balance: ${balance:.2f}")
    print()
    
    confirm = input("Type 'START' to begin live trading (Ctrl+C to abort): ")
    if confirm.strip().upper() != "START":
        print("Aborted.")
        return
    
    print("\n🚀 Starting Kalshi Live Trading Bot...")
    
    # Setup logging
    setup_database_logging()
    
    # Override config for safety
    os.environ["KALSHI_SINGLE_MAX_POSITION_USD"] = "25"  # Max $25 per trade
    os.environ["ENABLE_POLYMARKET_SINGLE_ARB"] = "false"  # Disable Polymarket
    os.environ["ENABLE_CROSS_PLATFORM_ARB"] = "false"  # Disable cross-platform
    
    # Create runner in LIVE mode (simulation_mode=False)
    runner = PolybotRunner(
        simulation_mode=False,  # LIVE!
    )
    
    # Override config after init for extra safety
    runner.config.trading.kalshi_single_max_position_usd = 25.0  # Cap at $25
    runner.config.trading.enable_polymarket_single_arb = False
    runner.config.trading.enable_cross_platform_arb = False
    runner.config.trading.enable_kalshi_single_arb = True
    
    logger.info("🔴 LIVE MODE ACTIVE - Kalshi Single Arb Only")
    logger.info(f"💰 Starting balance: ${balance:.2f}")
    logger.info(f"📏 Max position size: $25.00")
    
    try:
        await runner.run()
    except KeyboardInterrupt:
        logger.info("Shutdown requested...")
    finally:
        await runner.shutdown()
        
        # Print final stats
        print("\n" + "=" * 70)
        print("📊 SESSION SUMMARY")
        print("=" * 70)
        
        # Get final balance
        try:
            result = client.get_balance()
            final_balance = result.get("balance", 0)
            pnl = final_balance - balance
            print(f"   Starting balance: ${balance:.2f}")
            print(f"   Final balance: ${final_balance:.2f}")
            print(f"   P&L: ${pnl:+.2f}")
        except:
            print("   Could not fetch final balance")


if __name__ == "__main__":
    asyncio.run(main())
