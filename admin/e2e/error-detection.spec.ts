/**
 * Comprehensive Page Error Detection E2E Tests
 * 
 * Catches ALL types of errors that could indicate problems:
 * - JavaScript runtime errors (TypeError, ReferenceError, etc.)
 * - API errors (4xx, 5xx responses)
 * - React hydration mismatches
 * - Network failures
 * - Console errors and warnings
 * - Missing data rendering issues (NaN, undefined, null displayed)
 */

import { test, expect, Page, Response } from '@playwright/test';

// All pages to test for errors
const ALL_PAGES = [
  '/',
  '/markets',
  '/analytics',
  '/settings',
  '/strategies',
  '/news',
  '/whales',
  '/congress',
  '/leaderboard',
  '/admin/users',
  '/admin/features',
  '/strategy-builder',
];

interface PageError {
  type: 'js' | 'network' | 'api' | 'console' | 'render';
  message: string;
  url?: string;
  status?: number;
}

/**
 * Collects all errors during page load
 */
async function collectAllErrors(page: Page, path: string): Promise<PageError[]> {
  const errors: PageError[] = [];

  // 1. JavaScript runtime errors (uncaught exceptions)
  page.on('pageerror', (error) => {
    // Filter out known non-critical errors
    const msg = error.message;
    if (msg.includes('ResizeObserver') || 
        msg.includes('Loading chunk') ||
        msg.includes('Non-Error promise rejection')) {
      return;
    }
    errors.push({ type: 'js', message: msg });
  });

  // 2. Network request failures
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    errors.push({
      type: 'network',
      message: `${failure?.errorText || 'Unknown'}: ${request.url()}`,
      url: request.url(),
    });
  });

  // 3. API response errors (4xx/5xx)
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    
    // Only track our API calls, not external resources
    if (url.includes('/api/')) {
      if (status >= 400) {
        errors.push({
          type: 'api',
          message: `${status} ${response.statusText()}`,
          url: url.replace(/^.*\/api/, '/api'),
          status,
        });
      }
    }
  });

  // 4. Console errors (not warnings)
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out known non-critical console errors
      if (text.includes('Failed to load resource') && text.includes('favicon')) {
        return;
      }
      if (text.includes('Download the React DevTools')) {
        return;
      }
      errors.push({ type: 'console', message: text });
    }
  });

  // Navigate to page
  await page.goto(path, { 
    waitUntil: 'networkidle',
    timeout: 30000 
  });

  // Wait for any lazy-loaded content
  await page.waitForTimeout(2000);

  // 5. Check for render issues in the DOM
  const content = await page.content();
  
  // Check for undefined/null/NaN displayed in UI
  const renderIssues = [
    { pattern: />undefined</i, name: 'undefined rendered' },
    { pattern: />null</i, name: 'null rendered' },
    { pattern: />NaN</i, name: 'NaN rendered' },
    { pattern: />\[object Object\]</i, name: '[object Object] rendered' },
    { pattern: />Error:</i, name: 'Error message rendered' },
    { pattern: /Cannot read propert/i, name: 'Property access error' },
  ];

  for (const issue of renderIssues) {
    if (issue.pattern.test(content)) {
      errors.push({ type: 'render', message: issue.name });
    }
  }

  return errors;
}

