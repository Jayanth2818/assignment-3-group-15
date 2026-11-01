# Sentinel Workspace - Web Server Security Assignment 3

Sentinel Workspace is a local Express application that demonstrates five web-security issues and the corresponding protected implementations. It is designed for Group 15's coursework demonstration only.

## Objective

For every workflow, the application shows a legacy implementation, demonstrates its impact using harmless local data, and then shows the protected implementation blocking or safely handling the same input.

## Application architecture

```text
Browser
  |  HTTP forms and session cookie
  v
Express application (server.js)
  |-- Access Center        - authentication workflow
  |-- Knowledge Catalog    - database-search workflow
  |-- Network Diagnostics  - target-validation workflow
  |-- Community Wall       - stored-content workflow
  `-- Account Settings     - state-change / anti-forgery workflow
```

## Team ownership

| Member | Security category | Workspace module | Branch |
| --- | --- | --- | --- |
| Jasmine | SQL injection - authentication bypass | Access Center | `jasmine` |
| Diyanshi | SQL injection - UNION-based data exposure | Knowledge Catalog | `diyanshi` |
| Purvi | OS command injection | Network Diagnostics | `purvi` |
| Yashika | Stored cross-site scripting | Community Wall | `yashika` |
| Jayanth | Cross-site request forgery | Account Settings | `jayanth` |

## Run locally

```powershell
npm.cmd install
npm.cmd start
```

Open [http://localhost:3000](http://localhost:3000).

For the separate local CSRF attacker page, open another terminal in the same project folder:

```powershell
npm.cmd run attacker
```

Then visit [http://localhost:4000](http://localhost:4000) after first opening Account Settings in the same browser.

## Modules

| Module | Legacy workflow | Protected workflow |
| --- | --- | --- |
| Access Center | Builds an authentication query from input | Uses parameter placeholders and exact credential comparison |
| Knowledge Catalog | Interprets UNION-style search input | Treats all search input as plain text |
| Network Diagnostics | Demonstrates command construction from input | Validates IPv4 input and never invokes a shell |
| Community Wall | Renders a saved message as raw HTML | Encodes saved content before rendering |
| Account Settings | Changes an email through a GET request | Requires POST plus a per-session anti-forgery token |

## Project files

| File | Purpose |
| --- | --- |
| `server.js` | Main Express application and all five workflows |
| `attacker-site.js` | Separate local CSRF attacker page on port 4000 |
| `package.json` | Dependencies and run commands |
| `DEMO_GUIDE.md` | Suggested screen-recording demonstration sequence |
| `TEST_CASES.md` | Manual test cases and expected results |
| `VIVA.md` | Concise viva preparation notes |

## Important safety note

Run this project only on your own computer for coursework. The Network Diagnostics legacy workflow is intentionally simulated: it does not execute operating-system commands.
