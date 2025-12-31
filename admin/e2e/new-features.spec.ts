/**
 * New Features E2E Tests
 * 
 * Tests for newly added API endpoints and features:
 * - TradingView webhook
 * - Live feed API
 * - Congressional tracker
 * - Watchlist API
 */

import { test, expect } from '@playwright/test';

test.describe('API - TradingView Webhook', () => {
  test('GET /api/webhooks/tradingview should return usage documentation', async ({ page }) => {
    const response = await page.request.get('/api/webhooks/tradingview');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('TradingView webhook endpoint is active');
    expect(data.usage).toBeDefined();
    expect(data.usage.method).toBe('POST');
    expect(data.usage.required_fields).toContain('symbol');
    expect(data.usage.required_fields).toContain('action');
  });

  test('POST /api/webhooks/tradingview should accept valid signals', async ({ page }) => {
    const response = await page.request.post('/api/webhooks/tradingview', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        symbol: 'AAPL',
        action: 'buy',
        price: '150.50',
        strategy: 'test_strategy',
        interval: '1H'
      })
    });
    
    // Should accept the signal (may fail to store in DB during tests, but shouldn't crash)
    expect(response.status()).toBeLessThan(500);
    
    const data = await response.json();
    expect(data.success).toBeDefined();
  });

  test('POST /api/webhooks/tradingview should reject missing required fields', async ({ page }) => {
    const response = await page.request.post('/api/webhooks/tradingview', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({
        price: '150.50'
        // missing symbol and action
      })
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('required fields');
  });

  test('POST /api/webhooks/tradingview should handle all action types', async ({ page }) => {
    const actions = ['buy', 'sell', 'long', 'short', 'close'];
    
    for (const action of actions) {
      const response = await page.request.post('/api/webhooks/tradingview', {
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          symbol: 'TEST',
          action: action
        })
      });
      
      // Should not crash for any valid action type
      expect(response.status()).toBeLessThan(500);
    }
  });
});

test.describe('API - Live Feed', () => {
  test('GET /api/live-feed should return trade data', async ({ page }) => {
    const response = await page.request.get('/api/live-feed');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.trades).toBeDefined();
    expect(Array.isArray(data.trades)).toBe(true);
    expect(data.source).toBeDefined();
    expect(['live', 'sample']).toContain(data.source);
  });

  test('GET /api/live-feed should return properly formatted trades', async ({ page }) => {
    const response = await page.request.get('/api/live-feed');
    const data = await response.json();
    
    // Each trade should have required fields
    if (data.trades.length > 0) {
      const trade = data.trades[0];
      expect(trade.id).toBeDefined();
      expect(trade.market).toBeDefined();
      expect(trade.action).toBeDefined();
      expect(trade.platform).toBeDefined();
      expect(trade.profit).toBeDefined();
      expect(typeof trade.profit).toBe('number');
    }
  });
});

test.describe('API - Congressional Tracker', () => {
  test('GET /api/congress should not crash server', async ({ page }) => {
    const response = await page.request.get('/api/congress');
    
    // Should not return 500 (internal server error)
    // 200, 401, 404 are all acceptable
    const status = response.status();
    expect(status === 200 || status === 401 || status === 404 || status < 500).toBe(true);
  });
});

test.describe('Landing Page - Live Ticker', () => {
  test('should load home page without critical errors', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    const response = await page.goto('/');
    
    // Page should load (not 500 error)
    expect(response?.status()).toBeLessThan(500);
    
    // Wait for initial render
    await page.waitForTimeout(1000);
    
    // Filter out expected/benign errors
    const criticalErrors = errors.filter(e => 
      !e.includes('hydration') && 
      !e.includes('Supabase') &&
      !e.includes('NEXT_PUBLIC')
    );
    
    // Should not have critical JS errors (some warnings are OK)
    // This is a soft check - we mainly care the page renders
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test('live-feed API should be accessible', async ({ page }) => {
    const response = await page.request.get('/api/live-feed');
    
    // Should return 200 with data
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.trades).toBeDefined();
  });
});

test.describe('SEO and Metadata', () => {
  test('should serve robots.txt', async ({ page }) => {
    const response = await page.request.get('/robots.txt');
    
    expect(response.status()).toBe(200);
    
    const text = await response.text();
    expect(text).toContain('User-agent');
    expect(text).toContain('Sitemap');
  });

  test('should serve sitemap.xml', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml');
    
    expect(response.status()).toBe(200);
    
    const text = await response.text();
    expect(text).toContain('<?xml');
    expect(text).toContain('urlset');
    expect(text).toContain('polyparlay.io');
  });

  test('should serve llms.txt for AI agents', async ({ page }) => {
    const response = await page.request.get('/llms.txt');
    
    expect(response.status()).toBe(200);
    
    const text = await response.text();
    expect(text).toContain('PolyParlay');
    expect(text).toContain('prediction market');
  });

  test('should have page title', async ({ page }) => {
    const response = await page.goto('/');
    
    // Page should load
    expect(response?.status()).toBeLessThan(500);
    
    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    
    // Page should have a title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should have JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    
    // Check for JSON-LD script tag
    const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLd).toBeTruthy();
    
    const parsed = JSON.parse(jsonLd!);
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('SoftwareApplication');
  });
});
