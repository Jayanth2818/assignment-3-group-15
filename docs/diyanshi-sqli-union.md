# Diyanshi — SQL Injection (Variant 2: UNION-Based Data Extraction)

## Member Details
- **Member Name:** Diyanshi
- **Roll Number:** IIT2024158
- **Course:** Cyber Security (IT-30001) | Autumn Semester 2026 | IIIT Allahabad
- **Instructor:** Dr. Soumyadev Maity
- **Vulnerability Category:** SQL Injection
- **Variant Implemented:** Variant 2: UNION-Based Data Extraction
- **Assigned Git Branch:** `diyanshi`
- **Application Module:** Knowledge Catalog (`/catalog`, `/catalog/legacy-search`, `/catalog/secure-search`, `/search`)

---

## 1. Comprehensive Theory for Viva Voce

### 1.1 What is SQL?
**Structured Query Language (SQL)** is a standardized domain-specific programming language used to manage, query, insert, update, and manipulate relational databases (such as SQLite, MySQL, PostgreSQL, and Oracle). SQL commands instruct the database engine on which tables to access, which conditions to apply, and which data columns to return.

### 1.2 What is String Concatenation?
**String concatenation** is the programmatic joining of two or more text strings end-to-end to form a single larger string. In JavaScript, this is commonly done using the `+` operator or template literals (e.g., `` `SELECT ... WHERE title LIKE '%${userInput}%'` ``). 

When building database commands via string concatenation, untrusted user inputs are mixed directly with static SQL control syntax. If the user input contains SQL metacharacters (such as quotes `'`, semicolons `;`, or comment markers `--`), the interpreter cannot distinguish between the developer's intended SQL commands and the user's data.

### 1.3 What is SQL Injection (SQLi)?
**SQL Injection** is a web security vulnerability that occurs when an application takes untrusted user input and incorporates it directly into a dynamic SQL query string without adequate validation, sanitization, or parameter binding. This allows an attacker to break out of the data context and enter the command context, altering the syntactic structure and logical flow of the SQL statement executed by the database engine.

### 1.4 What is UNION-Based SQL Injection?
**UNION-based SQL Injection** is an in-band SQL injection technique where an attacker exploits dynamic SQL concatenation by appending the SQL `UNION` operator to the original query. This enables the attacker to attach the results of a secondary, unauthorized `SELECT` query to the results of the application's original legitimate query, dumping sensitive records from other database tables (e.g., user passwords, administrative accounts, personal records) directly into the HTTP response rendered on the user's screen.

### 1.5 What is the Purpose of the UNION Operator?
In standard SQL, the `UNION` (or `UNION ALL`) operator combines the result sets of two or more `SELECT` statements into a single unified tabular result set. 
In a legitimate business scenario, it might combine customer records from two regional databases. In an attack scenario, an attacker injects a `UNION SELECT` to merge data from a protected administrative table (`users`) into an otherwise harmless public search result (`items`).

### 1.6 Why Must Both SELECT Statements Return the Same Number of Columns?
For a SQL `UNION` operation to be syntactically valid in relational database engines (including SQLite, MySQL, and PostgreSQL):
1. **Identical Column Count:** Both the original `SELECT` statement and the injected `SELECT` statement must return the **exact same number of columns**. If the original query selects 3 columns (`id, title, description`), the injected query must also select exactly 3 columns (e.g., `1, username, password`). If the counts differ, the database engine aborts with a syntax error (e.g., `SELECTs to the left and right of UNION do not have the same number of result columns`).
2. **Compatible Data Types:** The corresponding columns in each query must possess compatible data types (e.g., integers aligning with integers, text aligning with text) so the database can format the unified rows.

### 1.7 Breakdown of My Exploit Payload
The assigned exploit payload from our group execution plan is:
```sql
' UNION SELECT 1, username, password FROM users --
```

Here is exactly what each component achieves:
1. `'` (Single Quote): Breaks out of the opening single quote in the application's `LIKE '%...%'` clause, terminating the original string literal early.
2. `UNION`: Tells the database engine to combine the rows of the first query with the rows of the following query.
3. `SELECT 1, username, password`: Formulates the secondary query, requesting 3 columns to match the 3 columns of the original query:
   - `1`: A constant dummy integer to match the integer `id` column of the `items` table.
   - `username`: Extracts the username from the `users` table, mapped to the `title` column of the search results.
   - `password`: Extracts the password credential from the `users` table, mapped to the `description` column of the search results.
