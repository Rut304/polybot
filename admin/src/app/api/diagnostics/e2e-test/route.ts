import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  // Note: This endpoint is for development/staging environments only
  // In production, E2E tests should be run via CI/CD
  
  const isDev = process.env.NODE_ENV === 'development';
  const isAllowed = process.env.ALLOW_E2E_API === 'true';
  
  if (!isDev && !isAllowed) {
    return NextResponse.json(
      { 
        error: 'E2E tests can only be run in development mode or with ALLOW_E2E_API=true',
        hint: 'Run tests locally with: npm run test:e2e'
      },
      { status: 403 }
    );
  }

  try {
    // Run playwright tests with JSON reporter
    const { stdout, stderr } = await execAsync(
      'npx playwright test --reporter=json 2>&1',
      { 
        cwd: process.cwd(),
        timeout: 120000, // 2 minute timeout
        env: {
          ...process.env,
          CI: 'true', // Ensure headless mode
        }
      }
    );

    // Parse the JSON output
    let results = { passed: 0, failed: 0, total: 0, output: '' };
    
    try {
      // Playwright JSON reporter outputs to stdout
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const report = JSON.parse(jsonMatch[0]);
        const suites = report.suites || [];
        
        let passed = 0;
        let failed = 0;
        
        const countTests = (suite: any) => {
          for (const spec of suite.specs || []) {
            for (const test of spec.tests || []) {
              if (test.status === 'expected' || test.status === 'passed') {
                passed++;
              } else if (test.status === 'unexpected' || test.status === 'failed') {
                failed++;
              }
            }
          }
          for (const child of suite.suites || []) {
            countTests(child);
          }
        };
        
        for (const suite of suites) {
          countTests(suite);
        }
        
        results = {
          passed,
          failed,
          total: passed + failed,
          output: failed > 0 ? stderr || 'See test report for details' : '',
        };
      }
    } catch (parseError) {
      // If JSON parsing fails, try to extract counts from text output
      const passedMatch = stdout.match(/(\d+) passed/);
      const failedMatch = stdout.match(/(\d+) failed/);
      
      results = {
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
        total: 0,
        output: stdout.slice(-2000), // Last 2000 chars of output
      };
      results.total = results.passed + results.failed;
    }

    return NextResponse.json(results);
  } catch (error: any) {
    // Extract test results from error output if tests ran but some failed
    const output = error.stdout || error.stderr || error.message || '';
    
    const passedMatch = output.match(/(\d+) passed/);
    const failedMatch = output.match(/(\d+) failed/);
    
    if (passedMatch || failedMatch) {
      return NextResponse.json({
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
        total: (passedMatch ? parseInt(passedMatch[1]) : 0) + (failedMatch ? parseInt(failedMatch[1]) : 0),
        output: output.slice(-2000),
      });
    }

    return NextResponse.json(
      { 
        error: 'Failed to run E2E tests',
        details: error.message,
        output: output.slice(-1000),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return info about E2E test setup
  return NextResponse.json({
    status: 'ready',
    framework: 'Playwright',
    testFiles: [
      'navigation.spec.ts',
      'dashboard.spec.ts',
      'api.spec.ts',
      'failed-trades.spec.ts',
      'ai-insights.spec.ts',
      'feature-flags.spec.ts',
      'auth.spec.ts',
      'settings.spec.ts',
      'trading.spec.ts',
    ],
    commands: {
      runAll: 'npm run test:e2e',
      runUI: 'npm run test:e2e:ui',
      runHeaded: 'npm run test:e2e:headed',
      debug: 'npm run test:e2e:debug',
    },
    documentation: '/admin/guide#e2e-testing',
  });
}
