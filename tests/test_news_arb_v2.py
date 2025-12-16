import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime, timezone
import xml.etree.ElementTree as ET
from decimal import Decimal
from src.strategies.news_arbitrage import NewsArbitrageStrategy, RSSMonitor, NewsSource, NewsEvent, PriceSnapshot

# Mock RSS Feed Content
COINDESK_RSS = """
<rss version="2.0">
<channel>
    <item>
        <title>Bitcoin Hits $100k</title>
        <link>https://coindesk.com/btc-100k</link>
        <description>Bitcoin has finally reached the 100k milestone.</description>
        <guid>btc-100k-guid</guid>
    </item>
</channel>
</rss>
"""

POLITICO_RSS = """
<rss version="2.0">
<channel>
    <item>
        <title>Trump Leads in New Poll</title>
        <link>https://politico.com/trump-poll</link>
        <description>New data shows Trump ahead in key states.</description>
        <guid>trump-poll-guid</guid>
    </item>
</channel>
</rss>
"""

@pytest.fixture
def mock_strategy():
    return NewsArbitrageStrategy(
        min_spread_pct=1.0,
        scan_interval_sec=1
    )

@pytest.mark.asyncio
async def test_rss_monitor_poll():
    monitor = RSSMonitor()
    
    # Mock aiohttp.ClientSession
    with patch("aiohttp.ClientSession") as MockSession:
        # Mock the session object returned by ClientSession()
        mock_session = AsyncMock()
        MockSession.return_value.__aenter__.return_value = mock_session
        
        # IMPORTANT: session.get() is synchronous and returns a context manager
        # We must explicitly set it to MagicMock to prevent it being an AsyncMock (coroutine)
        mock_session.get = MagicMock() 
        
        # Mock the response object
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.text.side_effect = [COINDESK_RSS, POLITICO_RSS]
        
        # Connect session.get() to return the context manager
        mock_get_ctx = AsyncMock()
        mock_get_ctx.__aenter__.return_value = mock_response
        mock_session.get.return_value = mock_get_ctx
        
        events = await monitor.poll()
        
        assert len(events) == 2
        assert any(e.headline == "Bitcoin Hits $100k" for e in events)
        assert any(e.headline == "Trump Leads in New Poll" for e in events)
        assert any("bitcoin" in str(e.keywords) for e in events if "Bitcoin" in e.headline)
        assert any("trump" in str(e.keywords) for e in events if "Trump" in e.headline)

@pytest.mark.asyncio
async def test_check_price_divergence(mock_strategy):
    # Mock price snapshots using Decimals
    poly_snapshot = PriceSnapshot(
        platform="polymarket", market_id="1", market_name="Test",
        yes_price=Decimal("0.6"), no_price=Decimal("0.4"), volume_24h=1000,
        timestamp=datetime.now(timezone.utc)
    )
    
    kalshi_snapshot = PriceSnapshot(
        platform="kalshi", market_id="2", market_name="Test",
        yes_price=Decimal("0.4"), no_price=Decimal("0.6"), volume_24h=1000,
        timestamp=datetime.now(timezone.utc)
    )
    
    # Mock _get_polymarket_price and _get_kalshi_price
    mock_strategy._get_polymarket_price = AsyncMock(return_value=poly_snapshot)
    mock_strategy._get_kalshi_price = AsyncMock(return_value=kalshi_snapshot)
    
    opp = await mock_strategy.check_price_divergence("test topic")
    
    assert opp is not None
    assert opp.direction == "buy_kalshi" # Poly 0.6YES, Kalshi 0.4YES -> Buy Kalshi (cheaper)
    # Price difference is 0.2. Base is 0.4. Spread% = (0.2/0.4)*100 = 50%
    assert abs(float(opp.spread_pct) - 50.0) < 0.0001
    assert opp.confidence > 0

@pytest.mark.asyncio
async def test_scan_for_events_integration(mock_strategy):
    # Mock RSS Monitor
    mock_strategy.rss_monitor.poll = AsyncMock(return_value=[
        NewsEvent(
            source=NewsSource.REUTERS,
            headline="Bitcoin Approval Imminent",
            keywords=["bitcoin"],
            detected_at=datetime.now(timezone.utc)
        )
    ])
    
    # Mock Volume Check
    mock_strategy._check_polymarket_volume_spikes = AsyncMock(return_value=[])
    
    events = await mock_strategy.scan_for_events()
    
    assert len(events) == 1
    assert events[0].headline == "Bitcoin Approval Imminent"
    assert mock_strategy.stats.events_detected == 1
