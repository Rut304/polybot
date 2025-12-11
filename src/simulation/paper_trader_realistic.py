"""
Realistic Paper Trading Simulator for PolyBot

Simulates real trading conditions including:
- Slippage (prices move before you can execute)
- Spread costs (bid-ask spreads eat into profits)
- Execution failures (opportunities disappear)
- Partial fills (can't always get full size)
- Platform fees (Polymarket/Kalshi fees)
- Market resolution risk (markets can resolve against you)
- Time decay and opportunity expiration
- FALSE POSITIVE DETECTION - rejects unrealistic "opportunities"
"""

import json
import random
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_DOWN
from enum import Enum
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class TradeOutcome(Enum):
    """Possible outcomes for simulated trades"""
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    FAILED_EXECUTION = "failed_execution"
    PARTIAL_FILL = "partial_fill"
    EXPIRED = "expired"
    REJECTED_FALSE_POSITIVE = "rejected_false_positive"


@dataclass
class SimulatedTrade:
    """Represents a simulated trade with realistic execution"""
    id: str
    created_at: datetime

    # Market info
    market_a_id: str
    market_a_title: str
    market_b_id: str
    market_b_title: str
    platform_a: str  # "polymarket" or "kalshi"
    platform_b: str

    # Original opportunity prices
    original_price_a: Decimal
    original_price_b: Decimal
    original_spread_pct: Decimal

    # Executed prices (after slippage)
    executed_price_a: Optional[Decimal] = None
    executed_price_b: Optional[Decimal] = None

    # Trade details
    intended_size_usd: Decimal = Decimal("0")
    executed_size_usd: Decimal = Decimal("0")  # May be less due to partial fill

    # Fees
    fee_a_usd: Decimal = Decimal("0")
    fee_b_usd: Decimal = Decimal("0")
    total_fees_usd: Decimal = Decimal("0")

    # P&L
    gross_profit_usd: Decimal = Decimal("0")
    net_profit_usd: Decimal = Decimal("0")
    net_profit_pct: Decimal = Decimal("0")

    # Outcome
    outcome: TradeOutcome = TradeOutcome.PENDING
    outcome_reason: str = ""
    resolved_at: Optional[datetime] = None
    
    # Arbitrage strategy type
    arbitrage_type: str = ""  # e.g., "polymarket_single", "kalshi_single", "cross_platform"


@dataclass
class RealisticStats:
    """Realistic paper trading statistics"""
    # Balance
    starting_balance: Decimal = Decimal("10000.00")
    current_balance: Decimal = Decimal("10000.00")

    # Opportunities
    opportunities_seen: int = 0
    opportunities_traded: int = 0
    opportunities_skipped_too_small: int = 0
    opportunities_skipped_insufficient_funds: int = 0

    # Execution
    successful_executions: int = 0
    failed_executions: int = 0
    partial_fills: int = 0

    # P&L
    total_gross_profit: Decimal = Decimal("0")
    total_fees_paid: Decimal = Decimal("0")
    total_net_profit: Decimal = Decimal("0")
    total_losses: Decimal = Decimal("0")

    # Trade stats
    winning_trades: int = 0
    losing_trades: int = 0
    breakeven_trades: int = 0

    # Best/Worst
    best_trade_pnl: Decimal = Decimal("0")
    worst_trade_pnl: Decimal = Decimal("0")
    avg_trade_pnl: Decimal = Decimal("0")

    # Timing
    first_trade_at: Optional[datetime] = None
    last_trade_at: Optional[datetime] = None

    @property
    def total_pnl(self) -> Decimal:
        return self.current_balance - self.starting_balance

    @property
    def roi_pct(self) -> float:
        if self.starting_balance == 0:
            return 0.0
        return float((self.current_balance - self.starting_balance)
                    / self.starting_balance * 100)

    @property
    def win_rate(self) -> float:
        total = self.winning_trades + self.losing_trades
        if total == 0:
            return 0.0
        return self.winning_trades / total * 100

    @property
    def execution_success_rate(self) -> float:
        total = self.successful_executions + self.failed_executions
        if total == 0:
            return 0.0
        return self.successful_executions / total * 100

    def to_dict(self) -> Dict[str, Any]:
        return {
            "simulated_starting_balance": str(self.starting_balance),
            "simulated_current_balance": str(self.current_balance),
            "total_pnl": str(self.total_pnl),
            "roi_pct": round(self.roi_pct, 2),
            "total_opportunities_seen": self.opportunities_seen,
            "total_simulated_trades": self.opportunities_traded,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "pending_trades": 0,
            "win_rate_pct": round(self.win_rate, 2),
            "execution_success_rate_pct": round(self.execution_success_rate, 2),
            "total_fees_paid": str(self.total_fees_paid),
            "total_losses": str(self.total_losses),
            "failed_executions": self.failed_executions,
            "best_trade_profit": str(self.best_trade_pnl),
            "worst_trade_loss": str(self.worst_trade_pnl),
            "avg_trade_pnl": str(self.avg_trade_pnl),
            "largest_opportunity_seen_pct": "0",
            "first_opportunity_at": (
                self.first_trade_at.isoformat() if self.first_trade_at else None
            ),
            "last_opportunity_at": (
                self.last_trade_at.isoformat() if self.last_trade_at else None
            ),
        }


