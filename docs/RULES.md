# ATOMA Workforce Intelligence — Rules

> Canonical engineering, data, metrics, security, mapping, and release rules.

## Engineering

1. Keep strict TypeScript and clean ESLint.
2. Use Drizzle via `@/db`; no ad-hoc client database calls.
3. Never hardcode/expose secrets.
4. API permission checks are authoritative; UI hiding is not authorization.
5. Production never trusts the unsigned demo role cookie.
6. Sanitize/reselect every uploaded field server-side.
7. Do not log HR rows or PII.
8. Audit dataset/report mutations and exports.
9. New customizable widgets require stable IDs.
10. Hidden widgets are not rendered and grids must reflow.
11. Unknown province remains `Unknown`; never default it to Kabul.
12. Do not add unresolved high/critical production dependencies.

## Metrics

- Headcount = records in security + filter scope.
- Growth = `(current − 12m reconstructed headcount) / 12m headcount`.
- Hiring rate = hires in last 12m / headcount.
- Gender diversity = normalized Blau index (100 = parity).
- Nationality diversity = Blau index ×100.
- Manager = direct reports, management title, or normalized level ≥6.
- Management ratio = non-managers / managers.
- Turnover = exit-language Remarks / headcount; retention = 100 − turnover.
- Promotion = promotion-language Remarks / headcount.
- Span = employees with supervisor / distinct supervisors.
- Retirement risk = age ≥55 planning signal, not legal conclusion.

## Filters

Security scope first. OR within dimension, AND across dimensions. Cascading counts apply all other filters. Division changes prune impossible Department/Title. Active single chart selection toggles off when clicked again.

## Personalization

Preference key `<userId>:<page>`. Store hidden IDs. Ignore stale IDs. Support Show All, Hide All, Essentials, group/individual toggle and reset. Personalization changes presentation—not data calculations, security, or structured exports.

## Map

Canonical list and GeoJSON must both contain exactly 34 matching names. Mapping precedence: province/region → duty station → Unknown. Unicode normalization must support Dari/Pashto and common transliterations. New aliases require regression checks. Coverage must be disclosed.

## Browser-local authentication

- First launch requires creation of one HR Admin username/password.
- Passwords are salted and hashed with PBKDF2-SHA256 (210,000 iterations); plaintext passwords are never stored.
- Authenticated user ID is held in `sessionStorage` and expires when the browser session is closed.
- Five failed logins trigger a 30-second local lockout.
- Only HR Admin creates users, assigns roles/division scope, activates/deactivates, deletes, or resets another password.
- A user cannot deactivate/delete themselves or remove their own HR Admin role; at least one active HR Admin must remain.
- Credentials and user records remain in IndexedDB on that browser profile. They do not synchronize between devices.
- Because code and data share one browser, this protects normal access but cannot defend against someone with OS/browser developer access. Protect the device and browser profile.

## Roles

| Capability | Admin | Officer | Executive | Division Manager | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| Dashboard/directory | ✓ | ✓ | ✓ | ✓ | ✓ |
| PII | ✓ | ✓ | ✓ | scoped | masked |
| Export | ✓ | ✓ | ✓ | scoped | — |
| Upload | ✓ | ✓ | — | — | — |
| Delete | ✓ | — | — | — | — |
| Schedule | ✓ | ✓ | ✓ | — | — |
| Audit/manage users | ✓ | — | — | — | — |

Entra app-role values: `Atoma.HRAdmin`, `Atoma.HROfficer`, `Atoma.Executive`, `Atoma.DivisionManager`, `Atoma.Viewer`. Division Manager production identity requires trusted division.

## Limits and sanitation

File 50 MB; request 120 MB; records 150,000. NFKC strings, remove controls, bound lengths, clamp finite numbers, whitelist mapping keys, recanonicalize provinces. Escape formula-leading exported values.

## Release gate

Run ESLint, Next typegen, TypeScript no-emit, production build, `npm audit --omit=dev`, platform startup, `/api/health`, API/RBAC/map smoke tests. Never commit `.env`, HR uploads, exports, or secrets.
