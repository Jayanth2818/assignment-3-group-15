# Jayanth's CSRF section - GET-based forged action

This is a deliberately small, local-only demonstration for the assignment. It contains both required states:

- **Vulnerable:** `GET /vulnerable/update-email?email=...` changes the account email and trusts the browser session cookie.
- **Mitigated:** `POST /secure/update-email` requires a per-session unpredictable anti-CSRF token. In a production deployment, also set session cookies to `HttpOnly; SameSite=Lax` (or `Strict`).

## Run locally

```powershell
npm install
npm start
```

In another terminal:

```powershell
node attacker-server.js
```

1. Visit `http://localhost:3000` first, which creates the session.
2. Open `http://localhost:4000` in the **same browser**. Its local image load sends a forged request to the intentionally vulnerable GET endpoint.
3. Go back to `http://localhost:3000` and show that the email became `attacker@example.test`.
4. The secure form on the victim page succeeds because it includes the hidden token. A cross-site request cannot provide the required POST body and token, so the same forged attempt is rejected with `403`.

## Video checklist (2-3 minutes)

1. Show the GET-based vulnerable route in `server.js`.
2. Load the local attacker page and show the victim email change.
3. Show the fixed `POST /secure/update-email` handler and token comparison.
4. Re-run the forged request against `/secure/update-email`; show the `403 Blocked` response.

## Merge notes

Keep this folder separate when moving it to the group repository. Ask the group lead before integrating it into the shared app's router and session middleware, because those shared files are the most likely conflict points.