4. `FROM users`: Instructs the database engine to retrieve the exfiltrated credentials from the sensitive `users` authentication table.
5. `--` (SQL Comment): In SQL syntax, `--` marks the start of a single-line comment. This causes the database parser to ignore everything following it in the developer's original query string (specifically, the trailing `%''` characters), preventing syntax errors that would otherwise break query execution.

### 1.8 What is the Root Cause of the Vulnerability?
**Root Cause Statement:**
Untrusted user input is directly concatenated into the SQL command string without sanitization or parameter binding, failing to enforce a boundary between code and data. This allows attacker-supplied input to alter the syntactic structure of the query and execute arbitrary secondary `UNION` statements that leak sensitive database tables into HTTP responses.

### 1.9 What are Parameterized Queries / Prepared Statements?
A **parameterized query** (or **prepared statement**) is a database feature where the database query code is compiled and optimized by the database engine *before* any user input values are supplied.
- Instead of inserting user data directly into the SQL string, placeholders (such as `?` in SQLite/MySQL or `$1` in PostgreSQL) are placed in the query structure:
  ```sql
  SELECT id, title, description FROM items WHERE title LIKE ?
  ```
- The user input values are passed separately across the database driver interface as bound data parameters.

### 1.10 How Do Parameterized Queries Prevent SQL Injection?
Parameterized queries fundamentally solve SQL injection through **strict context separation**:
1. **Compilation Phase:** The database compiles the SQL statement template into an immutable Abstract Syntax Tree (AST) / execution plan before looking at user data. The database parser determines exactly which tables, operators, and conditions exist.
2. **Execution Phase:** When user-supplied parameter values are transmitted, the database treats them strictly as literal literal data values for comparison within the pre-compiled slots.
3. **Neutralization of Exploit Payloads:** Even if an attacker supplies `' UNION SELECT 1, username, password FROM users --`, the database never interprets `'`, `UNION`, or `--` as SQL commands. It simply searches the `title` column for an item whose title literally contains that entire text string. Because no item has that title, zero rows are returned. The query syntax cannot be subverted.

---

## 2. My Implementation Details

### 2.1 Files Created or Modified
| File Path | Nature | Details |
| :--- | :--- | :--- |
| `server.js` | Modified | Added in-memory SQLite database (`items` and `users` tables), refactored `/catalog`, implemented vulnerable dynamic query path `/catalog/legacy-search`, implemented secure parameterized query path `/catalog/secure-search`, updated `/search` alias, and added route `/diyanshi` pointing to `/catalog`. |
| `docs/diyanshi-sqli-union.md` | Created / Updated | Complete documentation for individual viva voce, theory, implementation guide, video script, and 30+ Q&A pairs. |
| `README.md` | Existing | Integrated group overview table linking to my branch, module, and documentation. |

### 2.2 Database Schema & Dummy Data
The demonstration uses an authentic in-memory SQLite database initialized at application startup:

#### `items` Table (Public Search Target)
```sql
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);
```
**Seed Data:**
- ID 1: Title: `'Security Operations Handbook'`, Description: `'Guidance for internal response teams'`
- ID 2: Title: `'Web Application Playbook'`, Description: `'Practical secure-development reference'`
- ID 3: Title: `'Infrastructure Review Kit'`, Description: `'Network review and assessment toolkit'`

#### `users` Table (Sensitive Target Table)
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL
);
```
**Seed Data (Dummy Coursework Credentials):**
- ID 1: Username: `'admin'`, Password: `'admin123'`
- ID 2: Username: `'alex'`, Password: `'welcome123'`

### 2.3 Vulnerable Implementation (Code Path)
- **Endpoint:** `GET /catalog/legacy-search?q=` (also reachable via `/search?q=`)
- **Backend Code (`server.js`):**
  ```javascript
  // Dynamic SQL string concatenation (Vulnerable)
  const statement = `SELECT id, title, description FROM items WHERE title LIKE '%${q}%'`;
  rows = sqliteDb.prepare(statement).all();
  ```
- **Flaw:** The parameter `q` is interpolated directly into the query string. Submitting `' UNION SELECT 1, username, password FROM users --` alters the SQL AST, appending records from `users` into `rows`.

