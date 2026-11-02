# Purvi — OS Command Injection (Variant 1: In-Band)

## Member & Assignment Details
- **Student Name:** Purvi
- **Roll Number:** IIT2024160
- **Course:** Cyber Security (IT-30001) — IIIT Allahabad
- **Instructor:** Dr. Soumyadev Maity
- **Vulnerability Category:** OS Command Injection
- **Variant Implemented:** Variant 1: In-Band (Command Output Returned)
- **Active Git Branch:** `Purvi-OS-command-injection`
- **Application Module:** Network Diagnostics (`/diagnostics` and `/ping`)

---

## 1. Vulnerable Implementation (Code Path)

The application provides a network diagnostic utility allowing users to verify if a remote host or IP address is reachable. 

### Vulnerable Code Path in `server.js`:
In the legacy implementation (`handleDiagnosticsCheck` where `secure === false` and `/ping` raw API):
```javascript
// --- VULNERABLE CODE PATH (Purvi - OS Command Injection Variant 1: In-Band) ---
// Flaw: Dynamic string concatenation directly into system command shell.
const fullCommand = `${pingBinary} ${pingFlag} 1 ${host}`;

// Execute via command shell (powershell.exe / cmd.exe on Windows, /bin/sh on POSIX)
exec(fullCommand, { timeout: 6000, shell: shellEnv }, (err, stdout, stderr) => {
  res.send(stdout);
});
```

### Architectural Flaw:
1. **Shell Interpreter Invocation:** By calling `child_process.exec()`, Node.js explicitly spawns an operating system shell interpreter (`/bin/sh` on POSIX or `powershell.exe` / `cmd.exe` on Windows).
2. **String Concatenation:** Untrusted user input (`req.query.host`) is concatenated directly into the shell command string without prior sanitization, character escaping, or parameter separation.
3. **In-Band Return Channel:** Both `stdout` and `stderr` streams of the executed command are captured and rendered directly in the HTTP response body, allowing the attacker to receive immediate command output without needing out-of-band exfiltration techniques.

---

## 2. Working Exploit (Proof of Concept)

### Exploit Payloads:
| Target Platform | Payload | Effect / In-Band Output |
| :--- | :--- | :--- |
| **Unix / Linux / macOS** | `127.0.0.1; cat /etc/passwd` | Streams the server's user account database (`/etc/passwd`) |
| **Unix / Linux / macOS** | `127.0.0.1 && ls -la` | Dumps the full filesystem directory contents and permissions |
| **Windows / PowerShell** | `127.0.0.1; whoami` | Returns active system username and domain (`laptop-ema6hmar\purvi`) |
| **Windows / PowerShell** | `127.0.0.1; ls` | Returns local project files and directory listings |
| **Windows (cmd.exe)** | `127.0.0.1 && dir` | Lists server workspace directory contents |
| **Cross-Platform** | `127.0.0.1; cat package.json` | Exfiltrates server application configuration and dependencies |

### How the Exploit Works:
When the server constructs `ping -c 1 127.0.0.1; cat /etc/passwd` and dispatches it to the shell:
1. The shell parser reads the string from left to right.
2. It encounters the semicolon `;` (or `&&` / `|`), which the shell grammar defines as a command separator.
3. The shell terminates the arguments for `ping` and interprets `cat /etc/passwd` as an independent secondary command.
4. The secondary command executes under the operating system privileges of the Node.js server process.
5. Node.js captures the standard output stream of both commands and transmits it over HTTP to the attacker.

---

## 3. Root Cause Statement

