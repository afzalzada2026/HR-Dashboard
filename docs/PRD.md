# ATOMA HR Workforce Intelligence Platform — Product Requirements Document

## 1. Product summary

ATOMA Workforce Intelligence is an enterprise HR analytics portal for executives, HR teams, division managers, and read-only viewers. It converts Excel/CSV HR master data into interactive workforce KPIs, linked visuals, an Afghanistan province heat map, an employee directory, an organization chart, AI-style deterministic narratives, and board-ready exports.

The experience is intentionally comparable to Power BI, Tableau, SAP SuccessFactors Analytics, Oracle HCM Analytics, and Workday People Analytics while retaining ATOMA branding.

## 2. Goals

1. Provide a trusted single view of workforce composition and organization health.
2. Let nontechnical HR users import and automatically map common HRIS exports.
3. Support 10,000+ employee records with responsive filtering and virtualized tables.
4. Make every analytic view interactive, drillable, exportable, and role-aware.
5. Map Afghan employees reliably to the correct one of 34 provinces.
6. Let each user personalize which cards and visuals are visible; hidden items must be removed from layout and remaining widgets must reflow automatically.
7. Operate browser-only by default: the local Next.js server serves application assets, while employee rows, datasets, audit history, schedules, filters, themes and layouts stay in the browser. PostgreSQL enterprise mode is optional and must be explicitly enabled at build time.

## 3. Personas and roles

| Role | Primary need | Data scope | PII |
|---|---|---|---|
| HR Admin | Full administration, audit, datasets and roles | Organization | Full |
| HR Officer | Import, maintain, report and inspect employees | Organization | Full |
| Executive | Executive analytics and reporting | Organization | Full |
| Division Manager | Manage one assigned division | Assigned division only | Full within scope |
| Viewer | Read-only workforce trends | Organization | Masked |

The authoritative permission matrix is in `src/lib/rbac.ts` and documented in `RULES.md`.

## 4. Functional requirements

### 4.1 Data ingestion

- Drag/drop and file-browser import for `.xlsx`, `.xls`, and `.csv`.
- Browser file limit: 50 MB. Dataset limit: 150,000 records.
- Multi-sheet workbook support.
- Header-row detection when reports contain title/blank rows above headers.
- Automatic mapping to all 29 ATOMA HR fields using exact aliases and similarity scoring.
- Manual mapping review before import.
- Robust Excel serial and international date parsing.
- Server-side revalidation and sanitation before PostgreSQL persistence.
- Data-quality report: completeness, skipped rows, duplicate IDs, invalid dates, and unmatched provinces.
- Recent datasets, activation, deletion, and downloadable templates.
- Deterministic demo generator at 500–15,000 employees.

### 4.2 Executive overview

Twenty animated KPI cards:

- Total, male, female, gender ratio, local, expat.
- Average age and tenure.
- Married and single.
- Divisions, departments, duty stations, nationalities.
- Average span of control.
- Joined this year/month.
- Bachelor+, Master+, and PhD.

Cards include icons, trends, sparklines, contextual labels, tooltips, and click-to-filter behavior where meaningful.

### 4.3 Dashboard personalization

- `Customize` is available on Executive Overview, Strategic Analytics, and Interactive Visuals.
- Every KPI card, strategic metric, insight section, and chart has a stable widget ID.
- Users can show/hide one widget, a category, all widgets, or an “Essentials” preset.
- Preferences are stored per `userId + page` in browser local storage.
- Hidden widgets are not rendered.
- Remaining widgets use responsive `grid-flow-row-dense` layout and automatically close gaps.
- “Hide all” shows a recovery state with Customize and Restore Defaults controls.
- Preferences survive refreshes and do not change analytic filters.

### 4.4 Strategic workforce analytics

- Headcount growth, hiring rate, gender and nationality diversity indices.
- Average department size, management ratio, retention, turnover, promotion, and reporting-line depth.
- Formula tooltips and Healthy/Watch/Risk indicators.
- Division scorecard, diversity/retention gauges, capability radar, span distribution, management layers, and dynamic insight panel.

### 4.5 Interactive visuals

Minimum 15; current implementation provides 18:

1. Division headcount
2. Department headcount
3. Gender by division
4. Age histogram
5. Tenure histogram
6. Joining trend
7. Duty station analysis
8. Qualification treemap
9. Nationality treemap
10. Marital pie
11. Division → Department → Title sunburst
12. Supervisor load
13. Age vs tenure scatter
14. Afghanistan province map
15. Diversity heat matrix
16. Actual-level pyramid
17. Nationalization by division
18. Blood-group rose chart

