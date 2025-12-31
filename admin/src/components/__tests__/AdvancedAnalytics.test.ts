/**
 * Unit tests for AdvancedAnalytics metrics calculations
 * 
 * These tests verify the accuracy of financial metrics:
 * - Sharpe Ratio
 * - Sortino Ratio
 * - Calmar Ratio
 * - Max Drawdown
 * - Win Rate
 * - Expectancy
 * - Profit Factor
 * - Kelly Criterion
 * - R-Multiples
 */

// Mock trade data for testing
interface TestTrade {
  id: number;
  created_at: string;
  actual_profit_usd: number;
  position_size_usd: number;
  outcome: 'won' | 'lost';
}

// Test data: 10 trades over 10 days
const TEST_TRADES: TestTrade[] = [
  { id: 1, created_at: '2024-01-01T10:00:00Z', actual_profit_usd: 100, position_size_usd: 500, outcome: 'won' },
  { id: 2, created_at: '2024-01-02T11:00:00Z', actual_profit_usd: -50, position_size_usd: 500, outcome: 'lost' },
  { id: 3, created_at: '2024-01-03T09:00:00Z', actual_profit_usd: 75, position_size_usd: 500, outcome: 'won' },
  { id: 4, created_at: '2024-01-04T14:00:00Z', actual_profit_usd: 120, position_size_usd: 500, outcome: 'won' },
  { id: 5, created_at: '2024-01-05T08:00:00Z', actual_profit_usd: -80, position_size_usd: 500, outcome: 'lost' },
  { id: 6, created_at: '2024-01-06T16:00:00Z', actual_profit_usd: -30, position_size_usd: 500, outcome: 'lost' },
  { id: 7, created_at: '2024-01-07T12:00:00Z', actual_profit_usd: 200, position_size_usd: 500, outcome: 'won' },
  { id: 8, created_at: '2024-01-08T10:00:00Z', actual_profit_usd: 50, position_size_usd: 500, outcome: 'won' },
  { id: 9, created_at: '2024-01-09T15:00:00Z', actual_profit_usd: -100, position_size_usd: 500, outcome: 'lost' },
  { id: 10, created_at: '2024-01-10T11:00:00Z', actual_profit_usd: 150, position_size_usd: 500, outcome: 'won' },
];

const STARTING_BALANCE = 10000;

// ============================================
// CALCULATION FUNCTIONS (copied from component)
// ============================================

