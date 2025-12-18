
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

const BASE_URL = process.env.BASE_URL || 'https://admin-8bea3szz4-rut304s-projects.vercel.app';
const USER_ID = 'b2629537-3a31-4fa1-b05a-a9d523a008aa'; // The user UUID

async function runTest(name: string, fn: () => Promise<boolean>) {
  process.stdout.write(`Testing ${name}... `);
  try {
    const success = await fn();
    if (success) {
      console.log(`${colors.green}✓ PASS${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ FAIL${colors.reset}`);
    }
    return success;
  } catch (error) {
    console.log(`${colors.red}✗ ERROR${colors.reset}`);
    console.error(error);
    return false;
  }
}

async function verifyProduction() {
  console.log(`${colors.blue}Starting Production Verification for ${BASE_URL}${colors.reset}\n`);

  // 1. Verify Config Endpoint
  await runTest('API: Get Config (/api/config)', async () => {
    const res = await fetch(`${BASE_URL}/api/config?userId=${USER_ID}`);
    if (res.status === 200) return true;
    console.log(`  Status: ${res.status}`);
    return false;
  });

  // 2. Verify Config Write
  await runTest('API: Update Config (/api/config)', async () => {
    const res = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user_id: USER_ID,
        updated_at: new Date().toISOString() // Harmless update
      })
    });
    if (res.status === 200) return true;
    console.log(`  Status: ${res.status}`);
    return false;
  });

  // 3. Verify Logs Endpoint
  await runTest('API: Get Logs (/api/logs)', async () => {
    const res = await fetch(`${BASE_URL}/api/logs?userId=${USER_ID}`);
    if (res.status === 200) return true; // Even empty list is 200
    console.log(`  Status: ${res.status}`);
    return false;
  });

  // 4. Verify Bot Status
  await runTest('API: Bot Status (/api/bot/status)', async () => {
    const res = await fetch(`${BASE_URL}/api/bot/status?userId=${USER_ID}`);
    const data = await res.json();
    // Start logging detailed status
    if (res.status === 200) {
      // Logic check: version should not be 'unknown' anymore
      if (data.version && data.version !== 'unknown') {
         return true;
      }
      console.log(`  Version: ${data.version} (Expected v1.2.9+)`);
      return false; 
    }
    console.log(`  Status: ${res.status}`);
    return false;
  });

  console.log(`\n${colors.blue}Verification Complete.${colors.reset}`);
}

verifyProduction();
