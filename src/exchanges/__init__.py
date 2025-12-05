"""
Exchange integration layer for PolyBot.
Provides unified access to crypto and stock exchanges via CCXT and Alpaca.
"""

from .ccxt_client import CCXTClient
from .alpaca_client import AlpacaClient
from .base import BaseExchange

__all__ = ['CCXTClient', 'AlpacaClient', 'BaseExchange']
