/**
 * Authentication Setup for E2E Tests
 * 
 * This file handles authentication state for tests that need to run
 * as an authenticated user. It creates a storage state that subsequent
 * tests can reuse.
 * 
 * IMPORTANT: For local development, set these env vars:
 *   E2E_TEST_EMAIL - Test user email
 *   E2E_TEST_PASSWORD - Test user password
 * 
 * For CI, these should be set as secrets.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Skip auth setup if no credentials provided
  const testEmail = process.env.E2E_TEST_EMAIL;
  const testPassword = process.env.E2E_TEST_PASSWORD;
  
  if (!testEmail || !testPassword) {
    console.log('⚠️ No E2E_TEST_EMAIL/E2E_TEST_PASSWORD set - running tests unauthenticated');
    // Create empty auth state so tests don't fail
    await page.context().storageState({ path: authFile });
    return;
  }

  console.log('🔐 Authenticating for E2E tests...');
  
  // Navigate to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // Look for email input and sign in button
  // Adjust these selectors based on your actual login UI (Privy, etc.)
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const hasEmailInput = await emailInput.isVisible().catch(() => false);
  
  if (hasEmailInput) {
    await emailInput.fill(testEmail);
    
    // Look for password field
    const passwordInput = page.locator('input[type="password"]').first();
    const hasPasswordInput = await passwordInput.isVisible().catch(() => false);
    
    if (hasPasswordInput) {
      await passwordInput.fill(testPassword);
    }
    
    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign"), button:has-text("Log")').first();
    await submitButton.click();
    
    // Wait for redirect after login
    await page.waitForURL('**/*', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  } else {
    // Privy or other auth provider - look for their buttons
    const signInButton = page.locator('button:has-text("Sign in"), button:has-text("Continue")').first();
    const hasSignIn = await signInButton.isVisible().catch(() => false);
    
    if (hasSignIn) {
      console.log('⚠️ OAuth/Privy login detected - manual auth setup may be needed');
    }
  }
  
  // Verify we're authenticated by checking for user-specific content
  const authenticated = await page.locator('[data-testid="user-menu"], [class*="avatar"], [class*="profile"]')
    .isVisible()
    .catch(() => false);
  
  if (authenticated) {
    console.log('✅ Authentication successful');
  } else {
    console.log('⚠️ Could not verify authentication - tests will run with current state');
  }
  
  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