### 2.4 Mitigated Implementation (Code Path)
- **Endpoint:** `GET /catalog/secure-search?q=` (also reachable via `/search?q=...&mode=secure`)
- **Backend Code (`server.js`):**
  ```javascript
  // Parameterized Query / Prepared Statement (Mitigated)
  const statement = 'SELECT id, title, description FROM items WHERE title LIKE ?';
  rows = sqliteDb.prepare(statement).all(`%${q}%`);
  ```
- **Defense Mechanism:** The query structure is compiled with placeholder `?`. The string `%' UNION SELECT 1, username, password FROM users --%` is bound strictly as a literal text value. SQLite evaluates `title LIKE ?` safely, returning 0 rows.

### 2.5 Verification Matrix
| Test Case | Mode | Search Input (`q`) | Executed Query | Observed Behavior | Security Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Normal Search** | Vulnerable (`/catalog/legacy-search`) | `Security` | `SELECT id, title, description FROM items WHERE title LIKE '%Security%'` | Returns 1 legitimate item ("Security Operations Handbook"). No passwords shown. | Normal functionality operational. |
| **UNION Exploit** | Vulnerable (`/catalog/legacy-search`) | `' UNION SELECT 1, username, password FROM users --` | `SELECT id, title, description FROM items WHERE title LIKE '%' UNION SELECT 1, username, password FROM users --%'` | Returns catalog items **plus** dummy credentials for `admin` (`admin123`) and `alex` (`welcome123`) marked as `EXFILTRATED CREDENTIAL`. | **Vulnerability successfully demonstrated.** |
| **Mitigation Check** | Secure (`/catalog/secure-search`) | `' UNION SELECT 1, username, password FROM users --` | `SELECT id, title, description FROM items WHERE title LIKE ?`<br>Bound: `['%\' UNION SELECT...%']` | Treats input as literal search string. Returns **"No matching items found."** No credentials leaked. | **Exploit successfully blocked by parameterized query.** |
| **Secure Normal Search** | Secure (`/catalog/secure-search`) | `Security` | `SELECT id, title, description FROM items WHERE title LIKE ?`<br>Bound: `['%Security%']` | Returns 1 legitimate item ("Security Operations Handbook"). | Legitimate functionality preserved under mitigation. |

---

## 3. Alternative Mitigation Techniques (Theory for Viva)

Per the assignment rubric (Section 3 & Table 2 item e), only one mitigation is required to be implemented in code (parameterized queries), but students must understand and explain the alternative mitigations discussed in class:

### 3.1 Input Validation Using Allow-Lists
- **Concept:** Rather than attempting to block dangerous characters (block-listing / blacklisting, which attackers routinely bypass with alternative encodings), allow-list validation specifies strictly what characters and patterns are accepted.
- **Application to Search:** If a search feature is designed to search alphanumeric book or resource titles, the backend enforces a strict regular expression:
  ```javascript
  if (!/^[a-zA-Z0-9\s\-_]{1,50}$/.test(q)) {
    return res.status(400).send('Invalid search characters.');
  }
  ```
- **Why It Helps:** Rejecting characters like `'`, `"`, `;`, and `--` prevents SQL control characters from ever reaching the query construction layer.
- **Limitation:** Cannot be used as a standalone solution if valid search data legitimately includes punctuation (e.g., apostrophes in names like "O'Reilly"). Therefore, input validation is a **defense-in-depth** measure, not a substitute for parameterization.

### 3.2 Least-Privilege Database Accounts
- **Concept:** The Principle of Least Privilege mandates that every application process must run using the minimum set of permissions necessary to complete its legitimate operational tasks.
- **Application to Search:** In production environments:
  - The web application user account used by public search routines should only have `SELECT` privileges granted exclusively on the `items` table.
  - The search account should have **no read or write permissions** on sensitive tables such as `users`, `audit_logs`, or `billing`.
  - Permissions should be configured via database GRANT statements:
    ```sql
    GRANT SELECT ON catalog_db.items TO 'search_service'@'localhost';
    REVOKE ALL ON catalog_db.users FROM 'search_service'@'localhost';
    ```
- **Why It Helps:** Even if an attacker successfully injects `' UNION SELECT 1, username, password FROM users --`, the database engine refuses to execute the secondary query, aborting with a permission-denied error (`ERROR 1142: SELECT command denied to user 'search_service' for table 'users'`).

