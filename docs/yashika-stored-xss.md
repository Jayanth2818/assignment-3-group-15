# Yashika — Cross-Site Scripting (Variant 1: Stored XSS)

## Member Details
- **Member Name:** Yashika
- **Vulnerability Category:** Cross-Site Scripting (XSS)
- **Variant Implemented:** Variant 1: Stored XSS
- **Branch:** `yashika`
- **Application Module:** Community Wall (`/community` and `/comments`)

---

## 1. Vulnerable Implementation (Code Path)
The community updates module allows users to submit messages that are stored on the server and rendered back to all visiting users.

In the legacy implementation (`/community/legacy-post`), user input is stored directly and injected into the HTML response without output encoding or sanitization:

```javascript
// Unescaped / Raw HTML rendering
${post.mode === 'legacy' ? post.text : escapeHtml(post.text)}
```

```html
<!-- Vulnerable rendering pattern -->
<div><%= comment.text %></div>
```

---

## 2. Working Exploit
- **Payload:** `<script>alert(document.cookie)</script>` or `<img src=x onerror="alert('XSS')">`
- **Execution:** When submitted via the legacy form, the payload is persisted on the server. Whenever any user navigates to `/community`, the server renders the payload as raw HTML. The victim's browser parses the `<script>` or `<img>` tag and automatically executes the embedded JavaScript within the user's origin context.
- **Result:** The injected script can steal session cookies, hijack user sessions, perform unauthorized DOM manipulation, or redirect the user to phishing domains.

---

## 3. Root Cause Statement
Persistent user input is inserted directly into the HTML Document Object Model (DOM) without context-aware output encoding or HTML sanitization, allowing browser interpreters to treat untrusted data as executable script markup.

---

## 4. Implemented Mitigation
- **Fix:** Apply **Contextual HTML Entity Encoding**:
  ```javascript
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }
  ```
  In `/community/secure-post`, all submitted content is encoded before rendering into the HTML DOM. Special characters like `<` and `>` are converted into harmless HTML entities (`&lt;` and `&gt;`).
- **Verification:** When entering `<script>alert('XSS')</script>`, the browser renders the payload harmlessly as plain text on screen (`<script>alert('XSS')</script>`), and no JavaScript executes.

---

## 5. Other Mitigations (Theory for Viva)
1. **Content Security Policy (CSP):** Enforce strict HTTP CSP response headers (e.g., `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'`) to disallow inline scripts and restrict script execution only to trusted sources.
2. **HttpOnly Cookie Flag:** Ensure all session and authentication cookies include the `HttpOnly` attribute, preventing client-side JavaScript from accessing `document.cookie` even if an XSS flaw exists.
3. **HTML Sanitization Libraries:** If rich-text HTML rendering is required by design, use robust, actively maintained sanitization libraries such as DOMPurify to strip dangerous attributes (e.g., `onerror`, `onload`, `javascript:`) before DOM insertion.

---

## 6. Video Script Outline (2–3 mins)
1. **Show unescaped template rendering:** Highlight where legacy posts are rendered raw without encoding.
2. **Submit stored payload:** Submit `<img src=x onerror="alert('XSS')">` in the legacy form; show the JavaScript execution triggering in the browser.
3. **Show mitigated code:** Walk through the `escapeHtml` implementation and secure rendering logic.
4. **Demonstrate mitigation:** Submit the same payload in the protected form; reload the page to show it rendered as safe plain text.
