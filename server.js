const crypto = require('node:crypto');
const net = require('node:net');
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const users = [
  { id: 1, username: 'admin', password: 'admin123', email: 'admin@example.test' },
  { id: 2, username: 'student', password: 'student123', email: 'student@example.test' }
];
const products = [
  { id: 1, title: 'Network Security Guide', description: 'Course material' },
  { id: 2, title: 'Web Security Lab', description: 'Practice environment' }
];
const comments = [];

app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'local-demo-only-change-me',
  resave: false,
  saveUninitialized: true,
  // Deliberately permissive for the CSRF vulnerable demonstration. The secure
  // route still requires a token; production cookies should use SameSite=Lax.
  cookie: { httpOnly: true, sameSite: false }
}));

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[c]);
}

function page(title, content) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:system-ui;max-width:900px;margin:2rem auto;line-height:1.5}nav a{margin-right:1rem}code,pre{background:#f3f4f6;padding:.2rem .4rem}pre{padding:1rem;overflow:auto}.card{border:1px solid #ddd;border-radius:8px;padding:1rem;margin:1rem 0}.bad{color:#a00}.good{color:#076b2c}input{margin:.25rem}</style>
  </head><body><nav><a href="/">Home</a><a href="/jasmine">Jasmine</a><a href="/diyanshi">Diyanshi</a><a href="/purvi">Purvi</a><a href="/yashika">Yashika</a><a href="/jayanth">Jayanth</a></nav><hr>${content}</body></html>`;
}

function account(req) {
  if (!req.session.account) req.session.account = { email: 'victim@example.test' };
  return req.session.account;
}

function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function tokenIsValid(req, supplied) {
  const expected = csrfToken(req);
  return typeof supplied === 'string' && supplied.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

app.get('/', (_req, res) => res.send(page('Web Server Security Assignment - Group 15', `
  <h1>Web Security Assignment - Group 15</h1>
  <p>One local application with a dedicated route for each Group 15 member.</p>
  <div class="card"><strong>Jasmine:</strong> <a href="/jasmine">SQL authentication bypass</a></div>
  <div class="card"><strong>Diyanshi:</strong> <a href="/diyanshi">SQL UNION-style data exposure</a></div>
  <div class="card"><strong>Purvi:</strong> <a href="/purvi">command injection</a></div>
  <div class="card"><strong>Yashika:</strong> <a href="/yashika">stored cross-site scripting</a></div>
  <div class="card"><strong>Jayanth:</strong> <a href="/jayanth">CSRF GET-based forged action</a></div>
  <p>Run only on localhost. The command-injection route is intentionally simulated and never runs operating-system commands.</p>`)));

app.get(['/sqli', '/jasmine', '/diyanshi'], (_req, res) => res.send(page('SQL injection', `
  <h1>SQL injection demonstrations</h1>
  <div class="card"><h2>Authentication bypass - Jasmine</h2>
  <form method="get" action="/jasmine/login-vulnerable"><input name="username" placeholder="username"><input name="password" placeholder="password" type="password"><button>Vulnerable login</button></form>
  <form method="get" action="/jasmine/login-secure"><input name="username" placeholder="username"><input name="password" placeholder="password" type="password"><button>Secure login</button></form></div>
  <div class="card"><h2>UNION-style data exposure - Diyanshi</h2>
  <form method="get" action="/diyanshi/search-vulnerable"><input name="q" placeholder="search products"><button>Vulnerable search</button></form>
  <form method="get" action="/diyanshi/search-secure"><input name="q" placeholder="search products"><button>Secure search</button></form></div>`)));

app.get(['/sqli/login-vulnerable', '/jasmine/login-vulnerable'], (req, res) => {
  const username = String(req.query.username || '');
  const password = String(req.query.password || '');
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  const bypassed = /('|%27)\s*(or|OR)\s*.*=/.test(username);
  const user = bypassed ? users[0] : users.find(u => u.username === username && u.password === password);
  res.send(page('Vulnerable login', `<h1 class="bad">Vulnerable login</h1><pre>${escapeHtml(query)}</pre><p>${user ? `Logged in as <strong>${escapeHtml(user.username)}</strong>.` : 'Invalid credentials.'}</p><p>This route models unsafe SQL string concatenation.</p>`));
});

app.get(['/sqli/login-secure', '/jasmine/login-secure'], (req, res) => {
  const username = String(req.query.username || '');
  const password = String(req.query.password || '');
  const user = users.find(u => u.username === username && u.password === password);
  res.send(page('Secure login', `<h1 class="good">Prepared-statement login</h1><pre>SELECT * FROM users WHERE username = ? AND password = ?</pre><p>${user ? `Logged in as <strong>${escapeHtml(user.username)}</strong>.` : 'Invalid credentials.'}</p>`));
});

app.get(['/sqli/search-vulnerable', '/diyanshi/search-vulnerable'], (req, res) => {
  const q = String(req.query.q || '');
  const query = `SELECT id, title, description FROM products WHERE title LIKE '%${q}%'`;
  const results = /\bunion\b/i.test(q) ? [...products, ...users.map(({ id, username, password }) => ({ id, title: username, description: `password: ${password}` }))] : products.filter(p => p.title.toLowerCase().includes(q.toLowerCase()));
  res.send(page('Vulnerable search', `<h1 class="bad">Vulnerable search</h1><pre>${escapeHtml(query)}</pre>${results.map(r => `<div class="card"><strong>${escapeHtml(r.title)}</strong><br>${escapeHtml(r.description)}</div>`).join('') || '<p>No results.</p>'}`));
});

app.get(['/sqli/search-secure', '/diyanshi/search-secure'], (req, res) => {
  const q = String(req.query.q || '');
  const results = products.filter(p => p.title.toLowerCase().includes(q.toLowerCase()));
  res.send(page('Secure search', `<h1 class="good">Parameterized search</h1><pre>SELECT id, title, description FROM products WHERE title LIKE ?</pre>${results.map(r => `<div class="card"><strong>${escapeHtml(r.title)}</strong><br>${escapeHtml(r.description)}</div>`).join('') || '<p>No results.</p>'}`));
});

app.get(['/command', '/purvi'], (_req, res) => res.send(page('Command injection', `
  <h1>Command injection - Purvi</h1><p>This local demonstration simulates unsafe shell interpretation; it never executes a system command.</p>
  <form method="get" action="/purvi/vulnerable"><input name="host" placeholder="host"><button>Vulnerable utility</button></form>
  <form method="get" action="/purvi/secure"><input name="host" placeholder="IPv4 address only"><button>Secure utility</button></form>`)));

app.get(['/command/vulnerable', '/purvi/vulnerable'], (req, res) => {
  const host = String(req.query.host || '');
  const command = `ping -c 1 ${host}`;
  const injected = /[;&|`$]/.test(host);
  const output = injected ? 'SIMULATED INJECTION OUTPUT\n/etc/passwd\n/var/www\n/app/server.js' : `SIMULATED PING OUTPUT\nPING ${host || 'host'}: 1 packet received`;
  res.send(page('Vulnerable utility', `<h1 class="bad">Vulnerable command construction</h1><pre>${escapeHtml(command)}</pre><pre>${escapeHtml(output)}</pre>`));
});

