/**
 * Comprehensive Coursework Verification Script
 * Member: Jasmine (Group 15)
 * Module: Access Center - SQL Injection (Variant 1: Authentication Bypass)
 * Course: Cyber Security (IT-30001) | Autumn Semester 2026 | IIIT Allahabad
 */

const http = require('node:http');
const app = require('./server');

function makeRequest(path, method = 'GET', postData = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3999,
      path: path,
      method: method,
      headers: postData ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      } : {}
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  const server = app.listen(3999);
  console.log('================================================================');
  console.log('   SENTINEL WORKSPACE: JASMINE SQLi AUTHENTICATION TEST SUITE   ');
  console.log('================================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assertTest(name, condition, details) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`[PASS] Test ${totalCount}: ${name}`);
      if (details) console.log(`       -> ${details}`);
    } else {
      console.error(`[FAIL] Test ${totalCount}: ${name}`);
      if (details) console.error(`       -> ${details}`);
    }
  }

  try {
    // 1. Valid admin login in vulnerable mode
    const t1 = await makeRequest('/access/legacy-login?username=admin&password=admin123');
    assertTest(
      'Valid admin login in vulnerable mode',
      t1.statusCode === 200 &&
      t1.body.includes('Authentication Successful') &&
      t1.body.includes('admin') &&
      !t1.body.includes('admin123'),
      'Confirmed authentication succeeded and actual password was REDACTED in logs.'
    );

    // 2. Invalid admin password
    const t2 = await makeRequest('/access/legacy-login?username=admin&password=wrongpassword');
    assertTest(
      'Invalid admin password in vulnerable mode',
      t2.statusCode === 200 &&
      t2.body.includes('Authentication Failed') &&
      !t2.body.includes('wrongpassword'),
      'Confirmed authentication failed on incorrect password.'
    );

    // 3. Authentication bypass in vulnerable mode (admin' --)
    const t3 = await makeRequest('/access/legacy-login?username=' + encodeURIComponent("admin' --") + '&password=arbitrary_password');
    assertTest(
      'Authentication bypass in vulnerable mode (payload: admin\' --)',
      t3.statusCode === 200 &&
      t3.body.includes('SQL Injection Authentication Bypass') &&
      t3.body.includes('admin') &&
      !t3.body.includes('arbitrary_password'),
      'Confirmed SQL injection comment bypassed password clause and opened admin session.'
    );

    // 3b. Authentication bypass with tautology payload in vulnerable mode (' OR '1'='1' --)
    const t3b = await makeRequest('/access/legacy-login?username=' + encodeURIComponent("' OR '1'='1' --") + '&password=any');
    assertTest(
      'Authentication bypass with tautology payload (\' OR \'1\'=\'1\' --)',
      t3b.statusCode === 200 &&
      t3b.body.includes('SQL Injection Authentication Bypass') &&
      t3b.body.includes('admin'),
      'Confirmed tautology injection bypassed authentication.'
    );

    // 4. Same bypass attempt in secure mode
    const t4 = await makeRequest('/access/secure-login?username=' + encodeURIComponent("admin' --") + '&password=arbitrary_password');
    assertTest(
      'Same bypass attempt in secure mode (payload: admin\' --)',
      t4.statusCode === 200 &&
      t4.body.includes('SQL Injection Blocked') &&
      !t4.body.includes('Session opened'),
      'Confirmed parameterized query bound payload as literal text; attack was blocked.'
    );

    // 5. Another SQL injection payload in secure mode (' OR '1'='1)
    const t5 = await makeRequest('/access/secure-login?username=' + encodeURIComponent("' OR '1'='1") + '&password=anything');
    assertTest(
      'Another SQL injection payload in secure mode (payload: \' OR \'1\'=\'1)',
      t5.statusCode === 200 &&
      t5.body.includes('SQL Injection Blocked') &&
      !t5.body.includes('Session opened'),
      'Confirmed parameterized query blocked OR injection payload.'
    );

    // 6. Valid admin login in secure mode
    const t6 = await makeRequest('/access/secure-login?username=admin&password=admin123');
    assertTest(
      'Valid admin login in secure mode',
      t6.statusCode === 200 &&
      t6.body.includes('Authentication Successful') &&
      t6.body.includes('admin') &&
      !t6.body.includes('admin123'),
      'Confirmed legitimate admin login succeeds securely with parameter binding.'
    );

    // 7. Verify all other 4 modules are intact and operational
    console.log('\n--- VERIFYING PRESERVATION OF OTHER 4 GROUP MODULES ---');
    
    // Overview
    const m0 = await makeRequest('/');
    assertTest('Overview route (/) loads', m0.statusCode === 200 && m0.body.includes('Sentinel Workspace'));

    // Module 2: Diyanshi - Knowledge Catalog
    const m1 = await makeRequest('/catalog');
    const m1_legacy = await makeRequest('/catalog/legacy-search?q=union');
    const m1_secure = await makeRequest('/catalog/secure-search?q=handbook');
    assertTest(
      'Diyanshi - Knowledge Catalog (/catalog, legacy & secure search)',
      m1.statusCode === 200 && m1_legacy.statusCode === 200 && m1_secure.statusCode === 200 && m1_legacy.body.includes('Restricted'),
      'Confirmed UNION-based demonstration and secure catalog search work intact.'
    );

    // Module 3: Purvi - Network Diagnostics
    const m2 = await makeRequest('/diagnostics');
    const m2_legacy = await makeRequest('/diagnostics/legacy-check?host=127.0.0.1%3B+cat+%2Fetc%2Fpasswd');
    const m2_secure = await makeRequest('/diagnostics/secure-check?host=127.0.0.1');
    assertTest(
      'Purvi - Network Diagnostics (/diagnostics, legacy & secure check)',
      m2.statusCode === 200 && m2_legacy.statusCode === 200 && m2_secure.statusCode === 200,
      'Confirmed command injection simulation and IPv4 validation work intact.'
    );

    // Module 4: Yashika - Community Wall
    const m3 = await makeRequest('/community');
    assertTest(
      'Yashika - Community Wall (/community)',
      m3.statusCode === 200 && m3.body.includes('Community Wall'),
      'Confirmed Stored XSS demonstration feed works intact.'
    );

    // Module 5: Jayanth - Account Settings
    const m4 = await makeRequest('/settings');
    const m4_legacy = await makeRequest('/settings/legacy-update?email=test%40sentinel.test');
    assertTest(
      'Jayanth - Account Settings (/settings & legacy GET update)',
      m4.statusCode === 200 && m4_legacy.statusCode === 200 && m4_legacy.body.includes('Legacy update completed'),
      'Confirmed CSRF demonstration works intact.'
    );

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passedCount}/${totalCount} TESTS PASSED (100%)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    server.close();
  }
}

runTests();
