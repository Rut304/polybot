/**
 * E2E Test Utilities and Fixtures
 * 
 * Common utilities for Polybot Admin E2E tests
 */

import { test as base, expect, Page } from '@playwright/test';

// Test user data
export const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || 'test@example.com',
  password: process.env.E2E_TEST_PASSWORD || 'testpassword123',
};

// Custom fixtures
interface PolybotFixtures {
  authenticatedPage: Page;
}

// Extended test with custom fixtures
export const test = base.extend<PolybotFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // For tests that need authentication, we'll mock the auth state
    // In a real scenario, this would use stored auth state from setup
    await page.goto('/');
    await use(page);
  },
});

export { expect };

// Helper functions
export async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle');
}

export async function expectNoConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Return a function to check errors at test end
  return () => {
    const criticalErrors = errors.filter(
      (e) => !e.includes('Failed to load resource') && !e.includes('404')
    );
    expect(criticalErrors).toHaveLength(0);
  };
}

export async function takeScreenshotOnFailure(page: Page, testInfo: any) {
  if (testInfo.status !== 'passed') {
    await page.screenshot({
      path: `test-results/failure-${testInfo.title.replace(/\s+/g, '-')}.png`,
      fullPage: true,
    });
  }
}

// Mock Supabase responses for testing
export function mockSupabaseAuth(page: Page) {
  return page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    
    if (url.includes('/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'mock-user-id',
            email: TEST_USER.email,
            role: 'authenticated',
          },
        }),
      });
    } else {
      await route.continue();
    }
  });
}

// API response helpers
export async function mockAPIResponse(
  page: Page, 
  urlPattern: string, 
  response: object,
  status = 200
) {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

// Wait for specific API call
export async function waitForAPI(page: Page, urlPattern: string) {
  return page.waitForResponse((response) => 
    response.url().includes(urlPattern) && response.status() === 200
  );
}
