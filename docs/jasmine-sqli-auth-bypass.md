# Jasmine — SQL Injection (Variant 1: Authentication Bypass)

## Member Details
- **Member Name:** Jasmine
- **Vulnerability Category:** SQL Injection
- **Variant Implemented:** Variant 1: Authentication Bypass
- **Branch:** `jasmine`
- **Application Module:** Access Center (`/access` and `/login`)
- **Database Engine:** SQLite (Local persistent database via `sentinel.db`)

---

## 1. Database Implementation & Schema

The application uses an actual local SQLite database (`sentinel.db`) rather than JavaScript memory arrays, shared across both the vulnerable and secure workflows.

### Table Schema: `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT,
  email TEXT,
  role TEXT
);
```

### Pre-populated Dummy Accounts:
| ID | Username | Password | Email | Role |
|:---|:---|:---|:---|:---|
| 1 | `admin` | `admin123` | `admin@sentinel.test` | Administrator |
| 2 | `alex` | `welcome123` | `alex@sentinel.test` | Analyst |

---

## 2. Vulnerable Implementation (Code Path)

The legacy authentication endpoint (`/access/legacy-login`) formats SQL queries dynamically using direct string concatenation:

```sql
SELECT * FROM users WHERE username = 'INPUT_USER' AND password = 'INPUT_PASS';
```

### Backend Implementation (`db.js` & `server.js`):
```javascript
const rawQuery = `SELECT * FROM users WHERE username = '${safeUser}' AND password = '${safePass}'`;
const user = await get(rawQuery);
```

This query is executed directly against the local SQLite database.

---

## 3. Working Exploit Demonstration

### Payload 1: Comment Injection
- **Username Field:** `admin' --`
- **Password Field:** `anything` (or left blank)
- **Constructed SQL Query:**
  ```sql
  SELECT * FROM users WHERE username = 'admin' --' AND password = '[REDACTED]';
  ```
- **Execution Mechanism:**
  The single quote (`'`) closes the username string literal. The double-dash (`--`) sequence instructs SQLite to treat the remainder of the line as a comment. The `AND password = '...'` condition is ignored.
- **Database Result:** SQLite executes `SELECT * FROM users WHERE username = 'admin'` and returns the `admin` user record.
- **Outcome:** The application opens an authenticated session for `admin` without verifying any password.

### Payload 2: Tautology / Boolean-based Injection
- **Username Field:** `' OR '1'='1' --`
- **Password Field:** `arbitrary`
- **Constructed SQL Query:**
  ```sql
  SELECT * FROM users WHERE username = '' OR '1'='1' --' AND password = '[REDACTED]';
  ```
- **Execution Mechanism:**
  The injected `'1'='1'` evaluates to true for all rows in SQLite. The `--` comments out the subsequent password requirement. SQLite returns the first matching account (`admin`).
- **Outcome:** Authentication bypass succeeded; session opened.

---

## 4. Root Cause Statement

Untrusted user input is directly concatenated into the raw SQL command string without escaping or parameter binding. This allows attacker-supplied input data to break out of the data context, alter the syntactic query grammar, comment out authentication logic, and force unauthorized database access.

---

## 5. Implemented Mitigation (Protected Workflow)

### Mitigation: Parameterized Queries / Prepared Statements
In `/access/secure-login`, the application utilizes SQLite parameter binding:

```sql
SELECT * FROM users WHERE username = ? AND password = ?;
```

### Backend Implementation (`db.js`):
```javascript
const queryStructure = 'SELECT * FROM users WHERE username = ? AND password = ?';
const user = await get(queryStructure, [safeUser, safePass]);
```

### Verification Against Exploits:
When submitting `admin' --` or `' OR '1'='1`, SQLite binds the entire input literally as the parameter value. The database searches specifically for a user whose literal username string is `admin' --`. Because no user exists with that username, SQLite returns no records, and the attack is cleanly blocked:
- **Result Status:** `SQL Injection Blocked`
- **Session:** Access denied; credentials rejected.

---

## 6. Frontend & Credential Redaction Safety

