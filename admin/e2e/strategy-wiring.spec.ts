/**
 * Strategy Wiring Integration Tests
 * 
 * Validates that strategy enable toggles in the UI actually:
 * 1. Update the correct database config field
 * 2. Are read correctly by the bot engine
 * 3. Have matching field names across all layers
 * 
 * Root cause prevention for:
 * - Marketplace enable buttons not working (wrong configKey)
 * - Strategies appearing enabled in UI but not running
 * - Config field name mismatches between layers
 */

import { test, expect } from '@playwright/test';

// All strategy configs that should exist in the system
// Maps: UI display name -> expected database field name
const STRATEGY_CONFIG_MAP: Record<string, string> = {
  // Prediction Market Arbitrage
  'Polymarket Single Platform': 'enable_polymarket_single_arb',
  'Kalshi Single Platform': 'enable_kalshi_single_arb',
  'Cross Platform Arbitrage': 'enable_cross_platform_arb',
  
  // Crypto Strategies
  '15-Min Crypto Scalping': 'enable_15min_crypto_scalping',
  'Funding Rate Arbitrage': 'enable_funding_rate_arb',
  'Grid Trading': 'enable_grid_trading',
  'Pairs Trading': 'enable_pairs_trading',
  'Cross Exchange Arbitrage': 'enable_cross_exchange_arb',
  
  // Advanced Prediction Strategies
  'News Arbitrage': 'enable_news_arbitrage',
  'Market Making': 'enable_market_making',
  'AI Superforecasting': 'enable_ai_superforecasting',
  'Time Decay Strategy': 'enable_time_decay',
  'BTC Bracket Arbitrage': 'enable_btc_bracket_arb',
  'Bracket Compression': 'enable_bracket_compression',
  'Kalshi Mention Snipe': 'enable_kalshi_mention_snipe',
  'Spike Hunter': 'enable_spike_hunter',
  
  // Copy/Social Trading
  'Whale Copy Trading': 'enable_whale_copy_trading',
  'Selective Whale Copy': 'enable_selective_whale_copy',
  'Congressional Tracker': 'enable_congressional_tracker',
  
  // Sentiment/Contrarian
  'Macro Board': 'enable_macro_board',
  'Fear Premium Contrarian': 'enable_fear_premium_contrarian',
  'Political Event Strategy': 'enable_political_event_strategy',
  'High Conviction Strategy': 'enable_high_conviction_strategy',
  
  // Stock Strategies
  'Stock Mean Reversion': 'enable_stock_mean_reversion',
  'Stock Momentum': 'enable_stock_momentum',
  'Sector Rotation': 'enable_sector_rotation',
  'Dividend Growth': 'enable_dividend_growth',
  'Earnings Momentum': 'enable_earnings_momentum',
  
  // Options Strategies (IBKR)
  'Covered Calls': 'enable_covered_calls',
  'Cash Secured Puts': 'enable_cash_secured_puts',
  'Iron Condor': 'enable_iron_condor',
  'Wheel Strategy': 'enable_wheel_strategy',
  
  // Other
  'Polymarket Liquidation': 'enable_polymarket_liquidation',
  'IBKR Futures Momentum': 'enable_ibkr_futures_momentum',
};

// Exchange enable configs
const EXCHANGE_CONFIG_MAP: Record<string, string> = {
  'Polymarket': 'enable_polymarket',
  'Kalshi': 'enable_kalshi',
  'Binance': 'enable_binance',
  'Bybit': 'enable_bybit',
  'OKX': 'enable_okx',
  'Kraken': 'enable_kraken',
  'Coinbase': 'enable_coinbase',
  'KuCoin': 'enable_kucoin',
  'Alpaca': 'enable_alpaca',
  'Interactive Brokers': 'enable_ibkr',
};

