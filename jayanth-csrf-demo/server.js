const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'local-demo-only-change-me',
  resave: false,
  saveUninitialized: true,
  // Intentionally lacks SameSite for the vulnerable demo. In a production fix,
  // additionally set SameSite=Lax or Strict.
  cookie: { httpOnly: true, sameSite: false }
}));

function escaped(value) {
  return String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function ensureAccount(req) {
  if (!req.session.account) req.session.account = { email: 'victim@example.test' };
  return req.session.account;
}

function csrfToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

function validCsrfToken(req, supplied) {
  const expected = csrfToken(req);
  return typeof supplied === 'string'
    && supplied.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

// Deliberately vulnerable, LOCAL demonstration only: never use GET to change state.
app.get('/vulnerable/update-email', (req, res) => {
  const account = ensureAccount(req);
  if (typeof req.query.email !== 'string' || !req.query.email.includes('@')) {
    return res.status(400).send('A valid email is required.');
  }
  account.email = req.query.email;
  res.send(`Vulnerable endpoint changed email to: ${escaped(account.email)}`);
});

app.post('/secure/update-email', (req, res) => {
  const account = ensureAccount(req);
  const supplied = req.body.csrfToken;
  if (!validCsrfToken(req, supplied)) {
    return res.status(403).send('Blocked: missing or invalid anti-CSRF token.');
  }
  if (typeof req.body.email !== 'string' || !req.body.email.includes('@')) {
    return res.status(400).send('A valid email is required.');
  }
  account.email = req.body.email;
  res.send(`Secure endpoint changed email to: ${escaped(account.email)}`);
});

app.get('/', (req, res) => {
  const account = ensureAccount(req);
  const token = csrfToken(req);
  res.type('html').send(`<!doctype html>
<title>CSRF demo</title>
<h1>Jayanth - CSRF demonstration</h1>
<p>Current account email: <strong id="email">${escaped(account.email)}</strong></p>
<h2>Fixed account update</h2>
<form method="post" action="/secure/update-email">
  <label>Email <input name="email" type="email" required value="${escaped(account.email)}"></label>
  <input name="csrfToken" type="hidden" value="${token}">
  <button>Update securely</button>
</form>
<p>For the safe local attack demonstration, open <a href="http://localhost:4000">the attacker page</a> in this same browser.</p>`);
});

if (require.main === module) {
  app.listen(3000, () => console.log('Victim app: http://localhost:3000'));
}

module.exports = { app };
