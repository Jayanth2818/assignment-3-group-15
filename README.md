# Web Server Security Assignment 3 - Group 15

A single Express application that demonstrates five common web-security vulnerabilities and their mitigations. Each member owns one clearly named route in the shared application.

## Team and routes

| Member | Assignment | Route |
| --- | --- | --- |
| Jasmine | SQL injection - authentication bypass | `/jasmine` |
| Diyanshi | SQL injection - UNION-style data exposure | `/diyanshi` |
| Purvi | OS command injection | `/purvi` |
| Yashika | Stored cross-site scripting | `/yashika` |
| Jayanth | Cross-site request forgery | `/jayanth` |

## Run locally

```powershell
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

## Application structure

- `server.js` - shared Express application and all member routes.
- `package.json` - application dependencies and start command.
- `README.md` - project overview and route ownership.

Each route includes a deliberately vulnerable flow and a protected flow for comparison. The application is for localhost coursework only. The command-injection route is a safe simulation and never executes operating-system commands.
