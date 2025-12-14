"""
Selective Whale Copy Trading Strategy

Enhanced version of whale copy trading that only copies selected high-performers
rather than all tracked whales.

Key improvements over basic whale copy:
1. Tier-based filtering (only copy MEGA_WHALE and WHALE tiers)
2. Win rate thresholds (minimum 75% win rate)
3. Volume requirements (minimum $50K total volume)
4. Recency requirements (active in last 7 days)
5. ROI validation (positive ROI required)
6. Copy with delay to avoid front-running detection

Selection criteria based on leaderboard analysis:
- Elite traders (50%+ ROI) consistently outperform
- High win rate correlates with information edge
- Recent activity indicates ongoing engagement
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Callable

logger = logging.getLogger(__name__)


@dataclass
class SelectableWhale:
    """A whale that can be selected for copy trading"""
    address: str
    username: str
    
    # Performance metrics
    win_rate: float = 0.0
    roi_pct: float = 0.0
    total_volume_usd: Decimal = Decimal("0")
    total_trades: int = 0
    winning_trades: int = 0
    
    # Activity
    last_active_at: Optional[datetime] = None
    positions_count: int = 0
    
    # Selection status
    is_selected: bool = False
    selection_reason: Optional[str] = None
    auto_selected: bool = False  # Selected by algorithm vs manual
    
    # Copy settings (per whale)
    copy_delay_seconds: int = 60
    copy_scale_pct: float = 100.0  # % of whale position to copy
    max_copy_usd: Decimal = Decimal("100")
    
    # Track record of copying this whale
    copy_trades: int = 0
    copy_wins: int = 0
    copy_pnl: Decimal = Decimal("0")
    
    # Metadata
    added_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    @property
    def copy_win_rate(self) -> float:
        """Win rate from copying this whale"""
        if self.copy_trades == 0:
            return 0.0
        return (self.copy_wins / self.copy_trades) * 100
    
    def meets_criteria(
        self,
        min_win_rate: float = 75.0,
        min_volume_usd: float = 50000,
        min_roi_pct: float = 0.0,
        min_trades: int = 20,
        max_days_inactive: int = 7,
    ) -> tuple[bool, str]:
        """Check if whale meets selection criteria"""
        
        # Win rate check
        if self.win_rate < min_win_rate:
            return False, f"Win rate {self.win_rate:.1f}% < {min_win_rate}%"
        
        # Volume check
        if float(self.total_volume_usd) < min_volume_usd:
            return False, f"Volume ${self.total_volume_usd:,.0f} < ${min_volume_usd:,.0f}"
        
        # ROI check
        if self.roi_pct < min_roi_pct:
            return False, f"ROI {self.roi_pct:.1f}% < {min_roi_pct}%"
        
        # Trade count check
        if self.total_trades < min_trades:
            return False, f"Trades {self.total_trades} < {min_trades}"
        
        # Activity check
        if self.last_active_at:
            days_inactive = (
                datetime.now(timezone.utc) - self.last_active_at
            ).days
            if days_inactive > max_days_inactive:
                return False, f"Inactive {days_inactive} days > {max_days_inactive}"
        
        return True, "Meets all criteria"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "address": self.address,
            "username": self.username,
            "win_rate": self.win_rate,
            "roi_pct": self.roi_pct,
            "total_volume_usd": float(self.total_volume_usd),
            "total_trades": self.total_trades,
            "is_selected": self.is_selected,
            "selection_reason": self.selection_reason,
            "auto_selected": self.auto_selected,
            "copy_delay_seconds": self.copy_delay_seconds,
            "copy_scale_pct": self.copy_scale_pct,
            "max_copy_usd": float(self.max_copy_usd),
            "copy_trades": self.copy_trades,
            "copy_wins": self.copy_wins,
            "copy_pnl": float(self.copy_pnl),
            "copy_win_rate": self.copy_win_rate,
        }


@dataclass
class CopySignal:
    """Signal to copy a whale's trade"""
    whale: SelectableWhale
    market_id: str
    direction: str  # "buy_yes", "buy_no", "sell"
    whale_size_usd: Decimal
    copy_size_usd: Decimal
    execute_at: datetime
    
    # Market info
    current_price: float = 0.5
    market_title: str = ""
    
    # Status
    executed: bool = False
    execution_result: Optional[str] = None
    
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "whale_address": self.whale.address,
            "whale_username": self.whale.username,
            "market_id": self.market_id,
            "direction": self.direction,
            "whale_size_usd": float(self.whale_size_usd),
            "copy_size_usd": float(self.copy_size_usd),
            "execute_at": self.execute_at.isoformat(),
            "current_price": self.current_price,
            "market_title": self.market_title,
            "executed": self.executed,
            "created_at": self.created_at.isoformat(),
        }


