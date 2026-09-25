"use client";

import { Building2, Filter, GraduationCap, Hourglass, MapPinned, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { countBy, groupStats, type ProvinceStat, provinceStats } from "@/lib/analytics";
import { applyFilters } from "@/lib/filters";
import { cn, fmtNum, fmtPct } from "@/lib/format";
import { PROVINCE_INFO, PROVINCES, stationCoord, validateEmployeeMapCoverage } from "@/lib/geo";
import { useDataStore } from "@/store/data";
import { ChartCard } from "../charts/ChartCard";
import { mapOption } from "../charts/options";
import { useChartTokens } from "../charts/tokens";
import { DataGate } from "../shell/Chrome";
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, Segmented, Switch } from "../ui/primitives";

type Metric = "headcount" | "femalePct" | "avgAge" | "avgTenure";
const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: "headcount", label: "Headcount", unit: "" },
  { value: "femalePct", label: "Female %", unit: "%" },
  { value: "avgAge", label: "Avg age", unit: " yrs" },
  { value: "avgTenure", label: "Avg tenure", unit: " yrs" },
];

function metricOf(s: ProvinceStat, m: Metric): number {
  const v = m === "headcount" ? s.headcount : m === "femalePct" ? s.femalePct : m === "avgAge" ? s.avgAge : s.avgTenure;
  return Math.round(v * 10) / 10;
}