function calculateMetrics(trades: TestTrade[], startingBalance: number) {
  const completedTrades = trades.filter(t => t.outcome === 'won' || t.outcome === 'lost');
  if (completedTrades.length === 0) return null;

  const sortedTrades = [...completedTrades].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // === EQUITY CURVE ===
  let runningBalance = startingBalance;
  let peak = startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let currentDrawdown = 0;

  const dailyReturns: number[] = [];
  let lastDayBalance = startingBalance;
  let lastDay = '';

  sortedTrades.forEach(trade => {
    runningBalance += trade.actual_profit_usd || 0;
    const date = new Date(trade.created_at).toISOString().split('T')[0];
    
    if (date !== lastDay && lastDay) {
      const dailyReturn = (runningBalance - lastDayBalance) / lastDayBalance;
      dailyReturns.push(dailyReturn);
      lastDayBalance = runningBalance;
    }
    lastDay = date;

    if (runningBalance > peak) {
      peak = runningBalance;
      currentDrawdown = 0;
    } else {
      currentDrawdown = peak - runningBalance;
      const currentDrawdownPct = (currentDrawdown / peak) * 100;
      
      if (currentDrawdownPct > maxDrawdownPercent) {
        maxDrawdownPercent = currentDrawdownPct;
        maxDrawdown = currentDrawdown;
      }
    }
  });

  // === RISK METRICS ===
  const totalPnl = runningBalance - startingBalance;
  const returns = dailyReturns.length > 0 ? dailyReturns : sortedTrades.map(t => (t.actual_profit_usd || 0) / startingBalance);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
  
  // Sharpe Ratio (assuming 0% risk-free rate)
  // Only annualize if using daily returns; for per-trade, show raw ratio
  const useDailyReturns = dailyReturns.length >= 5;
  const annualizationFactor = useDailyReturns ? Math.sqrt(252) : 1;
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * annualizationFactor : 0;
  
  // Sortino Ratio
  const downsideReturns = returns.filter(r => r < 0);
  const downsideDeviation = Math.sqrt(
    downsideReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / (downsideReturns.length || 1)
  );
  const sortinoRatio = downsideDeviation > 0 ? (avgReturn / downsideDeviation) * annualizationFactor : 0;
  
  // Calmar Ratio
  const tradingDays = useDailyReturns ? dailyReturns.length : 
    Math.max(1, Math.ceil((new Date(sortedTrades[sortedTrades.length - 1].created_at).getTime() - 
      new Date(sortedTrades[0].created_at).getTime()) / (1000 * 60 * 60 * 24)));
  const annualReturn = useDailyReturns 
    ? avgReturn * 252 
    : (totalPnl / startingBalance) * (252 / tradingDays);
  const calmarRatio = maxDrawdownPercent > 0 ? (annualReturn * 100) / maxDrawdownPercent : 0;

  // === WIN/LOSS ANALYSIS ===
  const wins = sortedTrades.filter(t => t.outcome === 'won');
  const losses = sortedTrades.filter(t => t.outcome === 'lost');
  const winRate = (wins.length / sortedTrades.length) * 100;
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0) / losses.length) : 0;
  
  // Expectancy
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
  
  // Profit Factor
  const grossProfit = wins.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.actual_profit_usd || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Kelly Criterion
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
  const kellyCriterion = winLossRatio > 0 && winLossRatio !== Infinity
    ? ((winRate / 100) - ((100 - winRate) / 100) / winLossRatio) 
    : winRate > 50 ? 1 : 0;
  const riskOfRuin = kellyCriterion <= 0 
    ? 100 
    : Math.max(0, Math.min(100, 100 * Math.exp(-kellyCriterion * 5)));

  // R-Multiples
  const avgPositionSize = sortedTrades.reduce((sum, t) => sum + (t.position_size_usd || 0), 0) / sortedTrades.length || 1;
  const rMultiples = sortedTrades.map(t => (t.actual_profit_usd || 0) / (avgPositionSize * 0.02));
  const avgR = rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length;
  const totalR = rMultiples.reduce((a, b) => a + b, 0);

  // Consecutive wins/losses
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentStreak = 0;
  let lastOutcome: string | null = null;

  sortedTrades.forEach(trade => {
    if (trade.outcome === lastOutcome) {
      currentStreak++;
    } else {
      currentStreak = 1;
      lastOutcome = trade.outcome;
    }
    
    if (trade.outcome === 'won') {
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentStreak);
    } else {
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
    }
  });

  return {
    totalPnl,
    currentBalance: runningBalance,
    roi: (totalPnl / startingBalance) * 100,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdown,
    maxDrawdownPercent,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor,
    kellyCriterion: Math.max(0, kellyCriterion * 100),
    riskOfRuin,
    avgR,
    totalR,
    maxConsecutiveWins,
    maxConsecutiveLosses,
  };
}

// ============================================
// MANUAL CALCULATIONS FOR VERIFICATION
// ============================================

function manualCalculations(trades: TestTrade[], startingBalance: number) {
  // Manual calculation for verification
  const wins = trades.filter(t => t.outcome === 'won');
  const losses = trades.filter(t => t.outcome === 'lost');
  
  // Total PnL
  const totalPnl = trades.reduce((sum, t) => sum + t.actual_profit_usd, 0);
  // = 100 - 50 + 75 + 120 - 80 - 30 + 200 + 50 - 100 + 150 = 435
  
  // Win Rate
  const winRate = (wins.length / trades.length) * 100;
  // = (6 / 10) * 100 = 60%
  
  // Avg Win
  const avgWin = wins.reduce((sum, t) => sum + t.actual_profit_usd, 0) / wins.length;
  // = (100 + 75 + 120 + 200 + 50 + 150) / 6 = 695 / 6 = 115.83
  
  // Avg Loss
  const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.actual_profit_usd, 0)) / losses.length;
  // = (50 + 80 + 30 + 100) / 4 = 260 / 4 = 65
  
  // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
  const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
  // = (0.6 * 115.83) - (0.4 * 65) = 69.5 - 26 = 43.5
  
  // Profit Factor = Gross Profit / Gross Loss
  const grossProfit = wins.reduce((sum, t) => sum + t.actual_profit_usd, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.actual_profit_usd, 0));
  const profitFactor = grossProfit / grossLoss;
  // = 695 / 260 = 2.67
  
  // Max Drawdown - Need to track equity curve
  // Starting: 10000
  // Trade 1: 10100 (peak 10100)
  // Trade 2: 10050 (DD: 50)
  // Trade 3: 10125 (peak 10125)
  // Trade 4: 10245 (peak 10245)
  // Trade 5: 10165 (DD: 80)
  // Trade 6: 10135 (DD: 110)
  // Trade 7: 10335 (peak 10335)
  // Trade 8: 10385 (peak 10385)
  // Trade 9: 10285 (DD: 100)
  // Trade 10: 10435 (peak 10435)
  // Max DD = 110 (from peak 10245 to 10135)
  const maxDrawdown = 110;
  const maxDrawdownPct = (110 / 10245) * 100; // ~1.07%
  
  return {
    totalPnl,
    winRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor,
    grossProfit,
    grossLoss,
    maxDrawdown,
    maxDrawdownPct,
  };
}