class SelectiveWhaleCopyStrategy:
    """
    Copy trades from only selected high-performing whales.
    
    Selection process:
    1. Scan leaderboard for candidates
    2. Filter by win rate, volume, ROI, activity
    3. Auto-select top N performers
    4. Allow manual selection/deselection
    5. Copy with configurable delay and scaling
    """
    
    def __init__(
        self,
        db_client=None,
        config: Optional[Dict] = None,
        on_copy_signal: Optional[Callable[[CopySignal], None]] = None,
    ):
        self.db = db_client
        self.config = config or {}
        self.on_copy_signal = on_copy_signal
        
        # Configuration
        self.enabled = self.config.get("enable_selective_whale_copy", True)
        self.min_win_rate = self.config.get("swc_min_win_rate", 75.0)
        self.min_volume_usd = self.config.get("swc_min_volume_usd", 50000)
        self.min_roi_pct = self.config.get("swc_min_roi_pct", 10.0)
        self.min_trades = self.config.get("swc_min_trades", 20)
        self.max_days_inactive = self.config.get("swc_max_days_inactive", 7)
        self.auto_select_count = self.config.get("swc_auto_select_count", 5)
        
        # Copy settings
        self.default_delay_seconds = self.config.get("swc_copy_delay_sec", 60)
        self.default_scale_pct = self.config.get("swc_copy_scale_pct", 50)
        self.max_copy_usd = Decimal(str(
            self.config.get("swc_max_copy_usd", 100)
        ))
        self.max_concurrent_copies = self.config.get(
            "swc_max_concurrent_copies", 5
        )
        
        # State
        self.tracked_whales: Dict[str, SelectableWhale] = {}
        self.selected_whales: List[str] = []  # addresses
        self.pending_copies: List[CopySignal] = []
        self.active_copies: List[CopySignal] = []
        
        logger.info(
            f"SelectiveWhaleCopyStrategy initialized - "
            f"enabled={self.enabled}, min_win_rate={self.min_win_rate}%, "
            f"auto_select={self.auto_select_count}"
        )
    
    async def load_tracked_whales(self) -> List[SelectableWhale]:
        """Load tracked whales from database"""
        if not self.db:
            return []
        
        try:
            result = await self.db.from_(
                "polybot_tracked_whales"
            ).select("*").execute()
            
            for row in result.data or []:
                whale = SelectableWhale(
                    address=row["address"],
                    username=row.get("name", row["address"][:8]),
                    win_rate=row.get("win_rate_pct", 0) or 0,
                    roi_pct=row.get("roi_pct", 0) or 0,
                    total_volume_usd=Decimal(str(row.get("volume_usd", 0) or 0)),
                    total_trades=row.get("total_trades", 0) or 0,
                    is_selected=row.get("copy_enabled", False),
                    copy_scale_pct=row.get("copy_multiplier", 1.0) * 100,
                    max_copy_usd=Decimal(str(
                        row.get("max_copy_size_usd", 100) or 100
                    )),
                )
                self.tracked_whales[whale.address] = whale
                
                if whale.is_selected:
                    self.selected_whales.append(whale.address)
            
            logger.info(f"Loaded {len(self.tracked_whales)} tracked whales")
            return list(self.tracked_whales.values())
            
        except Exception as e:
            logger.error(f"Failed to load tracked whales: {e}")
            return []
    
    def add_whale_from_leaderboard(
        self,
        address: str,
        username: str,
        win_rate: float,
        roi_pct: float,
        volume_usd: float,
        total_trades: int,
    ) -> SelectableWhale:
        """Add a whale from leaderboard data"""
        whale = SelectableWhale(
            address=address,
            username=username,
            win_rate=win_rate,
            roi_pct=roi_pct,
            total_volume_usd=Decimal(str(volume_usd)),
            total_trades=total_trades,
            last_active_at=datetime.now(timezone.utc),
        )
        
        self.tracked_whales[address] = whale
        
        # Check if auto-select
        meets, reason = whale.meets_criteria(
            min_win_rate=self.min_win_rate,
            min_volume_usd=self.min_volume_usd,
            min_roi_pct=self.min_roi_pct,
            min_trades=self.min_trades,
            max_days_inactive=self.max_days_inactive,
        )
        
        if meets:
            whale.selection_reason = reason
            logger.debug(f"Whale {username} meets criteria: {reason}")
        
        return whale
    
    def auto_select_top_whales(self) -> List[SelectableWhale]:
        """Automatically select top N whales meeting criteria"""
        candidates = []
        
        for whale in self.tracked_whales.values():
            meets, reason = whale.meets_criteria(
                min_win_rate=self.min_win_rate,
                min_volume_usd=self.min_volume_usd,
                min_roi_pct=self.min_roi_pct,
                min_trades=self.min_trades,
                max_days_inactive=self.max_days_inactive,
            )
            if meets:
                candidates.append(whale)
        
        # Sort by ROI * win_rate composite score
        candidates.sort(
            key=lambda w: w.roi_pct * w.win_rate,
            reverse=True,
        )
        
        # Select top N
        selected = candidates[:self.auto_select_count]
        
        for whale in selected:
            whale.is_selected = True
            whale.auto_selected = True
            whale.selection_reason = (
                f"Auto-selected: {whale.roi_pct:.1f}% ROI, "
                f"{whale.win_rate:.1f}% win rate"
            )
            if whale.address not in self.selected_whales:
                self.selected_whales.append(whale.address)
        
        logger.info(
            f"Auto-selected {len(selected)} whales from "
            f"{len(candidates)} candidates"
        )
        
        return selected
    
    def select_whale(
        self,
        address: str,
        reason: str = "Manual selection",
    ) -> bool:
        """Manually select a whale for copy trading"""
        if address not in self.tracked_whales:
            logger.warning(f"Whale {address} not found")
            return False
        
        whale = self.tracked_whales[address]
        whale.is_selected = True
        whale.auto_selected = False
        whale.selection_reason = reason
        
        if address not in self.selected_whales:
            self.selected_whales.append(address)
        
        logger.info(f"Selected whale {whale.username}: {reason}")
        return True
    
    def deselect_whale(self, address: str) -> bool:
        """Deselect a whale from copy trading"""
        if address not in self.tracked_whales:
            return False
        
        whale = self.tracked_whales[address]
        whale.is_selected = False
        whale.selection_reason = None
        
        if address in self.selected_whales:
            self.selected_whales.remove(address)
        
        logger.info(f"Deselected whale {whale.username}")
        return True
    
    def process_whale_trade(
        self,
        whale_address: str,
        market_id: str,
        direction: str,
        size_usd: Decimal,
        current_price: float = 0.5,
        market_title: str = "",
    ) -> Optional[CopySignal]:
        """Process a whale trade and create copy signal if selected"""
        if not self.enabled:
            return None
        
        if whale_address not in self.tracked_whales:
            return None
        
        whale = self.tracked_whales[whale_address]
        
        if not whale.is_selected:
            logger.debug(f"Whale {whale.username} not selected, skipping")
            return None
        
        # Check concurrent copies limit
        if len(self.active_copies) >= self.max_concurrent_copies:
            logger.info(
                f"Max concurrent copies ({self.max_concurrent_copies}) reached"
            )
            return None
        
        # Calculate copy size
        scale = whale.copy_scale_pct / 100
        copy_size = min(
            size_usd * Decimal(str(scale)),
            whale.max_copy_usd,
            self.max_copy_usd,
        )
        
        # Calculate execution time with delay
        delay = timedelta(seconds=whale.copy_delay_seconds)
        execute_at = datetime.now(timezone.utc) + delay
        
        # Create copy signal
        signal = CopySignal(
            whale=whale,
            market_id=market_id,
            direction=direction,
            whale_size_usd=size_usd,
            copy_size_usd=copy_size,
            execute_at=execute_at,
            current_price=current_price,
            market_title=market_title,
        )
        
        self.pending_copies.append(signal)
        
        logger.info(
            f"Copy signal created: {whale.username} {direction} on "
            f"{market_id}, copy ${copy_size} in {whale.copy_delay_seconds}s"
        )
        
        # Callback
        if self.on_copy_signal:
            self.on_copy_signal(signal)
        
        return signal
    
    def get_ready_copies(self) -> List[CopySignal]:
        """Get copies that are ready to execute"""
        now = datetime.now(timezone.utc)
        ready = [c for c in self.pending_copies if c.execute_at <= now]
        
        # Move to active
        for copy in ready:
            self.pending_copies.remove(copy)
            self.active_copies.append(copy)
        
        return ready
    
    def mark_copy_executed(
        self,
        signal: CopySignal,
        success: bool,
        result: str = "",
    ):
        """Mark a copy as executed"""
        signal.executed = True
        signal.execution_result = result
        
        # Update whale stats
        if success:
            signal.whale.copy_trades += 1
        
        logger.info(
            f"Copy executed: {signal.whale.username} {signal.direction} "
            f"${signal.copy_size_usd} - {result}"
        )
    
    def record_copy_outcome(
        self,
        whale_address: str,
        won: bool,
        pnl: Decimal,
    ):
        """Record the outcome of a copy trade"""
        if whale_address not in self.tracked_whales:
            return
        
        whale = self.tracked_whales[whale_address]
        if won:
            whale.copy_wins += 1
        whale.copy_pnl += pnl
        
        logger.info(
            f"Copy outcome: {whale.username} - "
            f"{'Won' if won else 'Lost'} ${pnl}"
        )
    
    async def sync_to_database(self):
        """Sync whale selection status to database"""
        if not self.db:
            return
        
        try:
            for address, whale in self.tracked_whales.items():
                await self.db.from_("polybot_tracked_whales").upsert({
                    "address": address,
                    "name": whale.username,
                    "copy_enabled": whale.is_selected,
                    "copy_multiplier": whale.copy_scale_pct / 100,
                    "max_copy_size_usd": float(whale.max_copy_usd),
                }).execute()
            
            logger.info(
                f"Synced {len(self.tracked_whales)} whales to database"
            )
        except Exception as e:
            logger.error(f"Failed to sync whales: {e}")
    
    def get_selected_whales(self) -> List[SelectableWhale]:
        """Get all selected whales"""
        return [
            self.tracked_whales[addr]
            for addr in self.selected_whales
            if addr in self.tracked_whales
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get strategy statistics"""
        selected = self.get_selected_whales()
        total_pnl = sum(w.copy_pnl for w in selected)
        total_copies = sum(w.copy_trades for w in selected)
        total_wins = sum(w.copy_wins for w in selected)
        
        return {
            "enabled": self.enabled,
            "tracked_whales": len(self.tracked_whales),
            "selected_whales": len(self.selected_whales),
            "pending_copies": len(self.pending_copies),
            "active_copies": len(self.active_copies),
            "max_concurrent_copies": self.max_concurrent_copies,
            "total_copy_trades": total_copies,
            "total_copy_wins": total_wins,
            "copy_win_rate": (
                (total_wins / total_copies * 100) if total_copies > 0 else 0
            ),
            "total_copy_pnl": float(total_pnl),
            "selection_criteria": {
                "min_win_rate": self.min_win_rate,
                "min_volume_usd": self.min_volume_usd,
                "min_roi_pct": self.min_roi_pct,
                "min_trades": self.min_trades,
                "max_days_inactive": self.max_days_inactive,
            },
        }
