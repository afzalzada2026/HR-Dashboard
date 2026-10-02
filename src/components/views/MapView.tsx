"use client";

import { Building2, Filter, MapPin, MapPinned, Navigation, Trophy, Users } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { countBy, groupStats, provinceStats, type ProvinceStat } from "@/lib/analytics";
import { applyFilters } from "@/lib/filters";
import { cn, fmtNum, fmtPct } from "@/lib/format";
import { matchProvince, PROVINCE_INFO, PROVINCES, stationCoord, validateEmployeeMapCoverage } from "@/lib/geo";
import type { Employee } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { ChartCard } from "../charts/ChartCard";
import { mapOption } from "../charts/options";
import { useChartTokens } from "../charts/tokens";
import { DataGate } from "../shell/Chrome";
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, Segmented, Switch } from "../ui/primitives";

type Dimension = "station" | "province";

/** Province used for heat colouring when the map is focused on duty stations. */
const stationProvince = (e: Employee) => matchProvince(e.dutyStation) ?? e.province;

function ProfileCard({
  title,
  eyebrow,
  headcount,
  total,
  male,
  female,
  stats,
  extra,
  onApply,
  applyLabel,
}: {
  title: string;
  eyebrow: string;
  headcount: number;
  total: number;
  male: number;
  female: number;
  stats: { label: string; value: string }[];
  extra?: ReactNode;
  onApply: () => void;
  applyLabel: string;
}) {
  const malePct = headcount ? (male / headcount) * 100 : 0;
  return (
    <Card className="animate-fade-up flex flex-col">
      <div className="-mx-4 -mt-4 mb-4 rounded-t-2xl px-5 py-4 text-white sm:-mx-5 sm:-mt-5" style={{ background: "linear-gradient(135deg,#062B5B,#0D47A1 60%,#00A8FF)" }}>
        <p className="text-[10.5px] font-semibold tracking-[0.16em] text-white/70 uppercase">{eyebrow}</p>
        <h3 className="text-xl font-bold">{title}</h3>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-extrabold tabular-nums">{fmtNum(headcount)}</span>
          <span className="pb-1 text-[12px] text-white/75">employees · {fmtPct((headcount / Math.max(1, total)) * 100)} of scope</span>
        </div>
      </div>
      <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Gender split</p>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full">
        <div className="h-full bg-[#0D47A1] dark:bg-[#3D8BFF]" style={{ width: `${malePct}%` }} />
        <div className="h-full bg-pink-500" style={{ width: `${100 - malePct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px]">
        <span className="text-fg">
          <b>{fmtNum(male)}</b> male ({fmtPct(malePct)})
        </span>
        <span className="text-fg">
          <b>{fmtNum(female)}</b> female ({fmtPct(headcount ? (female / headcount) * 100 : 0)})
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {stats.map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-surface-muted/60 p-2.5">
            <p className="text-[10px] font-semibold tracking-wider text-subtle uppercase">{item.label}</p>
            <p className="mt-0.5 truncate text-[12.5px] font-semibold text-fg" title={item.value}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
      {extra}
      <div className="mt-auto pt-4">
        <Button variant="primary" className="w-full" onClick={onApply}>
          <Filter /> {applyLabel}
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
  const t = useChartTokens();

  // Two map filters: Duty station (default) and home Province.
  const [dimension, setDimension] = useState<Dimension>("station");
  const [stationsOn, setStationsOn] = useState(true);
  const [labels, setLabels] = useState(false);
  /** null = untouched (default to the top item); "" = explicit "All"; otherwise the focused item. */
  const [focus, setFocus] = useState<string | null | "all">(null);

  const base = useMemo(() => applyFilters(employees, { ...filters, province: [], dutyStation: [] }), [employees, filters]);
  const coverage = useMemo(() => validateEmployeeMapCoverage(base.map((employee) => employee.province)), [base]);
  const provinceStatsMap = useMemo(() => provinceStats(base), [base]);
  const provincesRanked = useMemo(() => [...provinceStatsMap.values()].filter((s) => s.name !== "Unknown").sort((a, b) => b.headcount - a.headcount), [provinceStatsMap]);

  const stationsRanked = useMemo(() => countBy(base, (e) => e.dutyStation).filter((s) => s.name !== "Unspecified"), [base]);
  const provinceList = useMemo(() => provincesRanked.map((p) => p.name), [provincesRanked]);

  const station =
    focus === "all" ? null : focus && stationsRanked.some((s) => s.name === focus) ? focus : focus === null && dimension === "station" ? (stationsRanked[0]?.name ?? null) : null;
  const province =
    focus === "all" ? null : focus && provinceList.includes(focus) ? focus : focus === null && dimension === "province" ? (provincesRanked[0]?.name ?? null) : null;

  const scope = useMemo(
    () => (dimension === "station" && station ? base.filter((e) => e.dutyStation === station) : dimension === "province" && province ? base.filter((e) => e.province === province) : base),
    [base, dimension, station, province]
  );

  const heatByStation = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of base) {
      const key = stationProvince(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [base]);

  const regions = useMemo(
    () =>
      PROVINCES.map((p) => ({
        name: p.name,
        value: dimension === "station" ? (heatByStation.get(p.name) ?? 0) : (provinceStatsMap.get(p.name)?.headcount ?? 0),
      })),
    [dimension, heatByStation, provinceStatsMap]
  );

  const markers = useMemo(() => {
    const byStation = countBy(base, (e) => e.dutyStation).filter((s) => s.name !== "Unspecified");
    const provinceOf = new Map(base.map((e) => [e.dutyStation, stationProvince(e)]));
    return byStation
      .map((s) => ({ name: s.name, count: s.value, coord: stationCoord(s.name, provinceOf.get(s.name)) }))
      .filter((s): s is { name: string; count: number; coord: [number, number] } => !!s.coord)
      .slice(0, 60);
  }, [base]);

  const stationInfo = dimension === "station" && station ? base.filter((e) => e.dutyStation === station) : [];
  const male = scope.filter((e) => e.gender === "Male").length;
  const female = scope.filter((e) => e.gender === "Female").length;
  const stats =
    dimension === "station"
      ? [
          { label: "Home province mix", value: countBy(stationInfo, (e) => e.province)[0]?.name ?? "—" },
          { label: "Top department", value: countBy(stationInfo, (e) => e.department)[0]?.name ?? "—" },
          { label: "Top qualification", value: countBy(stationInfo, (e) => e.qualificationGroup)[0]?.name ?? "—" },
          { label: "Station province", value: (station && matchProvince(station)) || "Unmapped" },
        ]
      : [
          { label: "Top division", value: countBy(scope, (e) => e.division)[0]?.name ?? "—" },
          { label: "Top department", value: countBy(scope, (e) => e.department)[0]?.name ?? "—" },
          { label: "Top qualification", value: countBy(scope, (e) => e.qualificationGroup)[0]?.name ?? "—" },
          { label: "Duty stations", value: String(countBy(scope, (e) => e.dutyStation).length) },
        ];

  const regionStats = groupStats(base.filter((e) => e.province !== "Unknown"), (e) => e.region, now);
  const title = dimension === "station" ? (station ?? "All duty stations") : (province ?? "All provinces");
  const applyFilter = () => {
    if (dimension === "station" && station) setFilter("dutyStation", filters.dutyStation.length === 1 && filters.dutyStation[0] === station ? [] : [station]);
    else if (dimension === "province" && province) setFilter("province", filters.province.length === 1 && filters.province[0] === province ? [] : [province]);
  };
  const applied =
    (dimension === "station" && station && filters.dutyStation.length === 1 && filters.dutyStation[0] === station) ||
    (dimension === "province" && province && filters.province.length === 1 && filters.province[0] === province);

  return (
    <>
      <PageHeader
        eyebrow="Geospatial Workforce Intelligence"
        title="Afghanistan workforce map"
        icon={<MapPinned />}
        subtitle={`${fmtNum(coverage.mapped)}/${fmtNum(coverage.total)} employees mapped (${fmtPct(coverage.coverage * 100)}) · ${fmtNum(stationsRanked.length)} duty stations · ${fmtNum(provincesRanked.length)} provinces staffed`}
        actions={
          <Segmented
            value={dimension}
            onChange={(value) => {
              setDimension(value);
              setFocus(null);
            }}
            options={[
              { value: "station", label: "Duty station", icon: <Navigation /> },
              { value: "province", label: "Home province", icon: <MapPin /> },
            ]}
          />
        }
      />

      <div className="glass animate-fade-up relative z-10 mb-4 rounded-2xl p-3" data-no-capture="true">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto_auto] xl:items-center">
          <label className="relative">
            <Navigation className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select
              className="field h-10 pl-9"
              value={dimension === "station" ? station ?? "" : ""}
              onFocus={() => setDimension("station")}
              onChange={(event) => {
                setDimension("station");
                setFocus(event.target.value || "all");
              }}
              aria-label="Filter by duty station"
            >
              <option value="">All duty stations</option>
              {stationsRanked.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} · {fmtNum(s.value)}
                </option>
              ))}
            </select>
          </label>
          <label className="relative">
            <MapPin className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select
              className="field h-10 pl-9"
              value={dimension === "province" ? province ?? "" : ""}
              onFocus={() => setDimension("province")}
              onChange={(event) => {
                setDimension("province");
                setFocus(event.target.value || "all");
              }}
              aria-label="Filter by home province"
            >
              <option value="">All provinces</option>
              {provincesRanked.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} · {fmtNum(p.headcount)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-strong px-3 py-2 text-xs text-fg">
            <Switch checked={stationsOn} onChange={setStationsOn} label="Duty station markers" /> Stations
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-strong px-3 py-2 text-xs text-fg">
            <Switch checked={labels} onChange={setLabels} label="Province labels" /> Labels
          </label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ChartCard
          title={`Province heat map — shaded by ${dimension === "station" ? "duty-station staff" : "home province"}`}
          subtitle="Darker = more employees · scroll to zoom, drag to pan · click a province or station marker to inspect"
          interactive
          needsMap
          option={mapOption(regions, t, { selected: dimension === "province" ? province : station ? (station && matchProvince(station)) : null, stations: stationsOn ? markers : undefined, showLabels: labels })}
          height={580}
          onClick={(p) => {
            if (p.seriesType === "effectScatter") {
              setDimension("station");
              setFocus(p.name);
            } else if (p.name && PROVINCE_INFO[p.name]) {
              setDimension("province");
              setFocus(p.name);
            }
          }}
          table={{
            columns: [dimension === "station" ? "Duty station" : "Province", "Headcount", "Female %", "Avg age", "Avg tenure"],
            rows: (dimension === "station" ? stationsRanked.slice(0, 30).map((s) => [s.name, s.value, "", "", ""]) : provincesRanked.map((p) => [p.name, p.headcount, p.femalePct, p.avgAge, p.avgTenure])) as (string | number)[][],
          }}
        />
        <ProfileCard
          eyebrow={dimension === "station" ? "Duty station" : "Home province"}
          title={title}
          headcount={scope.length}
          total={base.length}
          male={male}
          female={female}
          stats={stats}
          onApply={applyFilter}
          applyLabel={applied ? "Remove dashboard filter" : "Filter dashboard by this"}
          extra={
            dimension === "station" && station && matchProvince(station) ? (
              <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-[11.5px] text-muted">
                <MapPin className="mr-1 inline h-3.5 w-3.5 text-accent" />
                Plotted on <b className="text-fg">{matchProvince(station)}</b> — duty stations are shaded by the province that hosts them, while employees keep their home province.
              </p>
            ) : undefined
          }
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="animate-fade-up">
          <CardTitle icon={<Trophy />} title="Ranked by scope" subtitle={dimension === "station" ? "Duty stations by headcount" : "Provinces by headcount"} />
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {(dimension === "station"
              ? stationsRanked.map((s) => ({ key: s.name, label: s.name, value: s.value }))
              : provincesRanked.map((p) => ({ key: p.name, label: p.name, value: p.headcount }))
            ).map((row, index) => (
              <button
                key={row.key}
                type="button"
                onClick={() => setFocus(row.key)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-muted", (dimension === "station" ? station : province) === row.key && "bg-accent/10 ring-1 ring-accent/30")}
              >
                <span className="w-6 text-right text-[11px] font-bold text-subtle tabular-nums">{index + 1}</span>
                <span className="flex-1 truncate text-[12.5px] font-medium text-fg">{row.label}</span>
                <span className="w-16 text-right text-[12px] font-semibold text-fg tabular-nums">{fmtNum(row.value)}</span>
              </button>
            ))}
          </div>
        </Card>
        <Card className="animate-fade-up">
          <CardTitle icon={<Users />} title="Regional summary" subtitle="Eight geographic regions of Afghanistan" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {regionStats.map((r) => (
              <div key={r.name} className="rounded-xl border border-line bg-surface-muted/50 p-3">
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