class RealisticPaperTrader:
    """
    Realistic paper trading simulator that models real-world trading conditions.

    CRITICAL DISTINCTION:
    - CROSS-PLATFORM (Polymarket ↔ Kalshi): TRUE arbitrage, same event, low risk
    - SAME-PLATFORM OVERLAP: NOT arbitrage, correlation-based, HIGH risk
    
    Key realistic factors:
    1. FALSE POSITIVE FILTER: Rejects spreads > 12% as likely false correlations
    2. CROSS-PLATFORM PREFERENCE: Skip same-platform "overlap" trades by default
    3. Slippage: Prices move 0.2-1.0% by the time you execute
    4. Spread cost: Bid-ask spread ~0.5% on prediction markets
    5. Execution failure: ~10% for cross-platform, ~20% for overlap
    6. Platform fees: ~2% on Polymarket, ~7% on Kalshi profits
    7. RESOLUTION RISK: 3% for true arb, 40% for overlap (correlation failure)
    8. Minimum profit threshold: 5% to cover costs
    """

    # ========== DEFAULT VALUES (overridden by database config) ==========
    MAX_REALISTIC_SPREAD_PCT = 12.0  # Max believable spread
    MIN_PROFIT_THRESHOLD_PCT = 5.0   # Min spread to trade

    # ========== CRITICAL: Skip same-platform overlap by default ==========
    # Same-platform "overlap" is NOT true arbitrage and loses money!
    SKIP_SAME_PLATFORM_OVERLAP = True  # Set to False to allow risky overlap trades

    # ========== EXECUTION SIMULATION ==========
    # CONSERVATIVE REALISTIC RATES - Based on actual trading data:
    # - Professional HFT: 50-55% win rate
    # - Statistical arbitrage: 55-65% win rate  
    # - Prediction market arb: 70-82% win rate (still risky!)
    # - Expected realistic annual ROI: 15-30%
    SLIPPAGE_MIN_PCT = 0.5  # Real markets have significant slippage
    SLIPPAGE_MAX_PCT = 2.0  # Can be high during volatile periods
    SPREAD_COST_PCT = 1.0   # Bid-ask spread cost (~1% typical)
    EXECUTION_FAILURE_RATE = 0.20  # 20% base rate - conservative
    PARTIAL_FILL_CHANCE = 0.25  # 25% chance of partial fill
    PARTIAL_FILL_MIN_PCT = 0.50  # At least 50% fills

    # ========== MARKET RESOLUTION RISK ==========
    # CONSERVATIVE: Even "true arbitrage" has execution risk!
    # Key insight: Losses are often LARGER than wins (asymmetry)
    RESOLUTION_LOSS_RATE = 0.18  # 18% loss rate for true arb
    LOSS_SEVERITY_MIN = 0.05    # 5% min loss
    LOSS_SEVERITY_MAX = 0.20    # 20% max loss on arb trades

    # =========================================================================
    # COMPREHENSIVE FEE STRUCTURES - ALL PLATFORMS (as of December 2025)
    # =========================================================================
    # 
    # PREDICTION MARKETS:
    # - Polymarket: 0% trading fees (peer-to-peer, no house)
    #   Source: https://docs.polymarket.com/polymarket-learn/trading/fees
    # - Kalshi: ~7% fee on PROFITS ONLY at settlement
    #   Source: https://help.kalshi.com/trading/fees
    #
    # CRYPTO EXCHANGES (via CCXT):
    # - Binance.US: 0.1% maker/taker (0.075% with BNB discount)
    # - Coinbase: 0.5% spread + 0.6% maker / 1.2% taker (Coinbase One: 0%)
    # - Coinbase Advanced: 0.6% maker / 1.2% taker (volume discounts available)
    # - Kraken: 0.16% maker / 0.26% taker (volume discounts)
    # - Bybit: 0.1% maker / 0.1% taker (VIP discounts)
    # - OKX: 0.08% maker / 0.1% taker (VIP discounts)
    # - KuCoin: 0.1% maker / 0.1% taker
    #
    # STOCK BROKERS:
    # - Alpaca: $0 commission for stocks/ETFs (paper and live)
    # - IBKR: $0 for stocks (Pro: $0.005/share, min $1)
    #   Note: SEC/FINRA fees still apply (~$0.000008/share sold)
    #
    # CRYPTO FUTURES (Funding Rate Arb):
    # - Binance Futures: 0.02% maker / 0.04% taker
    # - Bybit Derivatives: 0.01% maker / 0.06% taker
    # - OKX Perps: 0.02% maker / 0.05% taker
    # =========================================================================
    
    # Prediction Markets
    POLYMARKET_FEE_PCT = 0.0      # 0% trading fees
    KALSHI_FEE_PCT = 7.0          # 7% on profits at settlement
    
    # Crypto Spot Exchanges (as percentage of trade value)
    BINANCE_US_MAKER_FEE_PCT = 0.10
    BINANCE_US_TAKER_FEE_PCT = 0.10
    COINBASE_MAKER_FEE_PCT = 0.60    # Coinbase Advanced
    COINBASE_TAKER_FEE_PCT = 1.20    # Higher for takers
    COINBASE_SPREAD_FEE_PCT = 0.50   # Built into prices on regular Coinbase
    KRAKEN_MAKER_FEE_PCT = 0.16
    KRAKEN_TAKER_FEE_PCT = 0.26
    BYBIT_MAKER_FEE_PCT = 0.10
    BYBIT_TAKER_FEE_PCT = 0.10
    OKX_MAKER_FEE_PCT = 0.08
    OKX_TAKER_FEE_PCT = 0.10
    KUCOIN_MAKER_FEE_PCT = 0.10
    KUCOIN_TAKER_FEE_PCT = 0.10
    
    # Crypto Futures/Perpetuals
    BINANCE_FUTURES_MAKER_FEE_PCT = 0.02
    BINANCE_FUTURES_TAKER_FEE_PCT = 0.04
    BYBIT_FUTURES_MAKER_FEE_PCT = 0.01
    BYBIT_FUTURES_TAKER_FEE_PCT = 0.06
    OKX_FUTURES_MAKER_FEE_PCT = 0.02
    OKX_FUTURES_TAKER_FEE_PCT = 0.05
    
    # Stock Brokers
    ALPACA_COMMISSION_USD = 0.0       # $0 commission
    ALPACA_SEC_FEE_PER_SHARE = 0.000008  # SEC fee on sells only
    IBKR_COMMISSION_USD = 0.0         # $0 for IBKR Lite
    IBKR_PRO_PER_SHARE = 0.005        # IBKR Pro: $0.005/share

    # ========== POSITION SIZING ==========
    MAX_POSITION_PCT = 5.0      # Max % of balance per trade
    MAX_POSITION_USD = 50.0     # Max $ per trade
    MIN_POSITION_USD = 5.0      # Minimum trade size

    def __init__(
        self,
        db_client,
        starting_balance: Decimal = Decimal("1000.00"),
    ):
        self.db = db_client
        self.stats = RealisticStats(
            starting_balance=starting_balance,
            current_balance=starting_balance,
        )
        self.trades: Dict[str, SimulatedTrade] = {}
        self._trade_counter = 0
        
        # Load config from database (overrides class defaults)
        self._load_config_from_db()

    def _load_config_from_db(self):
        """
        Load trading configuration from database.
        Overrides class defaults with values from polybot_config table.
        Falls back to class defaults if database is unavailable or values missing.
        """
        try:
            config = self.db.get_trading_config()
            if not config:
                logger.info("No database config found, using defaults")
                return
            
            # Map database columns to instance attributes
            config_mapping = {
                'max_realistic_spread_pct': 'MAX_REALISTIC_SPREAD_PCT',
                'min_profit_threshold_pct': 'MIN_PROFIT_THRESHOLD_PCT',
                'slippage_min_pct': 'SLIPPAGE_MIN_PCT',
                'slippage_max_pct': 'SLIPPAGE_MAX_PCT',
                'spread_cost_pct': 'SPREAD_COST_PCT',
                'execution_failure_rate': 'EXECUTION_FAILURE_RATE',
                'partial_fill_chance': 'PARTIAL_FILL_CHANCE',
                'partial_fill_min_pct': 'PARTIAL_FILL_MIN_PCT',
                'resolution_loss_rate': 'RESOLUTION_LOSS_RATE',
                'loss_severity_min': 'LOSS_SEVERITY_MIN',
                'loss_severity_max': 'LOSS_SEVERITY_MAX',
                'max_position_pct': 'MAX_POSITION_PCT',
                'max_position_usd': 'MAX_POSITION_USD',
                'min_position_usd': 'MIN_POSITION_USD',
            }
            
            loaded_count = 0
            for db_col, attr_name in config_mapping.items():
                if db_col in config and config[db_col] is not None:
                    value = float(config[db_col])
                    setattr(self, attr_name, value)
                    loaded_count += 1
                    logger.debug(f"Loaded {attr_name} = {value} from database")
            
            # Also load basic settings if present
            if config.get('min_profit_percent') is not None:
                self.MIN_PROFIT_THRESHOLD_PCT = float(config['min_profit_percent'])
                loaded_count += 1
            
            if config.get('max_trade_size') is not None:
                self.MAX_POSITION_USD = float(config['max_trade_size'])
                loaded_count += 1
            
            logger.info(f"✓ Loaded {loaded_count} config values from database")
            
            # Log current settings
            logger.info(f"  Max spread: {self.MAX_REALISTIC_SPREAD_PCT}%")
            logger.info(f"  Min profit: {self.MIN_PROFIT_THRESHOLD_PCT}%")
            logger.info(f"  Max position: ${self.MAX_POSITION_USD}")
            logger.info(f"  Exec failure rate: {self.EXECUTION_FAILURE_RATE*100:.0f}%")
            logger.info(f"  Resolution loss rate: {self.RESOLUTION_LOSS_RATE*100:.0f}%")
            
        except Exception as e:
            logger.warning(f"Failed to load config from database: {e}")
            logger.info("Using default configuration values")

    def _generate_trade_id(self) -> str:
        """Generate unique trade ID"""
        self._trade_counter += 1
        ts = datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
        return f"SIM-{ts}-{self._trade_counter:04d}"

    def _calculate_slippage(self, price: Decimal) -> Decimal:
        """
        Calculate realistic slippage.
        Prices typically move against you during execution.
        """
        slippage_pct = random.uniform(self.SLIPPAGE_MIN_PCT, self.SLIPPAGE_MAX_PCT)
        # Slippage usually works against you (price moves unfavorable)
        direction = 1 if random.random() > 0.3 else -1  # 70% unfavorable
        slippage = price * Decimal(str(slippage_pct / 100)) * direction
        return slippage

    def calculate_platform_fee(
        self,
        platform: str,
        trade_value: Decimal,
        gross_profit: Decimal,
        is_maker: bool = False,
        is_futures: bool = False,
        asset_type: str = "prediction",  # prediction, crypto, stock
    ) -> Decimal:
        """
        Calculate trading fee for a specific platform.
        
        Args:
            platform: Platform name (polymarket, kalshi, binance, etc)
            trade_value: Total trade value in USD
            gross_profit: Gross profit (for profit-based fees like Kalshi)
            is_maker: True if maker order, False if taker (crypto)
            is_futures: True if futures/perpetuals trade
            asset_type: Type of asset (prediction, crypto, stock)
        
        Returns:
            Fee amount in USD
        """
        platform_lower = platform.lower().replace(" ", "").replace("-", "")
        
        # ========== PREDICTION MARKETS ==========
        if platform_lower in ("polymarket", "poly"):
            return Decimal("0")  # 0% fees
        
        if platform_lower == "kalshi":
            # 7% on profits only, at settlement
            if gross_profit > 0:
                return gross_profit * Decimal("0.07")
            return Decimal("0")
        
        # ========== CRYPTO SPOT EXCHANGES ==========
        if platform_lower in ("binance", "binanceus"):
            rate = self.BINANCE_US_MAKER_FEE_PCT if is_maker else \
                   self.BINANCE_US_TAKER_FEE_PCT
            return trade_value * Decimal(str(rate / 100))
        
        if platform_lower in ("coinbase", "coinbasepro", "coinbaseadvanced"):
            rate = self.COINBASE_MAKER_FEE_PCT if is_maker else \
                   self.COINBASE_TAKER_FEE_PCT
            return trade_value * Decimal(str(rate / 100))
        
        if platform_lower == "kraken":
            rate = self.KRAKEN_MAKER_FEE_PCT if is_maker else \
                   self.KRAKEN_TAKER_FEE_PCT
            return trade_value * Decimal(str(rate / 100))
        
        if platform_lower == "bybit":
            if is_futures:
                rate = self.BYBIT_FUTURES_MAKER_FEE_PCT if is_maker else \
                       self.BYBIT_FUTURES_TAKER_FEE_PCT
            else:
                rate = self.BYBIT_MAKER_FEE_PCT if is_maker else \
                       self.BYBIT_TAKER_FEE_PCT
            return trade_value * Decimal(str(rate / 100))
        
        if platform_lower == "okx":
            if is_futures:
                rate = self.OKX_FUTURES_MAKER_FEE_PCT if is_maker else \
                       self.OKX_FUTURES_TAKER_FEE_PCT
            else:
                rate = self.OKX_MAKER_FEE_PCT if is_maker else \
                       self.OKX_TAKER_FEE_PCT
            return trade_value * Decimal(str(rate / 100))
        
        if platform_lower == "kucoin":
            rate = self.KUCOIN_MAKER_FEE_PCT if is_maker else \
                   self.KUCOIN_TAKER_FEE_PCT
            return trade_value * Decimal(str(rate / 100))
        
        # ========== STOCK BROKERS ==========
        if platform_lower == "alpaca":
            # Commission-free, but SEC fee on sells
            # SEC fee is ~$0.000008 per share sold
            # For simplicity, apply 0.0008% on sell value
            return trade_value * Decimal("0.000008")
        
        if platform_lower in ("ibkr", "interactivebrokers"):
            return Decimal(str(self.IBKR_COMMISSION_USD))
        
        # ========== DEFAULT / UNKNOWN ==========
        # Default to 0.1% if platform unknown (conservative estimate)
        logger.warning(f"Unknown platform '{platform}', using 0.1% fee")
        return trade_value * Decimal("0.001")

    def _simulate_execution(
        self,
        original_spread_pct: Decimal,
        is_cross_platform: bool = True,
    ) -> tuple[bool, str, Decimal, bool]:
        """
        Simulate whether a trade executes successfully.

        Returns: (success, reason, actual_profit_multiplier, is_loss)

        CRITICAL: Cross-platform arbitrage (Poly↔Kalshi) is TRUE arbitrage
        with low risk. Same-platform "overlap" is NOT real arbitrage and
        has MUCH higher loss rates.
        
        Key scenarios:
        1. Execution failure - opportunity disappears
        2. Successful but losing trade - market resolves against
        3. Successful winning trade - profit after costs
        
        REALISTIC RATES based on industry data:
        - Professional algo trading: 50-55% win rate typical
        - Statistical arbitrage: 55-65% win rate
        - Prediction market arb: 65-80% win rate (still risky!)
        
        Even "true arbitrage" has significant risks:
        - Data latency: Prices shown may not be executable
        - Execution delay: Multi-leg trades don't execute atomically
        - Liquidity: Order book may not have enough depth
        - Platform fees: Can exceed apparent spread
        """
        # ========== DIFFERENT RISK PROFILES ==========
        #
        # CONSERVATIVE REALISTIC RATES - No trading strategy is 98% win rate!
        # Even "true arbitrage" has significant execution risk.
        #
        if is_cross_platform:
            # TRUE ARBITRAGE: Same event, different platforms
            # STILL HAS SIGNIFICANT RISKS:
            # - Execution timing mismatch between platforms
            # - Price changes between leg executions
            # - Data feed latency (what you see isn't current)
            # - Liquidity differences between platforms
            # - Platform fees can exceed apparent spread
            exec_failure_rate = 0.20  # 20% fail - conservative
            loss_rate = 0.18  # 18% loss rate - realistic
            spread_float = float(original_spread_pct)
            loss_min = 0.05  # 5% min loss
            loss_max = min(0.20, spread_float / 100 + 0.08)
            profit_reason = "TRUE ARBITRAGE: Profit captured"
        else:
            # SAME-PLATFORM OVERLAP: Different events, correlation assumed
            # VERY HIGH risk - correlation rarely holds!
            exec_failure_rate = 0.30  # 30% fail
            loss_rate = 0.50  # 50% loss rate - correlation failures
            loss_min = 0.30  # 30% loss minimum
            loss_max = 0.85  # 85% loss max - complete failure
            profit_reason = "OVERLAP: Correlation held (very risky)"
        
        # Check if opportunity still exists (execution failure)
        if random.random() < exec_failure_rate:
            reasons = [
                "Opportunity disappeared before execution",
                "Price moved too far, spread closed",
                "Insufficient liquidity at target price",
                "Order rejected by platform",
                "Network delay caused missed opportunity",
            ]
            return False, random.choice(reasons), Decimal("0"), False

        # ========== MARKET RESOLUTION RISK ==========
        if random.random() < loss_rate:
            loss_severity = random.uniform(loss_min, loss_max)
            loss_pct = Decimal(str(-loss_severity * 100))

            if is_cross_platform:
                loss_reasons = [
                    "Execution timing mismatch caused slippage loss",
                    "One leg filled at worse price than expected",
                    "Platform fee higher than expected",
                ]
            else:
                loss_reasons = [
                    "CORRELATION FAILED: Markets resolved independently",
                    "Assumed relationship was WRONG - not true arbitrage",
                    "Market B moved against position - no hedge",
                    "Overlap assumption incorrect - full loss on position",
                    "Markets diverged instead of converging",
                    "Same-platform overlap is NOT risk-free arbitrage",
                ]
            return True, random.choice(loss_reasons), loss_pct, True

        # ========== CALCULATE REALISTIC PROFIT ==========
        slippage_range = (self.SLIPPAGE_MIN_PCT + self.SLIPPAGE_MAX_PCT) / 2
        avg_slippage = Decimal(str(slippage_range))
        spread_cost = Decimal(str(self.SPREAD_COST_PCT))
        
        # Estimate average fee impact for profit calculation
        # Note: Actual fees are platform-specific and calculated at trade time
        # Polymarket: 0%, Kalshi: 7% on profits
        # Use conservative estimate for filtering
        if is_cross_platform:
            avg_fee = Decimal("3.5")  # ~7% * 50% (one leg on Kalshi)
        else:
            avg_fee = Decimal("7.0")  # Kalshi-only trades pay full 7%

        actual_profit_pct = original_spread_pct - avg_slippage - spread_cost

        if actual_profit_pct > 0:
            actual_profit_pct = actual_profit_pct * (1 - avg_fee / 100)

        if actual_profit_pct <= 0:
            return True, "Costs exceeded spread - breakeven/loss", actual_profit_pct, True

        return True, profit_reason, actual_profit_pct, False

    def _calculate_position_size(self) -> Decimal:
        """Calculate conservative position size"""
        # Use smaller of: max_position_pct of balance, or max_position_usd
        pct_based = self.stats.current_balance * Decimal(str(self.MAX_POSITION_PCT / 100))
        size = min(pct_based, Decimal(str(self.MAX_POSITION_USD)))

        # Apply partial fill if applicable
        if random.random() < self.PARTIAL_FILL_CHANCE:
            fill_pct = random.uniform(self.PARTIAL_FILL_MIN_PCT, 1.0)
            size = size * Decimal(str(fill_pct))
            self.stats.partial_fills += 1

        return size.quantize(Decimal("0.01"), rounding=ROUND_DOWN)

    async def simulate_opportunity(
        self,
        market_a_id: str,
        market_a_title: str,
        market_b_id: str,
        market_b_title: str,
        platform_a: str,
        platform_b: str,
        price_a: Decimal,
        price_b: Decimal,
        spread_pct: Decimal,
        trade_type: str,
        arbitrage_type: str = "",  # "polymarket_single", "kalshi_single", "cross_platform"
    ) -> Optional[SimulatedTrade]:
        """
        Simulate a realistic trade on an arbitrage opportunity.

        This applies all realistic factors:
        - FALSE POSITIVE FILTER: Rejects unrealistically large spreads
        - CROSS-PLATFORM FILTER: Skips same-platform overlap by default
        - Execution failure chance
        - Slippage on prices
        - Spread costs
        - Platform fees
        - Partial fills
        - MARKET RESOLUTION RISK: Trades can lose money!
        """
        now = datetime.now(timezone.utc)

        # Track opportunity
        self.stats.opportunities_seen += 1
        if self.stats.first_trade_at is None:
            self.stats.first_trade_at = now
        self.stats.last_trade_at = now

        # ========== SAME-PLATFORM FILTER ==========
        # Skip same-platform "overlap" trades - they're NOT real arbitrage!
        # EXCEPTION: Single-platform arb is INTENTIONALLY same-platform
        is_single_platform_arb = arbitrage_type in (
            "polymarket_single", "kalshi_single"
        )
        is_cross_platform = (platform_a != platform_b)
        
        if not is_cross_platform and not is_single_platform_arb and self.SKIP_SAME_PLATFORM_OVERLAP:
            self.stats.opportunities_skipped_too_small += 1
            logger.info(
                f"🚫 SKIPPED SAME-PLATFORM: {platform_a}↔{platform_b} "
                f"({spread_pct:.1f}% spread) - NOT true arbitrage! "
                f"Enable SKIP_SAME_PLATFORM_OVERLAP=False to allow."
            )
            return None

        # ========== FALSE POSITIVE FILTER ==========
        # Reject opportunities with unrealistically large spreads
        if float(spread_pct) > self.MAX_REALISTIC_SPREAD_PCT:
            self.stats.opportunities_skipped_too_small += 1
            logger.info(
                f"🚫 REJECTED (false positive): {spread_pct:.1f}% spread "
                f"exceeds {self.MAX_REALISTIC_SPREAD_PCT}% max"
            )
            return None

        # Skip if spread too small to be profitable after costs
        if float(spread_pct) < self.MIN_PROFIT_THRESHOLD_PCT:
            self.stats.opportunities_skipped_too_small += 1
            logger.debug(
                f"Skipping: {spread_pct:.2f}% spread "
                f"below {self.MIN_PROFIT_THRESHOLD_PCT}% threshold"
            )
            return None

        # Check if we have enough balance
        min_size = Decimal(str(self.MIN_POSITION_USD))
        if self.stats.current_balance < min_size:
            self.stats.opportunities_skipped_insufficient_funds += 1
            logger.warning(
                f"Insufficient funds: ${self.stats.current_balance:.2f}"
            )
            return None

        # Calculate position size
        position_size = self._calculate_position_size()
        if position_size < min_size:
            self.stats.opportunities_skipped_insufficient_funds += 1
            return None

        # ========== CRITICAL: Determine if TRUE arbitrage ==========
        # Cross-platform (Polymarket ↔ Kalshi) = TRUE arbitrage = LOW RISK
        # Single-platform arb (YES/NO spread on same market) = TRUE arbitrage = LOW RISK
        # Same-platform overlap (different markets) = NOT true arbitrage = HIGH RISK
        
        is_single_platform_arb = arbitrage_type in (
            "polymarket_single", "kalshi_single", "poly_single"
        )
        is_cross_platform = (platform_a != platform_b)
        
        # Single-platform arb IS true arbitrage (YES/NO spread on same market)
        # Treat it the same as cross-platform for risk purposes
        is_true_arbitrage = is_cross_platform or is_single_platform_arb
        
        if not is_true_arbitrage:
            logger.warning(
                f"⚠️ SAME-PLATFORM OVERLAP detected ({platform_a}↔{platform_b}) - "
                f"HIGH RISK trade, NOT true arbitrage!"
            )

        # Simulate execution with appropriate risk profile
        success, reason, actual_profit_pct, is_loss = self._simulate_execution(
            spread_pct,
            is_cross_platform=is_true_arbitrage,  # Use true arbitrage flag for risk calc
        )

        # Determine arbitrage_type if not provided
        if not arbitrage_type:
            if platform_a != platform_b:
                arbitrage_type = "cross_platform"
            elif platform_a == "polymarket":
                arbitrage_type = "polymarket_single"
            else:
                arbitrage_type = "kalshi_single"
        
        # Create trade record
        trade = SimulatedTrade(
            id=self._generate_trade_id(),
            created_at=now,
            market_a_id=market_a_id,
            market_a_title=market_a_title[:200],
            market_b_id=market_b_id,
            market_b_title=market_b_title[:200],
            platform_a=platform_a,
            platform_b=platform_b,
            original_price_a=price_a,
            original_price_b=price_b,
            original_spread_pct=spread_pct,
            intended_size_usd=position_size,
            arbitrage_type=arbitrage_type,
        )

        if not success:
            # Execution failed - no money lost, opportunity just missed
            trade.outcome = TradeOutcome.FAILED_EXECUTION
            trade.outcome_reason = reason
            trade.resolved_at = now
            self.stats.failed_executions += 1

            logger.info(
                f"⚠️ FAILED: {trade.id} | {reason} | "
                f"Spread was: {spread_pct:.2f}%"
            )
        else:
            # Execution succeeded - but could be win or loss
            trade.executed_size_usd = position_size

            # Calculate slippage-adjusted prices
            slippage_a = self._calculate_slippage(price_a)
            slippage_b = self._calculate_slippage(price_b)
            trade.executed_price_a = price_a + slippage_a
            trade.executed_price_b = price_b + slippage_b

            # Calculate P&L BEFORE fees (gross)
            gross_pnl = position_size * actual_profit_pct / Decimal("100")
            trade.gross_profit_usd = gross_pnl

            # ========== PLATFORM-SPECIFIC FEE CALCULATION ==========
            # Use comprehensive fee calculator for each platform leg
            # Handles: Polymarket (0%), Kalshi (7% profit), Crypto, Stocks
            trade.fee_a_usd = self.calculate_platform_fee(
                platform=platform_a,
                trade_value=position_size / 2,  # Half position per leg
                gross_profit=gross_pnl / 2 if gross_pnl > 0 else Decimal("0"),
                is_maker=False,  # Assume taker for conservative estimate
                is_futures=False,
                asset_type="prediction" if platform_a.lower() in (
                    "polymarket", "kalshi", "poly"
                ) else "crypto"
            )
            
            trade.fee_b_usd = self.calculate_platform_fee(
                platform=platform_b,
                trade_value=position_size / 2,
                gross_profit=gross_pnl / 2 if gross_pnl > 0 else Decimal("0"),
                is_maker=False,
                is_futures=False,
                asset_type="prediction" if platform_b.lower() in (
                    "polymarket", "kalshi", "poly"
                ) else "crypto"
            )

            trade.total_fees_usd = trade.fee_a_usd + trade.fee_b_usd

            # Net P&L = Gross - Fees
            trade.net_profit_usd = gross_pnl - trade.total_fees_usd

            if position_size > 0:
                trade.net_profit_pct = (trade.net_profit_usd / position_size) * 100

            trade.resolved_at = now
            trade.outcome_reason = reason

            # Update stats
            self.stats.successful_executions += 1
            self.stats.opportunities_traded += 1
            self.stats.total_fees_paid += trade.total_fees_usd

            # ========== HANDLE WIN VS LOSS ==========
            if is_loss or trade.net_profit_usd < 0:
                # LOSING TRADE
                trade.outcome = TradeOutcome.LOST
                self.stats.losing_trades += 1
                loss_amount = abs(trade.net_profit_usd)
                self.stats.total_losses += loss_amount
                self.stats.current_balance -= loss_amount

                if trade.net_profit_usd < self.stats.worst_trade_pnl:
                    self.stats.worst_trade_pnl = trade.net_profit_usd

                logger.info(
                    f"❌ LOST: {trade.id} | "
                    f"Size: ${position_size:.2f} | "
                    f"Loss: -${loss_amount:.2f} ({trade.net_profit_pct:.1f}%) | "
                    f"Reason: {reason} | "
                    f"Balance: ${self.stats.current_balance:.2f}"
                )
            elif trade.net_profit_usd > 0:
                # WINNING TRADE
                trade.outcome = TradeOutcome.WON
                self.stats.winning_trades += 1
                self.stats.total_gross_profit += trade.gross_profit_usd
                self.stats.total_net_profit += trade.net_profit_usd
                self.stats.current_balance += trade.net_profit_usd

                if trade.net_profit_usd > self.stats.best_trade_pnl:
                    self.stats.best_trade_pnl = trade.net_profit_usd

                logger.info(
                    f"✅ WON: {trade.id} | "
                    f"Size: ${position_size:.2f} | "
                    f"Net P&L: +${trade.net_profit_usd:.2f} "
                    f"({trade.net_profit_pct:.1f}%) | "
                    f"Fees: ${trade.total_fees_usd:.2f} | "
                    f"Balance: ${self.stats.current_balance:.2f}"
                )
            else:
                # BREAKEVEN
                trade.outcome = TradeOutcome.WON
                self.stats.breakeven_trades += 1
                logger.info(f"➖ BREAKEVEN: {trade.id}")

        # Store trade
        self.trades[trade.id] = trade

        # Save to database
        await self._save_trade_to_db(trade)

        # Update average trade P&L
        total = self.stats.winning_trades + self.stats.losing_trades
        if total > 0:
            net = self.stats.total_net_profit - self.stats.total_losses
            self.stats.avg_trade_pnl = net / total

        return trade

    async def _save_trade_to_db(self, trade: SimulatedTrade) -> None:
        """Save trade to Supabase polybot_simulated_trades table"""
        try:
            # Determine strategy type from arbitrage_type or trade platforms
            strategy_type = trade.arbitrage_type
            if not strategy_type:
                if trade.platform_a == trade.platform_b:
                    strategy_type = f"{trade.platform_a}_single"
                else:
                    strategy_type = "cross_platform"

            # Core data that should always exist
            data = {
                "position_id": trade.id,
                "created_at": trade.created_at.isoformat(),
                "polymarket_token_id": trade.market_a_id,
                "polymarket_market_title": trade.market_a_title,
                "kalshi_ticker": trade.market_b_id,
                "kalshi_market_title": trade.market_b_title,
                "polymarket_yes_price": float(trade.original_price_a),
                "polymarket_no_price": float(1 - trade.original_price_a),
                "kalshi_yes_price": float(trade.original_price_b),
                "kalshi_no_price": float(1 - trade.original_price_b),
                "trade_type": f"realistic_arb_{trade.platform_a}_{trade.platform_b}",
                "arbitrage_type": trade.arbitrage_type,
                "position_size_usd": float(trade.executed_size_usd),
                "expected_profit_usd": float(trade.gross_profit_usd),
                "expected_profit_pct": float(trade.original_spread_pct),
                "outcome": trade.outcome.value,
                "actual_profit_usd": float(trade.net_profit_usd),
                "resolved_at": trade.resolved_at.isoformat() if trade.resolved_at else None,
                "resolution_notes": trade.outcome_reason,
            }
            
            # Extended fields for enhanced tracking (may not exist in older schemas)
            extended_data = {
                "strategy_type": strategy_type,
                "trading_mode": "paper",  # Paper trading mode
                "platform": trade.platform_a,
            }

            # Try multiple ways to save to database
            saved = False
            
            # Method 1: Use is_connected property
            if self.db and hasattr(self.db, 'is_connected') and self.db.is_connected:
                # Try with extended data first
                try:
                    full_data = {**data, **extended_data}
                    self.db._client.table("polybot_simulated_trades").insert(full_data).execute()
                    logger.info(f"📝 DB TRADE: {trade.id} saved (with extended fields)")
                    saved = True
                except Exception as e:
                    # If extended fields fail, try with core data only
                    if "column" in str(e).lower() and "does not exist" in str(e).lower():
                        try:
                            self.db._client.table("polybot_simulated_trades").insert(data).execute()
                            logger.info(f"📝 DB TRADE: {trade.id} saved (core fields only)")
                            saved = True
                        except Exception as e2:
                            logger.warning(f"Method 1 failed (core): {e2}")
                    else:
                        logger.warning(f"Method 1 failed: {e}")
            
            # Method 2: Direct _client check
            if not saved and self.db and hasattr(self.db, '_client') and self.db._client:
                try:
                    self.db._client.table("polybot_simulated_trades").insert(data).execute()
                    logger.info(f"📝 DB TRADE: {trade.id} saved (method 2)")
                    saved = True
                except Exception as e:
                    logger.warning(f"Method 2 failed: {e}")
            
            if not saved:
                # Log detailed debug info
                db_exists = bool(self.db)
                has_is_connected = hasattr(self.db, 'is_connected') if self.db else False
                is_connected = self.db.is_connected if has_is_connected else False
                has_client = hasattr(self.db, '_client') if self.db else False
                client_exists = bool(self.db._client) if has_client else False
                logger.warning(
                    f"DB not available for trade {trade.id}: "
                    f"db={db_exists}, has_is_connected={has_is_connected}, "
                    f"is_connected={is_connected}, has_client={has_client}, "
                    f"client_exists={client_exists}"
                )
        except Exception as e:
            logger.error(f"Failed to save trade to DB: {e}")

    async def save_stats_to_db(self) -> None:
        """Save current stats to Supabase polybot_simulation_stats table"""
        try:
            data = {
                "id": 1,  # Always update same row
                "snapshot_at": datetime.now(timezone.utc).isoformat(),
                "stats_json": self.stats.to_dict(),
                "simulated_balance": float(self.stats.current_balance),
                "total_pnl": float(self.stats.total_pnl),
                "total_trades": self.stats.opportunities_traded,
                "win_rate": self.stats.win_rate,
            }

            saved = False
            
            # Method 1: Use is_connected property
            if self.db and hasattr(self.db, 'is_connected') and self.db.is_connected:
                try:
                    self.db._client.table("polybot_simulation_stats").upsert(
                        data, on_conflict="id"
                    ).execute()
                    logger.info(
                        f"💾 DB SAVE: Balance=${self.stats.current_balance:.2f} "
                        f"Trades={self.stats.opportunities_traded}"
                    )
                    saved = True
                except Exception as e:
                    logger.warning(f"Stats save method 1 failed: {e}")
            
            # Method 2: Direct _client check
            if not saved and self.db and hasattr(self.db, '_client') and self.db._client:
                try:
                    self.db._client.table("polybot_simulation_stats").upsert(
                        data, on_conflict="id"
                    ).execute()
                    logger.info(
                        f"💾 DB SAVE: Balance=${self.stats.current_balance:.2f} "
                        f"Trades={self.stats.opportunities_traded} (method 2)"
                    )
                    saved = True
                except Exception as e:
                    logger.warning(f"Stats save method 2 failed: {e}")
            
            if not saved:
                # Log diagnostic info
                db_exists = bool(self.db)
                has_is_connected = hasattr(self.db, 'is_connected') if self.db else False
                is_connected = self.db.is_connected if has_is_connected else False
                logger.warning(
                    f"DB not available for stats: db={db_exists}, "
                    f"is_connected={is_connected}"
                )
        except Exception as e:
            logger.error(f"Failed to save stats to DB: {e}")

    # =========================================================================
    # CRYPTO TRADE SIMULATION
    # Supports: Binance.US, Coinbase, Kraken, Bybit, OKX, KuCoin
    # =========================================================================
    async def simulate_crypto_trade(
        self,
        symbol: str,
        exchange: str,
        side: str,  # "buy" or "sell"
        size_usd: Decimal,
        entry_price: Decimal,
        exit_price: Decimal,
        strategy: str = "manual",
        is_futures: bool = False,
        is_maker: bool = False,
    ) -> Optional[SimulatedTrade]:
        """
        Simulate a crypto trade with realistic fees.
        
        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            exchange: Exchange name (binance, coinbase, etc.)
            side: "buy" or "sell"
            size_usd: Trade size in USD
            entry_price: Entry price
            exit_price: Exit price (for P&L calculation)
            strategy: Strategy name for tracking
            is_futures: True if perpetual/futures trade
            is_maker: True if maker order (lower fees)
        
        Returns:
            SimulatedTrade object or None if execution fails
        """
        now = datetime.now(timezone.utc)
        self.stats.opportunities_seen += 1
        
        # Check balance
        if self.stats.current_balance < size_usd:
            logger.warning(f"Insufficient balance for crypto trade")
            return None
        
        # Calculate P&L
        if side == "buy":
            pnl_pct = (exit_price - entry_price) / entry_price * 100
        else:
            pnl_pct = (entry_price - exit_price) / entry_price * 100
        
        gross_pnl = size_usd * pnl_pct / Decimal("100")
        
        # Calculate fees using comprehensive method
        entry_fee = self.calculate_platform_fee(
            platform=exchange,
            trade_value=size_usd,
            gross_profit=Decimal("0"),  # Entry has no profit yet
            is_maker=is_maker,
            is_futures=is_futures,
            asset_type="crypto"
        )
        exit_fee = self.calculate_platform_fee(
            platform=exchange,
            trade_value=size_usd + gross_pnl if gross_pnl > 0 else size_usd,
            gross_profit=gross_pnl if gross_pnl > 0 else Decimal("0"),
            is_maker=is_maker,
            is_futures=is_futures,
            asset_type="crypto"
        )
        total_fees = entry_fee + exit_fee
        net_pnl = gross_pnl - total_fees
        
        # Create trade record
        trade = SimulatedTrade(
            id=self._generate_trade_id(),
            created_at=now,
            market_a_id=symbol,
            market_a_title=f"{symbol} {side.upper()} on {exchange}",
            market_b_id=symbol,
            market_b_title=f"{strategy}",
            platform_a=exchange,
            platform_b=exchange,
            original_price_a=entry_price,
            original_price_b=exit_price,
            original_spread_pct=abs(pnl_pct),
            intended_size_usd=size_usd,
            executed_size_usd=size_usd,
            executed_price_a=entry_price,
            executed_price_b=exit_price,
            fee_a_usd=entry_fee,
            fee_b_usd=exit_fee,
            total_fees_usd=total_fees,
            gross_profit_usd=gross_pnl,
            net_profit_usd=net_pnl,
            net_profit_pct=net_pnl / size_usd * 100 if size_usd > 0 else Decimal("0"),
            outcome=TradeOutcome.WON if net_pnl > 0 else TradeOutcome.LOST,
            outcome_reason=f"{strategy} - {exchange}",
            resolved_at=now,
            arbitrage_type=f"crypto_{strategy}",
        )
        
        # Update stats
        self._update_stats_from_trade(trade)
        
        logger.info(
            f"{'✅' if net_pnl > 0 else '❌'} CRYPTO: {symbol} {side} "
            f"${size_usd:.2f} | Net: ${net_pnl:+.2f} | "
            f"Fees: ${total_fees:.4f} ({exchange})"
        )
        
        return trade

    # =========================================================================
    # STOCK TRADE SIMULATION  
    # Supports: Alpaca ($0 commission), IBKR
    # =========================================================================
    async def simulate_stock_trade(
        self,
        symbol: str,
        broker: str,
        side: str,  # "buy" or "sell"
        shares: int,
        entry_price: Decimal,
        exit_price: Decimal,
        strategy: str = "manual",
    ) -> Optional[SimulatedTrade]:
        """
        Simulate a stock trade with realistic fees.
        
        Args:
            symbol: Stock ticker (e.g., "AAPL")
            broker: Broker name (alpaca, ibkr)
            side: "buy" or "sell"
            shares: Number of shares
            entry_price: Entry price per share
            exit_price: Exit price per share
            strategy: Strategy name for tracking
        
        Returns:
            SimulatedTrade object or None if execution fails
        """
        now = datetime.now(timezone.utc)
        self.stats.opportunities_seen += 1
        
        size_usd = Decimal(str(shares)) * entry_price
        
        # Check balance
        if self.stats.current_balance < size_usd:
            logger.warning(f"Insufficient balance for stock trade")
            return None
        
        # Calculate P&L
        if side == "buy":
            pnl_pct = (exit_price - entry_price) / entry_price * 100
        else:
            pnl_pct = (entry_price - exit_price) / entry_price * 100
        
        gross_pnl = size_usd * pnl_pct / Decimal("100")
        
        # Calculate fees (Alpaca: $0 commission, SEC fee on sells)
        # SEC fee: ~$0.000008 per share sold
        entry_fee = Decimal("0")  # No fee on buys for most brokers
        exit_fee = Decimal("0")
        
        if broker.lower() == "alpaca":
            # SEC fee only on sells
            if side == "sell":
                exit_fee = Decimal(str(shares)) * Decimal("0.000008")
        elif broker.lower() in ("ibkr", "interactivebrokers"):
            # IBKR Lite is $0, Pro is $0.005/share
            exit_fee = Decimal("0")  # Assume Lite
        
        total_fees = entry_fee + exit_fee
        net_pnl = gross_pnl - total_fees
        exit_value = Decimal(str(shares)) * exit_price
        
        # Create trade record
        trade = SimulatedTrade(
            id=self._generate_trade_id(),
            created_at=now,
            market_a_id=symbol,
            market_a_title=f"{symbol} {shares} shares {side.upper()}",
            market_b_id=symbol,
            market_b_title=f"{strategy}",
            platform_a=broker,
            platform_b=broker,
            original_price_a=entry_price,
            original_price_b=exit_price,
            original_spread_pct=abs(pnl_pct),
            intended_size_usd=size_usd,
            executed_size_usd=size_usd,
            executed_price_a=entry_price,
            executed_price_b=exit_price,
            fee_a_usd=entry_fee,
            fee_b_usd=exit_fee,
            total_fees_usd=total_fees,
            gross_profit_usd=gross_pnl,
            net_profit_usd=net_pnl,
            net_profit_pct=net_pnl / size_usd * 100 if size_usd > 0 else Decimal("0"),
            outcome=TradeOutcome.WON if net_pnl > 0 else TradeOutcome.LOST,
            outcome_reason=f"{strategy} - {broker}",
            resolved_at=now,
            arbitrage_type=f"stock_{strategy}",
        )
        
        # Update stats
        self._update_stats_from_trade(trade)
        
        logger.info(
            f"{'✅' if net_pnl > 0 else '❌'} STOCK: {symbol} {shares}sh {side} "
            f"${size_usd:.2f} | Net: ${net_pnl:+.2f} | "
            f"Fees: ${total_fees:.4f} ({broker})"
        )
        
        return trade

    # =========================================================================
    # FUNDING RATE ARB SIMULATION
    # Simulates delta-neutral funding collection
    # =========================================================================
    async def simulate_funding_trade(
        self,
        symbol: str,
        exchange: str,
        position_size_usd: Decimal,
        funding_rate_pct: Decimal,  # Per 8 hours
        hours_held: float = 8.0,
    ) -> Optional[SimulatedTrade]:
        """
        Simulate a funding rate arbitrage position.
        
        Funding arb is delta-neutral: long spot + short perp
        Profit comes from collecting positive funding payments.
        
        Args:
            symbol: Trading pair (e.g., "BTC/USDT")
            exchange: Exchange name
            position_size_usd: Position size
            funding_rate_pct: Funding rate per 8h as percentage
            hours_held: Hours position was held
        
        Returns:
            SimulatedTrade object
        """
        now = datetime.now(timezone.utc)
        self.stats.opportunities_seen += 1
        
        if self.stats.current_balance < position_size_usd:
            return None
        
        # Calculate funding collected
        funding_periods = hours_held / 8.0
        funding_collected = position_size_usd * (
            funding_rate_pct / 100
        ) * Decimal(str(funding_periods))
        
        # Fees for opening position (entry)
        # Need to buy spot AND short futures
        spot_entry_fee = self.calculate_platform_fee(
            platform=exchange,
            trade_value=position_size_usd,
            gross_profit=Decimal("0"),
            is_futures=False,
            asset_type="crypto"
        )
        futures_entry_fee = self.calculate_platform_fee(
            platform=exchange,
            trade_value=position_size_usd,
            gross_profit=Decimal("0"),
            is_futures=True,
            asset_type="crypto"
        )
        
        # Fees for closing (exit)
        spot_exit_fee = self.calculate_platform_fee(
            platform=exchange,
            trade_value=position_size_usd,
            gross_profit=Decimal("0"),
            is_futures=False,
            asset_type="crypto"
        )
        futures_exit_fee = self.calculate_platform_fee(
            platform=exchange,
            trade_value=position_size_usd,
            gross_profit=Decimal("0"),
            is_futures=True,
            asset_type="crypto"
        )
        
        total_fees = spot_entry_fee + futures_entry_fee + \
                     spot_exit_fee + futures_exit_fee
        net_pnl = funding_collected - total_fees
        
        # Create trade record
        trade = SimulatedTrade(
            id=self._generate_trade_id(),
            created_at=now,
            market_a_id=symbol,
            market_a_title=f"{symbol} Funding Arb",
            market_b_id=f"{symbol}:PERP",
            market_b_title=f"Delta-neutral {hours_held}h",
            platform_a=exchange,
            platform_b=exchange,
            original_price_a=funding_rate_pct,
            original_price_b=Decimal(str(hours_held)),
            original_spread_pct=funding_rate_pct * 3 * 365,  # Annualized
            intended_size_usd=position_size_usd,
            executed_size_usd=position_size_usd,
            fee_a_usd=spot_entry_fee + spot_exit_fee,
            fee_b_usd=futures_entry_fee + futures_exit_fee,
            total_fees_usd=total_fees,
            gross_profit_usd=funding_collected,
            net_profit_usd=net_pnl,
            net_profit_pct=net_pnl / position_size_usd * 100,
            outcome=TradeOutcome.WON if net_pnl > 0 else TradeOutcome.LOST,
            outcome_reason=f"Funding {funding_rate_pct:.4f}%/8h",
            resolved_at=now,
            arbitrage_type="funding_rate_arb",
        )
        
        self._update_stats_from_trade(trade)
        
        logger.info(
            f"{'✅' if net_pnl > 0 else '❌'} FUNDING: {symbol} "
            f"${position_size_usd:.0f} x {hours_held}h | "
            f"Collected: ${funding_collected:.4f} | "
            f"Net: ${net_pnl:+.4f} | Fees: ${total_fees:.4f}"
        )
        
        return trade

    def _update_stats_from_trade(self, trade: SimulatedTrade) -> None:
        """Update statistics from a completed trade."""
        self.trades[trade.id] = trade
        self.stats.opportunities_traded += 1
        self.stats.successful_executions += 1
        self.stats.total_fees_paid += trade.total_fees_usd
        
        if trade.outcome == TradeOutcome.WON:
            self.stats.winning_trades += 1
            self.stats.total_gross_profit += trade.gross_profit_usd
            self.stats.total_net_profit += trade.net_profit_usd
            self.stats.current_balance += trade.net_profit_usd
            if trade.net_profit_usd > self.stats.best_trade_pnl:
                self.stats.best_trade_pnl = trade.net_profit_usd
        else:
            self.stats.losing_trades += 1
            loss_amount = abs(trade.net_profit_usd)
            self.stats.total_losses += loss_amount
            self.stats.current_balance -= loss_amount
            if trade.net_profit_usd < self.stats.worst_trade_pnl:
                self.stats.worst_trade_pnl = trade.net_profit_usd
        
        # Update average
        total_trades = self.stats.winning_trades + self.stats.losing_trades
        if total_trades > 0:
            self.stats.avg_trade_pnl = (
                self.stats.total_net_profit - self.stats.total_losses
            ) / total_trades
        
        if not self.stats.first_trade_at:
            self.stats.first_trade_at = trade.created_at
        self.stats.last_trade_at = trade.created_at

    def get_summary(self) -> str:
        """Get formatted summary of paper trading performance"""
        return f"""
╔══════════════════════════════════════════════════════════════╗
║              📊 REALISTIC PAPER TRADING SUMMARY               ║
╠══════════════════════════════════════════════════════════════╣
║  Starting Balance:     ${self.stats.starting_balance:>10.2f}                   ║
║  Current Balance:      ${self.stats.current_balance:>10.2f}                   ║
║  Total P&L:            ${self.stats.total_pnl:>+10.2f} ({self.stats.roi_pct:>+.1f}%)          ║
╠══════════════════════════════════════════════════════════════╣
║  Opportunities Seen:   {self.stats.opportunities_seen:>10}                        ║
║  Trades Executed:      {self.stats.opportunities_traded:>10}                        ║
║  Execution Rate:       {self.stats.execution_success_rate:>10.1f}%                      ║
╠══════════════════════════════════════════════════════════════╣
║  Winning Trades:       {self.stats.winning_trades:>10}                        ║
║  Losing Trades:        {self.stats.losing_trades:>10}                        ║
║  Win Rate:             {self.stats.win_rate:>10.1f}%                       ║
╠══════════════════════════════════════════════════════════════╣
║  Total Fees Paid:      ${self.stats.total_fees_paid:>10.2f}                   ║
║  Best Trade:           ${self.stats.best_trade_pnl:>+10.2f}                   ║
║  Worst Trade:          ${self.stats.worst_trade_pnl:>+10.2f}                   ║
║  Avg Trade P&L:        ${self.stats.avg_trade_pnl:>+10.2f}                   ║
╚══════════════════════════════════════════════════════════════╝
"""