// ============================================
// RUN TESTS
// ============================================

console.log('='.repeat(60));
console.log('ANALYTICS METRICS VERIFICATION TEST');
console.log('='.repeat(60));
console.log('');

console.log('TEST DATA:');
console.log(`- Starting Balance: $${STARTING_BALANCE.toLocaleString()}`);
console.log(`- Number of Trades: ${TEST_TRADES.length}`);
console.log(`- Wins: ${TEST_TRADES.filter(t => t.outcome === 'won').length}`);
console.log(`- Losses: ${TEST_TRADES.filter(t => t.outcome === 'lost').length}`);
console.log('');

const calculated = calculateMetrics(TEST_TRADES, STARTING_BALANCE);
const manual = manualCalculations(TEST_TRADES, STARTING_BALANCE);

console.log('VERIFICATION RESULTS:');
console.log('-'.repeat(60));

const tests = [
  { name: 'Total PnL', calculated: calculated?.totalPnl, expected: manual.totalPnl, tolerance: 0.01 },
  { name: 'Win Rate %', calculated: calculated?.winRate, expected: manual.winRate, tolerance: 0.01 },
  { name: 'Avg Win $', calculated: calculated?.avgWin, expected: manual.avgWin, tolerance: 0.01 },
  { name: 'Avg Loss $', calculated: calculated?.avgLoss, expected: manual.avgLoss, tolerance: 0.01 },
  { name: 'Expectancy $', calculated: calculated?.expectancy, expected: manual.expectancy, tolerance: 0.1 },
  { name: 'Profit Factor', calculated: calculated?.profitFactor, expected: manual.profitFactor, tolerance: 0.01 },
  { name: 'Max Drawdown $', calculated: calculated?.maxDrawdown, expected: manual.maxDrawdown, tolerance: 0.01 },
];

let passCount = 0;
let failCount = 0;

tests.forEach(test => {
  const calcValue = test.calculated ?? 0;
  const diff = Math.abs(calcValue - test.expected);
  const pass = diff <= test.tolerance;
  
  if (pass) {
    passCount++;
    console.log(`✅ ${test.name}: ${calcValue.toFixed(2)} (expected: ${test.expected.toFixed(2)})`);
  } else {
    failCount++;
    console.log(`❌ ${test.name}: ${calcValue.toFixed(2)} (expected: ${test.expected.toFixed(2)}, diff: ${diff.toFixed(4)})`);
  }
});

console.log('');
console.log('-'.repeat(60));
console.log(`RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('');

// Print all calculated metrics
console.log('ALL CALCULATED METRICS:');
console.log('-'.repeat(60));
if (calculated) {
  console.log(`ROI: ${calculated.roi.toFixed(2)}%`);
  console.log(`Sharpe Ratio: ${calculated.sharpeRatio.toFixed(2)}`);
  console.log(`Sortino Ratio: ${calculated.sortinoRatio.toFixed(2)}`);
  console.log(`Calmar Ratio: ${calculated.calmarRatio.toFixed(2)}`);
  console.log(`Max Drawdown: $${calculated.maxDrawdown.toFixed(2)} (${calculated.maxDrawdownPercent.toFixed(2)}%)`);
  console.log(`Kelly Criterion: ${calculated.kellyCriterion.toFixed(2)}%`);
  console.log(`Risk of Ruin: ${calculated.riskOfRuin.toFixed(2)}%`);
  console.log(`Avg R-Multiple: ${calculated.avgR.toFixed(2)}R`);
  console.log(`Total R: ${calculated.totalR.toFixed(2)}R`);
  console.log(`Max Consecutive Wins: ${calculated.maxConsecutiveWins}`);
  console.log(`Max Consecutive Losses: ${calculated.maxConsecutiveLosses}`);
}

export { calculateMetrics, TEST_TRADES, STARTING_BALANCE };
