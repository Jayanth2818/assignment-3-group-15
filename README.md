# Sentinel Workspace - Web Server Security Assignment 3

Sentinel Workspace is a polished local web application for demonstrating secure and legacy implementations of common web workflows.

## Workspace modules

| Module | Route | Workflow |
| --- | --- | --- |
| Access Center | `/access` | Authentication and account access |
| Knowledge Catalog | `/catalog` | Search and data retrieval |
| Network Diagnostics | `/diagnostics` | Controlled target validation |
| Community Wall | `/community` | Publishing workspace updates |
| Account Settings | `/settings` | Protected account updates |

## Group ownership

| Member | Assigned security category | Module |
| --- | --- | --- |
| Jasmine | SQL injection - authentication bypass | Access Center |
| Diyanshi | SQL injection - UNION-based data exposure | Knowledge Catalog |
| Purvi | OS command injection | Network Diagnostics |
| Yashika | Stored cross-site scripting | Community Wall |
| Jayanth | Cross-site request forgery | Account Settings |

## Run locally

```powershell
npm install
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

For the separate local CSRF attacker page, open a second PowerShell window in the same folder and run:

```powershell
npm run attacker
```

Then visit [http://localhost:4000](http://localhost:4000) in the same browser after opening Account Settings.

## Application structure

- `server.js` - shared Express application and all member routes.
- `attacker-site.js` - separate local site used for the CSRF demonstration.
- `package.json` - application dependencies and start command.
- `README.md` - project overview and route ownership.

Each module includes a legacy workflow and a protected workflow for comparison. The application is for localhost coursework only. The Network Diagnostics module is a safe simulation and never executes operating-system commands.
