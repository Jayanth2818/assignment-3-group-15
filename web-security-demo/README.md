# Integrated Web Security Demo

One local Express application for the five Group 15 demonstrations.

## Run

```powershell
npm install
npm start
```

Open `http://localhost:3000`.

## Routes and owners

| Owner | Routes | Topic |
| --- | --- | --- |
| Jasmine | `/sqli/login-vulnerable`, `/sqli/login-secure` | authentication bypass |
| Diyanshi | `/sqli/search-vulnerable`, `/sqli/search-secure` | UNION-style data exposure |
| Purvi | `/command/vulnerable`, `/command/secure` | command injection simulation |
| Yashika | `/xss` | stored XSS |
| Jayanth | `/csrf` | GET-based CSRF |

The app is intentionally for localhost demonstration only. The command-injection route is a safe simulation and never invokes the operating system shell.
