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

## 1. Group Ownership Declaration (Table 3)

Per assignment guidelines for groups with more than four members, all four security categories are covered, and the 5th member is assigned the alternate variant of SQL Injection so that no two members implement the same variant.

| Member Name | Roll Number | Vulnerability Category | Variant Implemented | Workspace Module | Branch | Individual Roadmap & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Jasmine** | IIT2024200 | SQL Injection | Variant 1: Authentication Bypass | Access Center (`/login`, `/access`) | `jasmine` | [Jasmine Roadmap](docs/jasmine-sqli-auth-bypass.md) |
| **Diyanshi** | IIT2024158 | SQL Injection | Variant 2: UNION-Based Data Extraction | Knowledge Catalog (`/search`, `/catalog`) | `diyanshi` | [Diyanshi Roadmap](docs/diyanshi-sqli-union.md) |
| **Purvi** | IIT2024160 | OS Command Injection | Variant 1: In-Band (Command Output Returned) | Network Diagnostics (`/ping`, `/diagnostics`) | `Purvi-OS-command-injection` | [Purvi Roadmap](docs/purvi-command-injection.md) |
| **Yashika** | IIT2024178 | Cross-Site Scripting (XSS) | Variant 1: Stored XSS | Community Wall (`/comments`, `/community`) | `yashika` | [Yashika Roadmap](docs/yashika-stored-xss.md) |
| **Jayanth** | IIT2024155 | Cross-Site Request Forgery (CSRF) | Variant 1: GET-Based Forged Action | Account Settings (`/update-email`, `/settings`) | `jayanth` | [Jayanth Roadmap](docs/jayanth-csrf.md) |

## Run locally

```powershell
npm.cmd install
npm.cmd start
npm.cmd test
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
| Access Center | Builds an authentication query from input (SQLite concatenation) | Uses parameter placeholders and exact credential comparison (SQLite prepared statements) |
| Knowledge Catalog | Interprets UNION-style search input | Treats all search input as plain text |
| Network Diagnostics | Demonstrates command construction from input | Validates IPv4 input and never invokes a shell |
| Community Wall | Renders a saved message as raw HTML | Encodes saved content before rendering |
| Account Settings | Changes an email through a GET request | Requires POST plus a per-session anti-forgery token |

## Project files

| File | Purpose |
| --- | --- |
| `server.js` | Main Express application and all five workflows |
| `db.js` | Local SQLite database layer, schema setup, and query handlers |
| `test-auth.js` | Automated verification test suite for all modules and payloads |
| `attacker-site.js` | Separate local CSRF attacker page on port 4000 |
| `package.json` | Dependencies and run commands |

## Important safety note

Run this project only on your own computer for coursework. The Network Diagnostics legacy workflow is intentionally simulated: it does not execute operating-system commands.

## Demonstration guide

Each owner should show the legacy flow, explain the root cause, then show the protected flow.

### Access Center

1. Open `/access`.
2. Use a SQL-style authentication-bypass input in the legacy form and show that a session opens.
3. Repeat it in the protected form and show that authentication fails.
4. Explain that parameter binding prevents input from changing query logic.

### Knowledge Catalog

1. Open `/catalog`.
2. Use a UNION-style query in the legacy search and show the restricted sample records.
3. Repeat it in secure search and show that no records are returned.
4. Explain that the protected flow treats the input as a literal search term.

### Network Diagnostics

1. Open `/diagnostics`.
2. Show the legacy workflow handling a host value containing a shell control character.
3. Explain the simulated command output and why real applications must never build shell commands from request data.
4. Use the protected workflow to show that an invalid host is blocked.

### Community Wall

1. Open `/community`.
2. Submit harmless HTML markup through the legacy form and show that it renders as markup.
3. Submit the same text through the protected form and show that it displays as text.
4. Explain output encoding and contextual sanitization.

### Account Settings

1. Open `/settings` and note the current email.
2. Run `npm.cmd run attacker` in another terminal.
3. Open `http://localhost:4000` in the same browser, then return to Settings and show the email change.
4. Show the protected Settings form: it uses POST plus a hidden per-session token.
5. Explain that an external page cannot supply the required unpredictable token.

## Test cases

| Module | Test | Expected legacy behavior | Expected protected behavior |
| --- | --- | --- | --- |
| Access | SQL-style login input | Session opens in the lab model | Authentication fails |
| Catalog | UNION-style search input | Restricted sample records appear | No records match |
| Diagnostics | Invalid host containing a shell character | Simulated injected output is displayed | Request is blocked with HTTP 400 |
| Community | Harmless HTML input | Markup renders in the legacy feed | Markup is encoded as text |
| Settings | GET email update | Email changes | Protected POST requires a valid token |
| Settings | POST with no token | N/A | Request is blocked with HTTP 403 |

## Key security points

- Prepared statements separate SQL structure from user-supplied data.
- State-changing operations should use POST, never GET.
- Anti-forgery tokens verify that a sensitive request originated from the application.
- Output encoding prevents saved text from being interpreted as browser markup.
- Shells must never receive raw request input; validate input and use safe APIs instead.
- Least privilege and generic error handling reduce impact and information disclosure.