### 3.3 Safe Error Handling (Information Disclosure Prevention)
- **Concept:** Applications must never expose verbose database engine error messages, query fragments, or stack traces directly to end users in HTTP responses.
- **Application to SQLi:** Attackers frequently rely on verbose database errors (e.g., "column count mismatch" or "table 'users' not found") to incrementally map database schema, enumerate column counts, and fine-tune UNION payloads.
- **How It Works:** The server catches all database exceptions and logs the details internally to secure administrative log files, returning only generic, harmless messages to the client (e.g., "An unexpected search error occurred. Please try again later.").

---

## 4. How to Run and Test the Application

### 4.1 Prerequisites
- Node.js (version 22+ recommended for native `node:sqlite` support; the application includes automatic fallbacks for older versions).
- npm (Node Package Manager).

### 4.2 Installation & Startup
Open a terminal in the project root directory (`assignment-3-group-15`):
```powershell
npm install
npm start
```

The application will start at:
`http://localhost:3000`

### 4.3 Navigating to My Module
- Open your browser and navigate to `http://localhost:3000/catalog` (or click **Catalog** in the top navigation bar, or visit `http://localhost:3000/diyanshi`).

---

## 5. Step-by-Step Video Demonstration Script (2–3 Minutes)

This script is structured for Diyanshi's individual screen-recording demonstration. Follow this exact flow:

### 0:00 – 0:30 | Introduction & Code Overview
> *"Hello, I am Diyanshi, Roll Number IIT2024158. As part of Group 15 for Cyber Security IT-30001, my individual responsibility is SQL Injection, Variant 2: UNION-Based Data Extraction."*
>
> *(Show `server.js` on screen)*
> *"Here in `server.js`, our application initializes an SQLite database containing an `items` table for catalog search, and a sensitive `users` table holding user credentials. In our legacy search route `/catalog/legacy-search`, user input from the search query parameter `q` is directly concatenated into the SQL statement: `SELECT id, title, description FROM items WHERE title LIKE '%${q}%'`. Because there is no parameter binding, an attacker's input can alter the SQL syntax."*

### 0:30 – 1:15 | Executing the Vulnerable Exploit
> *(Switch to browser at `http://localhost:3000/catalog`)*
> *"First, let's perform a normal search in Vulnerable Mode. I type `Security` and click Search. The query searches for titles containing 'Security' and returns one catalog item: 'Security Operations Handbook'. No sensitive data is exposed."*
>
> *(Click 'New Search' or return to `/catalog`)*
> *"Now, let's inject our UNION payload: `' UNION SELECT 1, username, password FROM users --`. When I click Search, notice what happens! The single quote closes the LIKE string literal, UNION combines the query results, and our secondary query selects 3 columns matching the original query schema. As you can see on screen, the application has dumped the dummy administrative and analyst credentials from the `users` table: username `admin` with password `admin123`, and username `alex` with password `welcome123`!"*

### 1:15 – 2:00 | Showing the Mitigation Code & Testing Protected Search
> *(Switch to `server.js` code)*
> *"To mitigate this vulnerability, I implemented Parameterized Queries using Prepared Statements in `/catalog/secure-search`. Instead of concatenating input, the query template is pre-compiled as `SELECT id, title, description FROM items WHERE title LIKE ?`, and the user input is bound strictly as a literal parameter."*
>
> *(Switch to browser and click 'Test same input in Secure Mode')*
> *"Now, I submit the exact same exploit payload in Secure Mode. Notice that the database treats the entire payload string literally. No UNION clause is executed, no user credentials are leaked, and the application safely responds with 'No matching items found.'"*

### 2:00 – 2:30 | Preserving Normal Functionality & Conclusion
> *(In Secure search bar, type `Security` and click Search)*
> *"Finally, I test a normal search for `Security` in Secure Mode. As you can see, the legitimate catalog item is returned properly. This proves that our parameterized mitigation completely eliminates the SQL injection vulnerability while preserving full search functionality. Thank you!"*

---

## 6. 35 Probable Viva Questions & Detailed Answers

