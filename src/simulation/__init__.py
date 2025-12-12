"""
Simulation module for PolyBot paper trading.
"""

from .paper_trader_realistic import RealisticPaperTrader as PaperTrader, RealisticStats as PaperTradingStats, SimulatedTrade as SimulatedPosition

__all__ = ["PaperTrader", "PaperTradingStats", "SimulatedPosition"]
