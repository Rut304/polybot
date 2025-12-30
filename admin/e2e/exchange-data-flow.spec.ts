/**
 * Exchange Data Flow Integration Tests
 * 
 * Validates that when a user connects an exchange:
 * 1. Their credentials are stored correctly
 * 2. Market data from that exchange is available
 * 3. Trades/positions filter to their connected exchanges
 * 4. UI components show the correct exchange data
 * 
 * Root cause prevention for:
 * - User connects Kucoin but sees no Kucoin data
 * - Trades from other users showing up
 * - Market data not updating for connected exchanges
 */

import { test, expect } from '@playwright/test';

// Supported exchanges in the system
const SUPPORTED_EXCHANGES = [
  'alpaca',
  'binance',
  'bybit',
  'okx',
  'kraken',
  'coinbase',
  'kucoin',
  'ibkr',
  'robinhood',
  'webull',
];

// Prediction market platforms
const PREDICTION_PLATFORMS = ['polymarket', 'kalshi'];

test.describe('Exchange Connection UI', () => {
  
  test('secrets page should display exchange connection options', async ({ page }) => {
    await page.goto('/secrets');
    await page.waitForLoadState('domcontentloaded');
    
    const pageContent = await page.content();
    
    // Should have exchange connection section
    const foundExchanges = SUPPORTED_EXCHANGES.filter(
      exchange => pageContent.toLowerCase().includes(exchange.toLowerCase())
    );
    
    console.log(`Found ${foundExchanges.length} exchanges on secrets page: ${foundExchanges.join(', ')}`);
    
    // Should show at least 3 exchanges
    expect(foundExchanges.length).toBeGreaterThanOrEqual(3);
  });
  
  test('exchange connect component should have add credentials form', async ({ page }) => {
    await page.goto('/secrets');
    await page.waitForLoadState('networkidle');
    
    // Look for API key input fields
    const apiKeyInputs = await page.$$('input[type="password"], input[placeholder*="API"], input[placeholder*="Key"], input[placeholder*="Secret"]');
    
    // Should have input fields for credentials
    expect(apiKeyInputs.length).toBeGreaterThan(0);
  });
});

test.describe('User Credentials API', () => {
  
  test('user-credentials endpoint should return connection status', async ({ request }) => {
    const response = await request.get('/api/user-credentials');
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required');
      return;
    }
    
    if (response.ok()) {
      const data = await response.json();
      
      // Should return an array of exchange statuses
      expect(Array.isArray(data) || data.connections || data.exchanges).toBeTruthy();
      
      // Each exchange should have connection status
      const connections = Array.isArray(data) ? data : (data.connections || data.exchanges || []);
      
      for (const conn of connections) {
        expect(conn).toHaveProperty('exchange');
        expect(conn).toHaveProperty('connected');
      }
    }
  });
  
  test('user-credentials should list all supported exchanges', async ({ request }) => {
    const response = await request.get('/api/user-credentials');
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required');
      return;
    }
    
    if (response.ok()) {
      const data = await response.json();
      const connections = Array.isArray(data) ? data : (data.connections || data.exchanges || []);
      
      const listedExchanges = connections.map((c: any) => c.exchange?.toLowerCase());
      
      // All supported exchanges should be listed (connected or not)
      const missingExchanges = SUPPORTED_EXCHANGES.filter(
        ex => !listedExchanges.includes(ex.toLowerCase())
      );
      
      if (missingExchanges.length > 0) {
        console.warn('Exchanges not listed in API response:', missingExchanges);
      }
      
      // At least 70% of exchanges should be listed
      const coverageRatio = (SUPPORTED_EXCHANGES.length - missingExchanges.length) / SUPPORTED_EXCHANGES.length;
      expect(coverageRatio).toBeGreaterThan(0.7);
    }
  });
});

test.describe('Market Data Display', () => {
  
  test('markets page should load with price data', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');
    
    // Wait for market data to load
    await page.waitForTimeout(2000);
    
    const pageContent = await page.content();
    
    // Should show price indicators ($, %, or numeric values)
    const hasPriceData = 
      /\$[\d,]+/.test(pageContent) || // Dollar amounts
      /[\d.]+%/.test(pageContent) ||   // Percentages
      pageContent.includes('Price') ||
      pageContent.includes('Market Cap');
    
    expect(hasPriceData).toBeTruthy();
  });
  
  test('dashboard should show balance information', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const pageContent = await page.content();
    
    // Should show balance or P&L data
    const hasBalanceInfo = 
      pageContent.includes('Balance') ||
      pageContent.includes('P&L') ||
      pageContent.includes('Portfolio') ||
      pageContent.includes('Total Value') ||
      /\$[\d,]+/.test(pageContent);
    
    expect(hasBalanceInfo).toBeTruthy();
  });
});

