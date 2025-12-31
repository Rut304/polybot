"""
Exchange integration layer for PolyBot.
Provides unified access to crypto and stock exchanges.
"""

from .ccxt_client import CCXTClient
from .alpaca_client import AlpacaClient
from .ibkr_client import IBKRClient
from .ibkr_web_client import IBKRWebClient
from .base import BaseExchange

# Optional imports - these require additional dependencies
try:
    from .robinhood_client import RobinhoodClient
except ImportError:
    RobinhoodClient = None  # robin_stocks not installed

try:
    from .webull_client import WebullClient
except ImportError:
    WebullClient = None  # webull not installed

__all__ = [
    'CCXTClient',
    'AlpacaClient',
    'IBKRClient',
    'IBKRWebClient',
    'BaseExchange',
    'RobinhoodClient',
    'WebullClient'
]
