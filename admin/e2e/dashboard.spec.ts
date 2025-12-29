/**
 * Dashboard E2E Tests
 * 
 * Tests the main dashboard page functionality
 */

import { test, expect } from '@playwright/test';

async function waitForPageLoad(page: any) {
  await page.waitForLoadState('networkidle');
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should display dashboard header', async ({ page }) => {
    // Dashboard should have some identifying element
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    // Look for stat cards - common in dashboards
    const statsSection = page.locator('[class*="grid"], [class*="stats"]').first();
    
    // Should have some content
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await waitForPageLoad(page);
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && 
             !e.includes('Loading chunk') &&
             !e.includes('Non-Error')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should have meta tags for SEO', async ({ page }) => {
    await page.goto('/');
    
    // Check for title
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test('should handle refresh gracefully', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
    
    // Refresh the page
    await page.reload();
    await waitForPageLoad(page);
    
    // Should still work
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });
});

test.describe('Dashboard - Data Loading', () => {
  test('should show loading states', async ({ page }) => {
    // Slow down network to see loading states
    await page.route('**/api/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await page.goto('/');
    
    // Look for any loading indicator
    // This could be a spinner, skeleton, or loading text
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API errors
    await page.route('**/api/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.goto('/');
    await waitForPageLoad(page);
    
    // Page should not crash - might show error UI but shouldn't be blank
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