Chart clicks cross-filter the entire application. Charts support table mode, focus mode, and PNG download.

### 4.6 Afghanistan map

- 34 ADM1 province polygons from `public/geo/afghanistan.json`.
- Canonical names are identical across GeoJSON, province dictionary, employees, filters, and ECharts.
- Mapping priority: explicit province/region field → duty station/city → Unknown.
- Latin spelling variants plus Dari/Pashto province names are recognized.
- Metrics: headcount, female %, average age, average tenure.
- Optional station markers and province labels.
- Province drill panel: headcount, gender split, top qualification, department/division, age, tenure, stations.
- UI displays mapped employee count and mapping percentage.
- Upload data quality exposes unmatched provinces.

### 4.7 Directory and drill-through

- Virtualized employee table, frozen header/first column, global and column searches, sorting, pagination, selected columns, CSV/XLSX export.
- Profile drawer with required identity, employment, organization, contact, location, and blood-group fields.
- Reporting chain and direct reports.
- Download profile PDF, print profile, and copy contact actions.

### 4.8 Org chart

- CEO → division → department → employee structure.
- Search, zoom, pan, expand/collapse, paged employee branches, and profile drill-through.

### 4.9 Insights

- Dynamic findings for size, growth, demographics, diversity, capability, geography, span, retirement, layers, hires, expatriates, turnover, and data quality.
- Narrative executive summary.
- Rule-based natural-language workforce Q&A; no external LLM or employee data egress.

### 4.10 Reporting

- PDF, XLSX, CSV, PNG, branded snapshot, and executive PDF.
- Formula-leading spreadsheet values are escaped before export.
- Daily/weekly/monthly report schedules stored in PostgreSQL.
- “Run now” generates the output and records an audit event.
- Email delivery is represented in UI but requires an external mail/queue integration for production.

### 4.11 Themes and responsive UX

- Light, Dark, and ATOMA modes remembered by the browser.
- Desktop optimized; tablet/mobile responsive.
- Glass cards, subtle motion, skeleton loaders, notifications, tooltips, focus states, and reduced-motion support.

## 5. Security requirements

- Production must set `ATOMA_AUTH_MODE=production` (or `proxy`).
- Production must not expose the Next.js upstream directly.
- An identity-aware reverse proxy must validate Microsoft Entra tokens and inject authenticated identity/role headers with `ATOMA_PROXY_SECRET`.
- API handlers fail with 401 when proxy identity is absent/invalid in production mode.
- API permission checks enforce upload, delete, report, audit, and export capabilities.
- Division Manager row-level filtering and Viewer PII masking happen server-side before records are returned.
- Security headers include CSP, frame denial, MIME sniffing prevention, restricted referrer and permissions policies.
- Uploads are bounded, selected field-by-field, sanitized, and canonicalized server-side.
- Audit events record user, role, category, action, IP, and timestamp.
- Demo role cookies are explicitly non-production behavior.

## 6. Non-functional requirements

- TypeScript strict mode.
- Production build and `/api/health` must pass.
- Filtering and core analytics should remain interactive with 10,000 records.
- Charts lazy-mount near viewport.
- Directory rows are virtualized.
- Production runtime dependency audit target: zero known vulnerabilities.
- Accessibility: keyboard focus, labels, semantic controls, sufficient contrast, reduced motion.
- No hardcoded secrets.

## 7. Acceptance criteria

- Excel/CSV round-trip maps expected fields and dates.
- All 34 GeoJSON names exactly match canonical province names.
- All documented Latin and native aliases map to the correct province.
- Demo dataset has 100% province mapping.
- Division Manager API receives only their division.
- Viewer PII is masked by the API.
- Unauthorized mutation and audit requests return 403; unauthenticated production requests return 401.
- Personalization survives refresh and hidden widgets leave no empty grid cells.
- ESLint, Next typegen, TypeScript, production build, production-only audit, and runtime health check pass.

## 8. Known production integration work

- Connect a real Entra OIDC/token-validating proxy or Auth.js callback; demo login is not authentication.
- Connect scheduled report delivery to a queue/mail service.
- For very large datasets or many concurrent tenants, normalize employee JSONB arrays into indexed relational rows/materialized aggregates.
- Establish backup, retention, monitoring, and incident-response processes.
