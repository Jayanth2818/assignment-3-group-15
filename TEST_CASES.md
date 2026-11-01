# Test Cases

| Module | Test | Expected legacy behavior | Expected protected behavior |
| --- | --- | --- | --- |
| Access | SQL-style login input | Session opens in the lab model | Authentication fails |
| Catalog | UNION-style search input | Restricted sample records appear | No records match |
| Diagnostics | Invalid host containing a shell character | Simulated injected output is displayed | Request is blocked with HTTP 400 |
| Community | Harmless HTML input | Markup renders in the legacy feed | Markup is encoded as text |
| Settings | GET email update | Email changes | Protected POST requires a valid token |
| Settings | POST with no token | N/A | Request is blocked with HTTP 403 |

## Baseline functional check

```powershell
npm.cmd install
npm.cmd start
```

Confirm that `/`, `/access`, `/catalog`, `/diagnostics`, `/community`, and `/settings` load successfully.
