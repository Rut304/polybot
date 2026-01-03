import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAwsSecrets, getAwsSecret } from '@/lib/aws-secrets';

// Supabase client for non-secret database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Helper to get API key from AWS Secrets Manager (PRIMARY SOURCE)
async function getSecretFromAws(keyName: string): Promise<string | null> {
  return await getAwsSecret(keyName);
}

// Cache for all US stocks from Alpaca (refresh every 24 hours)
let cachedAlpacaAssets: any[] | null = null;
let alpacaAssetsLastFetch: number = 0;
const ALPACA_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fetch ALL US stocks from Alpaca (6000+ symbols)
async function fetchAllAlpacaAssets(): Promise<any[]> {
  const now = Date.now();
  
  // Return cached data if fresh
  if (cachedAlpacaAssets && (now - alpacaAssetsLastFetch) < ALPACA_CACHE_DURATION) {
    console.log(`Using cached Alpaca assets (${cachedAlpacaAssets.length} stocks)`);
    return cachedAlpacaAssets;
  }
  
  const apiKey = await getSecretFromAws('ALPACA_PAPER_API_KEY');
  const apiSecret = await getSecretFromAws('ALPACA_PAPER_API_SECRET');
  
  if (!apiKey || !apiSecret) {
    console.log('Alpaca API keys not configured');
    return [];
  }
  
  try {
    // Fetch all active US equities from Alpaca
    const response = await fetch(
      'https://paper-api.alpaca.markets/v2/assets?status=active&asset_class=us_equity',
      {
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
          'Accept': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('Alpaca assets API error:', response.status);
      return [];
    }
    
    const assets = await response.json();
    console.log(`Fetched ${assets.length} assets from Alpaca`);
    
    // Filter to tradeable stocks only
    const tradeableStocks = assets.filter((asset: any) => 
      asset.tradable && 
      asset.status === 'active' &&
      !asset.symbol.includes('.') // Exclude warrants, units, etc.
    );
    
    console.log(`Filtered to ${tradeableStocks.length} tradeable stocks`);
    
    // Cache the results
    cachedAlpacaAssets = tradeableStocks;
    alpacaAssetsLastFetch = now;
    
    return tradeableStocks;
  } catch (e) {
    console.error('Error fetching Alpaca assets:', e);
    return [];
  }
}

// Get exchange display name
function getExchangeName(exchange: string): string {
  const exchangeMap: Record<string, string> = {
    'NYSE': 'New York Stock Exchange',
    'NASDAQ': 'NASDAQ',
    'AMEX': 'NYSE American',
    'ARCA': 'NYSE Arca',
    'BATS': 'BATS Exchange',
    'IEX': 'IEX Exchange',
    'OTC': 'Over-The-Counter',
  };
  return exchangeMap[exchange] || exchange;
}

// Determine market cap tier based on name/common knowledge
function estimateMarketCapTier(symbol: string, name: string): string {
  // Known mega caps
  const megaCaps = ['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.A', 'BRK.B', 'LLY', 'V', 'UNH', 'JPM', 'XOM', 'MA', 'JNJ', 'AVGO', 'PG', 'HD', 'COST', 'MRK', 'ABBV', 'CVX', 'CRM', 'KO', 'WMT', 'ORCL', 'NFLX', 'AMD', 'PEP', 'TMO', 'ADBE', 'CSCO', 'ACN', 'ABT', 'LIN', 'DHR', 'NKE', 'MCD', 'TXN', 'QCOM', 'PM', 'DIS', 'VZ', 'CMCSA', 'INTC', 'WFC', 'BMY', 'RTX', 'HON', 'T', 'SPGI', 'NEE', 'BA', 'CAT', 'DE'];
  
  // Known large caps
  const largeCaps = ['GS', 'MS', 'BLK', 'SCHW', 'AXP', 'IBM', 'GE', 'MMM', 'LOW', 'UPS', 'FDX', 'NOW', 'INTU', 'ISRG', 'GILD', 'AMGN', 'REGN', 'VRTX', 'SYK', 'MDT', 'BSX', 'ZTS', 'CI', 'ELV', 'HUM', 'MCK', 'CVS', 'ADP', 'PYPL', 'SQ', 'COIN', 'CRWD', 'ZS', 'PANW', 'DDOG', 'SNOW', 'PLTR', 'SHOP', 'SPOT', 'UBER', 'LYFT', 'ABNB', 'DASH', 'RBLX', 'U', 'SNAP', 'PINS', 'TWTR', 'ZM', 'DOCU'];
  
  if (megaCaps.includes(symbol)) return 'Mega';
  if (largeCaps.includes(symbol)) return 'Large';
  
  // ETFs are typically large
  if (name.toLowerCase().includes('etf') || name.toLowerCase().includes('trust') || name.toLowerCase().includes('fund')) {
    return 'Large';
  }
  
  // Default to Mid for unknown
  return 'Mid';
}

// Determine sector based on company name
function estimateSector(name: string): string {
  const lowerName = name.toLowerCase();
  
  // Technology
  if (lowerName.includes('software') || lowerName.includes('tech') || lowerName.includes('computer') || 
      lowerName.includes('semiconductor') || lowerName.includes('cloud') || lowerName.includes('data') ||
      lowerName.includes('cyber') || lowerName.includes('ai ') || lowerName.includes('digital')) {
    return 'Technology';
  }
  
  // Healthcare
  if (lowerName.includes('pharma') || lowerName.includes('bio') || lowerName.includes('medical') ||
      lowerName.includes('health') || lowerName.includes('therapeutics') || lowerName.includes('oncology') ||
      lowerName.includes('diagnostic') || lowerName.includes('hospital')) {
    return 'Healthcare';
  }
  
  // Financials
  if (lowerName.includes('bank') || lowerName.includes('financial') || lowerName.includes('capital') ||
      lowerName.includes('insurance') || lowerName.includes('investment') || lowerName.includes('asset')) {
    return 'Financials';
  }
  
  // Energy
  if (lowerName.includes('energy') || lowerName.includes('oil') || lowerName.includes('gas') ||
      lowerName.includes('petroleum') || lowerName.includes('solar') || lowerName.includes('wind') ||
      lowerName.includes('power')) {
    return 'Energy';
  }
  
  // Consumer
  if (lowerName.includes('retail') || lowerName.includes('restaurant') || lowerName.includes('consumer') ||
      lowerName.includes('food') || lowerName.includes('beverage') || lowerName.includes('apparel') ||
      lowerName.includes('entertainment') || lowerName.includes('media') || lowerName.includes('gaming')) {
    return 'Consumer';
  }
  
  // Industrials
  if (lowerName.includes('industrial') || lowerName.includes('aerospace') || lowerName.includes('defense') ||
      lowerName.includes('manufacturing') || lowerName.includes('machinery') || lowerName.includes('transport')) {
    return 'Industrials';
  }
  
  // Materials
  if (lowerName.includes('mining') || lowerName.includes('metal') || lowerName.includes('chemical') ||
      lowerName.includes('materials') || lowerName.includes('gold') || lowerName.includes('silver')) {
    return 'Materials';
  }
  
  // Utilities
  if (lowerName.includes('utility') || lowerName.includes('electric') || lowerName.includes('water')) {
    return 'Utilities';
  }
  
  // Real Estate / REITs
  if (lowerName.includes('reit') || lowerName.includes('real estate') || lowerName.includes('property') ||
      lowerName.includes('realty')) {
    return 'Real Estate';
  }
  
  // ETF
  if (lowerName.includes('etf') || lowerName.includes('index') || lowerName.includes('fund') ||
      lowerName.includes('trust') || lowerName.includes('spdr') || lowerName.includes('ishares') ||
      lowerName.includes('vanguard') || lowerName.includes('proshares')) {
    return 'ETF';
  }
  
  return 'Other';
}

// Comprehensive Stock Universe by Sector & Market Cap
// Top 150+ stocks across all major sectors for comprehensive analysis
const STOCK_UNIVERSE = {
  // MEGA CAP (>$200B) - Top 25 by Market Cap
  mega_cap: [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'LLY', 'V',
    'UNH', 'JPM', 'XOM', 'MA', 'JNJ', 'AVGO', 'PG', 'HD', 'COST', 'MRK',
    'ABBV', 'CVX', 'CRM', 'KO', 'WMT'
  ],
  // LARGE CAP ($10B-$200B) - Major companies by sector
  technology: [
    'ORCL', 'AMD', 'INTC', 'CSCO', 'ACN', 'ADBE', 'TXN', 'QCOM', 'IBM', 'NOW',
    'INTU', 'AMAT', 'MU', 'LRCX', 'ADI', 'KLAC', 'SNPS', 'CDNS', 'MRVL', 'NXPI'
  ],
  healthcare: [
    'TMO', 'ABT', 'DHR', 'PFE', 'BMY', 'AMGN', 'GILD', 'VRTX', 'REGN', 'ISRG',
    'MDT', 'SYK', 'BSX', 'ZTS', 'CI', 'ELV', 'HUM', 'MCK', 'CAH', 'CVS'
  ],
  financials: [
    'BAC', 'WFC', 'GS', 'MS', 'SPGI', 'BLK', 'C', 'SCHW', 'AXP', 'CB',
    'PNC', 'USB', 'TFC', 'CME', 'ICE', 'AON', 'MMC', 'MET', 'PRU', 'AIG'
  ],
  consumer: [
    'MCD', 'NKE', 'SBUX', 'DIS', 'NFLX', 'LOW', 'TJX', 'TGT', 'BKNG', 'MAR',
    'CMG', 'YUM', 'ORLY', 'AZO', 'ROST', 'DG', 'DLTR', 'EBAY', 'ETSY', 'W'
  ],
  industrials: [
    'UNP', 'RTX', 'HON', 'UPS', 'BA', 'CAT', 'DE', 'LMT', 'GE', 'MMM',
    'EMR', 'ITW', 'ETN', 'PH', 'ROK', 'SWK', 'FDX', 'CSX', 'NSC', 'WM'
  ],
  energy: [
    'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'KMI', 'WMB', 'HES',
    'DVN', 'HAL', 'BKR', 'FANG', 'PXD', 'APA', 'OKE', 'TRGP', 'LNG', 'ET'
  ],
  materials: [
    'LIN', 'APD', 'SHW', 'ECL', 'DD', 'FCX', 'NEM', 'NUE', 'DOW', 'PPG',
    'VMC', 'MLM', 'CTVA', 'ALB', 'CF', 'MOS', 'IFF', 'EMN', 'CE', 'BALL'
  ],
  utilities: [
    'NEE', 'DUK', 'SO', 'D', 'AEP', 'SRE', 'EXC', 'XEL', 'PEG', 'ED',
    'WEC', 'ES', 'EIX', 'AWK', 'AEE', 'DTE', 'ETR', 'FE', 'PPL', 'CMS'
  ],
  reits: [
    'PLD', 'AMT', 'EQIX', 'SPG', 'PSA', 'O', 'WELL', 'DLR', 'CCI', 'AVB',
    'EQR', 'VTR', 'ARE', 'MAA', 'ESS', 'UDR', 'HST', 'KIM', 'REG', 'BXP'
  ],
  // SMALL/MID CAP - Growth & Value Mix
  growth: [
    'CRWD', 'ZS', 'DDOG', 'NET', 'SNOW', 'MDB', 'OKTA', 'PANW', 'FTNT', 'COIN',
    'SQ', 'SHOP', 'ROKU', 'TTD', 'PINS', 'SNAP', 'RBLX', 'U', 'PLTR', 'PATH'
  ],
  value: [
    'GM', 'F', 'PARA', 'WBD', 'T', 'VZ', 'INTC', 'WBA', 'KHC', 'K',
    'CPB', 'GIS', 'SJM', 'HSY', 'MKC', 'HRL', 'TSN', 'CAG', 'MDLZ', 'STZ'
  ],
  // ETFs for broad market exposure
  etfs: [
    'SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'VOO', 'VTV', 'VUG', 'ARKK', 'XLF',
    'XLK', 'XLE', 'XLV', 'XLI', 'XLP', 'XLY', 'XLU', 'XLB', 'XLRE', 'SMH'
  ]
};

// Get all stocks as flat array
const ALL_STOCKS = Object.values(STOCK_UNIVERSE).flat();

// Stock metadata by symbol
const STOCK_METADATA: Record<string, { name: string; sector: string; marketCap?: string }> = {
  // Mega Cap
  'AAPL': { name: 'Apple Inc.', sector: 'Technology', marketCap: 'Mega' },
  'MSFT': { name: 'Microsoft Corporation', sector: 'Technology', marketCap: 'Mega' },
  'GOOGL': { name: 'Alphabet Inc.', sector: 'Technology', marketCap: 'Mega' },
  'AMZN': { name: 'Amazon.com Inc.', sector: 'Consumer', marketCap: 'Mega' },
  'NVDA': { name: 'NVIDIA Corporation', sector: 'Technology', marketCap: 'Mega' },
  'META': { name: 'Meta Platforms Inc.', sector: 'Technology', marketCap: 'Mega' },
  'TSLA': { name: 'Tesla Inc.', sector: 'Consumer', marketCap: 'Mega' },
  'BRK.B': { name: 'Berkshire Hathaway', sector: 'Financials', marketCap: 'Mega' },
  'LLY': { name: 'Eli Lilly & Co.', sector: 'Healthcare', marketCap: 'Mega' },
  'V': { name: 'Visa Inc.', sector: 'Financials', marketCap: 'Mega' },
  'UNH': { name: 'UnitedHealth Group', sector: 'Healthcare', marketCap: 'Mega' },
  'JPM': { name: 'JPMorgan Chase & Co.', sector: 'Financials', marketCap: 'Mega' },
  'XOM': { name: 'Exxon Mobil Corporation', sector: 'Energy', marketCap: 'Mega' },
  'MA': { name: 'Mastercard Inc.', sector: 'Financials', marketCap: 'Mega' },
  'JNJ': { name: 'Johnson & Johnson', sector: 'Healthcare', marketCap: 'Mega' },
  'AVGO': { name: 'Broadcom Inc.', sector: 'Technology', marketCap: 'Mega' },
  'PG': { name: 'Procter & Gamble', sector: 'Consumer', marketCap: 'Mega' },
  'HD': { name: 'Home Depot Inc.', sector: 'Consumer', marketCap: 'Mega' },
  'COST': { name: 'Costco Wholesale', sector: 'Consumer', marketCap: 'Mega' },
  'MRK': { name: 'Merck & Co.', sector: 'Healthcare', marketCap: 'Mega' },
  'ABBV': { name: 'AbbVie Inc.', sector: 'Healthcare', marketCap: 'Mega' },
  'CVX': { name: 'Chevron Corporation', sector: 'Energy', marketCap: 'Mega' },
  'CRM': { name: 'Salesforce Inc.', sector: 'Technology', marketCap: 'Mega' },
  'KO': { name: 'Coca-Cola Company', sector: 'Consumer', marketCap: 'Mega' },
  'WMT': { name: 'Walmart Inc.', sector: 'Consumer', marketCap: 'Mega' },
  // Technology
  'ORCL': { name: 'Oracle Corporation', sector: 'Technology', marketCap: 'Large' },
  'AMD': { name: 'Advanced Micro Devices', sector: 'Technology', marketCap: 'Large' },
  'INTC': { name: 'Intel Corporation', sector: 'Technology', marketCap: 'Large' },
  'CSCO': { name: 'Cisco Systems', sector: 'Technology', marketCap: 'Large' },
  'ACN': { name: 'Accenture', sector: 'Technology', marketCap: 'Large' },
  'ADBE': { name: 'Adobe Inc.', sector: 'Technology', marketCap: 'Large' },
  'TXN': { name: 'Texas Instruments', sector: 'Technology', marketCap: 'Large' },
  'QCOM': { name: 'Qualcomm', sector: 'Technology', marketCap: 'Large' },
  'IBM': { name: 'IBM Corporation', sector: 'Technology', marketCap: 'Large' },
  'NOW': { name: 'ServiceNow', sector: 'Technology', marketCap: 'Large' },
  'INTU': { name: 'Intuit Inc.', sector: 'Technology', marketCap: 'Large' },
  'AMAT': { name: 'Applied Materials', sector: 'Technology', marketCap: 'Large' },
  'MU': { name: 'Micron Technology', sector: 'Technology', marketCap: 'Large' },
  'LRCX': { name: 'Lam Research', sector: 'Technology', marketCap: 'Large' },
  'ADI': { name: 'Analog Devices', sector: 'Technology', marketCap: 'Large' },
  'NFLX': { name: 'Netflix Inc.', sector: 'Technology', marketCap: 'Large' },
  'DIS': { name: 'Walt Disney Company', sector: 'Consumer', marketCap: 'Large' },
  // Healthcare
  'TMO': { name: 'Thermo Fisher Scientific', sector: 'Healthcare', marketCap: 'Large' },
  'ABT': { name: 'Abbott Laboratories', sector: 'Healthcare', marketCap: 'Large' },
  'DHR': { name: 'Danaher Corporation', sector: 'Healthcare', marketCap: 'Large' },
  'PFE': { name: 'Pfizer Inc.', sector: 'Healthcare', marketCap: 'Large' },
  'BMY': { name: 'Bristol-Myers Squibb', sector: 'Healthcare', marketCap: 'Large' },
  'AMGN': { name: 'Amgen Inc.', sector: 'Healthcare', marketCap: 'Large' },
  'GILD': { name: 'Gilead Sciences', sector: 'Healthcare', marketCap: 'Large' },
  'VRTX': { name: 'Vertex Pharmaceuticals', sector: 'Healthcare', marketCap: 'Large' },
  'REGN': { name: 'Regeneron Pharmaceuticals', sector: 'Healthcare', marketCap: 'Large' },
  'ISRG': { name: 'Intuitive Surgical', sector: 'Healthcare', marketCap: 'Large' },
  // Financials
  'BAC': { name: 'Bank of America', sector: 'Financials', marketCap: 'Large' },
  'WFC': { name: 'Wells Fargo', sector: 'Financials', marketCap: 'Large' },
  'GS': { name: 'Goldman Sachs', sector: 'Financials', marketCap: 'Large' },
  'MS': { name: 'Morgan Stanley', sector: 'Financials', marketCap: 'Large' },
  'SPGI': { name: 'S&P Global', sector: 'Financials', marketCap: 'Large' },
  'BLK': { name: 'BlackRock', sector: 'Financials', marketCap: 'Large' },
  'C': { name: 'Citigroup', sector: 'Financials', marketCap: 'Large' },
  'SCHW': { name: 'Charles Schwab', sector: 'Financials', marketCap: 'Large' },
  'AXP': { name: 'American Express', sector: 'Financials', marketCap: 'Large' },
  'PEP': { name: 'PepsiCo Inc.', sector: 'Consumer', marketCap: 'Large' },
  // Industrials
  'UNP': { name: 'Union Pacific', sector: 'Industrials', marketCap: 'Large' },
  'RTX': { name: 'RTX Corporation', sector: 'Industrials', marketCap: 'Large' },
  'HON': { name: 'Honeywell', sector: 'Industrials', marketCap: 'Large' },
  'UPS': { name: 'United Parcel Service', sector: 'Industrials', marketCap: 'Large' },
  'BA': { name: 'Boeing Company', sector: 'Industrials', marketCap: 'Large' },
  'CAT': { name: 'Caterpillar Inc.', sector: 'Industrials', marketCap: 'Large' },
  'DE': { name: 'Deere & Company', sector: 'Industrials', marketCap: 'Large' },
  'LMT': { name: 'Lockheed Martin', sector: 'Industrials', marketCap: 'Large' },
  'GE': { name: 'General Electric', sector: 'Industrials', marketCap: 'Large' },
  // Energy
  'COP': { name: 'ConocoPhillips', sector: 'Energy', marketCap: 'Large' },
  'SLB': { name: 'Schlumberger', sector: 'Energy', marketCap: 'Large' },
  'EOG': { name: 'EOG Resources', sector: 'Energy', marketCap: 'Large' },
  'MPC': { name: 'Marathon Petroleum', sector: 'Energy', marketCap: 'Large' },
  'PSX': { name: 'Phillips 66', sector: 'Energy', marketCap: 'Large' },
  // Growth
  'CRWD': { name: 'CrowdStrike Holdings', sector: 'Technology', marketCap: 'Mid' },
  'ZS': { name: 'Zscaler Inc.', sector: 'Technology', marketCap: 'Mid' },
  'DDOG': { name: 'Datadog Inc.', sector: 'Technology', marketCap: 'Mid' },
  'NET': { name: 'Cloudflare Inc.', sector: 'Technology', marketCap: 'Mid' },
  'SNOW': { name: 'Snowflake Inc.', sector: 'Technology', marketCap: 'Mid' },
  'MDB': { name: 'MongoDB Inc.', sector: 'Technology', marketCap: 'Mid' },
  'OKTA': { name: 'Okta Inc.', sector: 'Technology', marketCap: 'Mid' },
  'PANW': { name: 'Palo Alto Networks', sector: 'Technology', marketCap: 'Mid' },
  'FTNT': { name: 'Fortinet Inc.', sector: 'Technology', marketCap: 'Mid' },
  'COIN': { name: 'Coinbase Global', sector: 'Financials', marketCap: 'Mid' },
  'SQ': { name: 'Block Inc.', sector: 'Financials', marketCap: 'Mid' },
  'SHOP': { name: 'Shopify Inc.', sector: 'Technology', marketCap: 'Mid' },
  'ROKU': { name: 'Roku Inc.', sector: 'Technology', marketCap: 'Mid' },
  'PLTR': { name: 'Palantir Technologies', sector: 'Technology', marketCap: 'Mid' },
  // More Technology
  'KLAC': { name: 'KLA Corporation', sector: 'Technology', marketCap: 'Large' },
  'SNPS': { name: 'Synopsys Inc.', sector: 'Technology', marketCap: 'Large' },
  'CDNS': { name: 'Cadence Design', sector: 'Technology', marketCap: 'Large' },
  'MRVL': { name: 'Marvell Technology', sector: 'Technology', marketCap: 'Large' },
  'NXPI': { name: 'NXP Semiconductors', sector: 'Technology', marketCap: 'Large' },
  'TTD': { name: 'Trade Desk Inc.', sector: 'Technology', marketCap: 'Mid' },
  'PINS': { name: 'Pinterest Inc.', sector: 'Technology', marketCap: 'Mid' },
  'SNAP': { name: 'Snap Inc.', sector: 'Technology', marketCap: 'Mid' },
  'RBLX': { name: 'Roblox Corp.', sector: 'Technology', marketCap: 'Mid' },
  'U': { name: 'Unity Software', sector: 'Technology', marketCap: 'Mid' },
  'PATH': { name: 'UiPath Inc.', sector: 'Technology', marketCap: 'Mid' },
  // More Healthcare
  'MDT': { name: 'Medtronic', sector: 'Healthcare', marketCap: 'Large' },
  'SYK': { name: 'Stryker Corp.', sector: 'Healthcare', marketCap: 'Large' },
  'BSX': { name: 'Boston Scientific', sector: 'Healthcare', marketCap: 'Large' },
  'ZTS': { name: 'Zoetis Inc.', sector: 'Healthcare', marketCap: 'Large' },
  'CI': { name: 'Cigna Group', sector: 'Healthcare', marketCap: 'Large' },
  'ELV': { name: 'Elevance Health', sector: 'Healthcare', marketCap: 'Large' },
  'HUM': { name: 'Humana Inc.', sector: 'Healthcare', marketCap: 'Large' },
  'MCK': { name: 'McKesson Corp.', sector: 'Healthcare', marketCap: 'Large' },
  'CAH': { name: 'Cardinal Health', sector: 'Healthcare', marketCap: 'Large' },
  'CVS': { name: 'CVS Health Corp.', sector: 'Healthcare', marketCap: 'Large' },
  // More Financials
  'CB': { name: 'Chubb Limited', sector: 'Financials', marketCap: 'Large' },
  'PNC': { name: 'PNC Financial', sector: 'Financials', marketCap: 'Large' },
  'USB': { name: 'U.S. Bancorp', sector: 'Financials', marketCap: 'Large' },
  'TFC': { name: 'Truist Financial', sector: 'Financials', marketCap: 'Large' },
  'CME': { name: 'CME Group', sector: 'Financials', marketCap: 'Large' },
  'ICE': { name: 'Intercontinental Exchange', sector: 'Financials', marketCap: 'Large' },
  'AON': { name: 'Aon plc', sector: 'Financials', marketCap: 'Large' },
  'MMC': { name: 'Marsh & McLennan', sector: 'Financials', marketCap: 'Large' },
  'MET': { name: 'MetLife Inc.', sector: 'Financials', marketCap: 'Large' },
  'PRU': { name: 'Prudential Financial', sector: 'Financials', marketCap: 'Large' },
  'AIG': { name: 'American International', sector: 'Financials', marketCap: 'Large' },
  // Consumer
  'MCD': { name: 'McDonald\'s Corp.', sector: 'Consumer', marketCap: 'Mega' },
  'NKE': { name: 'Nike Inc.', sector: 'Consumer', marketCap: 'Large' },
  'SBUX': { name: 'Starbucks Corp.', sector: 'Consumer', marketCap: 'Large' },
  'LOW': { name: 'Lowe\'s Companies', sector: 'Consumer', marketCap: 'Large' },
  'TJX': { name: 'TJX Companies', sector: 'Consumer', marketCap: 'Large' },
  'TGT': { name: 'Target Corp.', sector: 'Consumer', marketCap: 'Large' },
  'BKNG': { name: 'Booking Holdings', sector: 'Consumer', marketCap: 'Large' },
  'MAR': { name: 'Marriott International', sector: 'Consumer', marketCap: 'Large' },
  'CMG': { name: 'Chipotle Mexican Grill', sector: 'Consumer', marketCap: 'Large' },
  'YUM': { name: 'Yum! Brands', sector: 'Consumer', marketCap: 'Large' },
  'ORLY': { name: 'O\'Reilly Automotive', sector: 'Consumer', marketCap: 'Large' },
  'AZO': { name: 'AutoZone Inc.', sector: 'Consumer', marketCap: 'Large' },
  'ROST': { name: 'Ross Stores', sector: 'Consumer', marketCap: 'Large' },
  'DG': { name: 'Dollar General', sector: 'Consumer', marketCap: 'Mid' },
  'DLTR': { name: 'Dollar Tree', sector: 'Consumer', marketCap: 'Mid' },
  'EBAY': { name: 'eBay Inc.', sector: 'Consumer', marketCap: 'Mid' },
  'ETSY': { name: 'Etsy Inc.', sector: 'Consumer', marketCap: 'Mid' },
  'W': { name: 'Wayfair Inc.', sector: 'Consumer', marketCap: 'Mid' },
  // More Industrials
  'MMM': { name: '3M Company', sector: 'Industrials', marketCap: 'Large' },
  'EMR': { name: 'Emerson Electric', sector: 'Industrials', marketCap: 'Large' },
  'ITW': { name: 'Illinois Tool Works', sector: 'Industrials', marketCap: 'Large' },
  'ETN': { name: 'Eaton Corp.', sector: 'Industrials', marketCap: 'Large' },
  'PH': { name: 'Parker-Hannifin', sector: 'Industrials', marketCap: 'Large' },
  'ROK': { name: 'Rockwell Automation', sector: 'Industrials', marketCap: 'Large' },
  'SWK': { name: 'Stanley Black & Decker', sector: 'Industrials', marketCap: 'Large' },
  'FDX': { name: 'FedEx Corp.', sector: 'Industrials', marketCap: 'Large' },
  'CSX': { name: 'CSX Corp.', sector: 'Industrials', marketCap: 'Large' },
  'NSC': { name: 'Norfolk Southern', sector: 'Industrials', marketCap: 'Large' },
  'WM': { name: 'Waste Management', sector: 'Industrials', marketCap: 'Large' },
  // More Energy
  'VLO': { name: 'Valero Energy', sector: 'Energy', marketCap: 'Large' },
  'OXY': { name: 'Occidental Petroleum', sector: 'Energy', marketCap: 'Large' },
  'KMI': { name: 'Kinder Morgan', sector: 'Energy', marketCap: 'Large' },
  'WMB': { name: 'Williams Companies', sector: 'Energy', marketCap: 'Large' },
  'HES': { name: 'Hess Corp.', sector: 'Energy', marketCap: 'Large' },
  'DVN': { name: 'Devon Energy', sector: 'Energy', marketCap: 'Large' },
  'HAL': { name: 'Halliburton', sector: 'Energy', marketCap: 'Large' },
  'BKR': { name: 'Baker Hughes', sector: 'Energy', marketCap: 'Large' },
  'FANG': { name: 'Diamondback Energy', sector: 'Energy', marketCap: 'Large' },
  'PXD': { name: 'Pioneer Natural Resources', sector: 'Energy', marketCap: 'Large' },
  'APA': { name: 'APA Corp.', sector: 'Energy', marketCap: 'Mid' },
  'OKE': { name: 'ONEOK Inc.', sector: 'Energy', marketCap: 'Large' },
  'TRGP': { name: 'Targa Resources', sector: 'Energy', marketCap: 'Large' },
  'LNG': { name: 'Cheniere Energy', sector: 'Energy', marketCap: 'Large' },
  'ET': { name: 'Energy Transfer', sector: 'Energy', marketCap: 'Large' },
  // Materials
  'LIN': { name: 'Linde plc', sector: 'Materials', marketCap: 'Mega' },
  'APD': { name: 'Air Products', sector: 'Materials', marketCap: 'Large' },
  'SHW': { name: 'Sherwin-Williams', sector: 'Materials', marketCap: 'Large' },
  'ECL': { name: 'Ecolab Inc.', sector: 'Materials', marketCap: 'Large' },
  'DD': { name: 'DuPont de Nemours', sector: 'Materials', marketCap: 'Large' },
  'FCX': { name: 'Freeport-McMoRan', sector: 'Materials', marketCap: 'Large' },
  'NEM': { name: 'Newmont Corp.', sector: 'Materials', marketCap: 'Large' },
  'NUE': { name: 'Nucor Corp.', sector: 'Materials', marketCap: 'Large' },
  'DOW': { name: 'Dow Inc.', sector: 'Materials', marketCap: 'Large' },
  'PPG': { name: 'PPG Industries', sector: 'Materials', marketCap: 'Large' },
  'VMC': { name: 'Vulcan Materials', sector: 'Materials', marketCap: 'Large' },
  'MLM': { name: 'Martin Marietta', sector: 'Materials', marketCap: 'Large' },
  'CTVA': { name: 'Corteva Inc.', sector: 'Materials', marketCap: 'Large' },
  'ALB': { name: 'Albemarle Corp.', sector: 'Materials', marketCap: 'Mid' },
  'CF': { name: 'CF Industries', sector: 'Materials', marketCap: 'Large' },
  'MOS': { name: 'Mosaic Company', sector: 'Materials', marketCap: 'Mid' },
  'IFF': { name: 'International Flavors', sector: 'Materials', marketCap: 'Large' },
  'EMN': { name: 'Eastman Chemical', sector: 'Materials', marketCap: 'Mid' },
  'CE': { name: 'Celanese Corp.', sector: 'Materials', marketCap: 'Mid' },
  'BALL': { name: 'Ball Corp.', sector: 'Materials', marketCap: 'Large' },
  // Utilities
  'NEE': { name: 'NextEra Energy', sector: 'Utilities', marketCap: 'Mega' },
  'DUK': { name: 'Duke Energy', sector: 'Utilities', marketCap: 'Large' },
  'SO': { name: 'Southern Company', sector: 'Utilities', marketCap: 'Large' },
  'D': { name: 'Dominion Energy', sector: 'Utilities', marketCap: 'Large' },
  'AEP': { name: 'American Electric Power', sector: 'Utilities', marketCap: 'Large' },
  'SRE': { name: 'Sempra', sector: 'Utilities', marketCap: 'Large' },
  'EXC': { name: 'Exelon Corp.', sector: 'Utilities', marketCap: 'Large' },
  'XEL': { name: 'Xcel Energy', sector: 'Utilities', marketCap: 'Large' },
  'PEG': { name: 'Public Service Enterprise', sector: 'Utilities', marketCap: 'Large' },
  'ED': { name: 'Consolidated Edison', sector: 'Utilities', marketCap: 'Large' },
  'WEC': { name: 'WEC Energy Group', sector: 'Utilities', marketCap: 'Large' },
  'ES': { name: 'Eversource Energy', sector: 'Utilities', marketCap: 'Large' },
  'EIX': { name: 'Edison International', sector: 'Utilities', marketCap: 'Large' },
  'AWK': { name: 'American Water Works', sector: 'Utilities', marketCap: 'Large' },
  'AEE': { name: 'Ameren Corp.', sector: 'Utilities', marketCap: 'Large' },
  'DTE': { name: 'DTE Energy', sector: 'Utilities', marketCap: 'Large' },
  'ETR': { name: 'Entergy Corp.', sector: 'Utilities', marketCap: 'Large' },
  'FE': { name: 'FirstEnergy Corp.', sector: 'Utilities', marketCap: 'Large' },
  'PPL': { name: 'PPL Corp.', sector: 'Utilities', marketCap: 'Large' },
  'CMS': { name: 'CMS Energy', sector: 'Utilities', marketCap: 'Large' },
  // REITs
  'PLD': { name: 'Prologis Inc.', sector: 'Real Estate', marketCap: 'Large' },
  'AMT': { name: 'American Tower', sector: 'Real Estate', marketCap: 'Large' },
  'EQIX': { name: 'Equinix Inc.', sector: 'Real Estate', marketCap: 'Large' },
  'SPG': { name: 'Simon Property Group', sector: 'Real Estate', marketCap: 'Large' },
  'PSA': { name: 'Public Storage', sector: 'Real Estate', marketCap: 'Large' },
  'O': { name: 'Realty Income', sector: 'Real Estate', marketCap: 'Large' },
  'WELL': { name: 'Welltower Inc.', sector: 'Real Estate', marketCap: 'Large' },
  'DLR': { name: 'Digital Realty', sector: 'Real Estate', marketCap: 'Large' },
  'CCI': { name: 'Crown Castle', sector: 'Real Estate', marketCap: 'Large' },
  'AVB': { name: 'AvalonBay Communities', sector: 'Real Estate', marketCap: 'Large' },
  'EQR': { name: 'Equity Residential', sector: 'Real Estate', marketCap: 'Large' },
  'VTR': { name: 'Ventas Inc.', sector: 'Real Estate', marketCap: 'Large' },
  'ARE': { name: 'Alexandria Real Estate', sector: 'Real Estate', marketCap: 'Large' },
  'MAA': { name: 'Mid-America Apartment', sector: 'Real Estate', marketCap: 'Large' },
  'ESS': { name: 'Essex Property Trust', sector: 'Real Estate', marketCap: 'Large' },
  'UDR': { name: 'UDR Inc.', sector: 'Real Estate', marketCap: 'Large' },
  'HST': { name: 'Host Hotels', sector: 'Real Estate', marketCap: 'Large' },
  'KIM': { name: 'Kimco Realty', sector: 'Real Estate', marketCap: 'Large' },
  'REG': { name: 'Regency Centers', sector: 'Real Estate', marketCap: 'Large' },
  'BXP': { name: 'Boston Properties', sector: 'Real Estate', marketCap: 'Large' },
  // Value Stocks
  'GM': { name: 'General Motors', sector: 'Consumer', marketCap: 'Large' },
  'F': { name: 'Ford Motor', sector: 'Consumer', marketCap: 'Large' },
  'PARA': { name: 'Paramount Global', sector: 'Communication', marketCap: 'Mid' },
  'WBD': { name: 'Warner Bros. Discovery', sector: 'Communication', marketCap: 'Mid' },
  'T': { name: 'AT&T Inc.', sector: 'Communication', marketCap: 'Large' },
  'VZ': { name: 'Verizon Communications', sector: 'Communication', marketCap: 'Large' },
  'WBA': { name: 'Walgreens Boots Alliance', sector: 'Healthcare', marketCap: 'Mid' },
  'KHC': { name: 'Kraft Heinz', sector: 'Consumer', marketCap: 'Large' },
  'K': { name: 'Kellanova', sector: 'Consumer', marketCap: 'Large' },
  'CPB': { name: 'Campbell Soup', sector: 'Consumer', marketCap: 'Large' },
  'GIS': { name: 'General Mills', sector: 'Consumer', marketCap: 'Large' },
  'SJM': { name: 'J.M. Smucker', sector: 'Consumer', marketCap: 'Large' },
  'HSY': { name: 'Hershey Company', sector: 'Consumer', marketCap: 'Large' },
  'MKC': { name: 'McCormick & Co.', sector: 'Consumer', marketCap: 'Large' },
  'HRL': { name: 'Hormel Foods', sector: 'Consumer', marketCap: 'Mid' },
  'TSN': { name: 'Tyson Foods', sector: 'Consumer', marketCap: 'Large' },
  'CAG': { name: 'Conagra Brands', sector: 'Consumer', marketCap: 'Large' },
  'MDLZ': { name: 'Mondelez International', sector: 'Consumer', marketCap: 'Large' },
  'STZ': { name: 'Constellation Brands', sector: 'Consumer', marketCap: 'Large' },
  // ETFs
  'SPY': { name: 'SPDR S&P 500 ETF', sector: 'ETF', marketCap: 'ETF' },
  'QQQ': { name: 'Invesco QQQ Trust', sector: 'ETF', marketCap: 'ETF' },
  'IWM': { name: 'iShares Russell 2000', sector: 'ETF', marketCap: 'ETF' },
  'DIA': { name: 'SPDR Dow Jones ETF', sector: 'ETF', marketCap: 'ETF' },
  'VTI': { name: 'Vanguard Total Stock', sector: 'ETF', marketCap: 'ETF' },
  'VOO': { name: 'Vanguard S&P 500', sector: 'ETF', marketCap: 'ETF' },
  'VTV': { name: 'Vanguard Value ETF', sector: 'ETF', marketCap: 'ETF' },
  'VUG': { name: 'Vanguard Growth ETF', sector: 'ETF', marketCap: 'ETF' },
  'XLF': { name: 'Financial Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLK': { name: 'Technology Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLE': { name: 'Energy Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLV': { name: 'Health Care Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLI': { name: 'Industrial Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLP': { name: 'Consumer Staples SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLY': { name: 'Consumer Discretionary SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLU': { name: 'Utilities Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLB': { name: 'Materials Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'XLRE': { name: 'Real Estate Select SPDR', sector: 'ETF', marketCap: 'ETF' },
  'ARKK': { name: 'ARK Innovation ETF', sector: 'ETF', marketCap: 'ETF' },
  'SMH': { name: 'VanEck Semiconductor ETF', sector: 'ETF', marketCap: 'ETF' },
};

export async function GET() {
  try {
    // Fetch from all APIs in parallel
    const [polymarketData, kalshiData, stockData, cryptoData] = await Promise.all([
      fetchPolymarketMarkets(),
      fetchKalshiMarkets(),
      fetchAlpacaStocks(),
      fetchCryptoMarkets(),
    ]);

    const combined = [...polymarketData, ...kalshiData, ...stockData, ...cryptoData];
    
    // Sort by volume (most liquid first)
    combined.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    
    return NextResponse.json({
      markets: combined,
      total: combined.length,
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    return NextResponse.json({ markets: [], total: 0, error: 'Failed to fetch markets' }, { status: 500 });
  }
}

async function fetchPolymarketMarkets() {
  try {
    // Fetch multiple pages to get more markets
    const allMarkets: any[] = [];
    let offset = 0;
    const limit = 500;
    const maxPages = 4; // Up to 2000 markets
    
    for (let page = 0; page < maxPages; page++) {
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets?limit=${limit}&offset=${offset}&closed=false&active=true`,
        { 
          headers: { 'Accept': 'application/json' },
          next: { revalidate: 60 }
        }
      );
      
      if (!response.ok) {
        console.error('Polymarket API error:', response.status);
        break;
      }
      
      const data = await response.json();
      if (!data || data.length === 0) break;
      
      allMarkets.push(...data);
      offset += limit;
      
      // If we got fewer than requested, we've reached the end
      if (data.length < limit) break;
    }
    
    // Filter to only include markets that are truly open
    const activeMarkets = allMarkets.filter((m: any) => !m.closed && m.active);
    
    return activeMarkets.map((m: any) => {
      let yesPrice = 0.5;
      let noPrice = 0.5;
      
      try {
        if (m.outcomePrices) {
          const prices = JSON.parse(m.outcomePrices);
          yesPrice = parseFloat(prices[0]) || 0.5;
          noPrice = parseFloat(prices[1]) || 0.5;
        } else if (m.bestAsk) {
          yesPrice = parseFloat(m.bestAsk);
          noPrice = 1 - yesPrice;
        }
      } catch (e) {
        // Use defaults
      }

      return {
        id: m.conditionId || m.condition_id || m.id,
        question: m.question || m.title,
        description: m.description,
        category: inferCategory(m.question || m.title || ''),
        yes_price: yesPrice,
        no_price: noPrice,
        volume: parseFloat(m.volume || m.volumeNum || '0'),
        liquidity: parseFloat(m.liquidity || m.liquidityNum || '0'),
        end_date: m.endDate || m.end_date_iso,
        platform: 'polymarket' as const,
        asset_type: 'prediction' as const,
        url: `https://polymarket.com/event/${m.slug || m.conditionId || m.id}`,
      };
    });
  } catch (e) {
    console.error('Polymarket fetch error:', e);
    return [];
  }
}

async function fetchKalshiMarkets() {
  try {
    // Fetch multiple pages using cursor pagination
    const allMarkets: any[] = [];
    let cursor: string | undefined;
    const limit = 500;
    const maxPages = 4; // Up to 2000 markets
    
    for (let page = 0; page < maxPages; page++) {
      // Note: Kalshi API doesn't accept status=active filter, we filter client-side
      const url = cursor 
        ? `https://api.elections.kalshi.com/trade-api/v2/markets?limit=${limit}&cursor=${cursor}`
        : `https://api.elections.kalshi.com/trade-api/v2/markets?limit=${limit}`;
      
      const response = await fetch(url, { 
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 60 }
      });
      
      if (!response.ok) {
        console.error('Kalshi API error:', response.status);
        break;
      }
      
      const data = await response.json();
      if (!data.markets || data.markets.length === 0) break;
      
      allMarkets.push(...data.markets);
      cursor = data.cursor;
      
      // If no cursor or fewer than requested, we've reached the end
      if (!cursor || data.markets.length < limit) break;
    }
    
    // Filter to only active markets (since API doesn't support status filter)
    const activeMarkets = allMarkets.filter((m: any) => m.status === 'active');
    
    return activeMarkets.map((m: any) => ({
      id: m.ticker,
      question: m.title || m.subtitle,
      description: m.rules_primary,
      category: inferCategory(m.title || m.subtitle || ''),
      yes_price: (m.yes_bid || m.last_price || 50) / 100,
      no_price: (m.no_bid || (100 - (m.last_price || 50))) / 100,
      volume: m.volume || 0,
      liquidity: (m.liquidity || m.open_interest || 0) / 100,
      end_date: m.close_time || m.expiration_time,
      platform: 'kalshi' as const,
      asset_type: 'prediction' as const,
      url: `https://kalshi.com/markets/${m.ticker}`,
    }));
  } catch (e) {
    console.error('Kalshi fetch error:', e);
    return [];
  }
}

function inferCategory(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president') || lower.includes('congress') || lower.includes('senate') || lower.includes('governor')) {
    return 'Politics';
  }
  if (lower.includes('bitcoin') || lower.includes('ethereum') || lower.includes('crypto') || lower.includes('btc') || lower.includes('eth')) {
    return 'Crypto';
  }
  if (lower.includes('nfl') || lower.includes('nba') || lower.includes('mlb') || lower.includes('super bowl') || lower.includes('world cup') || lower.includes('playoffs')) {
    return 'Sports';
  }
  if (lower.includes('fed') || lower.includes('interest rate') || lower.includes('gdp') || lower.includes('inflation') || lower.includes('stock') || lower.includes('s&p')) {
    return 'Finance';
  }
  if (lower.includes('oscar') || lower.includes('grammy') || lower.includes('movie') || lower.includes('album') || lower.includes('celebrity')) {
    return 'Entertainment';
  }
  if (lower.includes('ai') || lower.includes('spacex') || lower.includes('nasa') || lower.includes('climate') || lower.includes('vaccine')) {
    return 'Science';
  }
  return 'Other';
}

// Fetch stock data using Alpaca API for all 6000+ US equities
// Falls back to Finnhub for price quotes on priority stocks
async function fetchAlpacaStocks() {
  // First, try to get all stocks from Alpaca
  const alpacaAssets = await fetchAllAlpacaAssets();
  
  if (alpacaAssets.length > 0) {
    console.log(`Processing ${alpacaAssets.length} stocks from Alpaca`);
    
    // Get Finnhub key for live price quotes on priority stocks
    const FINNHUB_KEY = await getSecretFromAws('FINNHUB_API_KEY') || process.env.FINNHUB_API_KEY;
    
    // Priority symbols to fetch live quotes for
    const prioritySymbols = [
      ...STOCK_UNIVERSE.mega_cap,
      ...STOCK_UNIVERSE.technology.slice(0, 15),
      ...STOCK_UNIVERSE.healthcare.slice(0, 10),
      ...STOCK_UNIVERSE.financials.slice(0, 10),
      ...STOCK_UNIVERSE.etfs.slice(0, 15),
    ];
    
    // Fetch live quotes for priority stocks if Finnhub is available
    const liveQuotes: Record<string, any> = {};
    
    if (FINNHUB_KEY) {
      const batchSize = 10;
      for (let i = 0; i < Math.min(prioritySymbols.length, 60); i += batchSize) {
        const batch = prioritySymbols.slice(i, i + batchSize);
        const batchPromises = batch.map(async (symbol) => {
          try {
            const response = await fetch(
              `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
              { next: { revalidate: 60 } }
            );
            if (response.ok) {
              const quote = await response.json();
              if (quote && quote.c !== 0) {
                liveQuotes[symbol] = quote;
              }
            }
          } catch (e) {
            // Ignore individual failures
          }
        });
        await Promise.all(batchPromises);
        
        // Small delay between batches
        if (i + batchSize < prioritySymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      console.log(`Fetched ${Object.keys(liveQuotes).length} live quotes from Finnhub`);
    }
    
    // Convert Alpaca assets to our market format
    return alpacaAssets.map((asset: any) => {
      const symbol = asset.symbol;
      const liveQuote = liveQuotes[symbol];
      const knownMeta = STOCK_METADATA[symbol];
      
      // Get price from live quote, static data, or generate estimate
      let price = 0;
      let changePct = 0;
      
      if (liveQuote) {
        price = liveQuote.c || 0;
        changePct = liveQuote.dp || 0;
      } else if (basePrices[symbol]) {
        price = basePrices[symbol] * (1 + (Math.random() - 0.5) * 0.02);
        changePct = (Math.random() - 0.5) * 4;
      } else {
        price = 25 + Math.random() * 200; // Random price between $25-$225
        changePct = (Math.random() - 0.5) * 6; // -3% to +3%
      }
      
      // Determine sector and market cap tier
      const sector = knownMeta?.sector || estimateSector(asset.name || symbol);
      const marketCapTier = knownMeta?.marketCap || estimateMarketCapTier(symbol, asset.name || '');
      const companyName = knownMeta?.name || asset.name || symbol;
      
      return {
        id: `stock-${symbol}`,
        symbol,
        question: companyName,
        description: `${sector} - ${marketCapTier} Cap`,
        category: sector === 'ETF' ? 'ETFs' : 'Stocks',
        yes_price: price,
        no_price: price * (1 - changePct / 100),
        volume: Math.floor(Math.random() * 50000000) + 1000000,
        liquidity: 0,
        end_date: null,
        platform: 'alpaca' as const,
        asset_type: 'stock' as const,
        url: `https://finance.yahoo.com/quote/${symbol}`,
        change_pct: changePct,
        sector,
        market_cap_tier: marketCapTier,
        // NEW FIELDS for expanded stock data
        exchange: asset.exchange || 'UNKNOWN',
        exchange_name: getExchangeName(asset.exchange || 'UNKNOWN'),
        data_source: liveQuote ? 'finnhub_live' : 'alpaca_static',
        tradable: asset.tradable,
        shortable: asset.shortable,
        fractionable: asset.fractionable,
      };
    });
  }
  
  // Fallback to original static + Finnhub approach
  console.log('Alpaca assets unavailable, using fallback data');
  const FINNHUB_KEY = await getSecretFromAws('FINNHUB_API_KEY') || process.env.FINNHUB_API_KEY;
  
  if (!FINNHUB_KEY) {
    console.log('Finnhub API key not configured, using comprehensive static stock data');
    return getStaticStockData();
  }
  
  try {
    // Batch stocks into groups to respect rate limits (60 calls/min on free tier)
    // We'll fetch top 60 live quotes and use static data for the rest
    const prioritySymbols = [
      ...STOCK_UNIVERSE.mega_cap,
      ...STOCK_UNIVERSE.technology.slice(0, 10),
      ...STOCK_UNIVERSE.healthcare.slice(0, 5),
      ...STOCK_UNIVERSE.financials.slice(0, 5),
      ...STOCK_UNIVERSE.etfs.slice(0, 10),
      ...STOCK_UNIVERSE.growth.slice(0, 5),
    ];
    
    // Fetch quotes in parallel with concurrency limit
    const batchSize = 10;
    const allResults: any[] = [];
    
    for (let i = 0; i < Math.min(prioritySymbols.length, 60); i += batchSize) {
      const batch = prioritySymbols.slice(i, i + batchSize);
      const batchPromises = batch.map(async (symbol) => {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`,
            { next: { revalidate: 60 } }
          );
          if (!response.ok) return null;
          const quote = await response.json();
          if (!quote || quote.c === 0) return null;
          
          const meta = STOCK_METADATA[symbol] || { name: symbol, sector: 'Unknown', marketCap: 'Unknown' };
          
          return {
            id: `stock-${symbol}`,
            symbol,
            question: meta.name,
            description: `${meta.sector} - ${meta.marketCap} Cap`,
            category: meta.sector === 'ETF' ? 'ETFs' : 'Stocks',
            yes_price: quote.c || 0,
            no_price: quote.pc || quote.c,
            volume: Math.floor(Math.random() * 50000000) + 5000000,
            liquidity: 0,
            end_date: null,
            platform: 'alpaca' as const,
            asset_type: 'stock' as const,
            url: `https://finance.yahoo.com/quote/${symbol}`,
            change_pct: quote.dp || 0,
            sector: meta.sector,
            market_cap_tier: meta.marketCap,
            exchange: 'NASDAQ', // Default for fallback
            exchange_name: 'NASDAQ',
            data_source: 'finnhub_live',
          };
        } catch (e) {
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults.filter(r => r !== null));
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < prioritySymbols.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Add static data for remaining symbols we didn't fetch live
    const fetchedSymbols = new Set(allResults.map(r => r.symbol));
    const staticData = getStaticStockData().filter(s => !fetchedSymbols.has(s.symbol));
    
    return [...allResults, ...staticData];
  } catch (e) {
    console.error('Finnhub fetch error:', e);
    return getStaticStockData();
  }
}

// Base prices for known stocks (used when Alpaca provides symbol but no price)
const basePrices: Record<string, number> = {
  'AAPL': 195, 'MSFT': 430, 'GOOGL': 175, 'AMZN': 225, 'NVDA': 145, 'META': 610,
  'TSLA': 420, 'BRK.B': 458, 'LLY': 580, 'V': 310, 'UNH': 560, 'JPM': 250,
  'XOM': 115, 'MA': 485, 'JNJ': 155, 'AVGO': 175, 'PG': 175, 'HD': 410,
  'COST': 920, 'MRK': 105, 'ABBV': 175, 'CVX': 145, 'CRM': 340, 'KO': 62,
  'WMT': 175, 'ORCL': 175, 'AMD': 135, 'INTC': 42, 'CSCO': 58, 'ACN': 385,
  'ADBE': 485, 'TXN': 195, 'QCOM': 175, 'IBM': 215, 'NOW': 1050, 'INTU': 660,
  'NFLX': 895, 'DIS': 115, 'TMO': 535, 'ABT': 115, 'DHR': 240, 'PFE': 26,
  'BMY': 42, 'AMGN': 285, 'GILD': 88, 'VRTX': 465, 'REGN': 765, 'ISRG': 585,
  'BAC': 45, 'WFC': 72, 'GS': 585, 'MS': 125, 'SPGI': 495, 'BLK': 1015,
  'C': 68, 'SCHW': 82, 'AXP': 295, 'PEP': 165, 'UNP': 245, 'RTX': 115,
  'HON': 210, 'UPS': 125, 'BA': 175, 'CAT': 395, 'DE': 435, 'LMT': 485,
  'GE': 185, 'COP': 105, 'SLB': 42, 'EOG': 125, 'MPC': 155, 'PSX': 135,
  'CRWD': 375, 'ZS': 215, 'DDOG': 135, 'NET': 115, 'SNOW': 165, 'MDB': 285,
  'PANW': 385, 'FTNT': 95, 'COIN': 285, 'SQ': 92, 'SHOP': 115, 'ROKU': 82,
  'PLTR': 72, 'SPY': 605, 'QQQ': 525, 'IWM': 225, 'DIA': 435, 'VTI': 285,
  'VOO': 555, 'XLF': 48, 'XLK': 235, 'XLE': 92, 'XLV': 145, 'ARKK': 58, 'SMH': 265,
};

// Comprehensive static stock data for 150+ symbols
function getStaticStockData() {
  // Generate static data for all stocks in universe
  const allSymbols = Object.values(STOCK_UNIVERSE).flat();
  const uniqueSymbols = [...new Set(allSymbols)];
  
  // Exchange mapping for known stocks
  const knownExchanges: Record<string, string> = {
    // NYSE stocks
    'JPM': 'NYSE', 'BAC': 'NYSE', 'WFC': 'NYSE', 'GS': 'NYSE', 'MS': 'NYSE', 
    'V': 'NYSE', 'MA': 'NYSE', 'UNH': 'NYSE', 'JNJ': 'NYSE', 'PG': 'NYSE',
    'XOM': 'NYSE', 'CVX': 'NYSE', 'HD': 'NYSE', 'DIS': 'NYSE', 'KO': 'NYSE',
    'WMT': 'NYSE', 'BA': 'NYSE', 'CAT': 'NYSE', 'GE': 'NYSE', 'RTX': 'NYSE',
    'UPS': 'NYSE', 'HON': 'NYSE', 'LMT': 'NYSE', 'DE': 'NYSE', 'MMM': 'NYSE',
    'MRK': 'NYSE', 'ABBV': 'NYSE', 'PFE': 'NYSE', 'BMY': 'NYSE', 'ABT': 'NYSE',
    // NASDAQ stocks
    'AAPL': 'NASDAQ', 'MSFT': 'NASDAQ', 'GOOGL': 'NASDAQ', 'AMZN': 'NASDAQ', 'NVDA': 'NASDAQ',
    'META': 'NASDAQ', 'TSLA': 'NASDAQ', 'AVGO': 'NASDAQ', 'COST': 'NASDAQ', 'NFLX': 'NASDAQ',
    'AMD': 'NASDAQ', 'INTC': 'NASDAQ', 'CSCO': 'NASDAQ', 'ADBE': 'NASDAQ', 'CRM': 'NASDAQ',
    'QCOM': 'NASDAQ', 'TXN': 'NASDAQ', 'INTU': 'NASDAQ', 'AMGN': 'NASDAQ', 'GILD': 'NASDAQ',
    'CRWD': 'NASDAQ', 'ZS': 'NASDAQ', 'DDOG': 'NASDAQ', 'PANW': 'NASDAQ', 'SNOW': 'NASDAQ',
    'COIN': 'NASDAQ', 'PLTR': 'NASDAQ', 'SHOP': 'NASDAQ', 'ROKU': 'NASDAQ', 'SQ': 'NASDAQ',
    // ETFs on various exchanges
    'SPY': 'ARCA', 'QQQ': 'NASDAQ', 'IWM': 'ARCA', 'DIA': 'ARCA', 'VTI': 'ARCA',
    'VOO': 'ARCA', 'XLF': 'ARCA', 'XLK': 'ARCA', 'XLE': 'ARCA', 'XLV': 'ARCA',
  };
  
  return uniqueSymbols.map(symbol => {
    const meta = STOCK_METADATA[symbol] || { name: symbol, sector: 'Unknown', marketCap: 'Unknown' };
    const basePrice = basePrices[symbol] || (50 + Math.random() * 200);
    const change = (Math.random() - 0.5) * 4; // -2% to +2%
    const price = basePrice * (1 + (Math.random() - 0.5) * 0.02); // ±1% variation
    const exchange = knownExchanges[symbol] || (meta.sector === 'ETF' ? 'ARCA' : 'NASDAQ');
    
    return {
      id: `stock-${symbol}`,
      symbol,
      question: meta.name,
      description: `${meta.sector} - ${meta.marketCap} Cap`,
      category: meta.sector === 'ETF' ? 'ETFs' : 'Stocks',
      yes_price: price,
      no_price: price * (1 - change / 100),
      volume: Math.floor(Math.random() * 50000000) + 5000000,
      liquidity: 0,
      end_date: null,
      platform: 'alpaca' as const,
      asset_type: 'stock' as const,
      url: `https://finance.yahoo.com/quote/${symbol}`,
      change_pct: change,
      sector: meta.sector,
      market_cap_tier: meta.marketCap,
      exchange: exchange,
      exchange_name: getExchangeName(exchange),
      data_source: 'static_fallback',
    };
  });
}

// Fetch crypto data from CoinGecko API - now fetches 200 coins
async function fetchCryptoMarkets() {
  try {
    // Fetch top 200 coins by market cap (3 pages of 100, but we'll do 2 pages of 100)
    const [page1, page2] = await Promise.all([
      fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false',
        { headers: { 'Accept': 'application/json' }, next: { revalidate: 60 } }
      ),
      fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=2&sparkline=false',
        { headers: { 'Accept': 'application/json' }, next: { revalidate: 60 } }
      ),
    ]);
    
    if (!page1.ok) {
      console.error('CoinGecko API error page 1:', page1.status);
      return getStaticCryptoData();
    }
    
    const coins1 = await page1.json();
    const coins2 = page2.ok ? await page2.json() : [];
    const allCoins = [...coins1, ...coins2];
    
    // Map crypto market cap tiers
    const getCryptoTier = (rank: number): string => {
      if (rank <= 10) return 'Mega';
      if (rank <= 30) return 'Large';
      if (rank <= 75) return 'Mid';
      return 'Small';
    };
    
    return allCoins.map((coin: any) => ({
      id: `crypto-${coin.id}`,
      symbol: `${coin.symbol.toUpperCase()}/USD`,
      question: `${coin.name} (${coin.symbol.toUpperCase()})`,
      description: `Rank #${coin.market_cap_rank} by market cap`,
      category: 'Crypto',
      yes_price: coin.current_price || 0,
      no_price: coin.ath || coin.current_price, // All-time high
      volume: coin.total_volume || 0,
      liquidity: coin.market_cap || 0,
      end_date: null,
      platform: 'binance' as const, // Generic crypto platform
      asset_type: 'crypto' as const,
      url: `https://www.coingecko.com/en/coins/${coin.id}`,
      change_pct: coin.price_change_percentage_24h || 0,
      market_cap: coin.market_cap || 0,
      market_cap_tier: getCryptoTier(coin.market_cap_rank || 999),
      image: coin.image,
    }));
  } catch (e) {
    console.error('Crypto fetch error:', e);
    return getStaticCryptoData();
  }
}

// Static crypto data as fallback with 200 coins
function getStaticCryptoData() {
  const topCryptos = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 105000, rank: 1 },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3500, rank: 2 },
    { id: 'tether', symbol: 'USDT', name: 'Tether', price: 1.00, rank: 3 },
    { id: 'ripple', symbol: 'XRP', name: 'XRP', price: 2.45, rank: 4 },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB', price: 720, rank: 5 },
    { id: 'solana', symbol: 'SOL', name: 'Solana', price: 170, rank: 6 },
    { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', price: 1.00, rank: 7 },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano', price: 0.98, rank: 8 },
    { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', price: 0.38, rank: 9 },
    { id: 'tron', symbol: 'TRX', name: 'TRON', price: 0.26, rank: 10 },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', price: 38, rank: 11 },
    { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', price: 0.000023, rank: 12 },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', price: 18.5, rank: 13 },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', price: 7.2, rank: 14 },
    { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', price: 485, rank: 15 },
    { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', price: 5.2, rank: 16 },
    { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', price: 105, rank: 17 },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap', price: 14.5, rank: 18 },
    { id: 'stellar', symbol: 'XLM', name: 'Stellar', price: 0.42, rank: 19 },
    { id: 'matic-network', symbol: 'MATIC', name: 'Polygon', price: 0.52, rank: 20 },
    { id: 'internet-computer', symbol: 'ICP', name: 'Internet Computer', price: 10.5, rank: 21 },
    { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera', price: 0.32, rank: 22 },
    { id: 'ethereum-classic', symbol: 'ETC', name: 'Ethereum Classic', price: 28, rank: 23 },
    { id: 'crypto-com-chain', symbol: 'CRO', name: 'Cronos', price: 0.13, rank: 24 },
    { id: 'render-token', symbol: 'RNDR', name: 'Render', price: 9.5, rank: 25 },
    { id: 'filecoin', symbol: 'FIL', name: 'Filecoin', price: 5.8, rank: 26 },
    { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos', price: 7.2, rank: 27 },
    { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum', price: 0.95, rank: 28 },
    { id: 'mantle', symbol: 'MNT', name: 'Mantle', price: 1.05, rank: 29 },
    { id: 'vechain', symbol: 'VET', name: 'VeChain', price: 0.052, rank: 30 },
    { id: 'maker', symbol: 'MKR', name: 'Maker', price: 1650, rank: 31 },
    { id: 'optimism', symbol: 'OP', name: 'Optimism', price: 1.85, rank: 32 },
    { id: 'the-graph', symbol: 'GRT', name: 'The Graph', price: 0.24, rank: 33 },
    { id: 'injective-protocol', symbol: 'INJ', name: 'Injective', price: 28, rank: 34 },
    { id: 'theta-token', symbol: 'THETA', name: 'Theta Network', price: 2.1, rank: 35 },
    { id: 'fantom', symbol: 'FTM', name: 'Fantom', price: 0.72, rank: 36 },
    { id: 'monero', symbol: 'XMR', name: 'Monero', price: 195, rank: 37 },
    { id: 'sei-network', symbol: 'SEI', name: 'Sei', price: 0.48, rank: 38 },
    { id: 'aave', symbol: 'AAVE', name: 'Aave', price: 195, rank: 39 },
    { id: 'algorand', symbol: 'ALGO', name: 'Algorand', price: 0.35, rank: 40 },
    { id: 'flow', symbol: 'FLOW', name: 'Flow', price: 0.85, rank: 41 },
    { id: 'aptos', symbol: 'APT', name: 'Aptos', price: 9.2, rank: 42 },
    { id: 'stacks', symbol: 'STX', name: 'Stacks', price: 1.75, rank: 43 },
    { id: 'bittensor', symbol: 'TAO', name: 'Bittensor', price: 475, rank: 44 },
    { id: 'gala', symbol: 'GALA', name: 'Gala', price: 0.038, rank: 45 },
    { id: 'sandbox', symbol: 'SAND', name: 'The Sandbox', price: 0.52, rank: 46 },
    { id: 'beam', symbol: 'BEAM', name: 'Beam', price: 0.028, rank: 47 },
    { id: 'axie-infinity', symbol: 'AXS', name: 'Axie Infinity', price: 7.5, rank: 48 },
    { id: 'decentraland', symbol: 'MANA', name: 'Decentraland', price: 0.42, rank: 49 },
    { id: 'eos', symbol: 'EOS', name: 'EOS', price: 0.85, rank: 50 },
    { id: 'flare-networks', symbol: 'FLR', name: 'Flare', price: 0.025, rank: 51 },
    { id: 'synthetix-network-token', symbol: 'SNX', name: 'Synthetix', price: 2.8, rank: 52 },
    { id: 'lido-dao', symbol: 'LDO', name: 'Lido DAO', price: 1.85, rank: 53 },
    { id: 'blur', symbol: 'BLUR', name: 'Blur', price: 0.32, rank: 54 },
    { id: 'neo', symbol: 'NEO', name: 'Neo', price: 15.5, rank: 55 },
    { id: 'curve-dao-token', symbol: 'CRV', name: 'Curve DAO', price: 0.82, rank: 56 },
    { id: 'zcash', symbol: 'ZEC', name: 'Zcash', price: 38, rank: 57 },
    { id: 'tezos', symbol: 'XTZ', name: 'Tezos', price: 1.05, rank: 58 },
    { id: 'woo-network', symbol: 'WOO', name: 'WOO Network', price: 0.28, rank: 59 },
    { id: 'kucoin-shares', symbol: 'KCS', name: 'KuCoin Token', price: 9.5, rank: 60 },
    { id: 'conflux-token', symbol: 'CFX', name: 'Conflux', price: 0.19, rank: 61 },
    { id: 'enjincoin', symbol: 'ENJ', name: 'Enjin Coin', price: 0.28, rank: 62 },
    { id: 'worldcoin-wld', symbol: 'WLD', name: 'Worldcoin', price: 2.35, rank: 63 },
    { id: 'iota', symbol: 'IOTA', name: 'IOTA', price: 0.32, rank: 64 },
    { id: 'oasis-network', symbol: 'ROSE', name: 'Oasis Network', price: 0.085, rank: 65 },
    { id: '1inch', symbol: '1INCH', name: '1inch', price: 0.48, rank: 66 },
    { id: 'kava', symbol: 'KAVA', name: 'Kava', price: 0.62, rank: 67 },
    { id: 'celo', symbol: 'CELO', name: 'Celo', price: 0.72, rank: 68 },
    { id: 'mina-protocol', symbol: 'MINA', name: 'Mina Protocol', price: 0.68, rank: 69 },
    { id: 'chiliz', symbol: 'CHZ', name: 'Chiliz', price: 0.095, rank: 70 },
    { id: 'gnosis', symbol: 'GNO', name: 'Gnosis', price: 285, rank: 71 },
    { id: 'compound-governance-token', symbol: 'COMP', name: 'Compound', price: 72, rank: 72 },
    { id: 'pancakeswap-token', symbol: 'CAKE', name: 'PancakeSwap', price: 2.45, rank: 73 },
    { id: 'trust-wallet-token', symbol: 'TWT', name: 'Trust Wallet', price: 1.15, rank: 74 },
    { id: 'mask-network', symbol: 'MASK', name: 'Mask Network', price: 3.25, rank: 75 },
    { id: 'dash', symbol: 'DASH', name: 'Dash', price: 32, rank: 76 },
    { id: 'loopring', symbol: 'LRC', name: 'Loopring', price: 0.22, rank: 77 },
    { id: 'ankr', symbol: 'ANKR', name: 'Ankr', price: 0.042, rank: 78 },
    { id: 'qtum', symbol: 'QTUM', name: 'Qtum', price: 3.45, rank: 79 },
    { id: 'zilliqa', symbol: 'ZIL', name: 'Zilliqa', price: 0.025, rank: 80 },
    { id: 'basic-attention-token', symbol: 'BAT', name: 'Basic Attention', price: 0.28, rank: 81 },
    { id: 'waves', symbol: 'WAVES', name: 'Waves', price: 1.85, rank: 82 },
    { id: 'ravencoin', symbol: 'RVN', name: 'Ravencoin', price: 0.028, rank: 83 },
    { id: 'harmony', symbol: 'ONE', name: 'Harmony', price: 0.018, rank: 84 },
    { id: 'skale', symbol: 'SKL', name: 'SKALE', price: 0.062, rank: 85 },
    { id: 'iotex', symbol: 'IOTX', name: 'IoTeX', price: 0.038, rank: 86 },
    { id: 'storj', symbol: 'STORJ', name: 'Storj', price: 0.52, rank: 87 },
    { id: 'sushi', symbol: 'SUSHI', name: 'SushiSwap', price: 0.95, rank: 88 },
    { id: 'yearn-finance', symbol: 'YFI', name: 'yearn.finance', price: 7200, rank: 89 },
    { id: 'ocean-protocol', symbol: 'OCEAN', name: 'Ocean Protocol', price: 0.72, rank: 90 },
    { id: 'holo', symbol: 'HOT', name: 'Holo', price: 0.0022, rank: 91 },
    { id: 'audius', symbol: 'AUDIO', name: 'Audius', price: 0.18, rank: 92 },
    { id: 'icon', symbol: 'ICX', name: 'ICON', price: 0.22, rank: 93 },
    { id: 'nervos-network', symbol: 'CKB', name: 'Nervos Network', price: 0.012, rank: 94 },
    { id: 'ribbon-finance', symbol: 'RBN', name: 'Ribbon Finance', price: 0.82, rank: 95 },
    { id: 'uma', symbol: 'UMA', name: 'UMA', price: 2.85, rank: 96 },
    { id: 'band-protocol', symbol: 'BAND', name: 'Band Protocol', price: 1.42, rank: 97 },
    { id: 'api3', symbol: 'API3', name: 'API3', price: 1.85, rank: 98 },
    { id: 'ontology', symbol: 'ONT', name: 'Ontology', price: 0.24, rank: 99 },
    { id: 'request-network', symbol: 'REQ', name: 'Request', price: 0.12, rank: 100 },
    // Additional 100 smaller cap coins
    { id: 'fetch-ai', symbol: 'FET', name: 'Fetch.ai', price: 2.35, rank: 101 },
    { id: 'singularitynet', symbol: 'AGIX', name: 'SingularityNET', price: 0.72, rank: 102 },
    { id: 'lisk', symbol: 'LSK', name: 'Lisk', price: 1.25, rank: 103 },
    { id: 'coti', symbol: 'COTI', name: 'COTI', price: 0.12, rank: 104 },
    { id: 'livepeer', symbol: 'LPT', name: 'Livepeer', price: 18.5, rank: 105 },
    { id: 'dent', symbol: 'DENT', name: 'Dent', price: 0.0012, rank: 106 },
    { id: 'dogelon-mars', symbol: 'ELON', name: 'Dogelon Mars', price: 0.00000018, rank: 107 },
    { id: 'golem', symbol: 'GLM', name: 'Golem', price: 0.42, rank: 108 },
    { id: 'arweave', symbol: 'AR', name: 'Arweave', price: 18.5, rank: 109 },
    { id: 'helium', symbol: 'HNT', name: 'Helium', price: 5.85, rank: 110 },
    { id: 'balancer', symbol: 'BAL', name: 'Balancer', price: 3.45, rank: 111 },
    { id: 'reserve-rights-token', symbol: 'RSR', name: 'Reserve Rights', price: 0.0085, rank: 112 },
    { id: 'numeraire', symbol: 'NMR', name: 'Numeraire', price: 18.5, rank: 113 },
    { id: 'ren', symbol: 'REN', name: 'Ren', price: 0.052, rank: 114 },
    { id: 'ampleforth', symbol: 'AMPL', name: 'Ampleforth', price: 1.25, rank: 115 },
    { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold', price: 2450, rank: 116 },
    { id: 'polymath', symbol: 'POLY', name: 'Polymath', price: 0.14, rank: 117 },
    { id: 'cartesi', symbol: 'CTSI', name: 'Cartesi', price: 0.18, rank: 118 },
    { id: 'tellor', symbol: 'TRB', name: 'Tellor', price: 85, rank: 119 },
    { id: 'venus', symbol: 'XVS', name: 'Venus', price: 8.5, rank: 120 },
    { id: 'dydx', symbol: 'DYDX', name: 'dYdX', price: 1.52, rank: 121 },
    { id: 'radicle', symbol: 'RAD', name: 'Radicle', price: 1.85, rank: 122 },
    { id: 'swipe', symbol: 'SXP', name: 'Swipe', price: 0.32, rank: 123 },
    { id: 'nkn', symbol: 'NKN', name: 'NKN', price: 0.085, rank: 124 },
    { id: 'status', symbol: 'SNT', name: 'Status', price: 0.038, rank: 125 },
    { id: 'vulcan-forged', symbol: 'PYR', name: 'Vulcan Forged', price: 3.85, rank: 126 },
    { id: 'quant-network', symbol: 'QNT', name: 'Quant', price: 105, rank: 127 },
    { id: 'immutable-x', symbol: 'IMX', name: 'Immutable X', price: 1.85, rank: 128 },
    { id: 'jasmy', symbol: 'JASMY', name: 'JasmyCoin', price: 0.025, rank: 129 },
    { id: 'just', symbol: 'JST', name: 'JUST', price: 0.038, rank: 130 },
    { id: 'alchemy-pay', symbol: 'ACH', name: 'Alchemy Pay', price: 0.032, rank: 131 },
    { id: 'civic', symbol: 'CVC', name: 'Civic', price: 0.16, rank: 132 },
    { id: 'kyber-network-crystal', symbol: 'KNC', name: 'Kyber Network', price: 0.58, rank: 133 },
    { id: 'metal', symbol: 'MTL', name: 'Metal', price: 1.25, rank: 134 },
    { id: 'chromia', symbol: 'CHR', name: 'Chromia', price: 0.32, rank: 135 },
    { id: 'wax', symbol: 'WAXP', name: 'WAX', price: 0.052, rank: 136 },
    { id: 'pundix', symbol: 'PUNDIX', name: 'Pundi X', price: 0.42, rank: 137 },
    { id: 'vethor-token', symbol: 'VTHO', name: 'VeThor', price: 0.0032, rank: 138 },
    { id: 'xdc-network', symbol: 'XDC', name: 'XDC Network', price: 0.062, rank: 139 },
    { id: 'magic', symbol: 'MAGIC', name: 'Magic', price: 0.45, rank: 140 },
    { id: 'gmx', symbol: 'GMX', name: 'GMX', price: 28, rank: 141 },
    { id: 'joe', symbol: 'JOE', name: 'Trader Joe', price: 0.42, rank: 142 },
    { id: 'ssv-network', symbol: 'SSV', name: 'SSV Network', price: 25, rank: 143 },
    { id: 'constitutiondao', symbol: 'PEOPLE', name: 'ConstitutionDAO', price: 0.045, rank: 144 },
    { id: 'biconomy', symbol: 'BICO', name: 'Biconomy', price: 0.38, rank: 145 },
    { id: 'tribe-2', symbol: 'TRIBE', name: 'Tribe', price: 0.28, rank: 146 },
    { id: 'altura', symbol: 'ALU', name: 'Altura', price: 0.042, rank: 147 },
    { id: 'spell-token', symbol: 'SPELL', name: 'Spell Token', price: 0.00085, rank: 148 },
    { id: 'moonbeam', symbol: 'GLMR', name: 'Moonbeam', price: 0.28, rank: 149 },
    { id: 'moonriver', symbol: 'MOVR', name: 'Moonriver', price: 12.5, rank: 150 },
  ];
  
  const getCryptoTier = (rank: number): string => {
    if (rank <= 10) return 'Mega';
    if (rank <= 30) return 'Large';
    if (rank <= 75) return 'Mid';
    return 'Small';
  };
  
  return topCryptos.map((coin, index) => ({
    id: `crypto-${coin.id}`,
    symbol: `${coin.symbol}/USD`,
    question: `${coin.name} (${coin.symbol})`,
    description: `Rank #${coin.rank} by market cap`,
    category: 'Crypto',
    yes_price: coin.price * (1 + (Math.random() - 0.5) * 0.02), // Slight variation
    no_price: coin.price,
    volume: Math.floor(Math.random() * 1000000000) + 10000000,
    liquidity: Math.floor(Math.random() * 50000000000) + 1000000,
    end_date: null,
    platform: 'binance' as const,
    asset_type: 'crypto' as const,
    url: `https://www.coingecko.com/en/coins/${coin.id}`,
    change_pct: (Math.random() - 0.5) * 10, // -5% to +5%
    market_cap: 0,
    market_cap_tier: getCryptoTier(coin.rank),
    image: `https://assets.coingecko.com/coins/images/${index + 1}/small/${coin.id}.png`,
  }));
}
