# ATOMA Workforce Intelligence — Delivery Tasks

Legend: `[x]` complete, `[ ]` backlog, `[!]` production dependency/decision.

## Product foundation

- [x] Next.js App Router, strict TypeScript, Tailwind 4.
- [x] Responsive shell, sidebar, topbar, global search, filters, notifications.
- [x] Light, Dark, and ATOMA themes with persistence.
- [x] PostgreSQL + Drizzle schema and health endpoint.
- [x] Browser-only IndexedDB data mode.

## Admin data management

- [x] HR Admin employee row editor: add / edit / delete against the active dataset.
- [x] Recomputation of derived fields (age, tenure, level rank, qualification group, province) on save.
- [x] Robust handling of rows with no supervisor (CEO), blank identities and duplicate names.

## Data ingestion and quality

- [x] Excel/CSV drag-drop and browse.
- [x] Multi-sheet parsing and header-row detection.
- [x] 29-field alias/fuzzy auto-mapping with manual review.
- [x] Robust date, age, tenure, gender, nationality, qualification normalization.
- [x] File (50 MB), request (120 MB), and row (150,000) limits.
- [x] Server field selection, bounds, control stripping, and province recanonicalization.
- [x] Data-quality reporting and downloadable templates.
- [x] Secure SheetJS CE 0.20.3 registry package (`@e965/xlsx`).
- [x] Spreadsheet formula injection neutralization.
- [x] Realistic 500–15,000 employee demo generator.

## Dashboards and interaction

- [x] Twenty executive KPI cards with trends/sparklines.
- [x] Ten strategic metrics and scorecard.
- [x] Eighteen linked interactive visuals.
- [x] Cascading advanced filters and removable chips.
- [x] Click-to-filter visuals.
- [x] Focus/table/PNG chart modes.
- [x] Personalized visibility for Overview, Strategic Analytics, and Interactive Visuals.
- [x] Per-user/page persistence, Essentials, groups, Show/Hide All, reset.
- [x] Automatic dense grid rearrangement after hiding widgets.
- [x] Recovery UI when all widgets are hidden.

## Afghanistan geospatial analytics

- [x] Local 34-province ADM1 GeoJSON.
- [x] Canonical GeoJSON/province dictionary parity validator.
- [x] Latin transliteration aliases.
- [x] Dari/Pashto aliases for all 34 provinces.
- [x] City/duty-station-to-province aliases.
- [x] Unicode NFKC, Arabic/Persian ya/kaf normalization, diacritic removal.
- [x] Server-side province recanonicalization.
- [x] Employee mapping coverage diagnostic and visible map percentage.
- [x] Province detail panel and duty-station markers.
- [x] Demo data maps without unmatched provinces.

## Workforce features

- [x] Virtualized, sortable, filterable employee directory.
- [x] Column selector, paging, frozen header/first column, CSV/XLSX export.
- [x] Employee profile drawer, reporting chain, direct reports.
- [x] Profile PDF, print, copy contact.
- [x] Zoom/pan/search/recursive-expand org chart.
- [x] Cascading Division → Department org-chart filters.
- [x] Fixed L6 → L5 → L4 → L3H → L3 → L2 → L1 hierarchy with L1–L6 canonicalization.
- [x] Supervisor-first recursive reporting hierarchy with cycle protection.
- [x] Classic HR-style divisional organogram (level rail, elbow connectors, vacant/temporary cards).
- [x] Centred reporting rows (two left / two right) and bounded “+N more” expansion for very large divisions.
- [x] Flexible level bands: dense L2/L1 bands wrap into extra rows and grow taller (print-friendly width).
- [x] Pure line-manager mapping across levels (L2 can report directly to L5).
- [x] Tolerant supervisor matching (exact, e-mail, unique fuzzy name variants).
- [x] Leader rules: scope-root + subtree + GM/DGM/C-suite titles + division/department name in title.
- [x] Per-department sheets for divisions over 80 people, each topped by the division head.
- [x] Printed legend (filled / vacant / temporary / level band) on screen, SVG, PDF and print.
- [x] ATOMA chevron logo applied across the app, favicon and exports.
- [x] Subtree-based leader selection (CEO, division and department heads) with C-suite title handling.
- [x] Single-page vector organogram PDF (A4→A0), editable SVG, high-res PNG and one-page print.
- [x] Visio-style balance: head on the centre line, each manager centred over their team, reports split left/right.
- [x] Lateral staff officers (Secretary/Assistant) beside their manager.
- [x] Team clusters: 5+ reports stack in columns of 3 with spine/stub connectors; smaller teams in a centred row.
- [x] Editable Microsoft Visio export (.vsdx with .vdx XML fallback).
- [x] Landscape organogram engine: horizontal level rows, dominant-level labels with “cont.” rows, roster cards, centre aisles, bus connectors.
- [x] Reporting engine with link provenance (override/email/number/name/fuzzy/inferred), cycle repair and quality reporting.
- [x] Scored division-head candidates with reasons and per-division manual override.
- [x] SVG/PDF/print exports in the approved style (inferred-line legend + author credit).
- [x] Dashboard PDF: blue ATOMA band on page one only.
- [x] Page-level ErrorBoundary and chart option isolation so no widget can blank the page.
- [x] Footer credit: “Made with ♥ by Mohibullah Afzalzada”.
- [x] Deterministic AI insights and workforce Q&A.

