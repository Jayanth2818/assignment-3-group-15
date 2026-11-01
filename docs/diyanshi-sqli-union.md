# Diyanshi — SQL Injection (Variant 2: UNION-Based Data Extraction)

## Member Details
- **Member Name:** Diyanshi
- **Vulnerability Category:** SQL Injection
- **Variant Implemented:** Variant 2: UNION-Based Data Extraction
- **Branch:** `diyanshi`
- **Application Module:** Knowledge Catalog (`/catalog` and `/search`)

---

## 1. Vulnerable Implementation (Code Path)
The catalog search feature executes dynamic SQL query concatenation whose output is rendered directly on screen:

```sql
SELECT id, title, description FROM items WHERE title LIKE '%INPUT%';
```

In the legacy implementation (`/catalog/legacy-search` or `/search?q=`), input from the query parameter `q` is embedded without validation or parameter binding:

```javascript
const q = String(req.query.q || '');
const statement = `SELECT id, title, description FROM resources WHERE title LIKE '%${q}%'`;
```

---

## 2. Working Exploit
- **Payload:** `' UNION SELECT 1, username, password FROM users --`
- **Execution:** The attacker terminates the `LIKE` clause with a single quote `'` and appends a `UNION SELECT` statement. Because the injected query selects the same number of columns (3: id, username, password) matching the original query schema, the database merges the sensitive contents of the `users` table into the legitimate item search results.
- **Result:** Administrative and user credentials (usernames and passwords) are dumped and rendered directly onto the search results page.

---

## 3. Root Cause Statement
Unsanitized user input concatenated into the SQL statement allows attacker-supplied `UNION` clauses to execute secondary queries against different database tables and leak sensitive database content into HTTP responses.

---

## 4. Implemented Mitigation
- **Fix:** Refactor the search endpoint to use **Parameterized Query Placeholders**:
  ```sql
  SELECT id, title, description FROM resources WHERE title LIKE ?
  ```
  In `/catalog/secure-search`, input is passed as bound data parameters. The database treats the entire input string (including `' UNION ...`) as literal text to be matched against titles.
- **Verification:** When submitting `' UNION SELECT 1, username, password FROM users --`, the query safely evaluates whether any resource title literally contains that string. No union takes place, and the application safely returns "No resources match this query."

---

## 5. Other Mitigations (Theory for Viva)
1. **Allow-list Validation:** Enforce strict alphanumeric or standard search term character sets to reject SQL control characters before query dispatch.
2. **Database Least Privilege & Separation:** Ensure the web application's database user account cannot read sensitive tables (such as user credentials) or use separate database connections/privileges for public search vs. administrative services.
3. **Safe Error Display:** Suppress database exception stack traces and schema disclosure to prevent attackers from discovering column counts or table names needed for crafting UNION payloads.

---

## 6. Video Script Outline (2–3 mins)
1. **Show vulnerable code:** Point out the string interpolation inside `/catalog/legacy-search`.
2. **Execute UNION exploit:** Submit `' UNION ...` in the browser search bar and show dumped user credentials in the table.
3. **Show mitigated code:** Display the refactored code using parameterized query binding.
4. **Demonstrate mitigation:** Run the exact same payload again to prove that data extraction is completely prevented.
