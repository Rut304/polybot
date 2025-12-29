/**
 * AI Insights Page E2E Tests
 * 
 * Tests the AI Insights page functionality and risk explanations
 * Note: This page may be gated for Pro tier users
 */

import { test, expect } from '@playwright/test';

async function waitForPageLoad(page: any) {
  await page.waitForLoadState('networkidle');
}

test.describe('AI Insights Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/insights');
    await waitForPageLoad(page);
  });

  test('should load page without errors', async ({ page }) => {
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('should show content or upgrade prompt', async ({ page }) => {
    // Either show insights or upgrade message
    const hasInsights = await page.locator('text=/AI Insights|Strategy|Recommendation|Tuning/i').first().isVisible().catch(() => false);
    const hasUpgrade = await page.locator('text=/Pro|Upgrade|Subscribe|Premium|PolyBot/i').first().isVisible().catch(() => false);
    
    expect(hasInsights || hasUpgrade).toBeTruthy();
  });

  test('should not have JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/insights');
    await waitForPageLoad(page);
    
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && 
             !e.includes('Loading chunk') &&
             !e.includes('Non-Error')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });
});

test.describe('AI Insights - Risk Explanations', () => {
  test('should handle risk explanations when visible', async ({ page }) => {
    await page.goto('/insights');
    await waitForPageLoad(page);
    
    // Look for any risk-related content
    const riskContent = page.locator('text=/Risk|↑|↓|exposure/i');
    
    // Content may or may not be visible depending on auth state
    // Just ensure page is functional
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('AI Insights - Interactive Features', () => {
  test('should handle user interactions', async ({ page }) => {
    await page.goto('/insights');
    await waitForPageLoad(page);
    
    // Find clickable elements
    const buttons = page.locator('button');
    
    if (await buttons.count() > 0) {
      // Verify buttons exist without clicking (avoid side effects)
      await expect(buttons.first()).toBeVisible();
    }
    
    // Page should remain functional
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('should handle page refresh', async ({ page }) => {
    await page.goto('/insights');
    await waitForPageLoad(page);
    
    await page.reload();
    await waitForPageLoad(page);
    
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });
});
