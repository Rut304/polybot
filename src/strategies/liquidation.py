import logging
import asyncio
from typing import Dict, List, Optional
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime, timezone

from src.strategies.base_strategy import BaseStrategy
from src.exchanges.polymarket_client import PolymarketClient
from src.db.client import SupabaseClient

logger = logging.getLogger(__name__)

@dataclass
class LiquidationConfig:
    min_price: float = 0.98  # Sell if price > 98c
    min_days_to_expiry: int = 2  # Only if expiry is > 2 days away
    max_slippage: float = 0.01
    enabled: bool = False

class PolymarketLiquidationStrategy(BaseStrategy):
    """
    Polymarket Liquidation Bot (Capital Recycling).
    
    Scans for owned positions that are trading near $1.00 (winning)
    or near $0.00 (losing) and liquidates them early to free up capital
    if the IRR of selling now > holding to expiry.
    
    Primary use case:
    - You bought YES at 0.50.
    - Price is now 0.99.
    - Expiry is in 2 weeks.
    - Sell now at 0.99 to reinvest the capital immediately rather than 
      checking 1% yield over 2 weeks (26% APY).
    """
    
    def __init__(
        self,
        polymarket_client: PolymarketClient,
        db_client: SupabaseClient,
        min_price: float = 0.98,
        min_days_to_expiry: int = 2,
        scan_interval_seconds: int = 3600,
    ):
        self.poly = polymarket_client
        self.db = db_client
        self.config = LiquidationConfig(
            min_price=min_price,
            min_days_to_expiry=min_days_to_expiry
        )
        self.scan_interval = scan_interval_seconds
        self.running = False
        self.enabled = True

    async def start(self):
        self.running = True
        logger.info(f"Capital Recycling Bot started (Threshold: ${self.config.min_price})")
        while self.running:
            if self.enabled:
                try:
                    await self.recycle_capital()
                except Exception as e:
                    logger.error(f"Error in capital recycling: {e}")
            
            await asyncio.sleep(self.scan_interval)

    async def stop(self):
        self.running = False

    async def recycle_capital(self):
        """Scan positions and liquidate if eligible."""
        logger.info("♻️ Scanning for capital recycling opportunities...")
        
        # 1. Get all positions
        positions = await self.poly.get_portfolio()
        if not positions:
            return
            
        liquidated_count = 0
        
        for pos in positions:
            # Skip if position size is dust
            if float(pos.get('size', 0)) < 1.0:
                continue
                
            market_slug = pos.get('market_slug')
            outcome = pos.get('outcome') # YES/NO
            
            # 2. Check current market price
            # Assuming get_market returns { 'best_bid': ..., 'end_date': ... }
            market = await self.poly.get_market(market_slug)
            if not market:
                continue
                
            current_price = float(market.get(f'{outcome.lower()}_bid', 0))
            end_date_iso = market.get('end_date_iso')
            
            if not end_date_iso:
                continue
                
            # Calculate days to expiry
            try:
                end_dt = datetime.fromisoformat(end_date_iso.replace('Z', '+00:00'))
                days_to_expiry = (end_dt - datetime.now(timezone.utc)).days
            except:
                days_to_expiry = 0
                
            # 3. Evaluate Logic
            # Condition A: Price is very high (Winning) and expiry is far
            should_sell = False
            reason = ""
            
            if current_price >= self.config.min_price and days_to_expiry >= self.config.min_days_to_expiry:
                should_sell = True
                reason = f"High probability ({current_price:.2f}) with {days_to_expiry}d lockup"
                
            if should_sell:
                logger.info(f"💰 LIQUIDATING {market_slug} ({outcome}): {reason}")
                
                # Execute Sell
                # await self.poly.create_order(...)
                # For now, just log opportunity since execution needs safety checks
                self.db.log_opportunity({
                    "id": f"liquidate_{market_slug}",
                    "strategy": "capital_recycling",
                    "buy_platform": "polymarket_held",
                    "sell_platform": "polymarket_exit",
                    "buy_price": 0.0, # N/A
                    "sell_price": current_price,
                    "profit_percent": 0.0, # Depends on entry, assuming positive IRR choice
                    "buy_market_name": f"Sell {outcome} {market_slug}",
                    "sell_market_name": reason,
                    "detected_at": datetime.now(timezone.utc).isoformat()
                })
                liquidated_count += 1
                
        if liquidated_count > 0:
            logger.info(f"Recycling Pass: Identified {liquidated_count} positions to exit")
