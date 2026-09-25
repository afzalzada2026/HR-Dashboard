# ATOMA Workforce Intelligence — Project Memory

This file is a concise handoff for future maintainers and AI coding sessions. Read it with `PRD.md`, `ARCHITECTURE.md`, `RULES.md`, and `DESIGN.md` before changing behavior.

## Product identity

- Company: ATOMA.
- Product: enterprise HR Workforce Analytics & Intelligence Portal.
- Brand: `#062B5B`, `#0D47A1`, `#00A8FF`, white, `#F4F8FC`.
- Product language is English; Afghan location input supports English transliterations plus Dari/Pashto.

## Current architecture

- Next.js App Router + React 19 + strict TypeScript.
- PostgreSQL/Drizzle for centralized datasets, schedules and audit.
- IndexedDB for no-server local mode.
- ECharts for all charts and map.
- Zustand stores:
  - `data.ts`: active dataset, filtered data, filters.
  - `ui.ts`: theme, session, notifications, layout visibility.
- No external AI service: insights and Q&A are deterministic/local.

## Important decisions

1. **Whole dataset on client.** Current analytics are fast for 10k+ records and directory is virtualized. Move aggregates/server paging to PostgreSQL when scale/concurrency requires it.
2. **JSONB dataset records.** One employee array per dataset favors simple replacement and current client analytics. This is not the final multi-million-row design.
3. **Secure SheetJS package.** Use `@e965/xlsx` 0.20.3. Do not reintroduce npm `xlsx@0.18.5` (prototype-pollution/ReDoS advisories).
4. **One chart engine.** ECharts also handles the Afghanistan map; Leaflet/Plotly are intentionally not installed.
5. **Map never guesses.** Unknown province remains Unknown and is counted. Kabul is not a fallback.
6. **Personalization stores hidden IDs.** Default is show all. Key is `<userId>:<page>`; stable IDs are a compatibility contract.
7. **Demo auth is not auth.** Browser cookie supports role demonstrations only. Production uses validated proxy headers and secret.
8. **Role source in production is Entra app roles.** Do not use Entra tenant administrator roles as application permissions.
9. **Remarks-derived HR signals.** Turnover/promotion are inferred only because the source schema lacks authoritative events. Replace when fields become available.
10. **Exports respect security scope and filters.** View snapshots also reflect hidden widgets; structured workbook contains all approved filtered columns.

## Dashboard personalization IDs

### Executive Overview page: `executive-overview`

- `quick-filters`
- `kpi-total`, `kpi-male`, `kpi-female`, `kpi-gender-ratio`
- `kpi-local`, `kpi-expat`, `kpi-age`, `kpi-tenure`
- `kpi-married`, `kpi-single`, `kpi-divisions`, `kpi-departments`
- `kpi-stations`, `kpi-nationalities`, `kpi-span`
- `kpi-joined-year`, `kpi-joined-month`, `kpi-bachelor`, `kpi-master`, `kpi-phd`
- `visual-division`, `visual-insights`, `visual-hiring`, `visual-gender`, `visual-map`, `visual-age`, `visual-qualification`

### Strategic page: `strategic-analytics`

- `metric-growth`, `metric-hiring`, `metric-gender`, `metric-nationality`
- `metric-department`, `metric-management`, `metric-retention`, `metric-turnover`, `metric-promotion`, `metric-reporting`
- `section-insights`, `section-gauges`, `section-signals`, `section-scorecard`
- `visual-growth`, `visual-radar`, `visual-span`, `visual-layers`

### Visual page: `interactive-visuals`

- `division`, `department`, `gender`, `age`, `tenure`, `joining`
- `station`, `qualification`, `nationality`, `marital`, `sunburst`, `supervisor`
- `scatter`, `map`, `heatmap`, `level`, `nationalization`, `blood`

Do not rename IDs without migrating `atoma-ui.hiddenWidgets` preferences.

## Afghanistan map facts

- Canonical count: 34.
- Boundary: `public/geo/afghanistan.json`.
- Canonical dictionary: `src/lib/geo.ts`.
- Corrected boundary names include Ghazni (not Ghanzi), Nimroz (not Nimruz), Sar-e-Pul.
- Mapping priority: region/province → duty station → Unknown.
- `normPlace` handles Unicode NFKC, Persian/Arabic kaf/ya, diacritics, zero-width chars.
- `validateProvinceCoverage()` checks boundary parity.
- `validateEmployeeMapCoverage()` checks normalized employee values.
- Imported data is mapped in the browser and recalculated again by API sanitation.

## Security modes

### Demo/default

- `ATOMA_AUTH_MODE=demo` or unset.
- Role-switch cookie accepted.
- Suitable only for development, demonstrations, and this preview.

### Production/proxy

- `ATOMA_AUTH_MODE=production` or `proxy`.
- Requires `ATOMA_PROXY_SECRET` (minimum 32 chars).
- Required trusted headers documented in `ARCHITECTURE.md`.
- Missing/invalid identity is 401.
- Division Manager without division is 401.
- Proxy must validate Entra token and make Next upstream private.

## Role assignment reminder

Create Entra app-role values exactly:

- `Atoma.HRAdmin`
- `Atoma.HROfficer`
- `Atoma.Executive`
- `Atoma.DivisionManager`
- `Atoma.Viewer`

Assign in Entra **Enterprise applications → ATOMA → Users and groups**. The proxy forwards roles claim. Highest role wins if multiple are present.

## Validation status and commands

Required final sequence:

```bash
npm run lint
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run build
npm audit --omit=dev
# then platform build_and_start and /api/health
```

At the last sanitation pass:

- ESLint: clean.
- TypeScript: clean.
- Production dependency audit: 0 vulnerabilities.
- Full audit: 4 moderate Drizzle Kit development-loader advisories; suggested fix is an unsafe downgrade.

## Known gaps

- Real Entra OIDC/proxy is an infrastructure integration; app-side fail-closed contract is implemented.
- Scheduled email is not connected.
- No committed Vitest/Playwright suite yet; validation uses build/API/domain/chart scripts during development.
- PostgreSQL JSONB model should be normalized for substantially larger/multi-tenant deployments.
- Actual HR exit/promotion events should replace Remarks inference.

## Safe extension checklist

When adding a field/metric/widget:

1. Update types and canonical definitions.
2. Normalize/sanitize server-side.
3. Apply security scope before analytics.
4. Add stable widget ID if customizable.
5. Update exports and docs.
6. Add map aliases/tests if location-related.
7. Run lint, typegen, tsc, build, production audit, startup/health.
