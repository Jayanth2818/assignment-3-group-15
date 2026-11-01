# Jasmine — SQL Injection (Variant 1: Authentication Bypass)

## Member Details
- **Member Name:** Jasmine
- **Vulnerability Category:** SQL Injection
- **Variant Implemented:** Variant 1: Authentication Bypass
- **Branch:** `jasmine`
- **Application Module:** Access Center (`/access` and `/login`)

---

## 1. Vulnerable Implementation (Code Path)
The authentication module constructs dynamic database queries using direct string concatenation:

```sql
SELECT * FROM users WHERE username = 'INPUT_USER' AND password = 'INPUT_PASS';
```

In the legacy implementation (`/access/legacy-login` or `/login`), unvalidated query parameters are passed straight into the query string:

```javascript
const username = String(req.query.username || '');
const password = String(req.query.password || '');
const statement = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
```

---

## 2. Working Exploit
- **Payload:** `admin' --` or `' OR '1'='1` in the username field.
- **Execution:** The attacker injects SQL control characters (`'` and `--`), terminating the string literal and commenting out the remainder of the query (including the password verification clause). The query evaluates to:
  ```sql
  SELECT * FROM users WHERE username = 'admin' --' AND password = '...';
  ```
- **Result:** The database returns the record for `admin`, and the application opens an authenticated session without requiring a valid password.

---

## 3. Root Cause Statement
Untrusted user input is directly concatenated into the raw SQL command string without escaping or parameter binding. This allows attacker-supplied input data to break out of the data context, alter the syntactic query logic, and bypass authentication controls.

---

## 4. Implemented Mitigation
- **Fix:** Implementation of **Parameterized Queries / Prepared Statements**:
  ```sql
  SELECT * FROM users WHERE username = ? AND password = ?
  ```
  In `/access/secure-login`, user input is passed strictly as parameter values separate from the SQL query syntax, preventing user input from ever modifying the SQL command structure.
- **Verification:** Re-submitting `admin' --` or `' OR '1'='1` causes the database to search literally for a user whose username is the exact string `admin' --`. The authentication fails cleanly with an "Authentication failed" response.

---

## 5. Other Mitigations (Theory for Viva)
1. **Input Validation (Allow-listing):** Enforce strict allow-list validation on username fields (e.g., alphanumeric regex `^[a-zA-Z0-9_]{3,20}$`) to reject unexpected characters before queries are formed.
2. **Principle of Least Privilege:** Configure the web application database account with only read permissions on necessary authentication tables, disallowing administrative procedures or access to system tables.
3. **Safe Error Handling:** Suppress all database error details (e.g., syntax errors, table names) from being returned in HTTP responses; display only generic error messages to prevent information disclosure.

---

## 6. Video Script Outline (2–3 mins)
1. **Show vulnerable code:** Display the string concatenation logic in `/access/legacy-login`.
2. **Demonstrate exploit:** Enter `' OR '1'='1` into the username field in the browser; show that an authenticated session opens immediately.
3. **Show mitigated code:** Walk through the prepared statement logic in `/access/secure-login`.
4. **Demonstrate mitigation:** Re-enter the payload; show the query being safely parameterized and the login attempt rejected.
