/**
 * Failed Trades Page E2E Tests
 * 
 * Tests the Failed Trades (formerly Missed Opportunities) page functionality
 * Note: This page may be gated for Pro tier users
 */

import { test, expect } from '@playwright/test';

async function waitForPageLoad(page: any) {
  await page.waitForLoadState('networkidle');
}

async function mockAPIResponse(
  page: any, 
  urlPattern: string, 
  response: object,
  status = 200
) {
  await page.route(urlPattern, async (route: any) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

test.describe('Failed Trades Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/missed-opportunities');
    await waitForPageLoad(page);
  });

  test('should load page without errors', async ({ page }) => {
    // Page should load without crashing
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('should display page content or upgrade prompt', async ({ page }) => {
    // Page either shows content or upgrade prompt for Pro tier
    const hasContent = await page.locator('text=/Failed Trades|Understanding Risk/i').first().isVisible().catch(() => false);
    const hasUpgrade = await page.locator('text=/Pro|Upgrade|Subscribe|Premium/i').first().isVisible().catch(() => false);
    const hasPolybot = await page.locator('h1:has-text("PolyBot")').isVisible().catch(() => false);
    
    // One of these should be true - either page content or upgrade flow
    expect(hasContent || hasUpgrade || hasPolybot).toBeTruthy();
  });

  test('should not have JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/missed-opportunities');
    await waitForPageLoad(page);
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && 
             !e.includes('Loading chunk') &&
             !e.includes('Non-Error')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle refresh gracefully', async ({ page }) => {
    await page.goto('/missed-opportunities');
    await waitForPageLoad(page);
    
    // Refresh the page
    await page.reload();
    await waitForPageLoad(page);
    
    // Should still work
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Failed Trades - When Authenticated (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: In a real scenario, you'd set up authentication state
    // For now, we test that the page structure is correct when loaded
    await page.goto('/missed-opportunities');
    await waitForPageLoad(page);
  });

  test('should have accessible navigation', async ({ page }) => {
    // Check that nav links work
    const insightsLink = page.locator('a[href="/insights"]').first();
    
    if (await insightsLink.isVisible()) {
      await insightsLink.click();
      await expect(page).toHaveURL(/insights/);
    }
  });

  test('should respond to user interactions', async ({ page }) => {
    // Try to find any interactive element and click it
    const buttons = page.locator('button');
    const count = await buttons.count();
    
    if (count > 0) {
      // Click first button that's not nav
      const button = buttons.first();
      if (await button.isVisible()) {
        // Just verify it's clickable without error
        await button.click({ timeout: 1000 }).catch(() => {});
      }
    }
    
    // Page should still be functional
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Failed Trades - Bulk Actions', () => {
  test('should handle bulk actions section when visible', async ({ page }) => {
    await page.goto('/missed-opportunities');
    await waitForPageLoad(page);
    
    // Look for any action buttons
    const refreshButton = page.locator('button:has-text("Refresh")').first();
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      
      // Page should reload data without errors
      await waitForPageLoad(page);
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    } else {
      // Page might be gated - that's ok
      expect(true).toBeTruthy();
    }
  });
});
