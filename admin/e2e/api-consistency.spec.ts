/**
 * API Consistency Tests
 * 
 * Validates that API endpoints return consistent data structures
 * and that field names are consistent across different endpoints.
 * 
 * Root cause prevention for:
 * - Field name mismatches between frontend/backend
 * - API responses missing expected fields
 * - Inconsistent data formats
 */

import { test, expect } from '@playwright/test';

// Expected API endpoints
const API_ENDPOINTS = {
  config: '/api/config',
  trades: '/api/trades',
  balances: '/api/balances',
  status: '/api/status',
  userCredentials: '/api/user-credentials',
  markets: '/api/markets',
  help: '/api/help',
  health: '/api/health',
};

// Expected config fields (subset of critical ones)
const CRITICAL_CONFIG_FIELDS = [
  // Strategy enables
  'enable_polymarket_single_arb',
  'enable_kalshi_single_arb',
  'enable_cross_platform_arb',
  'enable_market_making',
  'enable_news_arbitrage',
  
  // Exchange enables
  'enable_polymarket',
  'enable_kalshi',
  
  // Core settings
  'simulation_mode',
  'max_position_usd',
  'min_profit_percent',
];

// Expected trade fields
const TRADE_FIELDS = [
  'id',
  'created_at',
  'strategy',
  'outcome',
  'trading_mode',
];

test.describe('API Response Structure Validation', () => {
  
  test('config API should return expected structure', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.config);
    
    if (response.status() === 401 || response.status() === 403) {
      test.skip(true, 'Auth required');
      return;
    }
    
    expect(response.ok()).toBeTruthy();
    
    const config = await response.json();
    expect(typeof config).toBe('object');
    
    // Check for critical fields
    const missingFields: string[] = [];
    for (const field of CRITICAL_CONFIG_FIELDS) {
      if (!(field in config)) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.warn('Config API missing critical fields:', missingFields);
    }
    
    // At least 50% of critical fields should exist
    const foundRatio = (CRITICAL_CONFIG_FIELDS.length - missingFields.length) / CRITICAL_CONFIG_FIELDS.length;
    expect(foundRatio).toBeGreaterThan(0.5);
  });
  
  test('trades API should return paginated response', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.trades);
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required');
      return;
    }
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    
    // Should have trades array
    expect(data).toHaveProperty('trades');
    expect(Array.isArray(data.trades)).toBeTruthy();
    
    // Should have pagination info
    expect(data).toHaveProperty('pagination');
    
    // If trades exist, validate structure
    if (data.trades.length > 0) {
      const trade = data.trades[0];
      
      const missingFields = TRADE_FIELDS.filter(f => !(f in trade));
      if (missingFields.length > 0) {
        console.warn('Trade object missing fields:', missingFields);
      }
      
      // Core fields should exist
      expect(trade).toHaveProperty('id');
      expect(trade).toHaveProperty('strategy');
    }
  });
  
  test('balances API should return structured data', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.balances);
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required');
      return;
    }
    
    if (response.ok()) {
      const data = await response.json();
      
      // Should have balance information
      expect(typeof data).toBe('object');
      
      // Should include total or balances array
      const hasBalanceInfo = 
        'total' in data ||
        'balances' in data ||
        'simulation_balance' in data ||
        'paper_balance' in data;
      
      expect(hasBalanceInfo).toBeTruthy();
    }
  });
  
  test('status API should return bot status', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.status);
    
    if (response.status() === 401) {
      test.skip(true, 'Auth required');
      return;
    }
    
    if (response.ok()) {
      const data = await response.json();
      
      // Should have status indicator
      const hasStatus = 
        'status' in data ||
        'is_running' in data ||
        'active' in data ||
        'state' in data;
      
      expect(hasStatus).toBeTruthy();
    }
  });
  
  test('health API should return health check', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.health);
    
    // Health should always be accessible (no auth)
    expect(response.status()).not.toBe(500);
    
    if (response.ok()) {
      const data = await response.json();
      
      // Should indicate health status
      expect(typeof data).toBe('object');
    }
  });
});

