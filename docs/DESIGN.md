# ATOMA Workforce Intelligence — Design System

## Product character

Executive, analytical, modern, and calm. Combine Power BI density with Workday/SAP HR polish. Decisions and exceptions take priority over decoration.

## Brand and semantic color

- Navy `#062B5B`: navigation, hierarchy, report headers.
- Blue `#0D47A1`: primary action and primary series.
- Bright blue `#00A8FF`: active, focus, selection.
- White `#FFFFFF`: surfaces/on-brand text.
- Canvas `#F4F8FC`: light background.
- Green = positive; amber = watch; red = risk; pink = female; blue = male.

Tokens are defined in `src/app/globals.css` for Light, Dark, and ATOMA modes.

## Typography

Segoe UI Variable/Text with system fallback. Page title 20–24 px bold; card title 14–15 px semibold; KPI value ~26 px bold; body 12–14 px; overlines 10–11 px uppercase. Metrics use tabular numerals.

## Layout and reflow

- Sidebar: 264 px / 76 px collapsed.
- Content max: 1680 px.
- Dashboard gaps: 12–16 px.
- Responsive cards: 1 → 2/3 → 4/5 columns.
- Visuals: 1 → 2 → 3 columns.
- Customizable grids use `grid-flow-row-dense`; hidden items are removed from DOM and remaining items close gaps.
- Wide visual cards may span two XL columns.

## Dashboard customization

- Customize control in page actions.
- Per-user/page immediate persistence.
- Show All, Essentials, Hide All, group toggles, individual toggles, Reset Default.
- Eye state + accessible switch on each row.
- Hidden/visible count is always shown.
- All-hidden state must provide obvious recovery.
- Snapshot/PDF/PNG view captures reflect the visible layout.

## Surfaces and controls

- Normal cards: `glass`, 16 px radius.
- Modal/popover/drawer: `glass-strong`.
- Controls: 8–12 px radius, 36–44 px height.
- Hover lift no more than 3 px.
- Visible bright-blue focus ring.

## KPI cards

Top accent, compact uppercase label, definition tooltip, animated value, gradient icon tile, trend badge, context, and sparkline. Click only when filtering intent is explicit.

## Charts

Shared ECharts tokens; subtle grids; high-contrast data; rounded tooltips; count + percentage where helpful. Interactive subtitles explain click behavior. Chart cards provide focus, PNG, and table mode. Lazy mount near viewport.

## Afghanistan map

Sequential theme-aware blue intensity; neutral unstaffed provinces; white/navy boundaries; amber selected province and station markers. Show mapping coverage and unknown count. Never visually assign unknown employees to a fallback province.

## Organization charts

Divisional organograms follow the approved landscape convention: levels are horizontal rows (amber rail at the left with the level code, count and band name), branches spread left-to-right, and orthogonal bus connectors run in the gap between bands. Position cards are deliberately minimal for print legibility: **bold position title on top, employee name beneath**, a slim level-colour stripe, and only a small TEMP/VACANT badge — type is large relative to the card and cards/gaps are compact so the sheet scales down far less. The level rail shows the band name in bold (L6, L3H, L3 …) with a small filled circle beneath holding that level’s headcount. Band heights are flexible and follow the tallest card in the row (roster cards make their band taller). Roster cards group five or more leaf reports in 2/3/4 columns. Even branch sets reserve a centre aisle so four reports sit two left / two right. Rows may repeat a level (“cont.”) and the top row is simply the top level present in scope. Dashed amber cards/lines mark inferred links, dotted cards mark vacancies, yellow marks temporary/contract staff, and lateral staff officers (Secretary/Assistant) sit beside their manager. Legend always includes Filled post, Vacant post, Temporary/contract, Inferred line and Level band, with the “Made with ♥ by Mohibullah Afzalzada” credit. Level bands are flexible — a dense band wraps into several rows and simply becomes taller (≈8 cards per row), keeping sheets near A3 proportions for print. Reports sit in one centred row under their manager (two left / two right for a team of four); oversized teams collapse into dashed “+N more” cards. Divisions over 80 people render per-department sheets, each headed by the division head. The whole-workforce view keeps the interactive expandable tree. Organogram export is vector first: single-page PDF scaling A4→A0, editable SVG, high-res PNG and one-page print — every sheet carries the ATOMA chevron mark and a printed legend (filled post, vacant post, temporary/contract, level band). In multi-page PDFs the blue ATOMA band appears on page one only.

## Tables

Sticky header/frozen first column, 52 px employee rows, global + column search, virtualized rows, horizontal overflow for selected columns, hover indicating profile drill-through.

## Motion

300–550 ms entrances, ~1.1 s KPI counting, ~850 ms charts. Animation fill mode must not block hover transforms. Respect `prefers-reduced-motion`.

## Accessibility

Every icon action has a label/tooltip. Info tooltips render through a body portal so card overflow cannot clip them; they open on hover, keyboard focus and tap, and wrap up to 340 px. Dialog semantics and Escape close. Switch semantics. Enter/Space support for interactive rows. Avoid color-only status. Provide chart table alternatives. Preserve contrast in all themes.

## Export styling

ATOMA navy header, bright blue accent line, title/dataset/scope/user/timestamp, and confidential footer. Captures wait for charts/fonts, use full scroll dimensions, disable animation, and render at a canvas-safe high-DPI scale. Dashboard PDFs use lossless PNG slices instead of JPEG to preserve labels and fine chart detail. Structured Excel remains independent of display personalization and follows approved filter/security scope.