1. **Two-Column Workflow:** Preserves Sentinel Workspace's clean split layout comparing Legacy and Protected workflows.
2. **Clear Result Distinctions:**
   - `Authentication Successful`: Legitimate credentials matched.
   - `Authentication Failed`: Normal incorrect credentials.
   - `SQL Injection Authentication Bypass`: Exploit succeeded in legacy mode.
   - `SQL Injection Blocked`: Exploit neutralized in protected mode.
3. **Credential Redaction:** Actual passwords are NEVER exposed in the result panels or query logs (`password = '[REDACTED]'`).

---

## 7. Automated Test Suite Verification

Run the automated verification test suite:
```bash
npm test
```

### Verified Test Matrix:
| # | Test Scenario | Mode | Expected Result | Verified Status |
|:---|:---|:---|:---|:---|
| 1 | Valid admin login (`admin` / `admin123`) | Legacy | Authentication Successful | PASS |
| 2 | Invalid admin password (`admin` / `wrongpass`) | Legacy | Authentication Failed | PASS |
| 3 | Bypass payload (`admin' --`) | Legacy | SQL Injection Authentication Bypass | PASS |
| 4 | Bypass payload (`' OR '1'='1' --`) | Legacy | SQL Injection Authentication Bypass | PASS |
| 5 | Same bypass attempt (`admin' --`) | Protected | SQL Injection Blocked | PASS |
| 6 | Alternative payload (`' OR '1'='1`) | Protected | SQL Injection Blocked | PASS |
| 7 | Valid admin login (`admin` / `admin123`) | Protected | Authentication Successful | PASS |
| 8-12 | Verification of other 4 group modules | All | Intact and operational (HTTP 200) | PASS |

---

## 8. Theoretical Mitigations (For Viva Discussion)

1. **Prepared Statements / Parameterized Queries (Primary Defense):** Compiles the SQL structure beforehand. Data parameters are transmitted separately over the wire, making SQL syntax alteration mathematically impossible.
2. **Input Validation (Allow-listing):** Validate input against strict regular expressions (e.g., `^[a-zA-Z0-9_]{3,30}$`). Any input containing quotes, dashes, or SQL keywords is rejected early.
3. **Principle of Least Privilege:** Grant the application database connection only `SELECT` permissions on required authentication tables, disallowing `DROP`, `ALTER`, or administrative system commands.
4. **Safe Error Handling:** Suppress raw database error traces or syntax errors from HTTP responses to prevent database fingerprinting and blind injection inference.
5. **Password Hashing (Argon2 / bcrypt):** While separate from injection, passwords should never be stored in plaintext. In modern architectures, query fetches by username only (`SELECT password_hash FROM users WHERE username = ?`), followed by constant-time hash verification.

---

## 9. Viva Voce Live Demonstration Guide (2–3 Minutes)

1. **Step 1: Introduction & Architecture (30s)**
   - Explain that Sentinel Workspace uses a local SQLite database (`sentinel.db`) with a `users` table seeded with `admin` and `alex`.
   - Point to `/access`, highlighting the dual-workflow layout (Legacy vs. Protected).
2. **Step 2: Demonstrate the Vulnerability (60s)**
   - In the **Legacy Workflow** column, enter username `admin' --` and password `anything`.
   - Submit the form.
   - Show the result panel: **SQL Injection Authentication Bypass**.
   - Explain how `--` commented out the `AND password = ...` check in SQLite, returning the `admin` row without password validation.
   - Point out that passwords are safely redacted in the displayed query.
3. **Step 3: Demonstrate the Mitigation (45s)**
   - In the **Protected Workflow** column, enter the exact same payload: `admin' --` and password `anything`.
   - Submit the form.
   - Show the result panel: **SQL Injection Blocked**.
   - Explain that SQLite parameterized queries bound `admin' --` as literal data, preventing syntactic evaluation of the comment or quote.
4. **Step 4: Verify Legitimate Use (15s)**
   - Enter `admin` and `admin123` into the Protected form.
   - Show **Authentication Successful**, confirming normal functionality is preserved.
