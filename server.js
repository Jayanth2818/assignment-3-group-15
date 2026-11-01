const crypto = require('node:crypto');
const net = require('node:net');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
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

app.get('/access', (_req, res) => res.send(shell('Access Center', 'access', `<section class="hero"><div><div class="eyebrow">Access Center</div><h1>Sign in to Sentinel Workspace</h1><p>Compare the legacy authentication workflow with the protected implementation.</p></div><span class="badge">Identity workflow</span></section><div class="split"><section class="card"><div class="mode lab">Legacy workflow</div><h2>Sign in</h2><p>Authentication request using the legacy query path.</p><form method="get" action="/access/legacy-login"><label>Username<input name="username" placeholder="Username"></label><label>Password<input name="password" type="password" placeholder="Password"></label><button>Continue</button></form></section><section class="card"><div class="mode secure">Protected workflow</div><h2>Secure sign in</h2><p>Uses parameter binding and exact credential comparison.</p><form method="get" action="/access/secure-login"><label>Username<input name="username" placeholder="Username"></label><label>Password<input name="password" type="password" placeholder="Password"></label><button>Continue securely</button></form></section></div>`)));

app.get('/access/legacy-login', (req, res) => {
  const username = String(req.query.username || ''); const password = String(req.query.password || '');
  const statement = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  const result = /('|%27)\s*(or|OR)\s*.*=/.test(username) ? users[0] : users.find(user => user.username === username && user.password === password);
  res.send(shell('Access result', 'access', `<div class="eyebrow">Access Center</div><h1>Legacy sign-in result</h1><div class="result ${result ? 'warning' : 'blocked'}"><strong>${result ? `Session opened for ${escapeHtml(result.username)}` : 'Authentication failed'}</strong><pre>${escapeHtml(statement)}</pre></div><a class="button secondary" href="/access">Return to access center</a>`));
});

app.get('/access/secure-login', (req, res) => {
  const username = String(req.query.username || ''); const password = String(req.query.password || '');
  const result = users.find(user => user.username === username && user.password === password);
  res.send(shell('Secure access result', 'access', `<div class="eyebrow">Access Center</div><h1>Protected sign-in result</h1><div class="result ${result ? '' : 'blocked'}"><strong>${result ? `Session opened for ${escapeHtml(result.username)}` : 'Authentication failed'}</strong><pre>SELECT * FROM users WHERE username = ? AND password = ?</pre></div><a class="button secondary" href="/access">Return to access center</a>`));
});

app.get('/catalog', (_req, res) => res.send(shell('Knowledge Catalog', 'catalog', `<section class="hero"><div><div class="eyebrow">Knowledge Catalog</div><h1>Search trusted internal resources.</h1><p>Catalog search supports a legacy lookup path and an isolated parameterized search path.</p></div><span class="badge">3 resources indexed</span></section><div class="split"><section class="card"><div class="mode lab">Legacy workflow</div><h2>Catalog search</h2><form method="get" action="/catalog/legacy-search"><label>Search query<input name="q" placeholder="Search resources"></label><button>Search</button></form></section><section class="card"><div class="mode secure">Protected workflow</div><h2>Secure catalog search</h2><form method="get" action="/catalog/secure-search"><label>Search query<input name="q" placeholder="Search resources"></label><button>Search securely</button></form></section></div>`)));

function resultsPage(req, res, secure) {
  const q = String(req.query.q || '');
  const result = !secure && /\bunion\b/i.test(q) ? [...inventory, ...users.map(user => ({ title: user.username, description: `password: ${user.password}`, status: 'Restricted' }))] : inventory.filter(item => item.title.toLowerCase().includes(q.toLowerCase()));
  const statement = secure ? 'SELECT id, title, description FROM resources WHERE title LIKE ?' : `SELECT id, title, description FROM resources WHERE title LIKE '%${q}%'`;
  res.send(shell('Catalog Results', 'catalog', `<div class="eyebrow">Knowledge Catalog</div><h1>${secure ? 'Secure' : 'Legacy'} search results</h1><div class="result ${secure ? '' : 'warning'}"><pre>${escapeHtml(statement)}</pre></div><div class="list">${result.length ? result.map(item => `<div class="row"><span class="status">${escapeHtml(item.status)}</span><strong>${escapeHtml(item.title)}</strong><br><small>${escapeHtml(item.description)}</small></div>`).join('') : '<div class="notice">No resources match this query.</div>'}</div><a class="button secondary" href="/catalog">Return to catalog</a>`));
}
app.get('/catalog/legacy-search', (req, res) => resultsPage(req, res, false));
app.get('/catalog/secure-search', (req, res) => resultsPage(req, res, true));

app.get('/diagnostics', (_req, res) => res.send(shell('Network Diagnostics', 'diagnostics', `<section class="hero"><div><div class="eyebrow">Network Diagnostics</div><h1>Validate reachable network targets.</h1><p>The protected utility accepts only an IPv4 address and does not invoke a system shell.</p></div><span class="badge">Controlled simulation</span></section><div class="split"><section class="card"><div class="mode lab">Legacy workflow</div><h2>Target check</h2><form method="get" action="/diagnostics/legacy-check"><label>Host<input name="host" placeholder="e.g. 127.0.0.1"></label><button>Run check</button></form></section><section class="card"><div class="mode secure">Protected workflow</div><h2>Safe target check</h2><form method="get" action="/diagnostics/secure-check"><label>IPv4 address<input name="host" placeholder="e.g. 127.0.0.1"></label><button>Run protected check</button></form></section></div>`)));

app.get('/diagnostics/legacy-check', (req, res) => {
  const host = String(req.query.host || ''); const injected = /[;&|`$]/.test(host); const output = injected ? 'SIMULATED COMMAND OUTPUT\n/etc/passwd\n/var/www\n/app/server.js' : `SIMULATED NETWORK CHECK\nTarget ${host || 'not supplied'} responded successfully`;
  res.send(shell('Diagnostic Result', 'diagnostics', `<div class="eyebrow">Network Diagnostics</div><h1>Legacy target check</h1><div class="result warning"><strong>Command assembled from user input</strong><pre>ping -c 1 ${escapeHtml(host)}</pre><pre>${escapeHtml(output)}</pre></div><a class="button secondary" href="/diagnostics">Return to diagnostics</a>`));
});

app.get('/diagnostics/secure-check', (req, res) => {
  const host = String(req.query.host || ''); const okay = net.isIP(host) === 4;
  res.status(okay ? 200 : 400).send(shell('Protected Diagnostic Result', 'diagnostics', `<div class="eyebrow">Network Diagnostics</div><h1>${okay ? 'Protected target check' : 'Request blocked'}</h1><div class="result ${okay ? '' : 'blocked'}"><strong>${okay ? 'Target validation passed' : 'Only a valid IPv4 address is accepted.'}</strong><pre>${okay ? `Argument array: ['-c', '1', '${escapeHtml(host)}']\nSimulated network check completed.` : 'No command was constructed or executed.'}</pre></div><a class="button secondary" href="/diagnostics">Return to diagnostics</a>`));
});

app.get('/community', (_req, res) => res.send(shell('Community Wall', 'community', `<section class="hero"><div><div class="eyebrow">Community Wall</div><h1>Share a workspace update.</h1><p>Compare raw rendering with the protected encoded-post workflow.</p></div><span class="badge">${posts.length} updates</span></section><div class="split"><section class="card"><div class="mode lab">Legacy workflow</div><h2>Publish update</h2><form method="post" action="/community/legacy-post"><label>Message<textarea name="text" placeholder="Write an update"></textarea></label><button>Publish</button></form></section><section class="card"><div class="mode secure">Protected workflow</div><h2>Publish protected update</h2><form method="post" action="/community/secure-post"><label>Message<textarea name="text" placeholder="Write an update"></textarea></label><button>Publish safely</button></form></section></div><section class="card" style="margin-top:18px"><h2>Recent updates</h2><div class="list">${posts.length ? posts.map(post => `<div class="row"><small>${post.mode === 'legacy' ? 'Legacy rendering' : 'Protected rendering'}</small><br>${post.mode === 'legacy' ? post.text : escapeHtml(post.text)}</div>`).join('') : '<div class="notice">No workspace updates have been published.</div>'}</div></section>`)));

app.post('/community/:mode', (req, res) => { posts.unshift({ mode: req.params.mode === 'secure-post' ? 'secure' : 'legacy', text: String(req.body.text || '') }); res.redirect('/community'); });

app.get('/settings', (req, res) => { const current = account(req); res.send(shell('Account Settings', 'settings', `<section class="hero"><div><div class="eyebrow">Account Settings</div><h1>Manage account contact details.</h1><p>Protected updates require a POST request and a per-session anti-forgery token.</p></div><span class="badge">Account verified</span></section><div class="grid"><section class="card span5"><div class="mode lab">Legacy workflow</div><h2>Legacy update path</h2><p>A legacy GET request changes state at <code>/settings/legacy-update?email=...</code>.</p></section><section class="card span7"><div class="mode secure">Protected workflow</div><h2>Update contact email</h2><form method="post" action="/settings/secure-update"><label>Email address<input name="email" type="email" value="${escapeHtml(current.email)}" required></label><input type="hidden" name="csrfToken" value="${token(req)}"><button>Save changes</button></form></section></div>`)); });

app.get('/settings/legacy-update', (req, res) => { const email = String(req.query.email || ''); if (!email.includes('@')) return res.status(400).send('A valid email is required.'); account(req).email = email; res.send(shell('Account Updated', 'settings', `<div class="eyebrow">Account Settings</div><h1>Legacy update completed</h1><div class="result warning"><strong>Contact email changed through a GET request.</strong><pre>${escapeHtml(email)}</pre></div><a class="button secondary" href="/settings">Return to settings</a>`)); });
app.post('/settings/secure-update', (req, res) => { const email = String(req.body.email || ''); if (!validToken(req, req.body.csrfToken)) return res.status(403).send(shell('Request blocked', 'settings', `<h1>Request blocked</h1><div class="result blocked"><strong>Missing or invalid anti-forgery token.</strong></div><a class="button secondary" href="/settings">Return to settings</a>`)); if (!email.includes('@')) return res.status(400).send('A valid email is required.'); account(req).email = email; res.send(shell('Account Updated', 'settings', `<div class="eyebrow">Account Settings</div><h1>Changes saved</h1><div class="result"><strong>Contact email updated securely.</strong><pre>${escapeHtml(email)}</pre></div><a class="button secondary" href="/settings">Return to settings</a>`)); });

// Assignment Roadmap Route Aliases
app.get('/login', (_req, res) => res.redirect('/access'));
app.get('/search', (req, res) => res.redirect(req.query.q ? `/catalog/legacy-search?q=${encodeURIComponent(req.query.q)}` : '/catalog'));
app.get('/ping', (req, res) => res.redirect(req.query.host ? `/diagnostics/legacy-check?host=${encodeURIComponent(req.query.host)}` : '/diagnostics'));
app.get('/comments', (_req, res) => res.redirect('/community'));
app.get('/update-email', (req, res) => res.redirect(req.query.email ? `/settings/legacy-update?email=${encodeURIComponent(req.query.email)}` : '/settings'));

// Backward-compatible aliases for any earlier bookmarked coursework URLs.
app.get(['/jasmine', '/diyanshi'], (_req, res) => res.redirect('/access'));
app.get('/purvi', (_req, res) => res.redirect('/diagnostics'));
app.get('/yashika', (_req, res) => res.redirect('/community'));
app.get('/jayanth', (_req, res) => res.redirect('/settings'));

if (require.main === module) app.listen(PORT, () => console.log(`Sentinel Workspace: http://localhost:${PORT}`));
module.exports = app;