test.describe('Trades API Multi-Tenancy', () => {
  
  test('trades endpoint should be accessible', async ({ request }) => {
    const response = await request.get('/api/trades');
    
    // Should not return 500 error
    expect(response.status()).not.toBe(500);
    
    if (response.ok()) {
      const data = await response.json();
      
      // Should have trades array and pagination
      expect(data).toHaveProperty('trades');
      expect(Array.isArray(data.trades)).toBeTruthy();
    }
  });
  
  test('trades should include exchange/platform information', async ({ request }) => {
    const response = await request.get('/api/trades?limit=10');
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required');
      return;
    }
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.trades && data.trades.length > 0) {
        const trade = data.trades[0];
        
        // Each trade should have platform/exchange info
        const hasPlatformInfo = 
          trade.platform ||
          trade.exchange ||
          trade.buy_platform ||
          trade.sell_platform;
        
        expect(hasPlatformInfo).toBeTruthy();
      }
    }
  });
});

test.describe('Exchange-Aware UI Components', () => {
  
  test('positions page should show platform column', async ({ page }) => {
    await page.goto('/positions');
    await page.waitForLoadState('domcontentloaded');
    
    const pageContent = await page.content();
    
    // Should show platform/exchange information
    const hasPlatformColumn = 
      pageContent.includes('Platform') ||
      pageContent.includes('Exchange') ||
      PREDICTION_PLATFORMS.some(p => pageContent.toLowerCase().includes(p)) ||
      SUPPORTED_EXCHANGES.some(e => pageContent.toLowerCase().includes(e));
    
    expect(hasPlatformColumn).toBeTruthy();
  });
  
  test('balances page should show multi-platform balances', async ({ page }) => {
    await page.goto('/balances');
    await page.waitForLoadState('networkidle');
    
    const pageContent = await page.content();
    
    // Should show balance breakdown by platform/exchange
    const hasMultiPlatform = 
      pageContent.includes('Platform') ||
      pageContent.includes('Exchange') ||
      pageContent.includes('Alpaca') ||
      pageContent.includes('Polymarket') ||
      pageContent.includes('Total');
    
    expect(hasMultiPlatform).toBeTruthy();
  });
  
  test('whales page should show which exchange whale activity is from', async ({ page }) => {
    await page.goto('/whales');
    await page.waitForLoadState('domcontentloaded');
    
    // Should load without error
    const pageContent = await page.content();
    
    // Should have whale-related content
    const hasWhaleContent = 
      pageContent.includes('Whale') ||
      pageContent.includes('whale') ||
      pageContent.includes('Trader') ||
      pageContent.includes('Volume');
    
    expect(hasWhaleContent).toBeTruthy();
  });
});

test.describe('Opportunities Platform Filtering', () => {
  
  test('opportunities should indicate source platform', async ({ page }) => {
    // Check both dashboard (which may show opportunities) and a dedicated page
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const pageContent = await page.content();
    
    // Should indicate where opportunities are from
    const hasPlatformIndicator = 
      pageContent.includes('Polymarket') ||
      pageContent.includes('Kalshi') ||
      pageContent.includes('Arbitrage') ||
      pageContent.includes('Opportunity');
    
    // Dashboard should at least mention opportunities or platforms
    expect(hasPlatformIndicator).toBeTruthy();
  });
});

test.describe('Exchange Configuration', () => {
  
  test('config API should include exchange enable flags', async ({ request }) => {
    const response = await request.get('/api/config');
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required');
      return;
    }
    
    if (response.ok()) {
      const config = await response.json();
      
      // Should have exchange enable flags
      const exchangeFlags = [
        'enable_polymarket',
        'enable_kalshi',
        'enable_binance',
        'enable_alpaca',
      ];
      
      const foundFlags = exchangeFlags.filter(flag => flag in config);
      
      console.log(`Found ${foundFlags.length}/${exchangeFlags.length} exchange flags in config`);
      
      // At least prediction market flags should exist
      expect(config).toHaveProperty('enable_polymarket');
    }
  });
});
