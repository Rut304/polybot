
import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from decimal import Decimal
from datetime import datetime

from src.strategies.cross_exchange_arb import CrossExchangeArbStrategy, ArbConfig
from src.exchanges.ccxt_client import Ticker

@pytest.mark.asyncio
async def test_arb_detection():
    # Setup
    ex1 = MagicMock()
    ex1.exchange_id = "binance"
    ex1._initialized = True
    ex1.get_ticker = AsyncMock(return_value=Ticker(
        symbol="BTC/USDT",
        bid=99000.0,
        ask=99100.0,
        last=99050.0,
        volume_24h=100.0,
        timestamp=datetime.now()
    ))

    ex2 = MagicMock()
    ex2.exchange_id = "kraken"
    ex2._initialized = True
    ex2.get_ticker = AsyncMock(return_value=Ticker(
        symbol="BTC/USDT",
        bid=100000.0, # High bid!
        ask=100100.0,
        last=100050.0,
        volume_24h=100.0,
        timestamp=datetime.now()
    ))

    # Spread: Buy ex1 @ 99100, Sell ex2 @ 100000.
    # Profit = 900.
    # Percentage = 900 / 99100 ~= 0.9%

    config = ArbConfig(
        min_profit_pct=Decimal("0.5"),
        scan_interval_sec=1,
        symbols=["BTC/USDT"]
    )
    
    opportunities = []
    def on_opp(opp):
        opportunities.append(opp)

    strategy = CrossExchangeArbStrategy(exchanges=[ex1, ex2], config=config, on_opportunity=on_opp)
    
    # Run one scan manually
    await strategy._scan()

    assert len(opportunities) == 1
    opp = opportunities[0]
    assert opp.buy_exchange == "binance"
    assert opp.sell_exchange == "kraken"
    assert opp.buy_price == Decimal("99100.0")
    assert opp.sell_price == Decimal("100000.0")
    assert opp.spread_pct > Decimal("0.8")

@pytest.mark.asyncio
async def test_no_arb_detected():
    # Setup
    ex1 = MagicMock()
    ex1.exchange_id = "binance"
    ex1._initialized = True
    ex1.get_ticker = AsyncMock(return_value=Ticker(
        symbol="BTC/USDT",
        bid=100000.0,
        ask=100100.0,
        last=100050.0,
        volume_24h=100.0,
        timestamp=datetime.now()
    ))

    ex2 = MagicMock()
    ex2.exchange_id = "kraken"
    ex2._initialized = True
    ex2.get_ticker = AsyncMock(return_value=Ticker(
        symbol="BTC/USDT",
        bid=99000.0, 
        ask=99100.0, # Ask is lower, but we buy here?
        # Buy ex2 @ 99100. Sell ex1 @ 100000.
        # Wait, that IS an arb. 
        # let's make them equal.
        last=100050.0,
        volume_24h=100.0,
        timestamp=datetime.now()
    ))
    
    # Reset ex2 to be same as ex1 roughly
    ex2.get_ticker = AsyncMock(return_value=Ticker(
        symbol="BTC/USDT",
        bid=100000.0, 
        ask=100100.0,
        last=100050.0,
        volume_24h=100.0,
        timestamp=datetime.now()
    ))

    config = ArbConfig(min_profit_pct=Decimal("0.5"), symbols=["BTC/USDT"])
    opportunities = []
    
    strategy = CrossExchangeArbStrategy(exchanges=[ex1, ex2], config=config, on_opportunity=lambda x: opportunities.append(x))
    await strategy._scan()

    assert len(opportunities) == 0

@pytest.mark.asyncio
async def test_graceful_failure():
    # Setup
    ex1 = MagicMock()
    ex1.exchange_id = "binance"
    ex1._initialized = True
    ex1.get_ticker = AsyncMock(side_effect=Exception("API Timeout"))

    ex2 = MagicMock()
    ex2.exchange_id = "kraken"
    ex2._initialized = True
    ex2.get_ticker = AsyncMock(return_value=Ticker(
        symbol="BTC/USDT",
        bid=100000.0,
        ask=100100.0,
        last=100050.0,
        volume_24h=100.0,
        timestamp=datetime.now()
    ))
    
    # 3rd exchange to allow arb?
    # If only 2 and one fails, it should return early.
    
    config = ArbConfig(symbols=["BTC/USDT"])
    opportunities = []
    
    strategy = CrossExchangeArbStrategy(exchanges=[ex1, ex2], config=config, on_opportunity=lambda x: opportunities.append(x))
    
    # Should not raise exception
    await strategy._scan()
    
    assert len(opportunities) == 0
