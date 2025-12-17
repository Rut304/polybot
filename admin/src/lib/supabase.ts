
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface BotStatus {
  id?: number;
  user_id?: string;
  is_running: boolean;
  mode: string;
  dry_run_mode?: boolean;
  require_approval?: boolean;
  polymarket_connected: boolean;
  kalshi_connected: boolean;
  updated_at?: string;
}

export interface SimulatedTrade {
  id: number;
  created_at: string;
  platform: string;
  market_title: string;
  outcome: 'won' | 'lost' | 'pending' | 'failed_execution';
  actual_profit_usd: number;
  strategy_type?: string;
  arbitrage_type?: string;
  trade_type?: string;
  trading_mode?: 'paper' | 'live';
  polymarket_yes_price?: number;
  kalshi_yes_price?: number;
  position_size_usd?: number;
  [key: string]: any;
}

export interface SimulationStats {
  snapshot_at: string;
  total_pnl: number;
  simulated_balance: number;
  total_trades: number;
  winning_trades?: number;
  losing_trades?: number;
  best_trade?: number;
  worst_trade?: number;
  [key: string]: any;
}

export interface Opportunity {
  id: number;
  detected_at: string;
  profit_percent: number;
  buy_platform?: string;
  sell_platform?: string;
  [key: string]: any;
}
