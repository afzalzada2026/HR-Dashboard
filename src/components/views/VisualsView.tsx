"use client";

import { ChartColumn, FilterX, MousePointerClick } from "lucide-react";
import { useMemo, useState } from "react";
import {
  AGE_BUCKETS, ageDistribution, countBy, heatMatrix, hiringTrend, levelDistribution, sunburstData, supervisorLoad, TENURE_BUCKETS, tenureDistribution, topN,
} from "@/lib/analytics";
import { activeFilterCount } from "@/lib/filters";
import type { MultiKey } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { ChartCard } from "../charts/ChartCard";
import type { ChartClick } from "../charts/EChart";
import { DashboardCustomizer, HiddenDashboardState, type DashboardWidget, useDashboardLayout } from "../dashboard/DashboardCustomizer";
import {
  barOption, donutOption, funnelOption, heatmapOption, histogramOption, mapOption, pieOption, scatterOption, stackedOption, sunburstOption, treemapOption, trendOption,
} from "../charts/options";
import { useChartTokens } from "../charts/tokens";
import { DataGate } from "../shell/Chrome";
import { Button, PageHeader, Segmented } from "../ui/primitives";

const VISUALS_PAGE = "interactive-visuals";
const VISUAL_WIDGETS: DashboardWidget[] = [
  { id: "division", label: "Division Headcount", group: "Workforce distribution", essential: true },
  { id: "department", label: "Department Headcount", group: "Workforce distribution", essential: true },
  { id: "gender", label: "Gender by Division", group: "Diversity", essential: true },
  { id: "age", label: "Age Analysis", group: "Demographics", essential: true },
  { id: "tenure", label: "Tenure Analysis", group: "Demographics" },
  { id: "joining", label: "Joining Trend", group: "Workforce distribution", essential: true },
  { id: "station", label: "Duty Station Analysis", group: "Location" },
  { id: "qualification", label: "Qualification Analysis", group: "Capability" },
  { id: "nationality", label: "Nationality Analysis", group: "Diversity" },
  { id: "marital", label: "Marital Status", group: "Demographics" },
  { id: "sunburst", label: "Organization Structure", group: "Organization" },
  { id: "supervisor", label: "Supervisor Analysis", group: "Organization" },
  { id: "scatter", label: "Employee Age vs Tenure", group: "Demographics" },
  { id: "map", label: "Regional Analysis", group: "Location", essential: true },
  { id: "heatmap", label: "Diversity Heat Matrix", group: "Diversity" },
  { id: "level", label: "Actual Level Pyramid", group: "Organization" },
  { id: "nationalization", label: "Nationalization by Division", group: "Diversity" },
  { id: "blood", label: "Blood Group Distribution", group: "Demographics" },
];

