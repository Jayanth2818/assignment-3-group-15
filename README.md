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

Each module includes a legacy workflow and a protected workflow for comparison. The application is for localhost coursework only. The Network Diagnostics module is a safe simulation and never executes operating-system commands.
