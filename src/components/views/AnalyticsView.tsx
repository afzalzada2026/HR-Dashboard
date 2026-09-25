"use client";

import { Activity, ArrowUpRight, Building, GitBranch, Globe2, Info, Percent, Repeat, Scale, Target, TrendingUp, UserMinus, UserPlus, Users } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { groupStats, layerDistribution, memo, spanDistribution, strategicMetrics, yearlyHires } from "@/lib/analytics";
import { cn, fmtNum, fmtPct } from "@/lib/format";
import { generateInsights, insightBox } from "@/lib/insights";
import { useDataStore } from "@/store/data";
import { ChartCard } from "../charts/ChartCard";
import { DashboardCustomizer, HiddenDashboardState, type DashboardWidget, useDashboardLayout } from "../dashboard/DashboardCustomizer";
import { barOption, comboYearOption, gaugesOption, histogramOption, radarOption } from "../charts/options";
import { useChartTokens } from "../charts/tokens";
import { DataGate } from "../shell/Chrome";
import { Badge, Card, CardTitle, PageHeader, ProgressBar, Tooltip } from "../ui/primitives";
import { InsightBox } from "./InsightBox";

type Status = "Healthy" | "Watch" | "Risk" | "Info";

const ANALYTICS_PAGE = "strategic-analytics";
const STRATEGIC_METRICS = [
  ["metric-growth", "Headcount Growth"], ["metric-hiring", "Hiring Rate"], ["metric-gender", "Gender Diversity Index"],
  ["metric-nationality", "Nationality Diversity Index"], ["metric-department", "Average Department Size"], ["metric-management", "Management Ratio"],
  ["metric-retention", "Retention Rate"], ["metric-turnover", "Turnover Rate"], ["metric-promotion", "Promotion Ratio"], ["metric-reporting", "Average Reporting Line"],
] as const;
const ANALYTICS_WIDGETS: DashboardWidget[] = [
  ...STRATEGIC_METRICS.map(([id, label], index) => ({ id, label, group: "Strategic metric cards", essential: index < 3 || id === "metric-retention" || id === "metric-turnover" })),
  { id: "section-insights", label: "Executive insight box", group: "Intelligence", essential: true },
  { id: "section-gauges", label: "Diversity & retention gauges", group: "Intelligence", essential: true },
  { id: "section-signals", label: "Key strategic signals", group: "Intelligence" },
  { id: "section-scorecard", label: "Division scorecard", group: "Organization", essential: true },
  { id: "visual-growth", label: "Headcount growth by year", group: "Organization" },
  { id: "visual-radar", label: "Division capability radar", group: "Organization" },
  { id: "visual-span", label: "Span of control distribution", group: "Organization" },
  { id: "visual-layers", label: "Management layers", group: "Organization" },
];

