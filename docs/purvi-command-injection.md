# Purvi — OS Command Injection (Variant 1: In-Band)

## Member Details
- **Member Name:** Purvi
- **Vulnerability Category:** OS Command Injection
- **Variant Implemented:** Variant 1: In-Band (Command Output Returned)
- **Branch:** `purvi`
- **Application Module:** Network Diagnostics (`/diagnostics` and `/ping`)

---

## 1. Vulnerable Implementation (Code Path)
The network utility endpoint accepts user input to execute an operating system diagnostic tool (`ping`) and directly returns the output into the HTTP response.

In a vulnerable implementation, input is concatenated straight into a system shell command string:

```javascript
child_process.exec("ping -c 1 " + req.query.host, (err, stdout) => {
  res.send(stdout);
});
```

In the coursework demonstration (`/diagnostics/legacy-check` or `/ping?host=`), the application demonstrates this behavior by inspecting shell control operators and displaying the resulting command structure and injected command outputs:

```javascript
const host = String(req.query.host || '');
const injected = /[;&|`$]/.test(host);
```

---

## 2. Working Exploit
- **Payload:** `127.0.0.1; cat /etc/passwd` or `127.0.0.1 && ls -la`
- **Execution:** Because the command is passed to a system shell interpreter (such as `/bin/sh` or `cmd.exe`), the shell control characters (`;`, `&&`, `|`) act as command separators. The shell first executes the `ping` utility, and then immediately executes the attacker's injected command.
- **Result:** The server executes the secondary operating system command in the context of the web server process and streams system directory listings or sensitive configuration files back to the client.

---

## 3. Root Cause Statement
Untrusted user parameters are passed directly into an operating system command shell without validation or escaping. This allows shell control operators (`;`, `&&`, `|`, `` ` ``) to break out of the intended argument context and execute arbitrary secondary host commands.

---

## 4. Implemented Mitigation
- **Fix:** 
  1. **Bypass Shell Invocation (Argument Vector Execution):** Execute system binaries directly without spawning an intermediary command shell (e.g., using `child_process.execFile('ping', ['-c', '1', host])`). This ensures the operating system treats all user input strictly as a single command-line argument rather than executable shell syntax.
  2. **Strict Allow-List Validation:** Enforce strict type and format validation on the parameter using built-in networking APIs (`net.isIP(host) === 4`).
- **Verification:** Submitting `127.0.0.1; ls` fails allow-list validation. The application rejects the request with HTTP 400 Bad Request ("Only a valid IPv4 address is accepted") and executes no command.

---

## 5. Other Mitigations (Theory for Viva)
1. **Avoid Shell Execution Completely:** Whenever possible, use native programming language APIs (e.g., Node.js `net.Socket` or `dns.lookup`) to test network connectivity rather than calling external OS binaries.
2. **Allow-List Input Validation:** Validate input strings against strict regular expressions (e.g., IPv4 regex `^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$`).
3. **Least Privilege OS User:** Run web server processes under heavily restricted, unprivileged service accounts with no shell access and read-only filesystem permissions.

---

## 6. Video Script Outline (2–3 mins)
1. **Show vulnerable code path:** Point out the shell invocation pattern where user input is concatenated into the command line.
2. **Execute command injection:** Run `127.0.0.1; ls -la` in the browser; show the simulated execution displaying server system files.
3. **Show mitigated code:** Walk through the safe argument array structure (`execFile`) and `net.isIP` validation.
4. **Demonstrate mitigation:** Execute the injected payload again and verify that the request is immediately rejected with HTTP 400.
