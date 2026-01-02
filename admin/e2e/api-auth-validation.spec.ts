/**
 * API Authentication Validation E2E Tests
 * 
 * These tests specifically catch issues where:
 * 1. Frontend makes API calls without proper auth headers
 * 2. Protected endpoints return 401s that get swallowed silently
 * 3. Page loads trigger 401 console errors
 * 
 * This test suite runs AUTHENTICATED and validates that API calls succeed.
 */

import { test, expect, Page } from '@playwright/test';

// Pages that make API calls on load (not just static content)
const PAGES_WITH_API_CALLS = [
  { path: '/', apis: ['/api/bot/status', '/api/config'] },
  { path: '/admin/users', apis: ['/api/users', '/api/user-exchanges'] },
  { path: '/settings', apis: ['/api/config', '/api/secrets'] },
  { path: '/markets', apis: ['/api/config'] },
  { path: '/analytics', apis: ['/api/config', '/api/trades'] },
  { path: '/strategy-builder', apis: ['/api/custom-strategies'] },
  { path: '/admin/features', apis: ['/api/admin/features'] },
];

// Protected API endpoints that MUST return 200 when authenticated
const PROTECTED_ENDPOINTS_REQUIRING_AUTH = [
  '/api/secrets',
  '/api/user-exchanges',
  '/api/user-credentials',
  '/api/custom-strategies',
  '/api/simulation/history',
  '/api/trades',
  '/api/balances',
];

interface ApiError {
  url: string;
  status: number;
  statusText: string;
  page: string;
}

test.describe('API Authentication Validation', () => {
  
  test.describe('Page Load API Call Monitoring', () => {
    for (const pageConfig of PAGES_WITH_API_CALLS) {
      test(`${pageConfig.path} should not have 401 API errors on load`, async ({ page }) => {
        const apiErrors: ApiError[] = [];
        const consoleErrors: string[] = [];
        
        // Monitor all API requests made during page load
        page.on('response', (response) => {
          const url = response.url();
          if (url.includes('/api/')) {
            const status = response.status();
            // Capture ALL 401/403 errors - these indicate missing auth headers
            if (status === 401 || status === 403) {
              apiErrors.push({
                url: url.replace(/^.*\/api/, '/api'),
                status,
                statusText: response.statusText(),
                page: pageConfig.path,
              });
            }
          }
        });
        
        // Monitor console for auth-related errors
        page.on('console', (msg) => {
          const text = msg.text();
          if (msg.type() === 'error' && 
              (text.includes('401') || text.includes('Unauthorized') || text.includes('auth'))) {
            consoleErrors.push(text);
          }
        });
        
        // Navigate to page
        await page.goto(pageConfig.path, { 
          waitUntil: 'networkidle',
          timeout: 30000 
        });
        
        // Wait for any lazy-loaded API calls
        await page.waitForTimeout(2000);
        
        // Report failures with detailed info
        if (apiErrors.length > 0) {
          console.error(`\n🔴 API Auth Errors on ${pageConfig.path}:`);
          apiErrors.forEach(e => {
            console.error(`   - ${e.status} ${e.statusText}: ${e.url}`);
          });
        }
        
        if (consoleErrors.length > 0) {
          console.error(`\n⚠️ Console Auth Errors on ${pageConfig.path}:`);
          consoleErrors.forEach(e => console.error(`   - ${e}`));
        }
        
        // FAIL if any 401 errors occurred
        expect(apiErrors, `Page ${pageConfig.path} had ${apiErrors.length} API auth errors`).toHaveLength(0);
      });
    }
  });

  test.describe('Protected Endpoint Direct Tests', () => {
    test('all protected endpoints should reject unauthenticated requests with 401', async ({ page }) => {
      // This verifies endpoints ARE protected (regression test)
      for (const endpoint of PROTECTED_ENDPOINTS_REQUIRING_AUTH) {
        const response = await page.request.get(endpoint);
        const status = response.status();
        
        // Protected endpoints should return 401 when no auth
        // 503 is also acceptable if service is not configured
        expect(
          status === 401 || status === 403 || status === 503,
          `${endpoint} should require auth but returned ${status}`
        ).toBeTruthy();
      }
    });
  });

  test.describe('Console Error Monitoring', () => {
    test('dashboard should have no auth-related console errors', async ({ page }) => {
      const authErrors = await collectAuthErrorsOnPage(page, '/');
      expect(authErrors).toHaveLength(0);
    });

    test('user management should have no auth-related console errors', async ({ page }) => {
      const authErrors = await collectAuthErrorsOnPage(page, '/admin/users');
      expect(authErrors).toHaveLength(0);
    });

    test('settings page should have no auth-related console errors', async ({ page }) => {
      const authErrors = await collectAuthErrorsOnPage(page, '/settings');
      expect(authErrors).toHaveLength(0);
    });

    test('strategy builder should have no auth-related console errors', async ({ page }) => {
      const authErrors = await collectAuthErrorsOnPage(page, '/strategy-builder');
      expect(authErrors).toHaveLength(0);
    });
  });
});

test.describe('API Response Validation', () => {
  test('should not return 401 for authenticated session context', async ({ page }) => {
    // First load the app to establish any session context
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Monitor subsequent API calls
    const failedCalls: string[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() === 401) {
        failedCalls.push(response.url());
      }
    });
    
    // Navigate through multiple pages that make API calls
    const testPages = ['/markets', '/analytics', '/settings'];
    
    for (const testPage of testPages) {
      await page.goto(testPage);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }
    
    if (failedCalls.length > 0) {
      console.error('API calls returning 401:', failedCalls);
    }
    
    expect(failedCalls).toHaveLength(0);
  });
});

// Helper function to collect auth-related errors
async function collectAuthErrorsOnPage(page: Page, path: string): Promise<string[]> {
  const errors: string[] = [];
  
  page.on('console', (msg) => {
    const text = msg.text().toLowerCase();
    // Only capture actual auth errors, not hydration warnings or other issues
    if (msg.type() === 'error' && 
        !text.includes('hydrat') &&  // Exclude hydration warnings
        !text.includes('did not match') &&  // Exclude prop mismatch warnings
        (text.includes('401') || 
         text.includes('unauthorized') || 
         text.includes('not authenticated') ||
         text.includes('authentication failed'))) {
      errors.push(msg.text());
    }
  });
  
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() === 401) {
      errors.push(`API 401: ${response.url()}`);
    }
  });
  
  await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  return errors;
}