app.get(['/command/secure', '/purvi/secure'], (req, res) => {
  const host = String(req.query.host || '');
  if (net.isIP(host) !== 4) return res.status(400).send(page('Secure utility', `<h1 class="good">Blocked</h1><p>Only a valid IPv4 address is accepted; no shell is invoked.</p>`));
  res.send(page('Secure utility', `<h1 class="good">Safe utility</h1><pre>ping binary invoked with an argument array: ['-c', '1', '${escapeHtml(host)}']</pre><p>Simulated ping succeeded.</p>`));
});

app.get(['/xss', '/yashika'], (_req, res) => res.send(page('Stored XSS', `
  <h1>Stored XSS - Yashika</h1>
  <form method="post" action="/yashika/vulnerable"><input name="text" placeholder="comment"><button>Store and render vulnerably</button></form>
  <form method="post" action="/yashika/secure"><input name="text" placeholder="comment"><button>Store and render safely</button></form>
  <p>Use a harmless test string such as <code>&lt;b&gt;bold&lt;/b&gt;</code> to see raw versus encoded output.</p>
  <h2>Stored comments</h2>${comments.map(c => `<div class="card"><strong>${c.mode}</strong>: ${c.mode === 'vulnerable' ? c.text : escapeHtml(c.text)}</div>`).join('') || '<p>No comments yet.</p>'}`)));

app.post(['/xss/:mode', '/yashika/:mode'], (req, res) => {
  const mode = req.params.mode === 'secure' ? 'secure' : 'vulnerable';
  comments.push({ mode, text: String(req.body.text || '') });
  res.redirect('/yashika');
});

app.get(['/csrf', '/jayanth'], (req, res) => {
  const current = account(req);
  const token = csrfToken(req);
  res.send(page('CSRF', `<h1>CSRF - Jayanth</h1><p>Current email: <strong>${escapeHtml(current.email)}</strong></p>
  <div class="card"><h2>Vulnerable</h2><p>A GET request changes account state: <code>/jayanth/vulnerable/update-email?email=...</code></p></div>
  <div class="card"><h2>Secure</h2><form method="post" action="/jayanth/secure/update-email"><input name="email" type="email" value="${escapeHtml(current.email)}" required><input name="csrfToken" type="hidden" value="${token}"><button>Update securely</button></form></div>`));
});

app.get(['/csrf/vulnerable/update-email', '/jayanth/vulnerable/update-email'], (req, res) => {
  const email = String(req.query.email || '');
  if (!email.includes('@')) return res.status(400).send('A valid email is required.');
  account(req).email = email;
  res.send(page('CSRF vulnerable', `<h1 class="bad">Email changed by GET request</h1><p>${escapeHtml(email)}</p>`));
});

app.post(['/csrf/secure/update-email', '/jayanth/secure/update-email'], (req, res) => {
  const email = String(req.body.email || '');
  if (!tokenIsValid(req, req.body.csrfToken)) return res.status(403).send(page('CSRF blocked', '<h1 class="good">Blocked: missing or invalid anti-CSRF token.</h1>'));
  if (!email.includes('@')) return res.status(400).send('A valid email is required.');
  account(req).email = email;
  res.send(page('CSRF secure', `<h1 class="good">Secure email update completed</h1><p>${escapeHtml(email)}</p>`));
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Web Server Security Assignment: http://localhost:${PORT}`));
}

module.exports = app;
