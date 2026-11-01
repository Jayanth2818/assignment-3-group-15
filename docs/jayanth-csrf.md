# Jayanth — Cross-Site Request Forgery (Variant 1: GET-Based Forged Action)

## Member Details
- **Member Name:** Jayanth
- **Vulnerability Category:** Cross-Site Request Forgery (CSRF)
- **Variant Implemented:** Variant 1: GET-Based Forged Action
- **Branch:** `jayanth`
- **Application Module:** Account Settings (`/settings` and `/update-email`)

---

## 1. Vulnerable Implementation (Code Path)
The account settings module exposes an email modification route that accepts HTTP GET requests and authenticates the user purely based on the session cookie:

```http
GET /update-email?email=user@example.com HTTP/1.1
Cookie: session_id=XYZ123
```

In `server.js` (`/settings/legacy-update` or `/update-email?email=`):
```javascript
app.get('/settings/legacy-update', (req, res) => {
  const email = String(req.query.email || '');
  if (!email.includes('@')) return res.status(400).send('A valid email is required.');
  account(req).email = email;
  res.send(...);
});
```

Because the request uses HTTP GET, any browser loading this URL (even embedded within an external resource) will automatically execute the action if the user has an active session.

---

## 2. Working Exploit
- **Attacker Setup:** The attacker hosts an external webpage (`attacker-site.js` running on `http://localhost:4000` or an external domain) containing an embedded auto-trigger element:
  ```html
  <img src="http://localhost:3000/settings/legacy-update?email=attacker%40sentinel.test" alt="tracking image">
  ```
- **Execution:** 
  1. The victim logs into Sentinel Workspace (`http://localhost:3000`), establishing an authenticated session cookie.
  2. The victim visits the external attacker page (`http://localhost:4000`) in another browser tab.
  3. The victim's browser attempts to fetch the image from `localhost:3000`. By default in legacy web specifications, the browser automatically attaches all credentials/cookies belonging to the target domain (`localhost:3000`).
- **Result:** The server processes the request as legitimate, silently updating the victim's email address to `attacker@sentinel.test` without the victim clicking any buttons or knowing an update took place.

---

## 3. Root Cause Statement
State-changing functions are exposed over idempotent HTTP `GET` requests and rely solely on ambient credentials (automatic browser cookie transmission) without verifying whether the request was intentionally generated and submitted by the user.

---

## 4. Implemented Mitigation
- **Fix:**
  1. **Strict HTTP Method Enforcement:** State modification routes are converted exclusively to HTTP `POST` (`/settings/secure-update`).
  2. **Synchronizer Token Pattern (Anti-CSRF Token):** The server generates a cryptographically secure, unpredictable per-session token:
     ```javascript
     function token(req) {
       if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
       return req.session.csrfToken;
     }
     ```
  3. **Timing-Safe Token Verification:** On every state-modifying POST request, the server validates the incoming token against the session token using constant-time comparison:
     ```javascript
     function validToken(req, supplied) {
       const expected = token(req);
       return typeof supplied === 'string' && 
              supplied.length === expected.length && 
              crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
     }
     ```
- **Verification:** An external site cannot read the secret token due to the browser's Same-Origin Policy (SOP). When an unauthorized cross-site request is sent, the token is missing or invalid, and the server rejects it with **HTTP 403 Forbidden** ("Missing or invalid anti-forgery token").

---

## 5. Other Mitigations (Theory for Viva)
1. **SameSite Cookie Attribute:** Setting cookies to `SameSite=Strict` or `SameSite=Lax` prevents the browser from attaching cookies on cross-origin requests.
2. **Re-Authentication / Step-Up Auth:** Requiring the user to re-enter their current password before saving sensitive changes (such as email or password updates) blocks automated CSRF attempts.
3. **Custom Request Headers:** Using AJAX with custom headers (e.g., `X-Requested-With` or `Authorization: Bearer <token>`) that browsers do not send automatically in cross-origin image or form tags.

---

## 6. Video Script Outline (2–3 mins)
1. **Show vulnerable backend code:** Highlight `/settings/legacy-update` GET route in `server.js`.
2. **Trigger attack:** With victim logged into `localhost:3000/settings`, open `http://localhost:4000`. Switch back to Settings and refresh to show the email changed silently.
3. **Show backend fix:** Highlight the POST route, token generator, and `crypto.timingSafeEqual` check in `server.js`.
4. **Demonstrate mitigation:** Trigger the request without a valid token and show the HTTP 403 Forbidden blocking the request.
