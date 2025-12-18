export {};

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

const BASE_URL = 'https://admin-3sh44j8sj-rut304s-projects.vercel.app';
const USER_ID = 'b2629537-3a31-4fa1-b05a-a9d523a008aa';

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

async function verifyPersistence() {
  console.log(`${colors.blue}Verifying Settings Persistence on ${BASE_URL}${colors.reset}\n`);

  // 1. Initial State
  let initialConfig: any;
    const res = await fetch(`${BASE_URL}/api/config?userId=${USER_ID}`);
    if (res.status !== 200) {
      const text = await res.text();
      console.log(`\nResponse Status: ${res.status}`);
      console.log(`Response Body: ${text}`);
      return false;
    }
    initialConfig = await res.json();
    return true;

  console.log('Current IBKR Enabled:', initialConfig.enable_ibkr);

  // 2. Attempt Update
  const testValue = !initialConfig.enable_ibkr; // Flip it
  const testTradeSize = 123.45; // Specific number to check float persistence

  await runTest(`Update Config (enable_ibkr -> ${testValue}, max_trade_size -> ${testTradeSize})`, async () => {
    const res = await fetch(`${BASE_URL}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: USER_ID,
        enable_ibkr: testValue,
        max_trade_size: testTradeSize,
        ibkr_futures_symbol: 'TEST_ES' // Test new column
      })
    });
    return res.status === 200;
  });

  // 3. Verify Update Persisted
  await runTest('Verify Persistence', async () => {
    // Wait a moment for DB propagation (though usually instant)
    await new Promise(r => setTimeout(r, 1000));
    
    const res = await fetch(`${BASE_URL}/api/config?userId=${USER_ID}`);
    const newConfig = await res.json();
    
    const ibkrMatch = newConfig.enable_ibkr === testValue;
    const sizeMatch = Math.abs(Number(newConfig.max_trade_size) - testTradeSize) < 0.01;
    const symbolMatch = newConfig.ibkr_futures_symbol === 'TEST_ES';

    if (!ibkrMatch) console.log(`  IBKR Mismatch: Expected ${testValue}, got ${newConfig.enable_ibkr}`);
    if (!sizeMatch) console.log(`  Trade Size Mismatch: Expected ${testTradeSize}, got ${newConfig.max_trade_size}`);
    if (!symbolMatch) console.log(`  Symbol Mismatch: Expected TEST_ES, got ${newConfig.ibkr_futures_symbol}`);

    return ibkrMatch && sizeMatch && symbolMatch;
  });
}

verifyPersistence();
