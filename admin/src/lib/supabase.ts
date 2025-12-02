import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database
export interface SimulatedTrade {
  id: number;
  position_id: string;
  created_at: string;
  polymarket_token_id: string;
  polymarket_market_title: string;
  kalshi_ticker: string;
  kalshi_market_title: string;
  polymarket_yes_price: number;
  polymarket_no_price: number;
  kalshi_yes_price: number;
  kalshi_no_price: number;
  trade_type: string;
  position_size_usd: number;
  expected_profit_usd: number;
  expected_profit_pct: number;
  outcome: 'pending' | 'won' | 'lost' | 'expired';
  actual_profit_usd: number | null;
  resolved_at: string | null;
  market_result: string | null;
  resolution_notes: string | null;
  is_automated?: boolean;
}

export interface SimulationStats {
  id: number;
  snapshot_at: string;
  stats_json: {
    total_opportunities_seen: number;
    total_simulated_trades: number;
    simulated_starting_balance: string;
    simulated_current_balance: string;
    total_pnl: string;
    winning_trades: number;
    losing_trades: number;
    pending_trades: number;
    win_rate_pct: number;
    roi_pct: number;
    best_trade_profit: string;
    worst_trade_loss: string;
    largest_opportunity_seen_pct: string;
    first_opportunity_at: string | null;
    last_opportunity_at: string | null;
  };
  simulated_balance: number;
  total_pnl: number;
  total_trades: number;
  win_rate: number;
}

export interface BotStatus {
  id: number;
  is_running: boolean;
  dry_run_mode: boolean;
  last_heartbeat_at: string;
  total_opportunities_detected: number;
  total_trades_executed: number;
  total_profit: number;
  daily_profit: number;
  max_trade_size: number;
  min_profit_threshold: number;
  is_paused: boolean;
  pause_reason: string | null;
  updated_at: string;
}

export interface Opportunity {
  id: number;
  opportunity_id: string;
  detected_at: string;
  buy_platform: string;
  sell_platform: string;
  buy_market_id: string;
  sell_market_id: string;
  buy_market_name: string;
  sell_market_name: string;
  buy_price: number;
  sell_price: number;
  profit_percent: number;
  max_size: number;
  total_profit: number;
  confidence: number;
  strategy: string;
  status: string;
  executed_at: string | null;
}

export interface BotConfig {
  id: number;
  polymarket_enabled: boolean;
  kalshi_enabled: boolean;
  min_profit_percent: number;
  max_trade_size: number;
  max_daily_loss: number;
  scan_interval: number;
  updated_at: string;
}

export interface DisabledMarket {
  id: number;
  market_id: string;
  platform: string;
  reason: string | null;
  disabled_at: string;
}

export interface Position {
  id: number;
  position_id: string;
  platform: 'polymarket' | 'kalshi';
  market_id: string;
  market_title: string;
  side: 'yes' | 'no';
  quantity: number;
  avg_price: number;
  current_price: number;
  cost_basis: number;
  current_value: number;
  unrealized_pnl: number;
  is_automated: boolean;
  created_at: string;
  updated_at: string;
}
