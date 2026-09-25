# ATOMA Workforce Intelligence — Architecture

## 1. System context

```text
Browser
  ├─ Next.js App Router UI (React 19, Tailwind 4, Zustand)
  ├─ ECharts visuals + Afghanistan GeoJSON
  ├─ Local mode: IndexedDB via idb-keyval
  └─ Enterprise mode: JSON API
          │
          ▼
Identity-aware reverse proxy (production only)
  ├─ validates Microsoft Entra token (issuer, audience, signature, expiry)
  ├─ strips all inbound x-atoma-* headers
  └─ injects identity + app roles + proxy secret
          │ private upstream
          ▼
Next.js route handlers
  ├─ fail-closed session resolver
  ├─ RBAC + row-level security + PII masking
  ├─ payload validation/sanitation
  ├─ Drizzle ORM
  └─ audit logging
          │
          ▼
PostgreSQL
  ├─ datasets
  ├─ dataset_records (normalized employee JSONB array)
  ├─ scheduled_reports
  └─ audit_logs
```

## 2. Technology

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript 5 strict |
| Styling | Tailwind CSS 4 + CSS design tokens |
| State | Zustand persistent UI store + in-memory data store |
| Charts/map | ECharts 6; GeoJSON map registration |
| Tables | TanStack Virtual custom enterprise grid |
| Import/export | `@e965/xlsx` (SheetJS CE 0.20.3), PapaParse, jsPDF, AutoTable, html2canvas-pro |
| Database | PostgreSQL, Drizzle ORM |
| Local data | IndexedDB (`idb-keyval`) |
| Icons | Lucide React |

## 3. Source layout

```text
src/
  app/
    (dashboard)/         page routes
    api/                 route handlers
    globals.css          theme/design tokens
  components/
    charts/              ECharts adapter, options, card shell
    dashboard/           persisted widget customization
    employee/            profile drill-through
    kpi/                 KPI counters/sparklines
    shell/               sidebar, topbar, filters, app chrome
    ui/                  reusable primitives
    views/               page-level feature composition
  db/
    index.ts              PostgreSQL pool + Drizzle client
    schema.ts             declarative schema
    ensure.ts             idempotent runtime bootstrap
  lib/
    analytics.ts          pure metrics and group calculations
    demo.ts               deterministic demo workforce
    exporters.ts          CSV/XLSX/PDF/PNG generation
    fields.ts             canonical 29-field dictionary
    filters.ts            compiled filters and cascading options
    geo.ts                34 provinces, aliases, map diagnostics
    insights.ts           deterministic narratives/Q&A
    mapping.ts            header detection and auto-mapping
    normalize.ts          raw row → Employee normalization
    rbac.ts               roles, permissions, RLS and masking
    server.ts             production identity/session boundary
    validation.ts         untrusted API payload sanitation
  store/
    data.ts               active dataset + filter state
    ui.ts                 theme, user, layout, toast persistence
public/geo/afghanistan.json
```

## 4. Data flow

### Import

1. Browser rejects unsupported extensions and files >50 MB.
2. PapaParse reads CSV; secure SheetJS package reads Excel.
3. Header detector checks the first 15 rows.
4. Auto-mapper scores aliases and fuzzy matches.
5. User reviews/overrides mappings.
6. Normalizer derives dates, age, tenure, qualification group, status, manager indicators, and canonical province.
7. Local mode stores employees in IndexedDB.
8. Enterprise mode POSTs canonical records to `/api/datasets`.
9. Server re-selects/sanitizes every field, reclamps numbers, and re-canonicalizes province.
10. Transaction deactivates the previous dataset, inserts metadata + employees, and writes an audit event.

### Analytics

1. Active dataset is fetched and server-side RLS/masking is applied.
2. Data store enriches time-dependent fields and direct-report counts.
3. Filters compile once to fast predicates.
4. Filtered array identity drives memoized analytics.
5. View components build ECharts options.
6. Click events update filters, causing all widgets to recompute.

### Personalization

- Widget definitions use stable IDs.
- UI store key: `<userId>:<page>`.
- Stored value: IDs hidden by that user.
- Hidden components are omitted from React output.
- Responsive dense grids repack visible children automatically.

## 5. PostgreSQL model

### `datasets`
Metadata, mapping, quality report, source, uploader, active flag, timestamps.

### `dataset_records`
One JSONB array per dataset. This optimizes current whole-dataset client analytics and simple replacement. It is not the recommended design for multi-million-row/large multi-tenant deployments.