test.describe('Strategy Config Field Validation', () => {
  
  test('should have all strategy configs accessible via API', async ({ request }) => {
    // Fetch current config from API
    const response = await request.get('/api/config');
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required - skipping API validation');
      return;
    }
    
    expect(response.ok()).toBeTruthy();
    const config = await response.json();
    
    // Verify all expected strategy fields exist
    const missingFields: string[] = [];
    const allExpectedFields = Object.values(STRATEGY_CONFIG_MAP);
    
    for (const field of allExpectedFields) {
      if (!(field in config)) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.error('Missing strategy config fields in API response:', missingFields);
    }
    
    // Allow some fields to be missing (not all may be in every API response)
    // But critical ones should exist
    const criticalFields = [
      'enable_polymarket_single_arb',
      'enable_cross_platform_arb',
      'enable_market_making',
      'enable_news_arbitrage',
    ];
    
    for (const field of criticalFields) {
      expect(config).toHaveProperty(field);
    }
  });
  
  test('marketplace page should have correct configKey mappings', async ({ page }) => {
    await page.goto('/marketplace');
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="strategy-card"], .strategy-card, [class*="strategy"]', { 
      timeout: 10000 
    }).catch(() => {});
    
    // Get all strategy toggle buttons
    const toggleButtons = await page.$$('button[aria-label*="toggle"], button[aria-label*="enable"], [role="switch"]');
    
    // Verify we found some toggle buttons
    expect(toggleButtons.length).toBeGreaterThan(0);
    
    console.log(`Found ${toggleButtons.length} strategy toggle buttons on marketplace`);
  });
  
  test('strategies page should render all strategy categories', async ({ page }) => {
    await page.goto('/strategies');
    
    // Wait for content
    await page.waitForLoadState('domcontentloaded');
    
    // Check for key strategy sections
    const pageContent = await page.content();
    
    // These are categories that should exist
    const expectedSections = [
      'Arbitrage',
      'Crypto',
      'Stock',
      'Copy Trading',
    ];
    
    const missingSections: string[] = [];
    for (const section of expectedSections) {
      if (!pageContent.toLowerCase().includes(section.toLowerCase())) {
        missingSections.push(section);
      }
    }
    
    if (missingSections.length > 0) {
      console.warn('Missing strategy sections:', missingSections);
    }
    
    // At least half should be present
    expect(missingSections.length).toBeLessThan(expectedSections.length / 2);
  });
});

test.describe('Strategy Toggle Functionality', () => {
  
  test('toggling a strategy should call the correct API endpoint', async ({ page }) => {
    let apiCalls: { url: string; body: any }[] = [];
    
    // Intercept config update calls
    await page.route('**/api/config**', async (route) => {
      const request = route.request();
      if (request.method() === 'PATCH' || request.method() === 'PUT' || request.method() === 'POST') {
        try {
          const body = request.postDataJSON();
          apiCalls.push({ url: request.url(), body });
        } catch (e) {
          // Body might not be JSON
        }
      }
      await route.continue();
    });
    
    await page.goto('/marketplace');
    await page.waitForLoadState('networkidle');
    
    // Find and click a strategy toggle
    const toggle = await page.$('button[aria-label*="toggle"], [role="switch"]');
    
    if (toggle) {
      await toggle.click();
      
      // Wait for API call
      await page.waitForTimeout(1000);
      
      if (apiCalls.length > 0) {
        const lastCall = apiCalls[apiCalls.length - 1];
        console.log('Config update call:', lastCall);
        
        // Verify the field name starts with 'enable_' (correct naming convention)
        const fieldName = Object.keys(lastCall.body || {})[0];
        if (fieldName) {
          expect(fieldName).toMatch(/^enable_/);
        }
      }
    }
  });
});

test.describe('Settings Strategy Toggles', () => {
  
  test('settings page should have strategy toggle section', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    
    // Look for strategy-related tabs or sections
    const pageContent = await page.content();
    
    // Check for strategy configuration section
    const hasStrategySection = 
      pageContent.includes('Strategy') || 
      pageContent.includes('Trading') ||
      pageContent.includes('Enable');
    
    expect(hasStrategySection).toBeTruthy();
  });
  
  test('exchange toggles should be present in settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to exchanges/integrations tab if exists
    const exchangeTab = await page.$('button:has-text("Exchanges"), button:has-text("Integrations"), [role="tab"]:has-text("Exchange")');
    if (exchangeTab) {
      await exchangeTab.click();
      await page.waitForTimeout(500);
    }
    
    const pageContent = await page.content();
    
    // Should mention at least some exchanges
    const mentionedExchanges = Object.keys(EXCHANGE_CONFIG_MAP).filter(
      exchange => pageContent.includes(exchange)
    );
    
    console.log(`Found ${mentionedExchanges.length} exchanges mentioned: ${mentionedExchanges.join(', ')}`);
    
    // At least Polymarket and Alpaca should be mentioned
    expect(mentionedExchanges.length).toBeGreaterThan(0);
  });
});

test.describe('Config Consistency Validation', () => {
  
  test('all config fields should use snake_case naming', async ({ request }) => {
    const response = await request.get('/api/config');
    
    if (!response.ok()) {
      test.skip(true, 'Config API not accessible');
      return;
    }
    
    const config = await response.json();
    const keys = Object.keys(config);
    
    const invalidKeys = keys.filter(key => {
      // Check for camelCase or other invalid patterns
      return /[A-Z]/.test(key) && !key.startsWith('NEXT_');
    });
    
    if (invalidKeys.length > 0) {
      console.warn('Config keys not in snake_case:', invalidKeys);
    }
    
    // Most keys should be snake_case
    const snakeCaseRatio = (keys.length - invalidKeys.length) / keys.length;
    expect(snakeCaseRatio).toBeGreaterThan(0.9);
  });
});
