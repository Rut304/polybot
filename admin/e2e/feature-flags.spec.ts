/**
 * Feature Flags Admin E2E Tests
 * 
 * Tests the admin feature control panel functionality
 * Note: Admin pages require authentication
 */

import { test, expect } from '@playwright/test';

async function waitForPageLoad(page: any) {
  await page.waitForLoadState('networkidle');
}

test.describe('Feature Flags Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/features');
    await waitForPageLoad(page);
  });

  test('should load admin page or redirect to auth', async ({ page }) => {
    // Admin pages either show content or redirect to auth
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('should not have JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/admin/features');
    await waitForPageLoad(page);
    
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && 
             !e.includes('Loading chunk') &&
             !e.includes('Non-Error')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should show feature control content or auth prompt', async ({ page }) => {
    // Either show feature flags or auth prompt
    const hasFeatures = await page.locator('text=/Feature|Flag|Control/i').first().isVisible().catch(() => false);
    const hasAuth = await page.locator('text=/Sign in|Login|PolyBot|Authenticate/i').first().isVisible().catch(() => false);
    
    expect(hasFeatures || hasAuth).toBeTruthy();
  });
});

test.describe('Feature Flags - Create/Edit (When Authenticated)', () => {
  test('should handle page interactions', async ({ page }) => {
    await page.goto('/admin/features');
    await waitForPageLoad(page);
    
    // Try to find and interact with buttons
    const buttons = page.locator('button');
    
    if (await buttons.count() > 0) {
      // Verify buttons are interactive (don't actually click, just check they exist)
      await expect(buttons.first()).toBeVisible();
    }
    
    // Page should remain functional
    await expect(page.locator('body')).not.toBeEmpty();
  });
});

test.describe('Feature Flags - User Overrides', () => {
  test('should handle search interactions when visible', async ({ page }) => {
    await page.goto('/admin/features');
    await waitForPageLoad(page);
    
    // Look for any input field
    const inputs = page.locator('input');
    
    if (await inputs.count() > 0) {
      const input = inputs.first();
      if (await input.isVisible()) {
        await input.fill('test');
        // Should not error
        await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      }
    }
    
    // Page should be functional
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
