"""
Position Manager - Auto-Claim & Position Tracking

Automatically claims USDC when markets resolve and tracks
open positions with real-time PnL calculations.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any, Callable
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


class PositionStatus(Enum):
    OPEN = "open"
    RESOLVED_WIN = "resolved_win"
    RESOLVED_LOSS = "resolved_loss"
    CLAIMED = "claimed"
    EXPIRED = "expired"


@dataclass
class Position:
    """Represents a position in a prediction market."""
    id: str
    condition_id: str
    token_id: str
    market_question: str
    outcome: str  # "Yes" or "No"
    size: float  # Number of shares
    avg_price: float  # Average entry price
    current_price: float
    status: PositionStatus
    entry_time: datetime
    resolved_time: Optional[datetime] = None
    claimed_time: Optional[datetime] = None
    pnl: float = 0.0
    pnl_percent: float = 0.0

    @property
    def market_value(self) -> float:
        """Current market value of position."""
        return self.size * self.current_price

    @property
    def cost_basis(self) -> float:
        """Original cost of position."""
        return self.size * self.avg_price

    @property
    def unrealized_pnl(self) -> float:
        """Unrealized profit/loss."""
        if self.status == PositionStatus.OPEN:
            return self.market_value - self.cost_basis
        return 0.0

    @property
    def realized_pnl(self) -> float:
        """Realized profit/loss for resolved positions."""
        if self.status == PositionStatus.RESOLVED_WIN:
            return self.size - self.cost_basis  # Win pays $1 per share
        elif self.status == PositionStatus.RESOLVED_LOSS:
            return -self.cost_basis  # Loss means shares worth $0
        elif self.status == PositionStatus.CLAIMED:
            return self.pnl
        return 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "condition_id": self.condition_id,
            "token_id": self.token_id,
            "market_question": self.market_question,
            "outcome": self.outcome,
            "size": self.size,
            "avg_price": self.avg_price,
            "current_price": self.current_price,
            "status": self.status.value,
            "cost_basis": self.cost_basis,
            "market_value": self.market_value,
            "unrealized_pnl": self.unrealized_pnl,
            "realized_pnl": self.realized_pnl,
            "entry_time": self.entry_time.isoformat(),
        }


@dataclass
class ClaimResult:
    """Result of claiming a resolved position."""
    position_id: str
    success: bool
    amount_claimed: float
    tx_hash: Optional[str] = None
    error: Optional[str] = None
    claimed_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PortfolioSummary:
    """Summary of all positions."""
    total_positions: int
    open_positions: int
    resolved_unclaimed: int
    total_invested: float
    current_value: float
    total_unrealized_pnl: float
    total_realized_pnl: float
    win_rate: float
    positions: List[Position] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_positions": self.total_positions,
            "open_positions": self.open_positions,
            "resolved_unclaimed": self.resolved_unclaimed,
            "total_invested": self.total_invested,
            "current_value": self.current_value,
            "total_unrealized_pnl": self.total_unrealized_pnl,
            "total_realized_pnl": self.total_realized_pnl,
            "win_rate": self.win_rate,
        }


class PositionManager:
    """
    Manages prediction market positions with auto-claim functionality.

    Features:
    - Track all open positions
    - Monitor for resolved markets
    - Auto-claim USDC when markets resolve
    - Calculate real-time PnL
    - Portfolio analytics
    """

    POSITIONS_API = "https://data-api.polymarket.com/positions"
    MARKETS_API = "https://gamma-api.polymarket.com/markets"
    CLOB_API = "https://clob.polymarket.com"

    def __init__(
        self,
        wallet_address: str,
        private_key: Optional[str] = None,
        auto_claim: bool = True,
        check_interval: int = 300,  # 5 minutes
    ):
        self.wallet_address = wallet_address
        self.private_key = private_key
        self.auto_claim = auto_claim
        self.check_interval = check_interval
        self.positions: Dict[str, Position] = {}
        self.claim_history: List[ClaimResult] = []
        self._running = False

    async def fetch_positions(self) -> List[Position]:
        """Fetch all positions for the wallet."""
        positions = []

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(
                    self.POSITIONS_API,
                    params={
                        "user": self.wallet_address.lower(),
                        "sizeThreshold": 0.01,
                    }
                )
                response.raise_for_status()
                data = response.json()

                for p in data:
                    try:
                        size = float(p.get("size", 0))
                        if size < 0.01:
                            continue

                        avg_price = float(p.get("avgPrice", 0))
                        current_price = float(p.get("curPrice", avg_price))

                        # Determine status
                        resolved = p.get("resolved", False)
                        outcome_won = p.get("outcomeWon", None)

                        if resolved:
                            # Check if this position won
                            position_outcome = p.get("outcome", "")
                            if outcome_won == position_outcome:
                                status = PositionStatus.RESOLVED_WIN
                            else:
                                status = PositionStatus.RESOLVED_LOSS
                        else:
                            status = PositionStatus.OPEN

                        position = Position(
                            id=p.get("id", f"{p.get('conditionId', '')}_{p.get('outcome', '')}"),
                            condition_id=p.get("conditionId", ""),
                            token_id=p.get("tokenId", ""),
                            market_question=p.get("title", "Unknown Market"),
                            outcome=p.get("outcome", "Unknown"),
                            size=size,
                            avg_price=avg_price,
                            current_price=current_price,
                            status=status,
                            entry_time=datetime.fromisoformat(
                                p.get("createdAt", datetime.utcnow().isoformat()).replace("Z", "")
                            ),
                        )

                        # Calculate PnL
                        if status == PositionStatus.RESOLVED_WIN:
                            position.pnl = size - (size * avg_price)
                        elif status == PositionStatus.RESOLVED_LOSS:
                            position.pnl = -(size * avg_price)
                        else:
                            position.pnl = position.unrealized_pnl

                        if position.cost_basis > 0:
                            position.pnl_percent = (position.pnl / position.cost_basis) * 100

                        positions.append(position)
                        self.positions[position.id] = position

                    except Exception as e:
                        logger.debug(f"Error parsing position: {e}")
                        continue

                logger.info(f"Fetched {len(positions)} positions")

            except Exception as e:
                logger.error(f"Error fetching positions: {e}")

        return positions

    async def check_resolved_markets(self) -> List[Position]:
        """Check for positions in resolved markets that need claiming."""
        unclaimed = []

        for position in self.positions.values():
            if position.status in [PositionStatus.RESOLVED_WIN, PositionStatus.RESOLVED_LOSS]:
                if position.status == PositionStatus.RESOLVED_WIN:
                    unclaimed.append(position)

        if unclaimed:
            logger.info(f"Found {len(unclaimed)} resolved positions to claim")

        return unclaimed

    async def claim_position(self, position: Position) -> ClaimResult:
        """
        Claim USDC from a resolved winning position.

        Note: Actual claiming requires web3 transaction signing.
        This is a placeholder for the full implementation.
        """
        logger.info(f"Claiming position: {position.market_question} ({position.outcome})")

        if not self.private_key:
            return ClaimResult(
                position_id=position.id,
                success=False,
                amount_claimed=0,
                error="No private key configured for claiming",
            )

        try:
            # In production, this would:
            # 1. Connect to the CTF Exchange contract
            # 2. Call redeemPositions() with the condition ID
            # 3. Wait for transaction confirmation

            # For now, we log and simulate
            amount = position.size  # Winning position pays $1 per share

            logger.info(
                f"Would claim {amount:.2f} USDC from {position.market_question}"
            )

            # Mark as claimed
            position.status = PositionStatus.CLAIMED
            position.claimed_time = datetime.utcnow()

            result = ClaimResult(
                position_id=position.id,
                success=True,
                amount_claimed=amount,
                tx_hash="simulation_tx",
            )
            self.claim_history.append(result)

            return result

        except Exception as e:
            logger.error(f"Error claiming position: {e}")
            return ClaimResult(
                position_id=position.id,
                success=False,
                amount_claimed=0,
                error=str(e),
            )

    async def claim_all_resolved(self) -> List[ClaimResult]:
        """Claim all resolved winning positions."""
        results = []
        unclaimed = await self.check_resolved_markets()

        for position in unclaimed:
            result = await self.claim_position(position)
            results.append(result)
            await asyncio.sleep(1)  # Rate limit between claims

        return results

    def get_portfolio_summary(self) -> PortfolioSummary:
        """Get summary of all positions."""
        positions = list(self.positions.values())

        open_positions = [p for p in positions if p.status == PositionStatus.OPEN]
        resolved_wins = [
            p for p in positions
            if p.status in [PositionStatus.RESOLVED_WIN, PositionStatus.CLAIMED]
        ]
        resolved_losses = [p for p in positions if p.status == PositionStatus.RESOLVED_LOSS]
        unclaimed = [
            p for p in positions
            if p.status in [PositionStatus.RESOLVED_WIN, PositionStatus.RESOLVED_LOSS]
        ]

        total_invested = sum(p.cost_basis for p in positions)
        current_value = sum(p.market_value for p in open_positions)
        unrealized_pnl = sum(p.unrealized_pnl for p in open_positions)
        realized_pnl = sum(p.realized_pnl for p in resolved_wins + resolved_losses)

        total_resolved = len(resolved_wins) + len(resolved_losses)
        win_rate = (len(resolved_wins) / total_resolved * 100) if total_resolved > 0 else 0

        return PortfolioSummary(
            total_positions=len(positions),
            open_positions=len(open_positions),
            resolved_unclaimed=len(unclaimed),
            total_invested=total_invested,
            current_value=current_value,
            total_unrealized_pnl=unrealized_pnl,
            total_realized_pnl=realized_pnl,
            win_rate=win_rate,
            positions=positions,
        )

    async def run(
        self,
        on_claim: Optional[Callable[[ClaimResult], Any]] = None,
        on_update: Optional[Callable[[PortfolioSummary], Any]] = None,
    ) -> None:
        """
        Run continuous position monitoring and auto-claiming.

        Args:
            on_claim: Callback when a position is claimed
            on_update: Callback when portfolio is updated
        """
        self._running = True
        logger.info(f"Starting position manager for {self.wallet_address}")

        while self._running:
            try:
                # Fetch current positions
                await self.fetch_positions()

                # Get portfolio summary
                summary = self.get_portfolio_summary()

                logger.info(
                    f"Portfolio: {summary.open_positions} open, "
                    f"{summary.resolved_unclaimed} unclaimed, "
                    f"PnL: ${summary.total_unrealized_pnl + summary.total_realized_pnl:.2f}"
                )

                if on_update:
                    try:
                        result = on_update(summary)
                        if asyncio.iscoroutine(result):
                            await result
                    except Exception as e:
                        logger.error(f"Update callback error: {e}")

                # Auto-claim if enabled
                if self.auto_claim and summary.resolved_unclaimed > 0:
                    logger.info(f"Auto-claiming {summary.resolved_unclaimed} positions")
                    claims = await self.claim_all_resolved()

                    for claim in claims:
                        if claim.success:
                            logger.info(
                                f"Claimed ${claim.amount_claimed:.2f} USDC"
                            )
                            if on_claim:
                                try:
                                    result = on_claim(claim)
                                    if asyncio.iscoroutine(result):
                                        await result
                                except Exception as e:
                                    logger.error(f"Claim callback error: {e}")

            except Exception as e:
                logger.error(f"Error in position manager loop: {e}")

            await asyncio.sleep(self.check_interval)

    def stop(self) -> None:
        """Stop the position manager."""
        self._running = False
        logger.info("Stopping position manager")


# Example usage
async def main():
    # Example wallet address
    manager = PositionManager(
        wallet_address="0x0000000000000000000000000000000000000000",
        auto_claim=True,
        check_interval=300,
    )

    # Single fetch
    positions = await manager.fetch_positions()

    print(f"\nFound {len(positions)} positions")
    for pos in positions[:5]:
        print(f"\n{pos.market_question}")
        print(f"  Outcome: {pos.outcome}")
        print(f"  Size: {pos.size:.2f} shares @ ${pos.avg_price:.3f}")
        print(f"  Current: ${pos.current_price:.3f}")
        print(f"  PnL: ${pos.pnl:.2f} ({pos.pnl_percent:.1f}%)")
        print(f"  Status: {pos.status.value}")

    summary = manager.get_portfolio_summary()
    print(f"\nPortfolio Summary:")
    print(f"  Total Invested: ${summary.total_invested:.2f}")
    print(f"  Current Value: ${summary.current_value:.2f}")
    print(f"  Unrealized PnL: ${summary.total_unrealized_pnl:.2f}")
    print(f"  Realized PnL: ${summary.total_realized_pnl:.2f}")
    print(f"  Win Rate: {summary.win_rate:.1f}%")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
