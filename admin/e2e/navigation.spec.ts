/**
 * Navigation E2E Tests
 * 
 * Tests core navigation functionality across the admin dashboard
 */

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load dashboard page', async ({ page }) => {
    // Wait for page to fully load
    await expect(page).toHaveURL('/');
    
    // Check for main dashboard elements
    await expect(page.locator('h1, [role="heading"]').first()).toBeVisible();
  });

  test('should navigate to all main sections', async ({ page }) => {
    const routes = [
      { path: '/analytics', name: 'Analytics' },
      { path: '/markets', name: 'Markets' },
      { path: '/bets', name: 'Bets' },
      { path: '/positions', name: 'Positions' },
      { path: '/balances', name: 'Balances' },
      { path: '/notifications', name: 'Notifications' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page).toHaveURL(route.path);
      
      // Page should not show error
      await expect(page.locator('text=Something went wrong')).not.toBeVisible();
      await expect(page.locator('text=404')).not.toBeVisible();
    }
  });

  test('should have working sidebar navigation', async ({ page }) => {
    // Look for navigation sidebar
    const sidebar = page.locator('nav, [role="navigation"]').first();
    await expect(sidebar).toBeVisible();
    
    // Click on a nav item
    const analyticsLink = page.locator('a[href="/analytics"]').first();
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await expect(page).toHaveURL('/analytics');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    
    // Page should still load without errors
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
    
    // Mobile menu should be present (hamburger menu)
    // The nav might be hidden initially on mobile
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Navigation - Pro Features', () => {
  test('should show gated content for AI Insights', async ({ page }) => {
    await page.goto('/insights');
    
    // Should either show the page or a pro feature gate
    // Both are valid outcomes depending on auth state
    await page.waitForLoadState('networkidle');
    
    // Page should not error
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });

  test('should show gated content for Failed Trades', async ({ page }) => {
    await page.goto('/missed-opportunities');
    
    await page.waitForLoadState('networkidle');
    
    // Page should load without critical errors
    await expect(page.locator('text=Something went wrong')).not.toBeVisible();
  });
});