> **Root Cause:** Untrusted user parameters are concatenated directly into an operating system command shell string without validation or escaping. This allows shell metacharacters (such as `;`, `&&`, `|`, and `` ` ``) to break out of the intended argument context and execute arbitrary secondary host commands in the security context of the server process.

---

## 4. Implemented Mitigation

The implementation applies defense-in-depth across two distinct security layers:

```
                  Untrusted Input: host = "127.0.0.1; ls"
                                   |
                                   v
             +-------------------------------------------+
             | Layer 1: Strict Allow-List Validation     |
             | net.isIP(host) === 4                      |
             +-------------------------------------------+
                        |                     |
                   [Pass: Valid IPv4]    [Fail: Contains non-IP chars]
                        |                     |
                        v                     v
+------------------------------------+  +--------------------------------+
| Layer 2: Parameterized Execution   |  | HTTP 400 Bad Request           |
| execFile('ping', ['-c', '1', host])|  | Request Blocked:               |
| No shell interpreter is spawned!   |  | "Only a valid IPv4 address is  |
| Arguments passed as discrete array |  | accepted."                     |
+------------------------------------+  +--------------------------------+
```

### 1. Primary Architecture Fix: Bypass Shell Invocation (Argument Vector Execution)
Instead of invoking a shell via `exec()`, the application uses `child_process.execFile()`:
```javascript
// --- MITIGATED CODE PATH (Purvi) ---
const pingArgs = process.platform === 'win32' ? ['-n', '1', host] : ['-c', '1', host];

// execFile executes the binary directly WITHOUT an intermediary shell
execFile('ping', pingArgs, { timeout: 6000 }, (err, stdout, stderr) => {
  res.send(renderOutput(stdout));
});
```
- **Why this works:** `execFile` communicates directly with the OS kernel's `execve` / `CreateProcess` syscalls. The arguments array `['-c', '1', host]` is passed as discrete data blocks. The operating system never parses the arguments for shell syntax. Even if a payload like `127.0.0.1; ls` reaches `execFile`, the `ping` utility receives `"127.0.0.1; ls"` literally as a hostname, fails to resolve it, and never spawns `ls`.

### 2. Secondary Defense: Strict Allow-List Input Validation
Before any process execution is attempted:
```javascript
const isAllowedIp = net.isIP(host) === 4;
if (!isAllowedIp) {
  return res.status(400).send(blockedHtml);
}
```
- **Why this works:** By restricting acceptable inputs strictly to decimal IPv4 addresses, all shell metacharacters (`;`, `&`, `|`, spaces, quotes) are rejected immediately at the application boundary with HTTP 400 Bad Request.

### Verification of Mitigation:
1. Submit `127.0.0.1; ls` to `/diagnostics/secure-check`.
2. The request is immediately rejected with **HTTP 400 Bad Request**.
3. Response details confirm: *"No command was constructed or dispatched to the operating system."*

---

## 5. Other Mitigations (Theory for Viva)

Based on course lectures and security standards:

1. **Avoid Shell Execution Completely (Use Native Programming Language APIs):**
   - External OS binaries should rarely be invoked from web servers. Instead of calling external `ping` or `nslookup`, use language-level networking libraries such as Node.js `net.Socket`, `dns.lookup()`, or ICMP ping libraries. Native APIs do not interact with the operating system command line, eliminating command injection by design.

2. **Allow-List Input Validation via Strict Regular Expressions:**
   - If input cannot be validated with built-in networking APIs, validate it against a strict character allow-list using anchored regular expressions:
     ```regex
     ^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$
     ```
   - Never use denylists / blocklists (such as stripping `;` or `&&`), as attackers can easily circumvent them using alternative shell syntax (newlines `\n`, pipes `|`, backticks, `$()`, or parameter expansion).

3. **Principle of Least Privilege (Restricted Execution Context):**
   - The web server process should run under a dedicated, low-privileged operating system service account (e.g., `www-data` or `nobody`) rather than `root` or `Administrator`.
   - The service account must have no access to administrative binaries (`sudo`, `passwd`, PowerShell), restricted filesystem permissions, and `/sbin/nologin` shell.

---

## 6. Video Demonstration Script (2–3 Minutes)

Use this script during your individual screen-recording segment:

| Timestamp | Visual Action | Narration Script |
| :--- | :--- | :--- |
| **0:00 – 0:35** | Show [server.js](file:///c:/Personal/Purvi_College/SEM-5/CS/vulnerablility_assign/assignment-3-group-15/server.js#L440-L470) in the code editor, highlighting the vulnerable `exec()` call. | *"Hello, I am Purvi, Roll Number IIT2024160. For Assignment 3, I implemented OS Command Injection, Variant 1: In-Band (Command Output Returned) on the Network Diagnostics module. In our server code, the legacy endpoint directly concatenates the user-supplied host parameter into a shell command string passed to `child_process.exec()`. Because an intermediary shell interpreter is spawned, shell control operators can alter the command syntax."* |
| **0:35 – 1:15** | Switch to the browser at `http://localhost:3000/diagnostics`. Click the **127.0.0.1; ls** (or `127.0.0.1 & whoami`) quick payload button. Click **Run vulnerable check**. | *"Now let's demonstrate the exploit. In the Legacy workflow, I provide the payload `127.0.0.1; whoami` (or `127.0.0.1; ls`). When submitted, the shell terminates the ping command at the semicolon and immediately executes the secondary command. Because this is an In-Band vulnerability, the command output — including our server username and directory contents — is returned directly inside the HTTP response body."* |
| **1:15 – 1:55** | Switch back to [server.js](file:///c:/Personal/Purvi_College/SEM-5/CS/vulnerablility_assign/assignment-3-group-15/server.js#L380-L425), highlighting `net.isIP()` and `execFile()`. | *"To mitigate this vulnerability, I implemented two layers of defense. First, we bypass shell invocation entirely using `child_process.execFile()`. By supplying arguments as a discrete array, the kernel executes the binary directly without a shell parser, rendering shell metacharacters harmless. Second, we enforce strict IPv4 allow-list validation using `net.isIP(host) === 4`."* |
| **1:55 – 2:30** | Switch to the browser. Click **Test same input in Protected Mode** (or submit the same payload into the Protected form). Show the **HTTP 400 Request Blocked** screen. | *"Now I submit the identical exploit payload into the Protected workflow. The application immediately validates the input, identifies illegal non-IP characters, and halts execution with HTTP 400 Bad Request. No system shell or external process is ever invoked, completely neutralizing the attack."* |

---

## 7. Viva Voce Preparation Guide

### Q1: What makes this vulnerability "In-Band" as opposed to "Blind"?
> **Answer:** In-Band OS command injection means that the output (stdout or stderr) generated by the injected command is returned directly to the client within the immediate HTTP response channel. In contrast, "Blind" command injection yields no output in the HTTP response, requiring the attacker to deduce execution via time delays (`ping -c 10`) or out-of-band network callbacks (DNS/HTTP requests).

### Q2: Why is `execFile` or `spawn` safer than `exec`?
> **Answer:** `exec()` always launches a system shell (`/bin/sh` or `cmd.exe`) and passes the whole string for parsing. Shell control characters (`;`, `&`, `|`) are interpreted as commands. In contrast, `execFile()` invokes the specified binary directly through OS-level APIs (such as `execve`) and accepts arguments as an array of discrete strings. Metacharacters in the argument array are treated strictly as literal data, preventing command breakout.

### Q3: Why is input allow-listing preferred over denylisting?
> **Answer:** Denylisting attempts to block known malicious characters (like `;` or `|`), but attackers frequently bypass denylists using alternatives such as newlines `\n`, backticks, `$()`, parameter expansion, or base64 decoding. Allow-listing defines the exact acceptable pattern (e.g. valid IPv4 format) and rejects everything else by default.

### Q4: How does the Principle of Least Privilege limit the impact if an injection still occurs?
> **Answer:** If an attacker succeeds in injecting a command, that command executes with the exact permissions of the web server's operating system process. If the web server runs as `root` or `Administrator`, the attacker achieves complete system compromise. If it runs as an unprivileged service user (`www-data`) in a container or jail with read-only root filesystems, the attacker cannot modify files, install persistence, or access sensitive system records.