function StrategicTile({ icon, label, value, context, status, formula, progress, index }: { icon: ReactNode; label: string; value: string; context: string; status: Status; formula: string; progress?: number; index: number }) {
  const tone = status === "Healthy" ? "success" : status === "Watch" ? "warning" : status === "Risk" ? "danger" : "primary";
  return (
    <div className="glass hover-lift animate-fade-up relative overflow-hidden rounded-2xl p-4" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-brand-700 to-brand-400 text-white shadow-md [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-1">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
        <Tooltip content={formula}>
          <Info className="h-3 w-3 text-subtle" />
        </Tooltip>
      </div>
      <p className="mt-1 text-[26px] leading-none font-bold tracking-tight text-fg tabular-nums">{value}</p>
      <p className="mt-2 text-[11.5px] text-muted">{context}</p>
      {progress !== undefined && <ProgressBar value={progress} className="mt-2.5" />}
    </div>
  );
}

function Scorecard() {
  const filtered = useDataStore((s) => s.filtered);
  const now = useDataStore((s) => s.now);
  const toggle = useDataStore((s) => s.toggleValue);
  const rows = useMemo(() => groupStats(filtered, (e) => e.division, now), [filtered, now]);
  const max = Math.max(1, ...rows.map((r) => r.headcount));
  const heat = (v: number, lo: number, hi: number, good: "high" | "low") => {
    const p = Math.max(0, Math.min(1, (v - lo) / Math.max(0.0001, hi - lo)));
    const g = good === "high" ? p : 1 - p;
    return g > 0.66 ? "text-success" : g > 0.33 ? "text-warning" : "text-danger";
  };
  return (
    <Card className="animate-fade-up overflow-hidden">
      <CardTitle icon={<Building />} title="Division Scorecard" subtitle="Power BI-style matrix with conditional formatting · click a row to filter" />
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead>
            <tr className="border-y border-line bg-surface-muted text-[10.5px] tracking-wider text-muted uppercase">
              {["Division", "Headcount", "Female %", "Avg Age", "Avg Tenure", "Hires 12m", "Growth", "Expat %", "Degree %", "Managers", "Age 55+"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-semibold whitespace-nowrap first:pl-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} onClick={() => toggle("division", r.name)} className="cursor-pointer border-b border-line transition-colors hover:bg-surface-muted">
                <td className="px-4 py-2.5 pl-5 font-semibold text-fg">{r.name}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-linear-to-r from-brand-700 to-brand-400" style={{ width: `${(r.headcount / max) * 100}%` }} />
                    </div>
                    <span className="font-semibold text-fg tabular-nums">{fmtNum(r.headcount)}</span>
                  </div>
                </td>
                <td className={cn("px-4 py-2.5 font-semibold tabular-nums", heat(r.femalePct, 10, 45, "high"))}>{fmtPct(r.femalePct)}</td>
                <td className="px-4 py-2.5 text-fg tabular-nums">{r.avgAge.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-fg tabular-nums">{r.avgTenure.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-fg tabular-nums">{fmtNum(r.hires12m)}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-0.5 font-semibold text-success tabular-nums">
                    <ArrowUpRight className="h-3 w-3" />
                    {fmtPct(r.growth)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-fg tabular-nums">{fmtPct(r.expatPct)}</td>
                <td className={cn("px-4 py-2.5 font-semibold tabular-nums", heat(r.degreePct, 30, 90, "high"))}>{fmtPct(r.degreePct)}</td>
                <td className="px-4 py-2.5 text-fg tabular-nums">{fmtNum(r.managers)}</td>
                <td className={cn("px-4 py-2.5 font-semibold tabular-nums", heat(r.retirementRisk / r.headcount, 0.01, 0.1, "low"))}>{fmtNum(r.retirementRisk)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function AnalyticsInner() {
  const filtered = useDataStore((s) => s.filtered);
  const now = useDataStore((s) => s.now);
  const layout = useDashboardLayout(ANALYTICS_PAGE);
  const t = useChartTokens();
  const s = useMemo(() => memo(filtered, "strategic", () => strategicMetrics(filtered, now)), [filtered, now]);
  const box = useMemo(() => insightBox(filtered, now), [filtered, now]);
  const insights = useMemo(() => memo(filtered, "insights", () => generateInsights(filtered, now)), [filtered, now]);
  const years = useMemo(() => yearlyHires(filtered, now, 10), [filtered, now]);
  const span = useMemo(() => spanDistribution(filtered), [filtered]);
  const layers = useMemo(() => layerDistribution(filtered), [filtered]);
  const divs = useMemo(() => groupStats(filtered, (e) => e.division, now).slice(0, 4), [filtered, now]);

  const st = (ok: boolean, watch: boolean): Status => (ok ? "Healthy" : watch ? "Watch" : "Risk");
  const tiles = [
    { id: "metric-growth", icon: <TrendingUp />, label: "Headcount Growth", value: s.headcountGrowth === null ? "—" : `${s.headcountGrowth >= 0 ? "+" : ""}${s.headcountGrowth.toFixed(1)}%`, context: `${fmtNum(s.headcount12mAgo)} → ${fmtNum(s.headcount)} over 12 months`, status: st((s.headcountGrowth ?? 0) > 0, (s.headcountGrowth ?? 0) === 0), formula: "(Current headcount − headcount 12 months ago) ÷ headcount 12 months ago. Point-in-time headcount is reconstructed from joining dates." },
    { id: "metric-hiring", icon: <UserPlus />, label: "Hiring Rate", value: fmtPct(s.hiringRate), context: `${fmtNum(s.hires12m)} hires in the last 12 months`, status: "Info" as Status, formula: "Employees hired in the last 12 months ÷ current headcount.", progress: s.hiringRate },
    { id: "metric-gender", icon: <Scale />, label: "Gender Diversity Index", value: `${s.genderDiversityIndex.toFixed(0)}/100`, context: "100 = perfect gender balance", status: st(s.genderDiversityIndex >= 80, s.genderDiversityIndex >= 50), formula: "Normalized Blau index: (1 − Σpᵢ²) ÷ 0.5 × 100 across genders.", progress: s.genderDiversityIndex },
    { id: "metric-nationality", icon: <Globe2 />, label: "Nationality Diversity Index", value: `${s.nationalityDiversityIndex.toFixed(0)}/100`, context: "Probability two employees differ in nationality", status: "Info" as Status, formula: "Blau index (1 − Σpᵢ²) × 100 across nationalities.", progress: s.nationalityDiversityIndex },
    { id: "metric-department", icon: <Users />, label: "Average Department Size", value: s.avgDeptSize.toFixed(1), context: "employees per department", status: st(s.avgDeptSize >= 8 && s.avgDeptSize <= 80, s.avgDeptSize < 120), formula: "Headcount ÷ number of distinct departments." },
    { id: "metric-management", icon: <GitBranch />, label: "Management Ratio", value: `1 : ${s.managementRatio.toFixed(1)}`, context: `${fmtNum(s.managers)} managers · ${fmtPct(s.managerPct)} of staff`, status: st(s.managementRatio >= 5 && s.managementRatio <= 12, s.managementRatio >= 3), formula: "Non-managers ÷ managers. Managers = employees with direct reports, management titles or level ≥ L6." },
    { id: "metric-retention", icon: <Repeat />, label: "Retention Rate", value: fmtPct(s.retentionRate), context: "share of workforce not flagged as exiting", status: st(s.retentionRate >= 92, s.retentionRate >= 85), formula: "100% − turnover rate.", progress: s.retentionRate },
    { id: "metric-turnover", icon: <UserMinus />, label: "Turnover Rate", value: fmtPct(s.turnoverRate), context: `${fmtNum(s.separations)} resigned / terminated / exiting`, status: st(s.turnoverRate <= 8, s.turnoverRate <= 15), formula: "Employees whose Remarks indicate resignation, termination, end of contract or exit ÷ headcount." },
    { id: "metric-promotion", icon: <Percent />, label: "Promotion Ratio", value: fmtPct(s.promotionRatio), context: `${fmtNum(s.promotions)} employees with promotion remarks`, status: st(s.promotionRatio >= 4, s.promotionRatio >= 2), formula: "Employees whose Remarks mention a promotion ÷ headcount." },
    { id: "metric-reporting", icon: <Activity />, label: "Average Reporting Line", value: `${s.avgReportingLine.toFixed(1)} levels`, context: `${s.maxLayers} management layers in total`, status: st(s.maxLayers <= 7, s.maxLayers <= 9), formula: "Average depth of each employee in the supervisor hierarchy (1 = top)." },
  ];

  const gauges = useMemo(() => gaugesOption([
    { name: "Gender diversity", value: s.genderDiversityIndex, color: t.female },
    { name: "Retention", value: s.retentionRate, color: t.success },
    { name: "Nationality diversity", value: s.nationalityDiversityIndex, color: t.primary },
  ], t), [s, t]);
  const yearOpt = useMemo(() => comboYearOption(years.labels, years.hires, years.headcount, t), [years, t]);
  const spanOpt = useMemo(() => histogramOption(span.labels, span.values, t, { name: "Supervisors" }), [span, t]);
  const layerOpt = useMemo(() => barOption(layers.labels.map((l, i) => ({ name: l, value: layers.values[i] })), t, { colors: ["#7FD4FF", t.primary] }), [layers, t]);
  const radar = useMemo(() => {
    const colors = [t.accent, "#FFB300", t.female, "#26C6DA"];
    return radarOption(
      [{ name: "Female %", max: 60 }, { name: "Degree %", max: 100 }, { name: "Expat %", max: 25 }, { name: "Growth %", max: 50 }, { name: "Avg tenure", max: 10 }, { name: "Avg age", max: 50 }],
      divs.map((d, i) => ({ name: d.name, color: colors[i % colors.length], values: [d.femalePct, d.degreePct, d.expatPct, d.growth, d.avgTenure, d.avgAge] })),
      t
    );
  }, [divs, t]);

  const visibleTiles = tiles.filter((tile) => layout.visible(tile.id));
  const sectionIds = ["section-insights", "section-gauges", "section-signals", "section-scorecard", "visual-growth", "visual-radar", "visual-span", "visual-layers"];
  const hasAnything = visibleTiles.length > 0 || layout.visibleCount(sectionIds) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Strategic Workforce Analytics"
        title="Growth, diversity & organizational health"
        icon={<Target />}
        subtitle="Board-level workforce metrics with definitions, status benchmarks and dynamic insights"
        actions={<DashboardCustomizer page={ANALYTICS_PAGE} title="Strategic Analytics" widgets={ANALYTICS_WIDGETS} />}
      />
      {!hasAnything && <HiddenDashboardState page={ANALYTICS_PAGE} title="Strategic Analytics" widgets={ANALYTICS_WIDGETS} />}
      {visibleTiles.length > 0 && (
        <div className="grid grid-flow-row-dense grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {visibleTiles.map((tile, index) => (
            <StrategicTile key={tile.id} {...tile} index={index} />
          ))}
        </div>
      )}
      {layout.visibleCount(["section-insights", "section-gauges", "section-signals"]) > 0 && (
        <div className="mt-5 grid grid-flow-row-dense gap-4 xl:grid-cols-3">
          {layout.visible("section-insights") && <InsightBox items={box} narrative={insights.find((i) => i.id === "largest-division")?.narrative} />}
          {layout.visible("section-gauges") && <ChartCard className="xl:col-span-2" title="Diversity & Retention Gauges" subtitle="Index scores out of 100" option={gauges} height={220} />}
          {layout.visible("section-signals") && (
            <Card className="animate-fade-up xl:col-span-2">
              <CardTitle icon={<Activity />} title="Key Strategic Signals" subtitle="Highest-priority findings from the insights engine" />
              <div className="grid gap-2 sm:grid-cols-2">
                {insights.filter((i) => i.severity !== "info").slice(0, 6).map((i) => (
                  <div key={i.id} className="rounded-xl border border-line bg-surface-muted/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-fg">{i.title}</p>
                      <Badge tone={i.severity === "positive" ? "success" : i.severity === "warning" ? "warning" : "danger"}>{i.metric}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted">{i.narrative}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
      {layout.visible("section-scorecard") && <div className="mt-4"><Scorecard /></div>}
      {layout.visibleCount(["visual-growth", "visual-radar", "visual-span", "visual-layers"]) > 0 && (
        <div className="mt-4 grid grid-flow-row-dense gap-4 xl:grid-cols-2">
          {layout.visible("visual-growth") && <ChartCard title="Headcount Growth by Year" subtitle="Annual hires vs year-end headcount (10 years)" option={yearOpt} height={300} table={{ columns: ["Year", "Hires", "Headcount"], rows: years.labels.map((l, i) => [l, years.hires[i], years.headcount[i]]) }} />}
          {layout.visible("visual-radar") && <ChartCard title="Division Capability Radar" subtitle="Top 4 divisions compared across six dimensions" option={radar} height={300} />}
          {layout.visible("visual-span") && <ChartCard title="Span of Control Distribution" subtitle={`Direct reports per supervisor · ${span.overloaded} over-extended (>12)`} option={spanOpt} height={280} />}
          {layout.visible("visual-layers") && <ChartCard title="Management Layers" subtitle="Employees at each reporting layer (1 = top)" option={layerOpt} height={280} />}
        </div>
      )}
    </>
  );
}

export default function AnalyticsView() {
  return (
    <DataGate>
      <AnalyticsInner />
    </DataGate>
  );
}
