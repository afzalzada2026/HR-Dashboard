"use client";

import { Building2, ChevronDown, ChevronRight, Crown, Expand, GitBranch, Hand, Layers, Maximize, Network, Search, Shrink, Users, ZoomIn, ZoomOut } from "lucide-react";
import { type PointerEvent as RPointerEvent, useMemo, useRef, useState } from "react";
import { buildOrgTree, organizationLevelProfile, type OrgNode } from "@/lib/analytics";
import { cn, fmtNum, fmtPct } from "@/lib/format";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { DataGate } from "../shell/Chrome";
import { Avatar, Badge, Button, IconButton, PageHeader } from "../ui/primitives";

const domId = (id: string) => `org-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
const PAGE = 24;

interface Flat {
  node: OrgNode;
  path: string[];
  index: number;
}

function flatten(root: OrgNode): Flat[] {
  const out: Flat[] = [];
  const walk = (n: OrgNode, path: string[], index: number) => {
    out.push({ node: n, path, index });
    n.children.forEach((c, i) => walk(c, [...path, n.id], i));
  };
  walk(root, [], 0);
  return out;
}

function Toggle({ open, count, onClick }: { open: boolean; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-strong px-2 py-0.5 text-[10.5px] font-semibold text-muted transition-colors hover:border-accent/50 hover:text-fg"
    >
      {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      {fmtNum(count)}
    </button>
  );
}

function scopedTree(root: OrgNode, division: string, department: string): OrgNode {
  const divisions = root.children
    .filter((node) => !division || node.label === division)
    .map((node) => ({ ...node, children: node.children.filter((child) => !department || child.label === department) }));
  const summaryNodes = department ? divisions.flatMap((node) => node.children) : divisions;
  const scopedHeadcount = summaryNodes.reduce((sum, node) => sum + node.headcount, 0);
  const scopedFemalePct = scopedHeadcount ? summaryNodes.reduce((sum, node) => sum + node.headcount * node.femalePct, 0) / scopedHeadcount : root.femalePct;
  return { ...root, headcount: scopedHeadcount || root.headcount, femalePct: scopedFemalePct, children: divisions };
}

function EmployeeBranch({ node, expanded, toggle, openEmployee, ring, depth = 0 }: {
  node: OrgNode;
  expanded: Set<string>;
  toggle: (id: string) => void;
  openEmployee: (id: string | null) => void;
  ring: (id: string) => string;
  depth?: number;
}) {
  const open = expanded.has(node.id);
  const reports = node.children.length;
  return (
    <div className="org-vitem">
      <div className={cn("flex w-full items-center gap-2 rounded-xl border border-line bg-surface-strong px-2 py-1.5 transition-all hover:border-accent/50 hover:shadow-md", ring(node.id))}>
        <button id={domId(node.id)} type="button" onClick={() => node.person && openEmployee(node.person.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Avatar name={node.label} size={24} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[11.5px] font-medium text-fg">{node.label}</span>
              {node.levelCode && <Badge tone={node.levelCode === "L3H" ? "warning" : "primary"}>{node.levelCode}</Badge>}
            </span>
            <span className="block truncate text-[10px] text-muted">{node.person?.title}</span>
          </span>
        </button>
        {reports > 0 && <Toggle open={open} count={reports} onClick={() => toggle(node.id)} />}
      </div>
      {open && reports > 0 && (
        <div className={cn("org-vlist", depth > 4 && "ml-2")}>
          {node.children.map((child) => (
            <EmployeeBranch key={child.id} node={child} expanded={expanded} toggle={toggle} openEmployee={openEmployee} ring={ring} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgInner() {
  const filtered = useDataStore((s) => s.filtered);
  const openEmployee = useUIStore((s) => s.openEmployee);
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const divisions = useMemo(() => [...new Set(filtered.map((employee) => employee.division))].filter(Boolean).sort(), [filtered]);
  const division = divisions.includes(selectedDivision) ? selectedDivision : "";
  const departments = useMemo(
    () => division ? [...new Set(filtered.filter((employee) => employee.division === division).map((employee) => employee.department))].filter(Boolean).sort() : [],
    [filtered, division]
  );
  const department = departments.includes(selectedDepartment) ? selectedDepartment : "";
  const scopedEmployees = useMemo(() => filtered.filter((employee) => (!division || employee.division === division) && (!department || employee.department === department)), [filtered, division, department]);
  const fullTree = useMemo(() => buildOrgTree(filtered), [filtered]);
  const tree = useMemo(() => scopedTree(fullTree, division, department), [fullTree, division, department]);
  const levelProfile = useMemo(() => organizationLevelProfile(scopedEmployees), [scopedEmployees]);
  const flat = useMemo(() => flatten(tree), [tree]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["ceo"]));
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [zoom, setZoom] = useState(0.9);
  const [q, setQ] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  const toggle = (id: string) => setExpanded((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const expandAll = () => setExpanded(new Set(flat.filter((item) => item.node.children.length > 0).map((item) => item.node.id)));
  const collapseAll = () => setExpanded(new Set(["ceo"]));

  const s = q.trim().toLowerCase();
  const results = useMemo(
    () => (s.length < 2 ? [] : flat.filter((f) => f.node.label.toLowerCase().includes(s) || (f.node.person?.title ?? "").toLowerCase().includes(s) || (f.node.person?.fullName ?? "").toLowerCase().includes(s)).slice(0, 10)),
    [flat, s]
  );

  const focus = (f: Flat) => {
    setExpanded((prev) => new Set([...prev, ...f.path]));
    if (f.node.kind === "employee") {
      const departmentId = f.path.find((id) => id.startsWith("dept:"));
      if (departmentId) setLimits((limits) => ({ ...limits, [departmentId]: Number.MAX_SAFE_INTEGER }));
    }
    setHighlight(f.node.id);
    setQ("");
    setTimeout(() => document.getElementById(domId(f.node.id))?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" }), 120);
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button,a,input")) return;
    const el = canvas.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = canvas.current;
    if (!d || !el) return;
    el.scrollLeft = d.l - (e.clientX - d.x);
    el.scrollTop = d.t - (e.clientY - d.y);
  };
  const endDrag = () => (drag.current = null);

  const ring = (id: string) => (highlight === id ? "ring-4 ring-amber-400/70 shadow-[0_0_30px_rgba(255,179,0,0.45)]" : "");
  const ceo = tree.person;
  const depts = tree.children.reduce((count, divisionNode) => count + divisionNode.children.length, 0);
  const mappedLevels = levelProfile.sequence.filter((level) => levelProfile.counts[level] > 0);

  return (
    <>
      <PageHeader
        eyebrow="Organization"
        title="Interactive org chart"
        icon={<Network />}
        subtitle={`${division || "All divisions"}${department ? ` → ${department}` : ""} · ${tree.children.length} division branch${tree.children.length === 1 ? "" : "es"} · ${depts} department${depts === 1 ? "" : "s"} · ${fmtNum(scopedEmployees.length)} employees`}
      />
      <div className="glass animate-fade-up relative z-10 mb-3 rounded-2xl p-3" data-no-capture="true">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[220px_240px_minmax(260px,1fr)_auto] xl:items-center">
          <label className="relative">
            <Building2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select
              className="field h-10 pl-9"
              value={division}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDivision(value);
                setSelectedDepartment("");
                setLimits({});
                setExpanded(new Set(["ceo", ...(value ? [`div:${value}`] : [])]));
              }}
              aria-label="Filter org chart by division"
            >
              <option value="">All divisions</option>
              {divisions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="relative">
            <Layers className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select
              className="field h-10 pl-9 disabled:cursor-not-allowed disabled:opacity-50"
              value={department}
              disabled={!division}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedDepartment(value);
                setLimits({});
                setExpanded(new Set(["ceo", `div:${division}`, ...(value ? [`dept:${division}:${value}`] : [])]));
              }}
              aria-label="Filter org chart by department"
            >
              <option value="">All departments</option>
              {departments.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search within the selected organization scope…" className="field h-10 pl-9" />
          {results.length > 0 && (
            <div className="glass-strong animate-pop absolute inset-x-0 top-full z-50 mt-2 rounded-xl p-1.5">
              {results.map((f) => (
                <button key={f.node.id} type="button" onClick={() => focus(f)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted">
                  <Avatar name={f.node.person?.fullName ?? f.node.label} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-fg">{f.node.kind === "employee" || f.node.kind === "ceo" ? f.node.person?.fullName ?? f.node.label : f.node.label}</span>
                    <span className="block truncate text-[11px] text-muted">{f.node.kind === "division" ? "Division" : f.node.kind === "department" ? "Department" : f.node.person?.title}</span>
                  </span>
                  <Badge>{f.node.kind}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" onClick={expandAll}>
            <Expand /> Expand all
          </Button>
          <Button size="sm" onClick={collapseAll}>
            <Shrink /> Collapse
          </Button>
          <div className="ml-1 flex items-center gap-0.5 rounded-xl border border-line bg-surface-strong p-0.5">
            <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.1).toFixed(2)))}>
              <ZoomOut />
            </IconButton>
            <span className="w-11 text-center text-[11px] font-semibold text-fg tabular-nums">{Math.round(zoom * 100)}%</span>
            <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>
              <ZoomIn />
            </IconButton>
            <IconButton label="Reset zoom" onClick={() => setZoom(0.9)}>
              <Maximize />
            </IconButton>
          </div>
          <span className="hidden items-center gap-1 text-[11px] text-subtle md:inline-flex">
            <Hand className="h-3.5 w-3.5" /> drag to pan · ctrl+scroll to zoom
          </span>
        </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-line pt-2 text-[11px] text-muted">
          <GitBranch className="h-3.5 w-3.5 text-accent" />
          <span className="font-semibold text-fg">Detected hierarchy:</span>
          {mappedLevels.length ? mappedLevels.map((level, index) => (
            <span key={level} className="inline-flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 text-subtle" />}
              <Badge tone={level === "L3H" ? "warning" : "primary"}>{level} · {levelProfile.counts[level]}</Badge>
            </span>
          )) : <span>No L1–L6 bands detected; title/reporting structure is used.</span>}
          {levelProfile.evidence > 0 && <span className="ml-auto text-subtle">{Math.round(levelProfile.confidence * 100)}% agreement across {levelProfile.evidence} supervisor pairs</span>}
        </div>
      </div>

      <div
        ref={canvas}
        className="glass relative cursor-grab overflow-auto rounded-2xl active:cursor-grabbing"
        style={{ height: "max(560px, calc(100vh - 350px))" }}
        data-export-expand="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={(e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          setZoom((z) => Math.min(1.6, Math.max(0.35, +(z - e.deltaY * 0.001).toFixed(2))));
        }}
      >
        <div className="inline-flex min-w-full justify-center p-8" style={{ zoom }}>
          <div className="flex flex-col items-center">
            <div id={domId("ceo")} className={cn("relative w-[300px] overflow-hidden rounded-2xl p-4 text-white shadow-[0_24px_50px_-20px_rgba(6,43,91,0.7)] transition-shadow", ring("ceo"))} style={{ background: "linear-gradient(135deg,#062B5B,#0D47A1 60%,#00A8FF)" }}>
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-3">
                <button type="button" onClick={() => ceo && openEmployee(ceo.id)} className="rounded-full ring-2 ring-white/40">
                  <Avatar name={tree.label} size={48} />
                </button>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.16em] text-amber-300 uppercase">
                    <Crown className="h-3 w-3" /> Chief Executive
                  </p>
                  <button type="button" onClick={() => ceo && openEmployee(ceo.id)} className="block truncate text-left text-[15px] font-bold hover:underline">
                    {tree.label}
                  </button>
                  <p className="flex items-center gap-1.5 truncate text-[11.5px] text-white/75">{ceo?.title ?? "Chief Executive Officer"}{tree.levelCode && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white">{tree.levelCode}</span>}</p>
                </div>
              </div>
              <div className="relative mt-3 flex items-center justify-between text-[11px] text-white/80">
                <span>
                  <b className="text-white">{fmtNum(tree.headcount)}</b> employees · {fmtPct(tree.femalePct)} female
                </span>
                <button type="button" onClick={() => toggle("ceo")} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-semibold hover:bg-white/25">
                  {expanded.has("ceo") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />} {tree.children.length}
                </button>
              </div>
            </div>

            {expanded.has("ceo") && tree.children.length > 0 && (
              <div className="org-children">
                {tree.children.map((div) => {
                  const open = expanded.has(div.id);
                  return (
                    <div key={div.id} className="org-child">
                      <div className="w-[250px]">
                        <div id={domId(div.id)} className={cn("glass-strong relative overflow-hidden rounded-2xl p-3.5 transition-shadow", ring(div.id))}>
                          <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-brand-700 to-brand-400" />
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-[13.5px] font-bold text-fg">{div.label}</p>
                            <Toggle open={open} count={div.children.length} onClick={() => toggle(div.id)} />
                          </div>
                          {div.person && (
                            <button type="button" onClick={() => openEmployee(div.person!.id)} className="mt-2 flex w-full items-center gap-2 rounded-xl p-1 text-left hover:bg-surface-muted">
                              <Avatar name={div.person.fullName} size={30} />
                              <span className="min-w-0">
                                <span className="flex items-center gap-1 truncate text-[12px] font-semibold text-fg">{div.person.fullName}{div.levelCode && <Badge tone={div.levelCode === "L3H" ? "warning" : "primary"}>{div.levelCode}</Badge>}</span>
                                <span className="block truncate text-[10.5px] text-muted">{div.person.title}</span>
                              </span>
                            </button>
                          )}
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <b className="text-fg">{fmtNum(div.headcount)}</b>
                            </span>
                            <span>{fmtPct(div.femalePct)} female</span>
                          </div>
                        </div>
                        {open && (
                          <div className="org-vlist">
                            {div.children.map((dept) => {
                              const dOpen = expanded.has(dept.id);
                              const limit = limits[dept.id] ?? PAGE;
                              return (
                                <div key={dept.id} className="org-vitem">
                                  <div id={domId(dept.id)} className={cn("glass rounded-xl p-2.5 transition-shadow", ring(dept.id))}>
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="truncate text-[12px] font-semibold text-fg">{dept.label}</p>
                                      <Toggle open={dOpen} count={Math.max(0, dept.headcount - (dept.person ? 1 : 0))} onClick={() => toggle(dept.id)} />
                                    </div>
                                    {dept.person && (
                                      <button type="button" onClick={() => openEmployee(dept.person!.id)} className="mt-1 flex w-full items-center gap-1.5 text-left">
                                        <Avatar name={dept.person.fullName} size={22} />
                                        <span className="min-w-0 flex-1 truncate text-[11px] text-muted hover:text-fg">{dept.person.fullName}</span>
                                        {dept.levelCode && <Badge tone={dept.levelCode === "L3H" ? "warning" : "primary"}>{dept.levelCode}</Badge>}
                                      </button>
                                    )}
                                  </div>
                                  {dOpen && (
                                    <div className="org-vlist">
                                      {dept.children.slice(0, limit).map((employeeNode) => (
                                        <EmployeeBranch key={employeeNode.id} node={employeeNode} expanded={expanded} toggle={toggle} openEmployee={openEmployee} ring={ring} />
                                      ))}
                                      {dept.children.length > limit && (
                                        <div className="org-vitem">
                                          <button type="button" onClick={() => setLimits((l) => ({ ...l, [dept.id]: limit + PAGE }))} className="w-full rounded-xl border border-dashed border-line-strong px-2 py-1.5 text-[11px] font-semibold text-primary hover:bg-surface-muted dark:text-accent">
                                            Show {Math.min(PAGE, dept.children.length - limit)} more · {fmtNum(dept.children.length - limit)} remaining
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
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
