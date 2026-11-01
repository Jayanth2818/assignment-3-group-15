# Demonstration Guide

Use this as a short demonstration plan. Each owner should show the legacy flow, explain the root cause, then show the protected flow.

## 1. Access Center

1. Open `/access`.
2. Use a SQL-style authentication-bypass input in the legacy form and show that a session opens.
3. Repeat it in the protected form and show that authentication fails.
4. Explain that parameter binding prevents input from changing query logic.

## 2. Knowledge Catalog

1. Open `/catalog`.
2. Use a UNION-style query in the legacy search and show the restricted sample records.
3. Repeat it in secure search and show that no records are returned.
4. Explain that the protected flow treats the input as a literal search term.

## 3. Network Diagnostics

1. Open `/diagnostics`.
2. Show the legacy workflow handling a host value containing a shell control character.
3. Explain the simulated command output and why real applications must never build shell commands from request data.
4. Use the protected workflow to show that an invalid host is blocked.

## 4. Community Wall

1. Open `/community`.
2. Submit harmless HTML markup through the legacy form and show that it renders as markup.
3. Submit the same text through the protected form and show that it displays as text.
4. Explain output encoding and contextual sanitization.

## 5. Account Settings

1. Open `/settings` and note the current email.
2. Start `npm.cmd run attacker` in another terminal.
3. Open `http://localhost:4000` in the same browser, then return to Settings and show the email change.
4. Show the protected Settings form: it uses POST plus a hidden per-session token.
5. Explain that an external page cannot supply the required unpredictable token.