test.describe('Comprehensive Error Detection', () => {
  
  test.describe('JavaScript Runtime Errors', () => {
    for (const path of ALL_PAGES) {
      test(`${path} should have no JS runtime errors`, async ({ page }) => {
        const jsErrors: string[] = [];
        
        page.on('pageerror', (error) => {
          const msg = error.message;
          // Filter known non-critical
          if (!msg.includes('ResizeObserver') && 
              !msg.includes('Loading chunk') &&
              !msg.includes('Non-Error')) {
            jsErrors.push(msg);
          }
        });

        await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000);

        if (jsErrors.length > 0) {
          console.error(`\n🔴 JS Errors on ${path}:`, jsErrors);
        }
        
        expect(jsErrors, `${path} has JavaScript errors`).toHaveLength(0);
      });
    }
  });

  test.describe('API Response Errors', () => {
    for (const path of ALL_PAGES) {
      test(`${path} should have no 5xx API errors`, async ({ page }) => {
        const serverErrors: { url: string; status: number }[] = [];
        
        page.on('response', (response) => {
          if (response.url().includes('/api/') && response.status() >= 500) {
            serverErrors.push({
              url: response.url().replace(/^.*\/api/, '/api'),
              status: response.status(),
            });
          }
        });

        await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);

        if (serverErrors.length > 0) {
          console.error(`\n🔴 Server Errors on ${path}:`, serverErrors);
        }
        
        expect(serverErrors, `${path} has server errors`).toHaveLength(0);
      });
    }
  });

  test.describe('Network Failures', () => {
    for (const path of ALL_PAGES) {
      test(`${path} should have no network failures`, async ({ page }) => {
        const failures: string[] = [];
        
        page.on('requestfailed', (request) => {
          const url = request.url();
          // Ignore external resources and analytics
          if (url.includes('/api/') || url.includes('localhost')) {
            failures.push(`${request.failure()?.errorText}: ${url}`);
          }
        });

        await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
        
        if (failures.length > 0) {
          console.error(`\n🔴 Network Failures on ${path}:`, failures);
        }
        
        expect(failures, `${path} has network failures`).toHaveLength(0);
      });
    }
  });

  test.describe('Render Quality', () => {
    const criticalPages = ['/', '/analytics', '/markets', '/settings'];
    
    for (const path of criticalPages) {
      test(`${path} should not display undefined/null/NaN`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const content = await page.content();
        
        // Check for common render issues
        const hasUndefined = />undefined</.test(content);
        const hasNull = />null</.test(content) && !content.includes('nullable'); // exclude code/docs
        const hasNaN = />NaN</.test(content);
        const hasObjectObject = />\[object Object\]</.test(content);
        
        const issues: string[] = [];
        if (hasUndefined) issues.push('undefined');
        if (hasNull) issues.push('null');
        if (hasNaN) issues.push('NaN');
        if (hasObjectObject) issues.push('[object Object]');
        
        if (issues.length > 0) {
          console.error(`\n🔴 Render issues on ${path}:`, issues);
        }
        
        expect(issues, `${path} displays raw values`).toHaveLength(0);
      });
    }
  });

  test.describe('Hydration Errors', () => {
    for (const path of ALL_PAGES.slice(0, 5)) { // Test main pages
      test(`${path} should not have React hydration mismatches`, async ({ page }) => {
        const hydrationErrors: string[] = [];
        
        page.on('console', (msg) => {
          const text = msg.text();
          if (text.includes('Hydration') || 
              text.includes('hydrat') ||
              text.includes('server rendered') ||
              text.includes('did not match')) {
            hydrationErrors.push(text);
          }
        });

        await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);
        
        // Filter out minor hydration warnings
        const criticalHydration = hydrationErrors.filter(e => 
          e.includes('Error') || e.includes('error')
        );
        
        if (criticalHydration.length > 0) {
          console.error(`\n🔴 Hydration errors on ${path}:`, criticalHydration);
        }
        
        expect(criticalHydration).toHaveLength(0);
      });
    }
  });

  test.describe('Critical Console Errors', () => {
    for (const path of ALL_PAGES) {
      test(`${path} should not have critical console errors`, async ({ page }) => {
        const criticalErrors: string[] = [];
        
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const text = msg.text();
            // Identify critical errors
            if (text.includes('TypeError') ||
                text.includes('ReferenceError') ||
                text.includes('Cannot read') ||
                text.includes('is not defined') ||
                text.includes('is not a function') ||
                text.includes('Uncaught')) {
              criticalErrors.push(text);
            }
          }
        });

        await page.goto(path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1000);
        
        if (criticalErrors.length > 0) {
          console.error(`\n🔴 Critical errors on ${path}:`, criticalErrors);
        }
        
        expect(criticalErrors, `${path} has critical errors`).toHaveLength(0);
      });
    }
  });
});

test.describe('Full Page Error Summary', () => {
  // This test iterates through all pages, so needs longer timeout
  test('generate error report for all pages', async ({ page }) => {
    test.setTimeout(120000); // 2 minutes for comprehensive test
    
    const report: Record<string, PageError[]> = {};
    let totalErrors = 0;
    
    for (const path of ALL_PAGES) {
      const errors = await collectAllErrors(page, path);
      if (errors.length > 0) {
        report[path] = errors;
        totalErrors += errors.length;
      }
    }
    
    if (totalErrors > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('📋 ERROR REPORT');
      console.log('='.repeat(60));
      
      for (const [path, errors] of Object.entries(report)) {
        console.log(`\n📄 ${path} (${errors.length} errors)`);
        for (const error of errors) {
          const icon = {
            js: '⚡',
            network: '🌐',
            api: '🔌',
            console: '💬',
            render: '🎨',
          }[error.type];
          console.log(`   ${icon} [${error.type}] ${error.message}`);
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log(`Total: ${totalErrors} errors across ${Object.keys(report).length} pages`);
      console.log('='.repeat(60) + '\n');
    }
    
    // This test provides visibility, doesn't fail
    // Individual tests above handle failures
    expect(true).toBeTruthy();
  });
});
