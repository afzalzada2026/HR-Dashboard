"use client";

import { BadgeCheck, Building2, ChevronRight, Layers, Network, RotateCcw, Search, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { averageDepth, buildOrgTree, loadOrgOverrides, rankDivisionHeadCandidates, saveOrgOverrides, scopeRoots, type OrgOverrides } from "@/lib/orgtree";
import { buildOrgLayout } from "@/lib/orglayout";
import { fmtNum, fmtPct } from "@/lib/format";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Organogram } from "../org/Organogram";
import { DataGate } from "../shell/Chrome";
import { Badge, Button, Card, CardTitle, PageHeader } from "../ui/primitives";

function OrgInner() {
  const filtered = useDataStore((s) => s.filtered);
  const openEmployee = useUIStore((s) => s.openEmployee);
  const session = useUIStore((s) => s.session);
  const [division, setDivision] = useState("");
  const [department, setDepartment] = useState("");
  const [query, setQuery] = useState("");
  // Overrides load after mount so server and client render identical trees (no hydration error).
  const [overrides, setOverrides] = useState<OrgOverrides>({ heads: {}, reporting: {} });
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOverrides(loadOrgOverrides()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const build = useMemo(() => buildOrgTree(filtered, overrides), [filtered, overrides]);
  const roots = useMemo(() => scopeRoots(build, division || undefined, department || undefined), [build, division, department]);
  const layout = useMemo(() => buildOrgLayout(roots), [roots]);

  const divisions = useMemo(() => [...new Set(filtered.map((e) => e.division).filter(Boolean))].sort(), [filtered]);
  const departments = useMemo(() => (division ? [...new Set(filtered.filter((e) => e.division === division).map((e) => e.department).filter(Boolean))].sort() : []), [filtered, division]);
  const candidates = useMemo(() => (division ? rankDivisionHeadCandidates(filtered, division, overrides.heads[division]) : []), [filtered, division, overrides]);
  const selectedHead = build.divisionHeads.get(division);

  const setHead = (key: string) => {
    const next: OrgOverrides = { ...overrides, heads: { ...overrides.heads, [division]: key } };
    saveOrgOverrides(next);
    setOverrides(next);
  };
  const resetHead = () => {
    const heads = { ...overrides.heads };
    delete heads[division];
    const next: OrgOverrides = { ...overrides, heads };
    saveOrgOverrides(next);
    setOverrides(next);
  };

  const matched = query.trim()
    ? filtered.filter((e) => `${e.fullName} ${e.title} ${e.department}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : [];

  const scopeTitle = `${division || "All divisions"}${department ? ` · ${department}` : ""}`;
  const subtitle = `${fmtNum(roots.reduce((a, r) => a + r.total, 0))} people · ${layout.layers.length} level rows · ${averageDepth(build).toFixed(1)} average reporting layers`;

  return (
    <>
      <PageHeader eyebrow="Organization" title="Organogram" icon={<Network />} subtitle={subtitle} />

      <div className="glass animate-fade-up relative z-10 mb-3 rounded-2xl p-3" data-no-capture="true">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[220px_240px_minmax(240px,1fr)_auto] xl:items-center">
          <label className="relative">
            <Building2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select
              className="field h-10 pl-9"
              value={division}
              onChange={(event) => {
                setDivision(event.target.value);
                setDepartment("");
              }}
              aria-label="Filter organogram by division"
            >
              <option value="">All divisions</option>
              {divisions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="relative">
            <Layers className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select className="field h-10 pl-9 disabled:cursor-not-allowed disabled:opacity-50" value={department} disabled={!division} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter organogram by department">
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input className="field h-10 pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a person to highlight on the chart…" />
            {matched.length > 0 && (
              <div className="glass-strong animate-pop absolute inset-x-0 top-full z-50 mt-2 rounded-xl p-1.5">
                {matched.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      openEmployee(e.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-fg">{e.fullName}</span>
                      <span className="block truncate text-[11px] text-muted">
                        {e.title} · {e.department}
                      </span>
                    </span>
                    <Badge>{e.level}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <Users className="h-4 w-4 text-accent" />
            {fmtNum(build.quality.linked)}/{fmtNum(build.quality.total)} reporting lines resolved ·{" "}
            <span className={build.quality.inferred ? "text-warning" : "text-success"}>{fmtNum(build.quality.inferred)} inferred</span>
          </div>
        </div>
      </div>

      {division && candidates.length > 0 && (
        <Card className="animate-fade-up mb-3">
          <CardTitle
            icon={<ShieldCheck />}
            title={`Division head — ${division}`}
            subtitle={`Currently: ${selectedHead?.emp.fullName ?? "unresolved"} · choose a different head if the reporting data is incomplete`}
            actions={
              overrides.heads[division] ? (
                <Button size="sm" variant="ghost" onClick={resetHead}>
                  <RotateCcw /> Reset to auto
                </Button>
              ) : undefined
            }
          />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {candidates.slice(0, 6).map((candidate) => (
              <button
                key={candidate.key}
                type="button"
                onClick={() => setHead(candidate.key)}
                className={`rounded-xl border p-2.5 text-left transition-colors ${candidate.selected ? "border-accent/60 bg-accent/8" : "border-line hover:bg-surface-muted"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-fg">{candidate.employee.fullName}</span>
                  {candidate.selected && <Badge tone="success"><BadgeCheck className="h-3 w-3" /> Head</Badge>}
                  {candidate.manual && <Badge tone="warning">Manual</Badge>}
                </div>
                <p className="truncate text-[11px] text-muted">{candidate.employee.title}</p>
                <p className="mt-1 line-clamp-2 text-[10.5px] text-subtle">{candidate.reasons.slice(0, 3).join(" · ")}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="glass overflow-hidden rounded-2xl" data-export-expand="true">
        <Organogram
          layout={layout}
          roots={roots}
          divisionEmployees={division ? filtered.filter((employee) => employee.division === division) : undefined}
          division={division || undefined}
          title={`Organization Chart · ${scopeTitle}`}
          subtitle={`L6 → L1 · ${subtitle}`}
          generatedBy={session.name}
          onOpenEmployee={openEmployee}
        />
      </div>

      {build.quality.unmatched.length > 0 && (
        <Card className="animate-fade-up mt-4">
          <CardTitle icon={<ChevronRight />} title="Supervisor names needing review" subtitle={`${build.quality.unmatched.length} references did not match an employee exactly — fuzzy matching resolved most variants`} />
          <div className="flex flex-wrap gap-1.5">
            {build.quality.unmatched.slice(0, 12).map((u) => (
              <Badge key={u.name} tone="warning">
                {u.name} · {u.count}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-subtle">
            Resolved by: {fmtNum(build.quality.byEmail)} e-mail · {fmtNum(build.quality.byNo)} employee number · {fmtNum(build.quality.byName)} name/fuzzy · {fmtNum(build.quality.inferred)} inferred ·{" "}
            {fmtNum(build.quality.cycles)} cycles repaired · {fmtPct((build.quality.linked / Math.max(1, build.quality.total)) * 100)} linked.
          </p>
        </Card>
      )}
    </>
  );
}

export default function OrgChartView() {
  return (
    <DataGate>
      <OrgInner />
    </DataGate>
  );
}