function VisualsInner() {
  const filtered = useDataStore((s) => s.filtered);
  const filters = useDataStore((s) => s.filters);
  const now = useDataStore((s) => s.now);
  const toggle = useDataStore((s) => s.toggleValue);
  const setFilter = useDataStore((s) => s.setFilter);
  const patch = useDataStore((s) => s.patchFilters);
  const clear = useDataStore((s) => s.clearFilters);
  const openEmployee = useUIStore((s) => s.openEmployee);
  const layout = useDashboardLayout(VISUALS_PAGE);
  const t = useChartTokens();
  const [heatMode, setHeatMode] = useState<"count" | "pct">("pct");
  const [heatCol, setHeatCol] = useState<"gender" | "expatLocal">("gender");

  const divs = useMemo(() => countBy(filtered, (e) => e.division), [filtered]);
  const depts = useMemo(() => topN(countBy(filtered, (e) => e.department), 10), [filtered]);
  const ages = useMemo(() => ageDistribution(filtered), [filtered]);
  const tenure = useMemo(() => tenureDistribution(filtered), [filtered]);
  const trend = useMemo(() => hiringTrend(filtered, now, 36), [filtered, now]);
  const stations = useMemo(() => countBy(filtered, (e) => e.dutyStation).slice(0, 15), [filtered]);
  const quals = useMemo(() => countBy(filtered, (e) => e.qualificationGroup), [filtered]);
  const nats = useMemo(() => countBy(filtered, (e) => e.nationality), [filtered]);
  const marital = useMemo(() => countBy(filtered, (e) => e.maritalStatus), [filtered]);
  const sun = useMemo(() => sunburstData(filtered), [filtered]);
  const sups = useMemo(() => supervisorLoad(filtered, 15), [filtered]);
  const provinces = useMemo(() => countBy(filtered, (e) => e.province).filter((p) => p.name !== "Unknown"), [filtered]);
  const levels = useMemo(() => levelDistribution(filtered), [filtered]);
  const blood = useMemo(() => countBy(filtered, (e) => e.bloodGroup), [filtered]);

  const genderByDiv = useMemo(() => {
    const cats = divs.map((d) => d.name);
    const idx = new Map(cats.map((c, i) => [c, i]));
    const male = cats.map(() => 0);
    const female = cats.map(() => 0);
    const expat = cats.map(() => 0);
    const local = cats.map(() => 0);
    for (const e of filtered) {
      const i = idx.get(e.division);
      if (i === undefined) continue;
      if (e.gender === "Male") male[i]++;
      else if (e.gender === "Female") female[i]++;
      if (e.expatLocal === "Expat") expat[i]++;
      else local[i]++;
    }
    return { cats, male, female, expat, local };
  }, [filtered, divs]);

  const heat = useMemo(() => {
    const cols = heatCol === "gender" ? ["Male", "Female"] : ["Local", "Expat"];
    const m = heatMatrix(filtered, (e) => e.division, (e) => (heatCol === "gender" ? e.gender : e.expatLocal), divs.map((d) => d.name), cols);
    if (heatMode === "count") return { ...m, cols };
    const data = m.data.map(([c, r, v]) => {
      const rowTotal = m.grid[r].reduce((a, b) => a + b, 0) || 1;
      return [c, r, (v / rowTotal) * 100] as [number, number, number];
    });
    return { ...m, data, cols };
  }, [filtered, divs, heatMode, heatCol]);

  const scatter = useMemo(() => {
    const male: [number, number, string, string][] = [];
    const female: [number, number, string, string][] = [];
    for (const e of filtered) {
      if (e.age === null || e.tenure === null) continue;
      const p: [number, number, string, string] = [Math.round(e.age * 10) / 10, Math.round(e.tenure * 10) / 10, e.fullName, e.id];
      (e.gender === "Female" ? female : male).push(p);
    }
    return [
      { name: "Male", color: t.male, points: male },
      { name: "Female", color: t.female, points: female },
    ];
  }, [filtered, t]);

  const ageSel = AGE_BUCKETS.findIndex((b) => b.min === filters.ageMin && b.max === filters.ageMax);
  const tenSel = TENURE_BUCKETS.findIndex((b) => b.min === filters.tenureMin && b.max === filters.tenureMax);
  const click = (key: MultiKey) => (p: ChartClick) => p.name && p.name !== "Others" && toggle(key, p.name);
  const pair = (a: MultiKey, av: string, b: MultiKey, bv: string) => {
    const same = filters[a].length === 1 && filters[a][0] === av && filters[b].length === 1 && filters[b][0] === bv;
    setFilter(a, same ? [] : [av]);
    setFilter(b, same ? [] : [bv]);
  };

  const opts = useMemo(
    () => ({
      div: barOption(divs, t, { selected: filters.division, rotate: divs.length > 6 ? 22 : 0 }),
      dept: donutOption(depts, t, { selected: filters.department, legend: "right", centerLabel: "Top departments" }),
      genderDiv: stackedOption(genderByDiv.cats, [{ name: "Male", data: genderByDiv.male, color: t.male }, { name: "Female", data: genderByDiv.female, color: t.female }], t, { rotate: genderByDiv.cats.length > 6 ? 22 : 0 }),
      age: histogramOption(ages.labels, ages.total, t, { selectedIndex: ageSel >= 0 ? ageSel : null }),
      tenure: histogramOption(tenure.labels, tenure.values, t, { selectedIndex: tenSel >= 0 ? tenSel : null, colors: ["#7FD4FF", t.primary] }),
      trend: trendOption(trend.labels, trend.hires, trend.cumulative, t, { zoom: true }),
      stations: barOption(stations, t, { horizontal: true, selected: filters.dutyStation }),
      quals: treemapOption(quals, t, { selected: filters.qualification }),
      nats: treemapOption(nats, t, { selected: filters.nationality, colors: [t.primary, t.accent, "#26C6DA", "#7E57C2", "#FFB300", "#EC407A", "#66BB6A", "#5C6BC0", "#8D6E63", "#42A5F5", "#AB47BC", "#26A69A", "#FF7043"] }),
      marital: pieOption(marital, t, { selected: filters.maritalStatus, colors: [t.primary, t.accent, "#FFB300", "#EC407A", "#94A3B8", "#26C6DA"] }),
      sun: sunburstOption(sun, t),
      sups: barOption(sups, t, { horizontal: true, selected: filters.supervisor, colors: ["#FFB300", "#F57C00"] }),
      scatter: scatterOption(scatter, t),
      map: mapOption(provinces, t, { selected: filters.province[0] ?? null, compact: true }),
      heat: heatmapOption(heat.rows, heat.cols, heat.data, t, { percent: heatMode === "pct" }),
      levels: funnelOption(levels, t, { selected: filters.level }),
      expat: stackedOption(genderByDiv.cats, [{ name: "Local", data: genderByDiv.local, color: t.primary }, { name: "Expat", data: genderByDiv.expat, color: "#FFB300" }], t, { horizontal: true, percent: true }),
      blood: pieOption(blood, t, { selected: filters.bloodGroup, rose: true, colors: ["#E53935", "#D81B60", "#8E24AA", "#5E35B1", "#1E88E5", "#00ACC1", "#43A047", "#FB8C00", "#94A3B8"] }),
    }),
    [divs, depts, genderByDiv, ages, tenure, trend, stations, quals, nats, marital, sun, sups, scatter, provinces, heat, heatMode, levels, blood, t, filters, ageSel, tenSel]
  );

  const n = activeFilterCount(filters);
  const shown = VISUAL_WIDGETS.filter((widget) => layout.visible(widget.id)).length;
  return (
    <>
      <PageHeader
        eyebrow="Interactive Visuals"
        title="Visual workforce analytics"
        icon={<ChartColumn />}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <MousePointerClick className="h-3.5 w-3.5 text-accent" /> {shown} of 18 linked visuals shown — click any mark to cross-filter everything.
          </span>
        }
        actions={
          <>
            <DashboardCustomizer page={VISUALS_PAGE} title="Interactive Visuals" widgets={VISUAL_WIDGETS} />
            {n > 0 && (
              <Button onClick={clear}>
                <FilterX /> Clear {n} filter{n > 1 ? "s" : ""}
              </Button>
            )}
          </>
        }
      />
      {shown === 0 && <HiddenDashboardState page={VISUALS_PAGE} title="Interactive Visuals" widgets={VISUAL_WIDGETS} />}
      {shown > 0 && (
        <div className="grid grid-flow-row-dense gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {layout.visible("division") && <ChartCard title="Division Headcount" subtitle="Workforce distribution · bar" interactive option={opts.div} onClick={click("division")} table={{ columns: ["Division", "Employees"], rows: divs.map((d) => [d.name, d.value]) }} />}
          {layout.visible("department") && <ChartCard title="Department Headcount" subtitle="Organizational distribution · top 10 donut" interactive option={opts.dept} onClick={click("department")} table={{ columns: ["Department", "Employees"], rows: depts.map((d) => [d.name, d.value]) }} delay={40} />}
          {layout.visible("gender") && <ChartCard title="Gender by Division" subtitle="Gender analytics · stacked column" interactive option={opts.genderDiv} onClick={(p) => p.seriesName && pair("division", p.name, "gender", p.seriesName)} table={{ columns: ["Division", "Male", "Female"], rows: genderByDiv.cats.map((c, i) => [c, genderByDiv.male[i], genderByDiv.female[i]]) }} delay={80} />}
          {layout.visible("age") && (
            <ChartCard title="Age Analysis" subtitle="Age histogram · click a band" interactive option={opts.age} onClick={(p) => { const b = AGE_BUCKETS[p.dataIndex]; if (b) patch(ageSel === p.dataIndex ? { ageMin: null, ageMax: null } : { ageMin: b.min, ageMax: b.max }); }} table={{ columns: ["Age band", "Employees"], rows: ages.labels.map((l, i) => [l, ages.total[i]]) }} />
          )}
          {layout.visible("tenure") && (
            <ChartCard title="Tenure Analysis" subtitle="Years of service histogram · click a band" interactive option={opts.tenure} onClick={(p) => { const b = TENURE_BUCKETS[p.dataIndex]; if (b) patch(tenSel === p.dataIndex ? { tenureMin: null, tenureMax: null } : { tenureMin: b.min, tenureMax: b.max }); }} table={{ columns: ["Tenure", "Employees"], rows: tenure.labels.map((l, i) => [l, tenure.values[i]]) }} delay={40} />
          )}
          {layout.visible("joining") && <ChartCard title="Joining Trend" subtitle="Monthly hiring trend · drag the slider to zoom" option={opts.trend} table={{ columns: ["Month", "Hires", "Headcount"], rows: trend.labels.map((l, i) => [l, trend.hires[i], trend.cumulative[i]]) }} delay={80} />}
          {layout.visible("station") && <ChartCard title="Duty Station Analysis" subtitle="Employees by location · top 15" interactive option={opts.stations} onClick={click("dutyStation")} height={360} table={{ columns: ["Duty station", "Employees"], rows: stations.map((d) => [d.name, d.value]) }} />}
          {layout.visible("qualification") && <ChartCard title="Qualification Analysis" subtitle="Treemap of qualification groups" interactive option={opts.quals} onClick={click("qualification")} height={360} table={{ columns: ["Qualification", "Employees"], rows: quals.map((d) => [d.name, d.value]) }} delay={40} />}
          {layout.visible("nationality") && <ChartCard title="Nationality Analysis" subtitle="Nationality distribution treemap" interactive option={opts.nats} onClick={click("nationality")} height={360} table={{ columns: ["Nationality", "Employees"], rows: nats.map((d) => [d.name, d.value]) }} delay={80} />}
          {layout.visible("marital") && <ChartCard title="Marital Status" subtitle="Married · single · other" interactive option={opts.marital} onClick={click("maritalStatus")} table={{ columns: ["Status", "Employees"], rows: marital.map((d) => [d.name, d.value]) }} />}
          {layout.visible("sunburst") && <ChartCard title="Organization Structure" subtitle="Sunburst: Division → Department → Title · click to drill" option={opts.sun} delay={40} />}
          {layout.visible("supervisor") && <ChartCard title="Supervisor Analysis" subtitle="Direct reports per supervisor · top 15" interactive option={opts.sups} onClick={click("supervisor")} table={{ columns: ["Supervisor", "Direct reports"], rows: sups.map((d) => [d.name, d.value]) }} delay={80} />}
          {layout.visible("scatter") && <ChartCard title="Employee Age vs Tenure" subtitle="Scatter plot · click a point to open the profile" interactive option={opts.scatter} onClick={(p) => Array.isArray(p.value) && typeof p.value[3] === "string" && openEmployee(p.value[3])} height={340} />}
          {layout.visible("map") && <ChartCard title="Regional Analysis" subtitle="Province headcount map · click to filter" interactive needsMap option={opts.map} onClick={(p) => p.name && toggle("province", p.name)} height={340} table={{ columns: ["Province", "Employees"], rows: provinces.map((d) => [d.name, d.value]) }} delay={40} />}
          {layout.visible("heatmap") && (
            <ChartCard
              title="Diversity Heat Matrix"
              subtitle={`Division × ${heatCol === "gender" ? "Gender" : "Expat/Local"} · ${heatMode === "pct" ? "row %" : "headcount"}`}
              interactive option={opts.heat} height={340} delay={80}
              onClick={(p) => { const v = p.value as number[] | undefined; if (v) pair("division", heat.rows[v[1]], heatCol, heat.cols[v[0]]); }}
              actions={<div className="mr-1 hidden gap-1 sm:flex"><Segmented size="xs" value={heatCol} onChange={setHeatCol} options={[{ value: "gender", label: "Gender" }, { value: "expatLocal", label: "Expat" }]} /><Segmented size="xs" value={heatMode} onChange={setHeatMode} options={[{ value: "pct", label: "%" }, { value: "count", label: "#" }]} /></div>}
            />
          )}
          {layout.visible("level") && <ChartCard title="Actual Level Pyramid" subtitle="Headcount by job level (senior at top)" interactive option={opts.levels} onClick={click("level")} height={340} table={{ columns: ["Level", "Employees"], rows: levels.map((d) => [d.name, d.value]) }} />}
          {layout.visible("nationalization") && <ChartCard title="Nationalization by Division" subtitle="Local vs expat share · 100% stacked" interactive option={opts.expat} onClick={(p) => p.seriesName && pair("division", p.name, "expatLocal", p.seriesName)} height={340} delay={40} />}
          {layout.visible("blood") && <ChartCard title="Blood Group Distribution" subtitle="Nightingale rose · emergency readiness" interactive option={opts.blood} onClick={click("bloodGroup")} height={340} table={{ columns: ["Blood group", "Employees"], rows: blood.map((d) => [d.name, d.value]) }} delay={80} />}
        </div>
      )}
    </>
  );
}

export default function VisualsView() {
  return (
    <DataGate>
      <VisualsInner />
    </DataGate>
  );
}
