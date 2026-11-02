const crypto = require('node:crypto');
const net = require('node:net');
const { exec, execFile } = require('node:child_process');
const express = require('express');
const session = require('express-session');

const db = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Initialize SQLite database with dummy accounts on startup
db.initDatabase().catch(err => console.error('SQLite initialization error:', err));

const users = [
  { id: 1, username: 'admin', password: 'admin123', email: 'admin@sentinel.test', role: 'Administrator' },
  { id: 2, username: 'alex', password: 'welcome123', email: 'alex@sentinel.test', role: 'Analyst' }
];
const inventory = [
  { id: 1, title: 'Security Operations Handbook', description: 'Guidance for internal response teams', status: 'Available' },
  { id: 2, title: 'Web Application Playbook', description: 'Practical secure-development reference', status: 'Available' },
  { id: 3, title: 'Infrastructure Review Kit', description: 'Network review and assessment toolkit', status: 'Limited' }
];
const posts = [];

// --- Database Setup for SQL Injection Demonstration (Diyanshi - Variant 2) ---
// Uses Node.js built-in SQLite module (node:sqlite) for genuine SQL query execution.
let sqliteDb = null;
try {
  const { DatabaseSync } = require('node:sqlite');
  sqliteDb = new DatabaseSync(':memory:');
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL
    );
    INSERT INTO items (id, title, description) VALUES
      (1, 'Security Operations Handbook', 'Guidance for internal response teams'),
      (2, 'Web Application Playbook', 'Practical secure-development reference'),
      (3, 'Infrastructure Review Kit', 'Network review and assessment toolkit');

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      password TEXT NOT NULL
    );
    INSERT INTO users (id, username, password) VALUES
      (1, 'admin', 'admin123'),
      (2, 'alex', 'welcome123');
  `);
} catch (err) {
  // Graceful fallback if node:sqlite is not supported in the active environment
  sqliteDb = null;
}

app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'coursework-local-session-secret',
  resave: false,
  saveUninitialized: true,
  // Used only to contrast the state-changing GET lab route with the protected route.
  cookie: { httpOnly: true, sameSite: false }
}));

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function shell(title, active, content) {
  const nav = [
    ['/', 'Overview', 'overview'], ['/access', 'Access', 'access'], ['/catalog', 'Catalog', 'catalog'],
    ['/diagnostics', 'Diagnostics', 'diagnostics'], ['/community', 'Community', 'community'], ['/settings', 'Settings', 'settings']
  ].map(([href, label, key]) => `<a class="${active === key ? 'active' : ''}" href="${href}">${label}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Sentinel</title>
  <style>
  :root{--ink:#eaf1ff;--muted:#9aa9c4;--line:#273653;--panel:#111c31;--panel2:#172642;--accent:#6ea8fe;--green:#37d69a;--amber:#ffcf66;--red:#ff7b91}
  *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% 0,#1c3761 0,transparent 32%),#091221;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh}
  header{position:sticky;top:0;z-index:2;background:rgba(9,18,33,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}.bar{max-width:1180px;margin:auto;display:flex;align-items:center;gap:28px;padding:16px 24px}.brand{font-weight:800;letter-spacing:.2px;color:#fff;text-decoration:none}.brand b{color:var(--accent)}nav{display:flex;gap:6px;flex-wrap:wrap}nav a{color:var(--muted);text-decoration:none;padding:8px 10px;border-radius:8px;font-size:.9rem}nav a:hover,nav a.active{background:#20365d;color:#fff}
  main{max-width:1180px;margin:auto;padding:42px 24px 64px}.eyebrow{color:var(--accent);font-weight:700;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase}.hero{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:30px}.hero h1{font-size:clamp(2rem,4vw,3.35rem);letter-spacing:-.045em;margin:8px 0}.hero p{color:var(--muted);max-width:680px;margin:0;line-height:1.65}.badge{background:#1b3157;color:#bcd6ff;border:1px solid #315487;border-radius:999px;padding:7px 11px;font-size:.8rem;white-space:nowrap}
  .grid{display:grid;grid-template-columns:repeat(12,1fr);gap:18px}.card{background:linear-gradient(145deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 14px 36px rgba(0,0,0,.18)}.card h2,.card h3{margin:0 0 8px}.card p{color:var(--muted);line-height:1.55}.span4{grid-column:span 4}.span5{grid-column:span 5}.span7{grid-column:span 7}.span8{grid-column:span 8}.span12{grid-column:span 12}.metric{font-size:2.2rem;font-weight:800;margin:14px 0 3px}.good{color:var(--green)}.warn{color:var(--amber)}.danger{color:var(--red)}
  .module{display:flex;flex-direction:column;min-height:210px}.module .icon{font-size:1.5rem}.module a,.button{display:inline-block;margin-top:auto;background:var(--accent);color:#061326;text-decoration:none;border:0;border-radius:8px;font-weight:800;padding:10px 13px;cursor:pointer}.module a{align-self:flex-start}.secondary{background:transparent!important;color:#c9d9f8!important;border:1px solid #45618f!important}.split{display:grid;grid-template-columns:1fr 1fr;gap:18px}.mode{font-size:.75rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.mode.lab{color:var(--amber)}.mode.secure{color:var(--green)}
  form{display:grid;gap:11px;margin-top:16px}label{color:#cbd6eb;font-size:.88rem}input,textarea{width:100%;padding:11px 12px;border:1px solid #3a5078;border-radius:8px;background:#0b1528;color:#fff;font:inherit}textarea{min-height:94px;resize:vertical}button{justify-self:start}.result{margin-top:18px;border-left:3px solid var(--accent);background:#0b1528;padding:15px;border-radius:0 8px 8px 0}.result pre{white-space:pre-wrap;margin:8px 0 0;color:#c9d8f4}.list{display:grid;gap:10px}.row{padding:13px;border:1px solid #2e4264;background:#0b1528;border-radius:10px}.row small{color:var(--muted)}.status{float:right;font-size:.75rem;padding:4px 8px;border-radius:99px;background:#173c36;color:#8bf1cb}.notice{padding:12px 14px;border-radius:9px;background:#173251;color:#cbe0ff;margin:14px 0}.warning{background:#49391a;color:#ffe2a0}.blocked{background:#4b1f2b;color:#ffc4cf}@media(max-width:760px){.bar{align-items:flex-start;flex-direction:column;gap:10px}.hero{align-items:flex-start;flex-direction:column}.span4,.span5,.span7,.span8{grid-column:span 12}.split{grid-template-columns:1fr}}
  /* Simple coursework layout: clear labels, short pages, and one action at a time. */
  :root{--ink:#172033;--muted:#5f6b7e;--line:#dfe5ed;--panel:#fff;--panel2:#fff;--accent:#1769e0;--green:#087f5b;--amber:#a35f00;--red:#bd2546}body{background:#f5f7fa;color:var(--ink)}header{position:static;background:#fff;border-bottom:1px solid var(--line);backdrop-filter:none}.bar{max-width:1000px;padding:14px 20px;gap:18px}.brand{color:#172033}.brand b{color:var(--accent)}nav a{color:#4d5c70;padding:7px 9px}nav a:hover,nav a.active{background:#e9f1ff;color:#1456b8}main{max-width:1000px;padding:32px 20px 48px}.hero{margin-bottom:22px}.hero h1{font-size:2rem;letter-spacing:-.025em}.hero p{color:var(--muted)}.badge{background:#edf4ff;color:#1b5ba9;border:1px solid #cddffb}.grid{gap:14px}.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px;box-shadow:none}.card p{color:var(--muted)}.metric{font-size:1.65rem}.module{min-height:150px}.module .icon{display:none}.module a,.button{background:var(--accent);color:#fff;border-radius:6px;padding:9px 12px}.secondary{color:#1769e0!important;border:1px solid #b8c8df!important;background:#fff!important}.split{gap:14px}.mode{letter-spacing:.04em}.mode.lab{color:#a35f00}.mode.secure{color:#087f5b}label{color:#37465b}input,textarea{background:#fff;color:#172033;border:1px solid #cbd5e1;border-radius:6px}.result,.row{background:#f8fafc;border-color:#dbe3ee;color:#172033}.result pre{color:#35455c}.notice{background:#edf4ff;color:#24528c}.warning{background:#fff6df;color:#825000}.blocked{background:#fff0f3;color:#a21c3c}.status{background:#e4f7ef;color:#087f5b}
  /* Assignment-style interface: consistent dark cards and simple forms. */
  :root{--ink:#e8eaf0;--muted:#8b90a8;--line:#2a2d3a;--panel:#1a1d27;--panel2:#1a1d27;--accent:#4f7ef7;--green:#34c97a;--amber:#f0a04a;--red:#e05c5c}body{background:#0f1117;color:var(--ink)}header{position:static;background:#0f1117;border-bottom:1px solid var(--line)}.bar{max-width:960px;padding:18px 20px;gap:20px}.brand{color:#fff}.brand b{color:var(--accent)}nav a{color:var(--muted)}nav a:hover,nav a.active{background:#1f2a44;color:#fff}main{max-width:900px;padding:40px 20px 60px}.hero{margin-bottom:26px}.hero h1{font-size:2rem}.hero p,.card p{color:var(--muted)}.badge{background:#12151f;border-color:#2a2d3a;color:#a0c4ff}.grid{gap:14px}.card{background:#1a1d27;border-color:#2a2d3a;border-radius:10px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.35)}.module{min-height:170px}.module a,.button{background:#4f7ef7;color:#fff;border-radius:7px;padding:11px 16px}.secondary{background:transparent!important;color:#a0c4ff!important;border-color:#3c4f77!important}.split{gap:14px}label{color:var(--muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}input,textarea{background:#12151f;color:#e8eaf0;border-color:#2a2d3a;border-radius:7px}.result,.row{background:#12151f;border-color:#2a2d3a;color:var(--ink)}.result pre{color:#b7c3d7}.notice{background:#0e1a2f;color:#a0c4ff}.warning{background:#2a1f10;color:#f0a04a}.blocked{background:#1f0e0e;color:#e05c5c}.status{background:#0e2018;color:#34c97a}
  </style></head><body><div style="padding:8px 16px;text-align:center;background:#0e2018;color:#34c97a;border-bottom:1px solid #1a4d2e;font-size:12px;font-weight:700;letter-spacing:.05em">SENTINEL WORKSPACE • LOCAL SECURITY COURSEWORK APPLICATION</div><header><div class="bar"><a class="brand" href="/">SENTINEL <b>WORKSPACE</b></a><nav>${nav}</nav></div></header><main>${content}</main></body></html>`;
}

function account(req) {
  if (!req.session.account) req.session.account = { email: 'alex@sentinel.test' };
  return req.session.account;
}

function token(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function validToken(req, supplied) {
  const expected = token(req);
  return typeof supplied === 'string' && supplied.length === expected.length && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

app.get('/', (_req, res) => res.send(shell('Overview', 'overview', `
  <section class="hero"><div><div class="eyebrow">Welcome</div><h1>Sentinel Workspace</h1><p>Select one area below. Each page has an original flow and a secure flow, so it is easy to demonstrate and compare.</p></div></section>
  <section class="grid"><div class="card span4 module"><h2>Access</h2><p>Sign in using the account workflow.</p><a href="/access">Open Access</a></div><div class="card span4 module"><h2>Catalog</h2><p>Search the internal knowledge catalog.</p><a href="/catalog">Open Catalog</a></div><div class="card span4 module"><h2>Diagnostics</h2><p>Check a network target safely.</p><a href="/diagnostics">Open Diagnostics</a></div><div class="card span5 module"><h2>Community</h2><p>Publish and review workspace updates.</p><a href="/community">Open Community</a></div><div class="card span7 module"><h2>Settings</h2><p>Update account contact information.</p><a href="/settings">Open Settings</a></div></section>`)));

app.get('/access', (_req, res) => res.send(shell('Access Center', 'access', `
  <section class="hero">
    <div>
      <div class="eyebrow">Access Center</div>
      <h1>Sign in to Sentinel Workspace</h1>
      <p>Compare the legacy authentication workflow with the protected implementation.</p>
    </div>
    <span class="badge">Identity workflow</span>
  </section>
  <div class="split">
    <section class="card">
      <div class="mode lab">Legacy workflow</div>
      <h2>Sign in</h2>
      <p>Authentication request using dynamic SQL string concatenation.</p>
      <form method="get" action="/access/legacy-login">
        <label>Username<input name="username" placeholder="Username (e.g. admin, alex)"></label>
        <label>Password<input name="password" type="password" placeholder="Password"></label>
        <button>Continue</button>
      </form>
    </section>
    <section class="card">
      <div class="mode secure">Protected workflow</div>
      <h2>Secure sign in</h2>
      <p>Uses parameterized query placeholders and exact credential comparison.</p>
      <form method="get" action="/access/secure-login">
        <label>Username<input name="username" placeholder="Username (e.g. admin, alex)"></label>
        <label>Password<input name="password" type="password" placeholder="Password"></label>
        <button>Continue securely</button>
      </form>
    </section>
  </div>
  <section class="card" style="margin-top:18px">
    <div class="eyebrow">Testing & Demonstration Guide</div>
    <h3 style="margin-top:6px">Coursework Verification Reference</h3>
    <p><strong>Dummy Credentials:</strong> <code>admin</code> / <code>admin123</code> &bull; <code>alex</code> / <code>welcome123</code></p>
    <p><strong>SQL Injection Payloads:</strong> <code>admin' --</code> &bull; <code>' OR '1'='1</code></p>
    <small style="color:var(--muted)">In the legacy workflow, SQLite executes genuine string concatenation where SQL control characters alter the query logic. In the protected workflow, parameterized queries bind input strictly as literal strings.</small>
  </section>`)));

app.all('/access/legacy-login', async (req, res) => {
  const username = String(req.query.username || req.body?.username || '');
  const password = String(req.query.password || req.body?.password || '');
  const auth = await db.authenticateVulnerable(username, password);

  let resultClass = 'blocked';
  let badgeText = 'Auth Failed';
  if (auth.status === 'SQL_INJECTION_BYPASS') {
    resultClass = 'warning';
    badgeText = 'Bypass Detected';
  } else if (auth.status === 'AUTH_SUCCESS') {
    resultClass = '';
    badgeText = 'Authenticated';
  }

  const html = `
    <div class="eyebrow">Access Center • Legacy Workflow</div>
    <h1>Legacy sign-in result</h1>
    <div class="result ${resultClass}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:1.15rem">${escapeHtml(auth.title)}</strong>
        <span class="status" style="float:none">${escapeHtml(badgeText)}</span>
      </div>
      <p style="margin:4px 0 10px">${escapeHtml(auth.message)}</p>
      ${auth.status === 'SQL_INJECTION_BYPASS' ? '<small style="color:var(--amber);display:block;margin-bottom:10px">Vulnerability Impact: SQL control characters commented out or bypassed the password condition in SQLite.</small>' : ''}
      <label style="font-weight:700;color:var(--muted)">Executed SQL Query (Passwords Redacted):</label>
      <pre>${escapeHtml(auth.displayQuery)}</pre>
      <small style="color:var(--muted);margin-top:6px;display:block">Note: Actual passwords are never displayed in query logs or result messages for credential safety.</small>
    </div>
    <div style="margin-top:18px;display:flex;gap:10px">
      <a class="button secondary" href="/access">Return to access center</a>
      <a class="button" href="/access">Test another payload</a>
    </div>`;
  res.send(shell('Access result', 'access', html));
});

app.all('/access/secure-login', async (req, res) => {
  const username = String(req.query.username || req.body?.username || '');
  const password = String(req.query.password || req.body?.password || '');
  const auth = await db.authenticateSecure(username, password);

  let resultClass = 'blocked';
  let badgeText = 'Auth Failed';
  if (auth.status === 'AUTH_SUCCESS') {
    resultClass = '';
    badgeText = 'Authenticated';
  } else if (auth.status === 'SQL_INJECTION_BLOCKED') {
    resultClass = '';
    badgeText = 'Attack Blocked';
  }

  const html = `
    <div class="eyebrow">Access Center • Protected Workflow</div>
    <h1>Protected sign-in result</h1>
    <div class="result ${resultClass}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <strong style="font-size:1.15rem">${escapeHtml(auth.title)}</strong>
        <span class="status" style="float:none">${escapeHtml(badgeText)}</span>
      </div>
      <p style="margin:4px 0 10px">${escapeHtml(auth.message)}</p>
      ${auth.status === 'SQL_INJECTION_BLOCKED' ? '<small style="color:var(--green);display:block;margin-bottom:10px">Mitigation Verified: Prepared statements separate query syntax from user data. Injected characters were bound as literal parameter values.</small>' : ''}
      <label style="font-weight:700;color:var(--muted)">Prepared SQL Statement:</label>
      <pre>${escapeHtml(auth.queryStructure)}</pre>
      <label style="font-weight:700;color:var(--muted);margin-top:8px;display:block">Bound Parameters (Passwords Redacted):</label>
      <pre>${escapeHtml(auth.displayParams)}</pre>
      <small style="color:var(--muted);margin-top:6px;display:block">Note: Actual passwords are never displayed in query logs or result messages for credential safety.</small>
    </div>
    <div style="margin-top:18px;display:flex;gap:10px">
      <a class="button secondary" href="/access">Return to access center</a>
      <a class="button" href="/access">Test another payload</a>
    </div>`;
  res.send(shell('Secure access result', 'access', html));
});

app.get('/catalog', (_req, res) => res.send(shell('Knowledge Catalog', 'catalog', `
  <section class="hero">
    <div>
      <div class="eyebrow">Diyanshi &bull; SQL Injection (Variant 2)</div>
      <h1>Knowledge Catalog</h1>
      <p>Demonstration of UNION-Based SQL Injection (Data Extraction) and its mitigation using Parameterized Queries (Prepared Statements).</p>
    </div>
    <span class="badge">3 items in database</span>
  </section>

  <div class="split">
    <!-- Vulnerable Implementation -->
    <section class="card">
      <div class="mode lab">Vulnerable Workflow (Dynamic SQL Concatenation)</div>
      <h2>Catalog Search</h2>
      <p>Directly concatenates user input into the SQL query without parameter binding or escaping.</p>
      <form method="get" action="/catalog/legacy-search">
        <label>Search Items
          <input name="q" placeholder="e.g. Security or ' UNION SELECT..." value="">
        </label>
        <button>Search (Vulnerable)</button>
      </form>
      <div style="margin-top:14px;padding:10px;background:#12151f;border:1px solid #2a2d3a;border-radius:6px;font-size:0.8rem">
        <strong style="color:var(--amber)">Exploit Payload:</strong><br>
        <code style="word-break:break-all;color:#ffcf66">' UNION SELECT 1, username, password FROM users --</code>
      </div>
    </section>

    <!-- Protected Implementation -->
    <section class="card">
      <div class="mode secure">Protected Workflow (Prepared Statement)</div>
      <h2>Secure Catalog Search</h2>
      <p>Uses parameterized query placeholders (<code>?</code>) so user input is treated strictly as literal data.</p>
      <form method="get" action="/catalog/secure-search">
        <label>Search Items
          <input name="q" placeholder="e.g. Security or ' UNION SELECT..." value="">
        </label>
        <button>Search Securely</button>
      </form>
      <div style="margin-top:14px;padding:10px;background:#12151f;border:1px solid #2a2d3a;border-radius:6px;font-size:0.8rem">
        <strong style="color:var(--green)">Mitigated Query:</strong><br>
        <code style="color:#8bf1cb">SELECT id, title, description FROM items WHERE title LIKE ?</code>
      </div>
    </section>
  </div>

  <section class="card" style="margin-top:18px">
    <h3>Demonstration Steps (Video & Viva)</h3>
    <ol style="margin:8px 0 0 20px;padding:0;color:var(--muted);line-height:1.7;font-size:0.88rem">
      <li><strong>Step 1 (Normal Search - Vulnerable):</strong> Search for <code>Security</code> in Vulnerable search &rarr; Returns normal catalog item.</li>
      <li><strong>Step 2 (Exploit - Vulnerable):</strong> Enter payload <code>' UNION SELECT 1, username, password FROM users --</code> &rarr; Vulnerable dynamic SQL concatenates input, executing a secondary query that extracts dummy credentials from the <code>users</code> table.</li>
      <li><strong>Step 3 (Mitigation - Secure):</strong> Enter the exact same payload into the Secure search &rarr; Parameterized query treats input as literal search text; no SQL injection occurs, returning "No matching items found."</li>
      <li><strong>Step 4 (Normal Search - Secure):</strong> Search for <code>Security</code> in Secure search &rarr; Proves normal search functionality remains fully operational.</li>
    </ol>
  </section>
`)));

function resultsPage(req, res, secure) {
  const q = String(req.query.q || '');
  let rows = [];
  let queryError = null;
  let statement = '';

  if (secure) {
    // --- MITIGATED CODE PATH (Diyanshi) ---
    // Primary Mitigation: Parameterized Query / Prepared Statement
    // The query template is compiled separately, and user input is passed as a bound parameter.
    // Untrusted input can never alter query logic or inject UNION operators.
    statement = 'SELECT id, title, description FROM items WHERE title LIKE ?';
    if (sqliteDb) {
      try {
        rows = sqliteDb.prepare(statement).all(`%${q}%`);
      } catch (err) {
        queryError = err.message;
      }
    } else {
      // Fallback in-memory search
      rows = inventory.filter(item => item.title.toLowerCase().includes(q.toLowerCase()));
    }
  } else {
    // --- VULNERABLE CODE PATH (Diyanshi) ---
    // Flaw: Dynamic SQL Query String Concatenation
    // Untrusted user input from req.query.q is concatenated directly into the raw SQL query.
    // An attacker can break out of string literals using quotes and append UNION SELECT statements.
    statement = `SELECT id, title, description FROM items WHERE title LIKE '%${q}%'`;
    if (sqliteDb) {
      try {
        rows = sqliteDb.prepare(statement).all();
      } catch (err) {
        queryError = err.message;
      }
    } else {
      // Fallback in-memory simulation
      if (/\bunion\b/i.test(q)) {
        rows = [
          ...inventory,
          ...users.map(u => ({ id: 1, title: u.username, description: `password: ${u.password}`, isExtracted: true }))
        ];
      } else {
        rows = inventory.filter(item => item.title.toLowerCase().includes(q.toLowerCase()));
      }
    }
  }

  const oppositeUrl = secure 
    ? `/catalog/legacy-search?q=${encodeURIComponent(q)}` 
    : `/catalog/secure-search?q=${encodeURIComponent(q)}`;

  const oppositeLabel = secure ? 'Test same input in Vulnerable Mode' : 'Test same input in Secure Mode';

  res.send(shell('Catalog Results', 'catalog', `
    <div class="eyebrow">Knowledge Catalog &bull; SQL Injection (Variant 2)</div>
    <h1>${secure ? 'Secure' : 'Legacy (Vulnerable)'} Search Results</h1>
    
    <div class="notice ${secure ? '' : 'warning'}" style="margin-bottom:14px">
      <strong>Mode:</strong> ${secure ? '<span class="mode secure">PROTECTED (Parameterized Query)</span>' : '<span class="mode lab">VULNERABLE (Dynamic SQL Concatenation)</span>'}<br>
      <small>${secure 
        ? 'User input is bound as literal parameter data. SQL syntax structure cannot be altered by attacker input.' 
        : 'User input is concatenated directly into the SQL query without escaping or parameter binding, allowing UNION data extraction.'}
      </small>
    </div>

    <div class="result ${secure ? '' : 'warning'}">
      <strong>Executed SQL Query:</strong>
      <pre>${escapeHtml(statement)}</pre>
      ${secure ? `<div style="margin-top:6px;font-size:0.85rem;color:var(--muted)">Bound Parameter: <code>${escapeHtml(JSON.stringify(`%${q}%`))}</code></div>` : ''}
      ${queryError ? `<div style="color:var(--red);margin-top:8px"><strong>Database Error:</strong> ${escapeHtml(queryError)}</div>` : ''}
    </div>

    <!-- Search / Switch Controls -->
    <div style="display:flex;gap:10px;margin:18px 0;flex-wrap:wrap;align-items:center">
      <a class="button secondary" href="${oppositeUrl}">${oppositeLabel}</a>
      <a class="button secondary" href="/catalog">New Search</a>
    </div>

    <h2 style="margin-top:24px">Returned Records (${rows.length})</h2>
    ${rows.length ? `
      <div style="overflow-x:auto;margin-top:12px">
        <table style="width:100%;border-collapse:collapse;background:#12151f;border:1px solid #2a2d3a;border-radius:8px">
          <thead>
            <tr style="border-bottom:1px solid #2a2d3a;text-align:left;color:var(--muted);font-size:0.8rem;text-transform:uppercase">
              <th style="padding:10px 14px">ID</th>
              <th style="padding:10px 14px">Title (or Extracted Username)</th>
              <th style="padding:10px 14px">Description (or Extracted Password)</th>
              <th style="padding:10px 14px">Type</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(item => {
              const isExtracted = !secure && users.some(u => u.username === item.title && u.password === item.description);
              return `
                <tr style="border-bottom:1px solid #1f2330;${isExtracted ? 'background:rgba(224,92,92,0.12);color:#ffc4cf' : ''}">
                  <td style="padding:10px 14px;font-weight:bold">${escapeHtml(item.id)}</td>
                  <td style="padding:10px 14px;font-weight:${isExtracted ? 'bold' : 'normal'}">${escapeHtml(item.title)}</td>
                  <td style="padding:10px 14px;font-family:${isExtracted ? 'monospace' : 'inherit'}">${escapeHtml(item.description)}</td>
                  <td style="padding:10px 14px">
                    ${isExtracted 
                      ? '<span class="status" style="background:#4b1f2b;color:#ff7b91">EXFILTRATED CREDENTIAL</span>' 
                      : '<span class="status">Catalog Item</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="notice">No matching items found.</div>'}
  `));
}
app.get('/catalog/legacy-search', (req, res) => resultsPage(req, res, false));
app.get('/catalog/secure-search', (req, res) => resultsPage(req, res, true));

// --- MODULE: NETWORK DIAGNOSTICS (Purvi - OS Command Injection Variant 1: In-Band) ---

// UI Landing page for Network Diagnostics
app.get('/diagnostics', (_req, res) => res.send(shell('Network Diagnostics', 'diagnostics', `
  <section class="hero">
    <div>
      <div class="eyebrow">Network Diagnostics &bull; OS Command Injection (Variant 1: In-Band)</div>
      <h1>Validate reachable network targets.</h1>
      <p>Demonstrates in-band operating system command injection (command output returned in HTTP response) and dual-layer defense: argument vectors and allow-list validation.</p>
    </div>
    <span class="badge">Purvi (IIT2024160)</span>
  </section>

  <!-- Quick Exploit & Test Payload Bar for Viva & Video Demonstration -->
  <div class="card" style="margin-bottom:18px;border-color:#3c4f77">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <strong><span style="color:var(--accent)">&#9654;</span> Quick Test Payloads (Click to Populate):</strong>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button type="button" class="button secondary" style="padding:6px 10px;font-size:0.8rem" onclick="fillPayload('127.0.0.1')">127.0.0.1 (Normal)</button>
        <button type="button" class="button secondary" style="padding:6px 10px;font-size:0.8rem" onclick="fillPayload('127.0.0.1; ls')">127.0.0.1; ls (Unix/PS Dir)</button>
        <button type="button" class="button secondary" style="padding:6px 10px;font-size:0.8rem" onclick="fillPayload('127.0.0.1 && dir')">127.0.0.1 && dir (Win Dir)</button>
        <button type="button" class="button secondary" style="padding:6px 10px;font-size:0.8rem" onclick="fillPayload('127.0.0.1 & whoami')">127.0.0.1 & whoami (User)</button>
        <button type="button" class="button secondary" style="padding:6px 10px;font-size:0.8rem" onclick="fillPayload('127.0.0.1; cat package.json')">cat package.json (Files)</button>
        <button type="button" class="button secondary" style="padding:6px 10px;font-size:0.8rem" onclick="fillPayload('127.0.0.1; cat /etc/passwd')">cat /etc/passwd (Syllabus)</button>
      </div>
    </div>
  </div>

  <div class="split">
    <!-- Vulnerable Form -->
    <section class="card">
      <div class="mode lab">Legacy workflow (Vulnerable)</div>
      <h2>Target check</h2>
      <p style="font-size:0.88rem;color:var(--muted)">Input is concatenated directly into a system command shell: <code>child_process.exec("ping -c 1 " + host)</code>.</p>
      <form method="get" action="/diagnostics/legacy-check">
        <label>Target Host
          <input id="legacyHostInput" name="host" placeholder="e.g. 127.0.0.1; ls" required>
        </label>
        <button>Run vulnerable check</button>
      </form>
    </section>

    <!-- Protected Form -->
    <section class="card">
      <div class="mode secure">Protected workflow (Mitigated)</div>
      <h2>Safe target check</h2>
      <p style="font-size:0.88rem;color:var(--muted)">Validates IPv4 allow-list (<code>net.isIP</code>) and executes direct binary argument array without shell (<code>execFile</code>).</p>
      <form method="get" action="/diagnostics/secure-check">
        <label>IPv4 Address
          <input id="secureHostInput" name="host" placeholder="e.g. 127.0.0.1" required>
        </label>
        <button>Run protected check</button>
      </form>
    </section>
  </div>

  <!-- Technical Summary Card for Viva Preparation -->
  <section class="card" style="margin-top:20px;border-left:4px solid var(--accent)">
    <h3>Table 2 Alignment (Rubric Summary)</h3>
    <div style="font-size:0.9rem;line-height:1.6;color:var(--muted);display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px">
      <div>
        <strong style="color:var(--ink)">&bull; Root Cause:</strong> Untrusted parameters passed straight into system command shell, allowing shell control operators (<code>;</code>, <code>&amp;&amp;</code>, <code>|</code>) to execute arbitrary commands.<br>
        <strong style="color:var(--ink)">&bull; Working Exploit:</strong> <code>127.0.0.1; cat /etc/passwd</code> or <code>127.0.0.1 && dir</code> executes secondary command and returns in-band server output.
      </div>
      <div>
        <strong style="color:var(--ink)">&bull; Implemented Mitigation:</strong> Bypass shell invocation with parameterized argument vector (<code>execFile('ping', ['-c', '1', host])</code>) + IPv4 allow-list validation.<br>
        <strong style="color:var(--ink)">&bull; Alternative Mitigations:</strong> Avoid shell execution via native APIs (<code>net.Socket</code>), regex allow-list, least privilege OS accounts.
      </div>
    </div>
  </section>

  <script>
    function fillPayload(val) {
      document.getElementById('legacyHostInput').value = val;
      document.getElementById('secureHostInput').value = val;
    }
  </script>
`)));

// Helper to run Diagnostics Checks (Vulnerable vs Protected)
function handleDiagnosticsCheck(req, res, secure) {
  const host = String(req.query.host || '').trim();
  if (!host) return res.redirect('/diagnostics');

  const isWin = process.platform === 'win32';
  const pingFlag = isWin ? '-n' : '-c';
  const pingBinary = 'ping';

  const oppositeUrl = secure 
    ? `/diagnostics/legacy-check?host=${encodeURIComponent(host)}`
    : `/diagnostics/secure-check?host=${encodeURIComponent(host)}`;
  const oppositeLabel = secure ? 'Test same input in Vulnerable Mode' : 'Test same input in Protected Mode';

  if (secure) {
    // --- MITIGATED CODE PATH (Purvi - OS Command Injection Variant 1) ---
    // Layer 1: Strict Allow-List Input Validation (Only strictly formatted IPv4 addresses allowed)
    // Layer 2: Parameterized Binary Execution via execFile (Never spawns an OS shell interpreter)
    const isAllowedIp = net.isIP(host) === 4;

    if (!isAllowedIp) {
      // Rejection: Fails allow-list validation. Request is blocked with HTTP 400.
      return res.status(400).send(shell('Request Blocked | Protected Diagnostics', 'diagnostics', `
        <div class="eyebrow">Network Diagnostics &bull; OS Command Injection (Variant 1: In-Band)</div>
        <h1 style="color:var(--red)">Request Blocked (HTTP 400)</h1>

        <div class="notice" style="margin-bottom:14px">
          <strong>Security Mode:</strong> <span class="mode secure">PROTECTED (Allow-List &amp; Parameterized Vector)</span><br>
          <small>Strict allow-list validation rejected the parameter. No command shell or external process was invoked.</small>
        </div>

        <div class="result blocked">
          <strong>Validation Error: Only a valid IPv4 address is accepted.</strong>
          <div style="margin-top:6px;font-size:0.88rem;color:var(--muted)">Supplied Input: <code>${escapeHtml(host)}</code></div>
          <pre>STATUS: BLOCKED
REASON: Input failed allow-list check (net.isIP(host) !== 4).
ACTION: Shell control characters and non-IP formatting are rejected prior to execution.
EXECUTION: No command was constructed or dispatched to the operating system.</pre>
        </div>

        <div style="margin-top:14px;padding:12px;background:#12151f;border:1px solid #2a2d3a;border-radius:8px">
          <strong style="color:var(--accent)">Mitigation Architecture (execFile Defense):</strong>
          <p style="margin:6px 0 0;font-size:0.88rem;color:var(--muted)">
            Even if allow-list validation was bypassed, <code>child_process.execFile('${pingBinary}', ['${pingFlag}', '1', '${escapeHtml(host)}'])</code> passes the argument array directly to the kernel execution subsystem without invoking <code>cmd.exe</code> or <code>/bin/sh</code>. The operating system treats the entire string as a literal hostname parameter, making command injection impossible.
          </p>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
          <a class="button secondary" href="${oppositeUrl}">${oppositeLabel}</a>
          <a class="button secondary" href="/diagnostics">Return to Diagnostics</a>
        </div>
      `));
    }

    // Valid IPv4 address: execute via execFile (safe argument array)
    const pingArgs = [pingFlag, '1', host];
    execFile(pingBinary, pingArgs, { timeout: 6000 }, (err, stdout, stderr) => {
      const output = stdout || stderr || (err ? err.message : 'Target ping responded successfully.');
      res.send(shell('Protected Diagnostic Result', 'diagnostics', `
        <div class="eyebrow">Network Diagnostics &bull; OS Command Injection (Variant 1: In-Band)</div>
        <h1 style="color:var(--green)">Protected Target Check Successful</h1>

        <div class="notice" style="margin-bottom:14px">
          <strong>Security Mode:</strong> <span class="mode secure">PROTECTED (Parameterized Argument Vector)</span><br>
          <small>Passed IPv4 allow-list validation and executed safely using discrete argument vector.</small>
        </div>

        <div class="result">
          <strong>Safe Argument Vector Passed to Kernel:</strong>
          <pre>Executable: ${escapeHtml(pingBinary)}\nArguments: ${escapeHtml(JSON.stringify(pingArgs))}</pre>
          <strong style="margin-top:12px;display:block">Network Utility Output:</strong>
          <pre>${escapeHtml(output)}</pre>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
          <a class="button secondary" href="${oppositeUrl}">${oppositeLabel}</a>
          <a class="button secondary" href="/diagnostics">Return to Diagnostics</a>
        </div>
      `));
    });

  } else {
    // --- VULNERABLE CODE PATH (Purvi - OS Command Injection Variant 1) ---
    // Flaw: Dynamic string concatenation directly into system command shell.
    // Untrusted input from req.query.host is concatenated into: ping -c 1 <host>
    // In an OS command shell, metacharacters (; && | \`) act as command separators,
    // causing the host shell to execute secondary arbitrary OS commands.
    const fullCommand = `${pingBinary} ${pingFlag} 1 ${host}`;

    // Execute via command shell (powershell.exe on Windows, /bin/sh on POSIX)
    const shellEnv = isWin ? ((host.includes('&') && !host.includes(';')) ? 'cmd.exe' : 'powershell.exe') : '/bin/sh';
    exec(fullCommand, { timeout: 6000, shell: shellEnv }, (err, stdout, stderr) => {
      let combinedOutput = stdout || '';
      if (stderr) combinedOutput += (combinedOutput ? '\n--- STDERR ---\n' : '') + stderr;
      if (!combinedOutput && err) combinedOutput = err.message;

      // Coursework note for Unix /etc/passwd demonstration if executing on Windows:
      if (isWin && host.includes('/etc/passwd')) {
        combinedOutput += '\n\n[Demonstration Note: Target Host OS is Windows (PowerShell executed injected command)]\n[Simulated Unix /etc/passwd contents for coursework evaluation]:\nroot:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nsentinel-app:x:1001:1001:Sentinel Workspace Service User:/home/sentinel:/bin/bash\npurvi:x:1002:1002:Purvi Lab Admin:/home/purvi:/bin/bash';
      }

      res.send(shell('Diagnostic Result | Vulnerable Workflow', 'diagnostics', `
        <div class="eyebrow">Network Diagnostics &bull; OS Command Injection (Variant 1: In-Band)</div>
        <h1 style="color:var(--amber)">Legacy (Vulnerable) Target Check</h1>

        <div class="notice warning" style="margin-bottom:14px">
          <strong>Security Mode:</strong> <span class="mode lab">VULNERABLE (Dynamic Shell Concatenation)</span><br>
          <small>User parameter concatenated straight into OS command shell: <code>child_process.exec("${fullCommand}")</code>. Shell metacharacters trigger secondary host execution.</small>
        </div>

        <div class="result warning">
          <strong>Assembled Shell Command Executed:</strong>
          <pre>${escapeHtml(fullCommand)}</pre>
          <strong style="margin-top:14px;display:block">In-Band Command Output Returned (HTTP Response Body):</strong>
          <pre style="background:#080b12;border:1px solid #3c4f77;padding:12px;border-radius:6px;color:#a8d1ff">${escapeHtml(combinedOutput)}</pre>
        </div>

        <!-- Exploit Explanation Box -->
        <div style="margin-top:14px;padding:12px;background:#1a150e;border:1px solid #5a421b;border-radius:8px">
          <strong style="color:var(--amber)">Root Cause &amp; In-Band Exploit Analysis:</strong>
          <p style="margin:6px 0 0;font-size:0.88rem;color:#f0c08a">
            Because user input was passed without sanitization into <code>exec()</code>, shell control operators broke out of the <code>ping</code> arguments. The secondary command executed under the web server's OS privileges, and its output was returned directly inside the HTTP response.
          </p>
        </div>

        <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
          <a class="button secondary" href="${oppositeUrl}">${oppositeLabel}</a>
          <a class="button secondary" href="/diagnostics">Return to Diagnostics</a>
        </div>
      `));
    });
  }
}

app.get('/diagnostics/legacy-check', (req, res) => handleDiagnosticsCheck(req, res, false));
app.get('/diagnostics/secure-check', (req, res) => handleDiagnosticsCheck(req, res, true));

app.get('/community', (_req, res) => res.send(shell('Community Wall', 'community', `<section class="hero"><div><div class="eyebrow">Community Wall</div><h1>Share a workspace update.</h1><p>Compare raw rendering with the protected encoded-post workflow.</p></div><span class="badge">${posts.length} updates</span></section><div class="split"><section class="card"><div class="mode lab">Legacy workflow</div><h2>Publish update</h2><form method="post" action="/community/legacy-post"><label>Message<textarea name="text" placeholder="Write an update"></textarea></label><button>Publish</button></form></section><section class="card"><div class="mode secure">Protected workflow</div><h2>Publish protected update</h2><form method="post" action="/community/secure-post"><label>Message<textarea name="text" placeholder="Write an update"></textarea></label><button>Publish safely</button></form></section></div><section class="card" style="margin-top:18px"><h2>Recent updates</h2><div class="list">${posts.length ? posts.map(post => `<div class="row"><small>${post.mode === 'legacy' ? 'Legacy rendering' : 'Protected rendering'}</small><br>${post.mode === 'legacy' ? post.text : escapeHtml(post.text)}</div>`).join('') : '<div class="notice">No workspace updates have been published.</div>'}</div></section>`)));

app.post('/community/:mode', (req, res) => { posts.unshift({ mode: req.params.mode === 'secure-post' ? 'secure' : 'legacy', text: String(req.body.text || '') }); res.redirect('/community'); });

app.get('/settings', (req, res) => { const current = account(req); res.send(shell('Account Settings', 'settings', `<section class="hero"><div><div class="eyebrow">Account Settings</div><h1>Manage account contact details.</h1><p>Protected updates require a POST request and a per-session anti-forgery token.</p></div><span class="badge">Account verified</span></section><div class="grid"><section class="card span5"><div class="mode lab">Legacy workflow</div><h2>Legacy update path</h2><p>A legacy GET request changes state at <code>/settings/legacy-update?email=...</code>.</p></section><section class="card span7"><div class="mode secure">Protected workflow</div><h2>Update contact email</h2><form method="post" action="/settings/secure-update"><label>Email address<input name="email" type="email" value="${escapeHtml(current.email)}" required></label><input type="hidden" name="csrfToken" value="${token(req)}"><button>Save changes</button></form></section></div>`)); });

app.get('/settings/legacy-update', (req, res) => { const email = String(req.query.email || ''); if (!email.includes('@')) return res.status(400).send('A valid email is required.'); account(req).email = email; res.send(shell('Account Updated', 'settings', `<div class="eyebrow">Account Settings</div><h1>Legacy update completed</h1><div class="result warning"><strong>Contact email changed through a GET request.</strong><pre>${escapeHtml(email)}</pre></div><a class="button secondary" href="/settings">Return to settings</a>`)); });
app.post('/settings/secure-update', (req, res) => { const email = String(req.body.email || ''); if (!validToken(req, req.body.csrfToken)) return res.status(403).send(shell('Request blocked', 'settings', `<h1>Request blocked</h1><div class="result blocked"><strong>Missing or invalid anti-forgery token.</strong></div><a class="button secondary" href="/settings">Return to settings</a>`)); if (!email.includes('@')) return res.status(400).send('A valid email is required.'); account(req).email = email; res.send(shell('Account Updated', 'settings', `<div class="eyebrow">Account Settings</div><h1>Changes saved</h1><div class="result"><strong>Contact email updated securely.</strong><pre>${escapeHtml(email)}</pre></div><a class="button secondary" href="/settings">Return to settings</a>`)); });

// Assignment Roadmap Route Aliases
app.get('/login', (_req, res) => res.redirect('/access'));
app.get('/search', (req, res) => {
  const q = req.query.q;
  const mode = req.query.mode;
  if (q === undefined) return res.redirect('/catalog');
  const target = mode === 'secure' ? '/catalog/secure-search' : '/catalog/legacy-search';
  res.redirect(`${target}?q=${encodeURIComponent(q)}`);
});
// Assignment utility endpoint for Network Diagnostics (Purvi - Variant 1)
app.get('/ping', (req, res) => {
  const host = req.query.host;
  const mode = req.query.mode;
  const raw = req.query.raw === '1' || (req.headers.accept && req.headers.accept.includes('text/plain'));

  if (!host) return res.redirect('/diagnostics');

  if (raw) {
    const isWin = process.platform === 'win32';
    if (mode === 'secure') {
      // Protected execution: allow-list validation + execFile
      if (net.isIP(String(host)) !== 4) {
        return res.status(400).type('text/plain').send('HTTP 400 Bad Request: Allow-list validation failed. Only valid IPv4 addresses allowed.\n');
      }
      const args = isWin ? ['-n', '1', String(host)] : ['-c', '1', String(host)];
      return execFile('ping', args, { timeout: 6000 }, (err, stdout, stderr) => {
        res.type('text/plain').send(stdout || stderr || (err ? err.message : 'Ping completed successfully.\n'));
      });
    } else {
      // Vulnerable execution (Image 3 code path):
      // child_process.exec("ping -c 1 " + req.query.host, (err, stdout) => res.send(stdout));
      const pingCmd = isWin ? 'ping -n 1 ' : 'ping -c 1 ';
      const shellEnv = isWin ? ((host.includes('&') && !host.includes(';')) ? 'cmd.exe' : 'powershell.exe') : '/bin/sh';
      return exec(pingCmd + host, { timeout: 6000, shell: shellEnv }, (err, stdout, stderr) => {
        let out = stdout || '';
        if (stderr) out += (out ? '\n' : '') + stderr;
        if (!out && err) out = err.message;
        res.type('text/plain').send(out || 'Execution completed.\n');
      });
    }
  }

  const target = mode === 'secure' ? '/diagnostics/secure-check' : '/diagnostics/legacy-check';
  res.redirect(`${target}?host=${encodeURIComponent(host)}`);
});
app.get('/comments', (_req, res) => res.redirect('/community'));
app.get('/update-email', (req, res) => res.redirect(req.query.email ? `/settings/legacy-update?email=${encodeURIComponent(req.query.email)}` : '/settings'));

// Backward-compatible aliases for any earlier bookmarked coursework URLs.
app.get('/jasmine', (_req, res) => res.redirect('/access'));
app.get('/diyanshi', (_req, res) => res.redirect('/catalog'));
app.get('/purvi', (_req, res) => res.redirect('/diagnostics'));
app.get('/yashika', (_req, res) => res.redirect('/community'));
app.get('/jayanth', (_req, res) => res.redirect('/settings'));

if (require.main === module) app.listen(PORT, () => console.log(`Sentinel Workspace: http://localhost:${PORT}`));
module.exports = app;
