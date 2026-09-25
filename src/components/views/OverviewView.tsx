"use client";

import {
  Award, BadgeCheck, Briefcase, Building2, Cake, CalendarCheck, CalendarPlus, Camera, FileDown, Flag, Globe, GraduationCap, Heart, Hourglass, House, LayoutDashboard, Layers, MapPin, Mars, Network, Scale, SlidersHorizontal, UserRound, Users, Venus,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { ageDistribution, computeKpis, countBy, hiresComparison, hiringTrend, type Kpis, kpiSeries, memo, monthlyHires, topN } from "@/lib/analytics";
import { availableOptions } from "@/lib/filters";
import { fmtDate, fmtNum, fmtPct, pctChange } from "@/lib/format";
import { executiveSummary, insightBox } from "@/lib/insights";
import type { MultiKey } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { DashboardCustomizer, HiddenDashboardState, type DashboardWidget, useDashboardLayout } from "../dashboard/DashboardCustomizer";
import { ChartCard } from "../charts/ChartCard";
import type { ChartClick } from "../charts/EChart";
import { barOption, donutOption, mapOption, pyramidOption, treemapOption, trendOption } from "../charts/options";
import { useChartTokens } from "../charts/tokens";
import { KpiCard, type KpiCardProps, type Trend } from "../kpi/KpiCard";
import { DataGate } from "../shell/Chrome";
import { runExport } from "../shell/Topbar";
import { MultiSelect } from "../ui/MultiSelect";
import { Button, PageHeader } from "../ui/primitives";
import { InsightBox } from "./InsightBox";

const OVERVIEW_PAGE = "executive-overview";

const OVERVIEW_KPIS = [
  ["kpi-total", "Total Employees"], ["kpi-male", "Male Employees"], ["kpi-female", "Female Employees"], ["kpi-gender-ratio", "Gender Ratio"],
  ["kpi-local", "Local Staff"], ["kpi-expat", "Expat Staff"], ["kpi-age", "Average Age"], ["kpi-tenure", "Average Tenure"],
  ["kpi-married", "Married Employees"], ["kpi-single", "Single Employees"], ["kpi-divisions", "Divisions"], ["kpi-departments", "Departments"],
  ["kpi-stations", "Duty Stations"], ["kpi-nationalities", "Nationalities"], ["kpi-span", "Average Span of Control"], ["kpi-joined-year", "Joined This Year"],
  ["kpi-joined-month", "Joined This Month"], ["kpi-bachelor", "Bachelor Degree+"], ["kpi-master", "Master Degree+"], ["kpi-phd", "PhD Holders"],
] as const;

const OVERVIEW_WIDGETS: DashboardWidget[] = [
  { id: "quick-filters", label: "Quick filter bar", group: "Controls", description: "Division, department, title, gender and station slicers", essential: true },
  ...OVERVIEW_KPIS.map(([id, label], index) => ({ id, label, group: "Executive KPI cards", description: "Animated KPI, trend and sparkline", essential: index === 0 || id === "kpi-female" || id === "kpi-age" || id === "kpi-tenure" })),
  { id: "visual-division", label: "Division headcount", group: "Dashboard visuals", essential: true },
  { id: "visual-insights", label: "Executive insight box", group: "Dashboard visuals", essential: true },
  { id: "visual-hiring", label: "Monthly hiring trend", group: "Dashboard visuals", essential: true },
  { id: "visual-gender", label: "Gender distribution", group: "Dashboard visuals", essential: true },
  { id: "visual-map", label: "Afghanistan province map", group: "Dashboard visuals" },
  { id: "visual-age", label: "Age pyramid", group: "Dashboard visuals" },
  { id: "visual-qualification", label: "Qualification mix", group: "Dashboard visuals" },
];

const QUICK: { key: MultiKey; label: string; icon: React.ReactNode }[] = [
  { key: "division", label: "Division", icon: <Building2 /> },
  { key: "department", label: "Department", icon: <Layers /> },
  { key: "title", label: "Title", icon: <Briefcase /> },
  { key: "gender", label: "Gender", icon: <Users /> },
  { key: "dutyStation", label: "Duty Station", icon: <MapPin /> },
];

export function QuickSlicers() {
  const employees = useDataStore((s) => s.employees);
  const filters = useDataStore((s) => s.filters);
  const setFilter = useDataStore((s) => s.setFilter);
  const setPane = useUIStore((s) => s.setFilterPane);
  const opts = useMemo(() => Object.fromEntries(QUICK.map((q) => [q.key, availableOptions(employees, filters, q.key)])), [employees, filters]);
  return (
    <div className="glass animate-fade-up relative z-20 mb-5 rounded-2xl p-3" data-no-capture="true">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {QUICK.map((q) => (
          <MultiSelect key={q.key} label={q.label} icon={q.icon} options={opts[q.key]} selected={filters[q.key]} onChange={(v) => setFilter(q.key, v)} />
        ))}
        <Button variant="soft" className="h-10" onClick={() => setPane(true)}>
          <SlidersHorizontal /> All filters
        </Button>
      </div>
    </div>
  );
}

function OverviewInner() {
  const filtered = useDataStore((s) => s.filtered);
  const now = useDataStore((s) => s.now);
  const dataset = useDataStore((s) => s.dataset);
  const filters = useDataStore((s) => s.filters);
  const toggle = useDataStore((s) => s.toggleValue);
  const patch = useDataStore((s) => s.patchFilters);
  const layout = useDashboardLayout(OVERVIEW_PAGE);
  const t = useChartTokens();

  const k = useMemo(() => memo(filtered, "kpis", () => computeKpis(filtered, now, now)), [filtered, now]);
  const series = useMemo(() => memo(filtered, "series12", () => kpiSeries(filtered, now, 12)), [filtered, now]);
  const hires = useMemo(() => monthlyHires(filtered, now, 12), [filtered, now]);
  const cmp = useMemo(() => hiresComparison(filtered, now), [filtered, now]);
  const box = useMemo(() => insightBox(filtered, now), [filtered, now]);
  const narrative = useMemo(() => executiveSummary(filtered, now)[0], [filtered, now]);
  const divs = useMemo(() => countBy(filtered, (e) => e.division), [filtered]);
  const genders = useMemo(() => countBy(filtered, (e) => e.gender), [filtered]);
  const trend = useMemo(() => hiringTrend(filtered, now, 24), [filtered, now]);
  const ages = useMemo(() => ageDistribution(filtered), [filtered]);
  const quals = useMemo(() => countBy(filtered, (e) => e.qualificationGroup), [filtered]);
  const provinces = useMemo(() => countBy(filtered, (e) => e.province).filter((p) => p.name !== "Unknown"), [filtered]);

  const S = series.series;
  const first = S[0];
  const last = S[S.length - 1];
  const sp = (f: (x: Kpis) => number) => S.map(f);
  const tr = (f: (x: Kpis) => number, polarity: Trend["polarity"], label = "vs 12m ago"): Trend => ({ pct: pctChange(f(last), f(first)), polarity, label });
  const share = (n: number) => (k.total ? fmtPct((n / k.total) * 100) : "—");

  const cards: (KpiCardProps & { id: string })[] = [
    { id: "kpi-total", label: "Total Employees", value: k.total, icon: Users, accent: ["#0D47A1", "#00A8FF"], spark: sp((x) => x.total), trend: tr((x) => x.total, "up-good"), sub: `${fmtNum(k.supervisors)} people leaders`, tooltip: "Headcount in the current selection. Trend = point-in-time headcount 12 months ago (from joining dates)." },
    { id: "kpi-male", label: "Male Employees", value: k.male, icon: Mars, accent: ["#1E3A8A", "#3B82F6"], spark: sp((x) => x.male), trend: tr((x) => x.male, "neutral"), sub: `${share(k.male)} of workforce`, onClick: () => toggle("gender", "Male") },
    { id: "kpi-female", label: "Female Employees", value: k.female, icon: Venus, accent: ["#9D174D", "#F472B6"], spark: sp((x) => x.female), trend: tr((x) => x.female, "up-good"), sub: `${share(k.female)} of workforce`, onClick: () => toggle("gender", "Female") },
    { id: "kpi-gender-ratio", label: "Gender Ratio", value: k.genderRatio, format: (n) => (isFinite(n) ? `${n.toFixed(1)} : 1` : "—"), icon: Scale, accent: ["#6D28D9", "#A78BFA"], spark: sp((x) => x.femalePct), trend: tr((x) => x.femalePct, "up-good", "female share"), sub: "male : female", tooltip: "Number of male employees per female employee." },
    { id: "kpi-local", label: "Local Staff", value: k.local, icon: House, accent: ["#047857", "#34D399"], spark: sp((x) => x.local), trend: tr((x) => x.local, "up-good"), sub: `${share(k.local)} nationalization`, onClick: () => toggle("expatLocal", "Local") },
    { id: "kpi-expat", label: "Expat Staff", value: k.expat, icon: Globe, accent: ["#0E7490", "#22D3EE"], spark: sp((x) => x.expat), trend: tr((x) => x.expat, "neutral"), sub: `${share(k.expat)} of workforce`, onClick: () => toggle("expatLocal", "Expat") },
    { id: "kpi-age", label: "Average Age", value: k.avgAge, format: (n) => n.toFixed(1), icon: Cake, accent: ["#B45309", "#FBBF24"], spark: sp((x) => x.avgAge), trend: tr((x) => x.avgAge, "neutral"), sub: "years", tooltip: "Mean age computed from date of birth (or Age column)." },
    { id: "kpi-tenure", label: "Average Tenure", value: k.avgTenure, format: (n) => n.toFixed(1), icon: Hourglass, accent: ["#0D47A1", "#60A5FA"], spark: sp((x) => x.avgTenure), trend: tr((x) => x.avgTenure, "up-good"), sub: "years of service" },
    { id: "kpi-married", label: "Married Employees", value: k.married, icon: Heart, accent: ["#BE123C", "#FB7185"], spark: sp((x) => x.married), trend: tr((x) => x.married, "neutral"), sub: share(k.married), onClick: () => toggle("maritalStatus", "Married") },
    { id: "kpi-single", label: "Single Employees", value: k.single, icon: UserRound, accent: ["#7C3AED", "#C4B5FD"], spark: sp((x) => x.single), trend: tr((x) => x.single, "neutral"), sub: share(k.single), onClick: () => toggle("maritalStatus", "Single") },
    { id: "kpi-divisions", label: "Divisions", value: k.divisions, icon: Building2, accent: ["#062B5B", "#0D47A1"], spark: sp((x) => x.divisions), trend: tr((x) => x.divisions, "neutral"), sub: `${fmtNum(k.total / Math.max(1, k.divisions), 1)} avg headcount` },
    { id: "kpi-departments", label: "Departments", value: k.departments, icon: Layers, accent: ["#1D4ED8", "#38BDF8"], spark: sp((x) => x.departments), trend: tr((x) => x.departments, "neutral"), sub: `${fmtNum(k.total / Math.max(1, k.departments), 1)} avg size` },
    { id: "kpi-stations", label: "Duty Stations", value: k.dutyStations, icon: MapPin, accent: ["#0F766E", "#2DD4BF"], spark: sp((x) => x.dutyStations), trend: tr((x) => x.dutyStations, "up-good"), sub: `${provinces.length} provinces covered` },
    { id: "kpi-nationalities", label: "Nationalities", value: k.nationalities, icon: Flag, accent: ["#9333EA", "#E879F9"], spark: sp((x) => x.nationalities), trend: tr((x) => x.nationalities, "up-good"), sub: "distinct nationalities" },
    { id: "kpi-span", label: "Avg Span of Control", value: k.avgSpan, format: (n) => n.toFixed(1), icon: Network, accent: ["#334155", "#94A3B8"], spark: sp((x) => x.avgSpan), trend: tr((x) => x.avgSpan, "neutral"), sub: "direct reports per supervisor", tooltip: "Employees with a supervisor ÷ number of distinct supervisors." },
    { id: "kpi-joined-year", label: "Joined This Year", value: k.joinedThisYear, icon: CalendarPlus, accent: ["#15803D", "#4ADE80"], spark: hires.hires, trend: { pct: pctChange(k.joinedThisYear, cmp.ytdLastYear), polarity: "up-good", label: "vs same period LY" }, sub: `${new Date(now).getUTCFullYear()} year-to-date`, onClick: () => patch({ joinFrom: `${new Date(now).getUTCFullYear()}-01-01`, joinTo: "" }) },
    { id: "kpi-joined-month", label: "Joined This Month", value: k.joinedThisMonth, icon: CalendarCheck, accent: ["#16A34A", "#86EFAC"], spark: hires.hires, trend: { pct: pctChange(k.joinedThisMonth, cmp.mtdLastMonth), polarity: "up-good", label: "vs last month" }, sub: "new joiners" },
    { id: "kpi-bachelor", label: "Bachelor Degree+", value: k.bachelorPlus, icon: GraduationCap, accent: ["#0D47A1", "#00A8FF"], spark: sp((x) => x.bachelorPlus), trend: tr((x) => x.bachelorPlus, "up-good"), sub: `${share(k.bachelorPlus)} of workforce` },
    { id: "kpi-master", label: "Master Degree+", value: k.masterPlus, icon: Award, accent: ["#4338CA", "#818CF8"], spark: sp((x) => x.masterPlus), trend: tr((x) => x.masterPlus, "up-good"), sub: `${share(k.masterPlus)} of workforce`, onClick: () => toggle("qualification", "Master") },
    { id: "kpi-phd", label: "PhD Holders", value: k.phd, icon: BadgeCheck, accent: ["#A16207", "#FACC15"], spark: sp((x) => x.phd), trend: tr((x) => x.phd, "up-good"), sub: `${share(k.phd)} of workforce`, onClick: () => toggle("qualification", "PhD") },
  ];

  const divOption = useMemo(() => barOption(divs, t, { selected: filters.division, rotate: divs.length > 6 ? 20 : 0 }), [divs, t, filters.division]);
  const genderOption = useMemo(() => donutOption(genders, t, { selected: filters.gender, colors: genders.map((g) => (g.name === "Female" ? t.female : g.name === "Male" ? t.male : t.muted)) }), [genders, t, filters.gender]);
  const trendOpt = useMemo(() => trendOption(trend.labels, trend.hires, trend.cumulative, t), [trend, t]);
  const pyramid = useMemo(() => pyramidOption(ages.labels, ages.male, ages.female, t), [ages, t]);
  const qualOpt = useMemo(() => treemapOption(quals, t, { selected: filters.qualification }), [quals, t, filters.qualification]);
  const mapOpt = useMemo(() => mapOption(provinces, t, { selected: filters.province[0] ?? null, compact: true }), [provinces, t, filters.province]);

  const click = (key: MultiKey) => (p: ChartClick) => p.name && toggle(key, p.name);

  const visibleCards = cards.filter((card) => layout.visible(card.id));
  const visualIds = ["visual-division", "visual-insights", "visual-hiring", "visual-gender", "visual-map", "visual-age", "visual-qualification"];
  const hasAnything = layout.visible("quick-filters") || visibleCards.length > 0 || layout.visibleCount(visualIds) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Executive Overview"
        title="Workforce at a glance"
        icon={<LayoutDashboard />}
        subtitle={
          <>
            Snapshot as of <b className="text-fg">{fmtDate(new Date(now).toISOString())}</b> · {dataset?.name}
          </>
        }
        actions={
          <>
            <DashboardCustomizer page={OVERVIEW_PAGE} title="Executive Overview" widgets={OVERVIEW_WIDGETS} />
            <Button onClick={() => runExport("snapshot", "Executive Overview")}>
              <Camera /> Snapshot
            </Button>
            <Button variant="primary" onClick={() => runExport("pdf", "Executive Overview")}>
              <FileDown /> Export PDF
            </Button>
          </>
        }
      />
      {!hasAnything && <HiddenDashboardState page={OVERVIEW_PAGE} title="Executive Overview" widgets={OVERVIEW_WIDGETS} />}
      {layout.visible("quick-filters") && <QuickSlicers />}
      {visibleCards.length > 0 && (
        <div className="grid grid-flow-row-dense grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visibleCards.map((card, index) => (
            <KpiCard key={card.id} {...card} index={index} />
          ))}
        </div>
      )}

      {layout.visibleCount(visualIds) > 0 && (
        <div className="mt-5 grid grid-flow-row-dense gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {layout.visible("visual-division") && (
            <ChartCard className="xl:col-span-2" title="Workforce Distribution by Division" subtitle="Click a bar to cross-filter the dashboard" interactive option={divOption} onClick={click("division")} height={330} table={{ columns: ["Division", "Headcount", "Share %"], rows: divs.map((d) => [d.name, d.value, (d.value / k.total) * 100]) }} />
          )}
          {layout.visible("visual-insights") && <InsightBox items={box.slice(0, 6)} narrative={narrative} />}
          {layout.visible("visual-hiring") && (
            <ChartCard className="xl:col-span-2" title="Monthly Hiring Trend" subtitle="New joiners per month vs cumulative headcount (24 months)" option={trendOpt} height={300} table={{ columns: ["Month", "Hires", "Headcount"], rows: trend.labels.map((l, i) => [l, trend.hires[i], trend.cumulative[i]]) }} />
          )}
          {layout.visible("visual-gender") && <ChartCard title="Gender Distribution" subtitle="Click a segment to filter" interactive option={genderOption} onClick={click("gender")} height={300} />}
          {layout.visible("visual-map") && (
            <ChartCard
              title="Province Headcount"
              subtitle="Darker = more employees · click to filter"
              interactive
              needsMap
              option={mapOpt}
              onClick={(p) => p.name && toggle("province", p.name)}
              height={300}
              footer={
                <Link href="/map" className="text-[12px] font-semibold text-primary hover:underline dark:text-accent">
                  Open Afghanistan workforce map →
                </Link>
              }
            />
          )}
          {layout.visible("visual-age") && <ChartCard title="Age Pyramid" subtitle="Male vs female by age band" option={pyramid} height={300} />}
          {layout.visible("visual-qualification") && <ChartCard title="Qualification Mix" subtitle="Highest qualification group" interactive option={qualOpt} onClick={click("qualification")} height={300} table={{ columns: ["Qualification", "Employees"], rows: topN(quals, 10).map((q) => [q.name, q.value]) }} />}
        </div>
      )}
    </>
  );
}

export default function OverviewView() {
  return (
    <DataGate>
      <OverviewInner />
    </DataGate>
  );
}
