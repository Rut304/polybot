import abc
import logging

logger = logging.getLogger(__name__)

from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any

class SignalType(Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    NEUTRAL = "NEUTRAL"
    LIQUIDATE = "LIQUIDATE"

@dataclass
class StrategySignal:
    type: SignalType
    symbol: str
    weight: float = 1.0
    reason: str = ""
    metadata: Optional[Dict[str, Any]] = None

class BaseStrategy(abc.ABC):
    """
    Abstract base class for all strategies.
    Ensures consistent interface for the BotRunner.
    """
    
    def __init__(self):
        self.running = False
        self.enabled = False

    @abc.abstractmethod
    async def start(self):
        """Start the strategy loop."""
        pass

    @abc.abstractmethod
    async def stop(self):
        """Stop the strategy loop."""
        pass