### `audit_logs`
Append-only application events. Production database policy should deny UPDATE/DELETE to the application role or archive to immutable storage.

### `scheduled_reports`
Schedule definition, status, next/last run, and run counter.

Schema is declared in `src/db/schema.ts`; `src/db/ensure.ts` provides idempotent bootstrap. Production deployments should use controlled Drizzle migrations rather than relying only on runtime DDL.

## 6. Authentication and production role assignment

### Modes

- `ATOMA_AUTH_MODE=demo` (default): browser role cookie and account switcher; development/demo only.
- `ATOMA_AUTH_MODE=production` or `proxy`: browser cookie is ignored; the server requires validated proxy headers.

### Entra app roles

Create these app-role **values** in the ATOMA App Registration:

| Display name | App-role value | Internal role |
|---|---|---|
| HR Admin | `Atoma.HRAdmin` | `hr_admin` |
| HR Officer | `Atoma.HROfficer` | `hr_officer` |
| Executive | `Atoma.Executive` | `executive` |
| Division Manager | `Atoma.DivisionManager` | `division_manager` |
| Viewer | `Atoma.Viewer` | `viewer` |

Allowed member type should be **Users/Groups**. Assign users/groups under **Microsoft Entra admin center → Enterprise applications → ATOMA → Users and groups → Add user/group → Select role → Assign**.

If multiple roles are present, the server selects the highest recognized role in this order: HR Admin, HR Officer, Executive, Division Manager, Viewer.

### Proxy contract

The proxy must remove any browser-provided `x-atoma-*` values, validate the Entra token, then add:

```text
x-atoma-proxy-secret: <ATOMA_PROXY_SECRET>
x-atoma-user-id: <Entra object ID>
x-atoma-user-email: <verified UPN/email>
x-atoma-user-name: <display name>
x-atoma-user-roles: Atoma.Executive[,Atoma.Viewer]
x-atoma-user-division: Operations   # mandatory only for Division Manager
```

Set:

```bash
ATOMA_AUTH_MODE=production
ATOMA_PROXY_SECRET=<cryptographically-random value of at least 32 characters>
AZURE_AD_TENANT_ID=<tenant UUID>
AZURE_AD_CLIENT_ID=<application UUID>
```

The Next.js upstream must accept traffic only from the proxy/private network. A shared header alone is not sufficient if the upstream is internet-accessible.

### Division scope

`Atoma.DivisionManager` also requires a trusted division value. Recommended sources:

1. Entra custom security attribute transformed by the proxy, or
2. one approved division security group mapped by proxy configuration.

Missing division causes a 401 in production. The API filters employee rows before returning JSON.

## 7. Security boundaries

- Route handlers are the authorization boundary; UI hiding is convenience only.
- Production identity does not use the unsigned demo cookie.
- Upload JSON is untrusted and rebuilt field-by-field.
- File/row/body limits reduce resource exhaustion.
- React escapes displayed strings; spreadsheet exports additionally neutralize formulas.
- CSP denies external scripts/frames/objects.
- Secrets stay server-side.
- `/api/health` is intentionally public and only reports `{ok}`.

## 8. Afghanistan map architecture

- Boundary source: geoBoundaries AFG ADM1 simplified geometry (34 features), stored locally.
- Feature names are normalized to canonical product names (e.g. Ghazni, Nimroz, Sar-e-Pul).
- `validateProvinceCoverage()` asserts exact feature/dictionary parity.
- `matchProvince()` supports Latin variations, capital/duty-station names, combined free text, and Dari/Pashto script.
- Server sanitation re-runs mapping even if the client sent a province.
- `validateEmployeeMapCoverage()` reports mapped, unknown, invalid canonical values, and percentage.
- Unknown records are not colored into an incorrect province; they remain visible in data quality and map coverage counts.

## 9. Performance

- ECharts is dynamically imported.
- Charts mount within a 300 px viewport margin.
- Directory renders only visible rows.
- Filtering is predicate-compiled.
- Derived calculations use array-identity memoization.
- GeoJSON is ~65 KB after coordinate simplification.
- A 10,000-record demo generation + normalization is expected in sub-second to low-second range on modern desktop hardware.

## 10. Scaling path

For 150,000+ rows or multi-tenant concurrency:

1. Move employee records into an indexed relational table partitioned by tenant/dataset.
2. Execute RLS and aggregate queries in PostgreSQL.
3. Add materialized workforce cubes and cache invalidation.
4. Paginate directory server-side.
5. Queue import validation and scheduled report generation.
6. Store generated reports in encrypted object storage with expiring signed links.