### Section A: Fundamentals of SQL & Web Security
1. **What is SQL injection, and what is its fundamental cause?**  
   *Answer:* SQL Injection occurs when untrusted user input is directly concatenated into a dynamic SQL query string without parameter binding or sanitization. Its fundamental cause is the failure to maintain a strict separation between code (the developer's SQL syntax) and data (the user-supplied values).

2. **What does UNION do in SQL?**  
   *Answer:* The `UNION` operator combines the result sets of two or more `SELECT` queries into a single tabular result set, discarding duplicate rows (or retaining them with `UNION ALL`).

3. **What is the difference between In-band SQLi, Inferential (Blind) SQLi, and Out-of-Band SQLi?**  
   *Answer:* In-band SQLi (like UNION-based and error-based) returns extracted data through the same channel used to launch the attack (e.g., in the immediate HTTP response). Inferential/Blind SQLi reconstructs data bit-by-bit by observing server behavioral changes or time delays. Out-of-band SQLi exfiltrates data via external protocols (such as DNS or HTTP requests to an attacker-controlled server).

4. **Why is UNION-based SQLi classified as an In-Band technique?**  
   *Answer:* Because the extracted data is directly appended to the legitimate application response and displayed immediately in the HTTP web page.

5. **What are the prerequisites for a successful UNION-based SQL injection?**  
   *Answer:* Two prerequisites: (1) The attacker's injected `SELECT` query must return the exact same number of columns as the original query. (2) The corresponding columns must have compatible data types.

---

### Section B: Anatomy of My Exploit
6. **What is the exact payload you used for your demonstration?**  
   *Answer:* `' UNION SELECT 1, username, password FROM users --`

7. **Why does your payload begin with a single quote (`'`)?**  
   *Answer:* The vulnerable application query surrounds user input in single quotes: `WHERE title LIKE '%${q}%'`. The leading single quote terminates the opening string literal so that subsequent words are parsed as SQL commands.

8. **Why did you use the number `1` as the first column in `SELECT 1, username, password`?**  
   *Answer:* The original query selects `id, title, description`. The first column (`id`) is an integer. Passing the literal integer `1` fulfills the first column requirement with a compatible data type while reserving the remaining two columns for the username and password strings.

9. **What is the purpose of `--` at the end of your payload?**  
   *Answer:* In standard SQL, `--` initiates a comment. It instructs the database engine to ignore everything following it in the original query template—specifically, the trailing `%'`—avoiding syntax errors.

10. **What would happen if your injected query selected 4 columns instead of 3?**  
    *Answer:* The database would abort query execution with a fatal syntax error stating that the queries to the left and right of `UNION` do not have the same number of result columns, and no records would be displayed.

11. **How would an attacker determine the number of columns if they did not have access to source code?**  
    *Answer:* By using either `ORDER BY 1`, `ORDER BY 2`, `ORDER BY 3`, etc., until an error occurs, or by injecting `UNION SELECT NULL`, `UNION SELECT NULL, NULL`, etc., until the query succeeds without a column count error.

12. **How does an attacker discover the target table name (`users`) and column names (`username`, `password`) in a black-box scenario?**  
    *Answer:* In SQLite, by querying `sqlite_master` (`SELECT 1, tbl_name, sql FROM sqlite_master WHERE type='table'`). In MySQL or PostgreSQL, by querying `information_schema.tables` and `information_schema.columns`.

---

### Section C: My Implementation Details
13. **Which database technology is used in your implementation?**  
    *Answer:* An in-memory SQLite database utilizing Node.js's built-in `node:sqlite` module (`DatabaseSync`), with fallback handling to preserve compatibility.

14. **What are the schemas of the two tables in your implementation?**  
    *Answer:* `items` table: `id INTEGER PRIMARY KEY, title TEXT, description TEXT`. `users` table: `id INTEGER PRIMARY KEY, username TEXT, password TEXT`.

15. **What dummy credentials exist in your demonstration database?**  
    *Answer:* `admin` with password `admin123`, and `alex` with password `welcome123`.

16. **What is the vulnerable SQL query in your code?**  
    *Answer:* `SELECT id, title, description FROM items WHERE title LIKE '%${q}%'` located in `/catalog/legacy-search`.

17. **What is the secure SQL query in your code?**  
    *Answer:* `SELECT id, title, description FROM items WHERE title LIKE ?` located in `/catalog/secure-search`, where `%${q}%` is passed as a bound parameter.

18. **Why did you use dummy credentials rather than real credentials?**  
    *Answer:* To adhere strictly to security best practices and assignment ethics. Demonstration environments must never expose real user secrets, live keys, or production data.

19. **How does your interface distinguish between normal items and extracted credentials?**  
    *Answer:* Normal items display a green `Catalog Item` badge. When the UNION payload extracts rows matching usernames and passwords from the `users` table, the application highlights them with red rows and an `EXFILTRATED CREDENTIAL` badge.

20. **What endpoints did you implement or configure?**  
    *Answer:* `/catalog` (module home with both modes), `/catalog/legacy-search` (vulnerable search), `/catalog/secure-search` (mitigated search), and `/search` (redirection alias supporting both modes).

---

### Section D: Parameterization & Defense Mechanics
21. **What is a prepared statement?**  
    *Answer:* A prepared statement is a pre-compiled SQL statement template where parameters are represented by placeholders (e.g., `?`). The database compiles and optimizes the execution plan before receiving parameter values.

22. **Why does parameter binding prevent SQL injection?**  
    *Answer:* Parameter binding ensures that user input is transmitted out-of-band across the database protocol as pure literal data. The database parser never evaluates the data values for SQL grammar, keywords, or operators.

23. **In your secure search, what does the database do when given `' UNION SELECT 1, username, password FROM users --`?**  
    *Answer:* The database searches the `title` column of `items` for any title that literally contains the exact character sequence `%' UNION SELECT 1, username, password FROM users --%`. Because no item has that title, it returns 0 rows.

24. **Does parameterization hurt normal search queries like searching for "Security"?**  
    *Answer:* No. The bound parameter is `%Security%`, so SQLite correctly matches any row whose title contains the substring "Security", returning "Security Operations Handbook".

25. **Can parameterized queries be used for dynamic table names or column names?**  
    *Answer:* No. Parameter placeholders (`?`) can only represent data values (literals). They cannot represent SQL identifiers such as table names, column names, or sort orders (`ASC`/`DESC`). Dynamic identifiers must be validated against a strict allow-list of known valid names.

---

### Section E: Alternative Mitigations & Defense-in-Depth
26. **What is allow-list input validation, and how would it apply to your search?**  
    *Answer:* Allow-list validation tests inputs against a strict pattern of permitted characters (e.g., `/^[a-zA-Z0-9\s]+$/`), rejecting inputs containing apostrophes, dashes, or SQL symbols before queries are generated.

27. **Why is allow-list validation insufficient as the sole defense against SQL injection?**  
    *Answer:* Because legitimate business requirements may require accepting characters that happen to be SQL metacharacters (e.g., names with apostrophes like "O'Connor"). Parameterized queries handle these inputs safely without rejecting them.

28. **What is the Principle of Least Privilege in the context of database security?**  
    *Answer:* It means database user accounts should only be granted the minimum permissions required for their specific function. For instance, the catalog search user account should only have `SELECT` on `items`, and no permissions on the `users` table.

29. **How would least privilege stop your UNION attack even if the code remained vulnerable?**  
    *Answer:* Even if dynamic string concatenation allowed the query `UNION SELECT ... FROM users` to be sent to the database engine, the database would reject the query because the web user lacks `SELECT` privileges on the `users` table.

30. **What role does safe error handling play in defending against SQL injection?**  
    *Answer:* It prevents database syntax errors, column count mismatches, and schema structure from being displayed to users. This suppresses the reconnaissance information attackers need to craft working UNION payloads.

---

### Section F: Group Integration & Git Safety
31. **What is the difference between your variant and Jasmine's variant?**  
    *Answer:* Jasmine implemented Variant 1: Authentication Bypass (altering a `WHERE username = '...' AND password = '...'` logic to log in without credentials). I implemented Variant 2: UNION-Based Data Extraction (using `UNION SELECT` on a search feature to exfiltrate records from an entirely different table).

32. **Did your changes break Jasmine's, Jayanth's, Purvi's, or Yashika's implementations?**  
    *Answer:* No. All teammates' routes (`/access`, `/diagnostics`, `/community`, `/settings`), session structures, and existing in-memory arrays were preserved completely intact.

33. **On which Git branch did you perform your work?**  
    *Answer:* On my dedicated feature branch named `diyanshi`.

34. **How did you test your implementation before declaring it ready?**  
    *Answer:* Using automated end-to-end HTTP integration tests that verified: (1) application starts on port 3000, (2) teammate routes remain functional, (3) vulnerable mode returns normal items on standard search, (4) vulnerable mode extracts user credentials with the UNION payload, (5) secure mode blocks the same payload, and (6) secure mode continues to return normal search results.

35. **Why should web developers avoid block-lists (blacklists) like filtering out the word "UNION"?**  
    *Answer:* Block-lists are easily bypassed through character case alterations (`uNiOn`), SQL comments inside keywords (`UN/**/ION`), alternative encodings (URL encoding, double encoding), or alternate SQL injection vectors. Parameterization solves the root cause universally.