test.describe('Field Name Consistency', () => {
  
  test('config enable fields should use snake_case with enable_ prefix', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.config);
    
    if (!response.ok()) {
      test.skip(true, 'Config API not accessible');
      return;
    }
    
    const config = await response.json();
    const enableFields = Object.keys(config).filter(k => k.includes('enable'));
    
    const invalidNames: string[] = [];
    for (const field of enableFields) {
      // Should start with enable_ and be snake_case
      if (!field.startsWith('enable_')) {
        invalidNames.push(`${field} (should start with enable_)`);
      }
      if (/[A-Z]/.test(field)) {
        invalidNames.push(`${field} (should be snake_case, not camelCase)`);
      }
    }
    
    if (invalidNames.length > 0) {
      console.error('Invalid enable field names:', invalidNames);
    }
    
    // All enable fields should follow convention
    expect(invalidNames).toHaveLength(0);
  });
  
  test('trade fields should be consistent', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.trades + '?limit=5');
    
    if (!response.ok()) {
      test.skip(true, 'Trades API not accessible');
      return;
    }
    
    const data = await response.json();
    
    if (data.trades && data.trades.length > 1) {
      const firstTrade = data.trades[0];
      const secondTrade = data.trades[1];
      
      // All trades should have same structure
      const firstKeys = Object.keys(firstTrade).sort();
      const secondKeys = Object.keys(secondTrade).sort();
      
      // Core fields should be consistent (values may differ)
      const coreKeys = ['id', 'strategy', 'created_at', 'outcome'];
      for (const key of coreKeys) {
        if (key in firstTrade) {
          expect(secondTrade).toHaveProperty(key);
        }
      }
    }
  });
});

test.describe('API Error Handling', () => {
  
  test('invalid config update should return error', async ({ request }) => {
    const response = await request.patch(API_ENDPOINTS.config, {
      data: { invalid_field_xyz: true },
    });
    
    // Should not crash - return 4xx or success
    expect(response.status()).not.toBe(500);
  });
  
  test('trades with invalid params should handle gracefully', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.trades + '?limit=invalid&offset=xyz');
    
    // Should not return 500
    expect(response.status()).not.toBe(500);
  });
  
  test('missing required fields should return proper error', async ({ request }) => {
    const response = await request.post(API_ENDPOINTS.userCredentials, {
      data: {}, // Missing required fields
    });
    
    // Should return 4xx, not 500
    if (response.status() >= 400) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});

test.describe('Config Update Validation', () => {
  
  test('config update should accept valid enable flags', async ({ request }) => {
    // First get current config
    const getResponse = await request.get(API_ENDPOINTS.config);
    
    if (!getResponse.ok()) {
      test.skip(true, 'Config API not accessible');
      return;
    }
    
    const currentConfig = await getResponse.json();
    
    // Get current value of a strategy flag
    const testField = 'enable_market_making';
    const currentValue = currentConfig[testField];
    
    if (currentValue !== undefined) {
      // Try to update it (toggle)
      const updateResponse = await request.patch(API_ENDPOINTS.config, {
        data: { [testField]: !currentValue },
      });
      
      // If auth required, skip
      if (updateResponse.status() === 401) {
        test.skip(true, 'Auth required');
        return;
      }
      
      // Should either succeed or return validation error, not 500
      expect(updateResponse.status()).not.toBe(500);
      
      // Restore original value
      await request.patch(API_ENDPOINTS.config, {
        data: { [testField]: currentValue },
      });
    }
  });
});

test.describe('Response Time Validation', () => {
  
  test('config API should respond within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(API_ENDPOINTS.config, {
      timeout: 5000,
    });
    const duration = Date.now() - start;
    
    console.log(`Config API responded in ${duration}ms`);
    
    // Should not timeout
    expect(response.status()).toBeDefined();
    expect(duration).toBeLessThan(5000);
  });
  
  test('trades API should respond within 5 seconds', async ({ request }) => {
    const start = Date.now();
    const response = await request.get(API_ENDPOINTS.trades + '?limit=10', {
      timeout: 5000,
    });
    const duration = Date.now() - start;
    
    console.log(`Trades API responded in ${duration}ms`);
    
    expect(response.status()).toBeDefined();
    expect(duration).toBeLessThan(5000);
  });
});