function ProvincePanel({ name, stat, total, rank, onFilter, onView }: { name: string | null; stat?: ProvinceStat; total: number; rank: number; onFilter: () => void; onView: () => void }) {
  if (!name) return <Card><EmptyState icon={<MapPinned />} title="Select a province" description="Click any province on the map to see its workforce profile." /></Card>;
  const info = PROVINCE_INFO[name];
  if (!stat)
    return (
      <Card className="animate-fade-up">
        <CardTitle icon={<MapPinned />} title={name} subtitle={info ? `${info.region} region · capital ${info.capital}` : undefined} />
        <EmptyState title="No employees in this province" description="No staff in the current selection are based here." />
      </Card>
    );
  const malePct = stat.headcount ? (stat.male / stat.headcount) * 100 : 0;
  return (
    <Card className="animate-fade-up flex flex-col">
      <div className="-mx-4 -mt-4 mb-4 rounded-t-2xl px-5 py-4 text-white sm:-mx-5 sm:-mt-5" style={{ background: "linear-gradient(135deg,#062B5B,#0D47A1 60%,#00A8FF)" }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.16em] text-white/70 uppercase">{info?.region ?? "Province"} region</p>
            <h3 className="text-xl font-bold">{name}</h3>
            <p className="text-[12px] text-white/75">Capital: {info?.capital ?? "—"}</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
            <Trophy className="h-3.5 w-3.5 text-amber-300" /> #{rank}
          </span>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-extrabold tabular-nums">{fmtNum(stat.headcount)}</span>
          <span className="pb-1 text-[12px] text-white/75">employees · {fmtPct((stat.headcount / Math.max(1, total)) * 100)} of workforce</span>
        </div>
      </div>
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Gender split</p>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full">
        <div className="h-full bg-[#0D47A1] dark:bg-[#3D8BFF]" style={{ width: `${malePct}%` }} />
        <div className="h-full bg-pink-500" style={{ width: `${100 - malePct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px]">
        <span className="text-fg">
          <b>{fmtNum(stat.male)}</b> male ({fmtPct(malePct)})
        </span>
        <span className="text-fg">
          <b>{fmtNum(stat.female)}</b> female ({fmtPct(stat.femalePct)})
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { icon: <GraduationCap />, l: "Top qualification", v: stat.topQualification },
          { icon: <Building2 />, l: "Top department", v: stat.topDepartment },
          { icon: <Users />, l: "Top division", v: stat.topDivision },
          { icon: <Hourglass />, l: "Avg age · tenure", v: `${stat.avgAge.toFixed(1)} · ${stat.avgTenure.toFixed(1)} yrs` },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-line bg-surface-muted/60 p-2.5">
            <p className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-subtle uppercase [&_svg]:h-3 [&_svg]:w-3">
              {x.icon}
              {x.l}
            </p>
            <p className="mt-0.5 truncate text-[12.5px] font-semibold text-fg" title={x.v}>
              {x.v}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] font-semibold tracking-wider text-muted uppercase">Duty stations</p>
      <div className="mt-1.5 space-y-1">
        {stat.stations.slice(0, 5).map((s) => (
          <div key={s.name} className="flex items-center justify-between text-[12.5px]">
            <span className="text-fg">{s.name}</span>
            <Badge tone="primary">{fmtNum(s.value)}</Badge>
          </div>
        ))}
      </div>
      <div className="mt-auto flex gap-2 pt-4">
        <Button className="flex-1" onClick={onFilter}>
          <Filter /> Filter dashboard
        </Button>
        <Button variant="primary" className="flex-1" onClick={onView}>
          <Users /> View employees
        </Button>
      </div>
    </Card>
  );
}

function MapInner() {
  const employees = useDataStore((s) => s.employees);
  const filters = useDataStore((s) => s.filters);
  const now = useDataStore((s) => s.now);
  const setFilter = useDataStore((s) => s.setFilter);
  const router = useRouter();
  const t = useChartTokens();
  const [metric, setMetric] = useState<Metric>("headcount");
  const [stationsOn, setStationsOn] = useState(true);
  const [labels, setLabels] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const base = useMemo(() => applyFilters(employees, { ...filters, province: [] }), [employees, filters]);
  const stats = useMemo(() => provinceStats(base), [base]);
  const coverage = useMemo(() => validateEmployeeMapCoverage(base.map((employee) => employee.province)), [base]);
  const ranked = useMemo(() => [...stats.values()].filter((s) => s.name !== "Unknown").sort((a, b) => b.headcount - a.headcount), [stats]);
  const current = picked ?? filters.province[0] ?? ranked[0]?.name ?? null;
  const m = METRICS.find((x) => x.value === metric) ?? METRICS[0];
  const stations = useMemo(() => {
    const byStation = countBy(base, (e) => e.dutyStation);
    const prov = new Map(base.map((e) => [e.dutyStation, e.province]));
    return byStation.map((s) => ({ name: s.name, count: s.value, coord: stationCoord(s.name, prov.get(s.name)) })).filter((s): s is { name: string; count: number; coord: [number, number] } => !!s.coord);
  }, [base]);
  const regions = useMemo(() => groupStats(base.filter((e) => e.province !== "Unknown"), (e) => e.region, now), [base, now]);
  const option = useMemo(
    () => mapOption(PROVINCES.map((p) => ({ name: p.name, value: stats.get(p.name) ? metricOf(stats.get(p.name) as ProvinceStat, metric) : 0 })), t, { metricLabel: m.label, unit: m.unit, selected: current, stations: stationsOn ? stations : undefined, showLabels: labels }),
    [stats, metric, t, m, current, stationsOn, stations, labels]
  );
  const maxHc = Math.max(1, ...ranked.map((r) => r.headcount));
  const unknown = stats.get("Unknown")?.headcount ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Geospatial Workforce Intelligence"
        title="Afghanistan employee map"
        icon={<MapPinned />}
        subtitle={`${ranked.length} of 34 provinces staffed · ${fmtNum(coverage.mapped)}/${fmtNum(coverage.total)} employees mapped (${fmtPct(coverage.coverage * 100)})${unknown ? ` · ${fmtNum(unknown)} unmatched` : ""}`}
        actions={
          <>
            <Segmented value={metric} onChange={setMetric} options={METRICS.map((x) => ({ value: x.value, label: x.label }))} />
            <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-strong px-3 py-1.5 text-xs text-fg">
              <Switch checked={stationsOn} onChange={setStationsOn} label="Duty stations" /> Stations
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-strong px-3 py-1.5 text-xs text-fg">
              <Switch checked={labels} onChange={setLabels} label="Province labels" /> Labels
            </label>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ChartCard
          title="Province heat map"
          subtitle={`Color intensity = ${m.label.toLowerCase()} (darker = higher) · scroll to zoom, drag to pan, click a province`}
          interactive
          needsMap
          option={option}
          height={580}
          onClick={(p) => {
            if (p.seriesType === "effectScatter") return;
            if (p.name && PROVINCE_INFO[p.name]) setPicked(p.name);
          }}
          table={{ columns: ["Province", "Region", "Headcount", "Female %", "Avg age", "Avg tenure"], rows: ranked.map((r) => [r.name, PROVINCE_INFO[r.name]?.region ?? "", r.headcount, r.femalePct, r.avgAge, r.avgTenure]) }}
        />
        <ProvincePanel
          name={current}
          stat={current ? stats.get(current) : undefined}
          total={base.length}
          rank={current ? ranked.findIndex((r) => r.name === current) + 1 : 0}
          onFilter={() => current && setFilter("province", [current])}
          onView={() => {
            if (!current) return;
            setFilter("province", [current]);
            router.push("/directory");
          }}
        />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="animate-fade-up">
          <CardTitle icon={<Trophy />} title="Province ranking" subtitle="Headcount by province · click to inspect" />
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {ranked.map((r, i) => (
              <button key={r.name} type="button" onClick={() => setPicked(r.name)} className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-muted", current === r.name && "bg-accent/10 ring-1 ring-accent/30")}>
                <span className="w-6 text-right text-[11px] font-bold text-subtle tabular-nums">{i + 1}</span>
                <span className="w-28 truncate text-[12.5px] font-medium text-fg">{r.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-linear-to-r from-brand-700 to-brand-400" style={{ width: `${(r.headcount / maxHc) * 100}%` }} />
                </span>
                <span className="w-12 text-right text-[12px] font-semibold text-fg tabular-nums">{fmtNum(r.headcount)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="animate-fade-up">
          <CardTitle icon={<MapPinned />} title="Regional summary" subtitle="Eight geographic regions of Afghanistan" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {regions.map((r) => (
              <div key={r.name} className="rounded-xl border border-line bg-surface-muted/50 p-3 transition-colors hover:border-accent/40">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-fg">{r.name}</p>
                  <Badge tone="primary">{fmtPct(r.share)}</Badge>
                </div>
                <p className="mt-1 text-2xl font-bold text-fg tabular-nums">{fmtNum(r.headcount)}</p>
                <p className="text-[11px] text-muted">
                  {fmtPct(r.femalePct)} female · {r.avgTenure.toFixed(1)} yrs tenure · top: {r.topDepartment}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

export default function MapView() {
  return (
    <DataGate allowEmptyFilter>
      <MapInner />
    </DataGate>
  );
}