## Reporting

- [x] PDF, executive PDF, XLSX, CSV, PNG, branded snapshot.
- [x] PostgreSQL daily/weekly/monthly schedules.
- [x] Run-now generation and audit event.
- [ ] Connect a durable queue/worker for schedules.
- [ ] Connect approved SMTP/Graph email delivery.
- [ ] Store generated reports in encrypted object storage with retention.

## Security and sanitation

- [x] Five-role RBAC and permission matrix.
- [x] First-run local HR Admin account setup.
- [x] PBKDF2-SHA256 salted local password hashing and session-only login.
- [x] HR Admin user CRUD, role/division assignment, activation and password reset.
- [x] Five-attempt temporary login lockout and last-admin safeguards.
- [x] Division Manager server-side row-level filtering.
- [x] Viewer server-side PII masking.
- [x] Dataset/report/audit API permission checks.
- [x] Fail-closed production proxy authentication mode.
- [x] Deterministic Entra app-role claim precedence.
- [x] Division claim mandatory for production Division Managers.
- [x] CSP, frame denial, MIME sniffing, referrer and permissions headers.
- [x] Audit text sanitation.
- [x] Next.js upgraded to patched 16.3.6.
- [x] Production dependency audit: zero known vulnerabilities.
- [!] Four moderate development-only advisories remain in Drizzle Kit loader; npm recommends an unsafe major downgrade. Do not use Drizzle development server on an untrusted network.
- [ ] Integrate a real Entra token-validating proxy/Auth.js deployment.
- [ ] Make PostgreSQL audit logs immutable by database permissions/archival.
- [ ] Add CSRF token/origin validation if cookie-based production authentication is ever introduced.
- [ ] Add rate limiting at ingress for API/upload endpoints.

## Production role rollout

- [ ] Register ATOMA enterprise app in Microsoft Entra.
- [ ] Define `Atoma.HRAdmin`, `Atoma.HROfficer`, `Atoma.Executive`, `Atoma.DivisionManager`, `Atoma.Viewer` app roles.
- [ ] Create approved security groups and assign users/groups under Enterprise Applications.
- [ ] Establish trusted division attribute/group mapping.
- [ ] Deploy identity-aware proxy that validates tokens and strips/injects headers.
- [ ] Generate 32+ character `ATOMA_PROXY_SECRET` in a secret manager.
- [ ] Set `ATOMA_AUTH_MODE=production` and block direct upstream access.
- [ ] Test every role with positive and negative API cases.
- [ ] Document access-request, approval, quarterly review, and revocation process.

## Validation/release checklist

- [x] ESLint clean.
- [x] Next route type generation clean.
- [x] TypeScript `--noEmit` clean.
- [x] Production build clean.
- [x] Full application startup and `/api/health` pass.
- [x] 10,000-row domain/render smoke test.
- [x] Chart option rendering test in all three themes.
- [x] Excel title-row/header/date round-trip test.
- [x] Role/RLS/PII API tests.
- [x] GeoJSON and alias mapping test.
- [ ] Add committed automated test runner (Vitest/Playwright) to CI.
- [ ] Add browser E2E tests for drag/drop, exports, print, and personalization persistence.
- [ ] Add load tests at 50k/150k rows in production-sized infrastructure.
