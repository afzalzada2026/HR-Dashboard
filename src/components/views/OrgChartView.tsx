"use client";
import { ArrowUpDown, Briefcase, CheckCircle2, GitBranch, Info, Layers, Link2, Search, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ancestorIds,
  averageDepth,
  buildOrgTree,
  employeeOrgKey,
  employeeStatus,
  loadOrgOverrides,
  rankDivisionHeadCandidates,
  saveOrgOverrides,
  scopeRoots,
  type OrgNode,
  type OrgOverrides,
} from "@/lib/orgtree";
import {
  analyzeLevels,
  layerOfLevel,
  levelAtLayer,
  levelOrderLabel,
  resolveSeniorityDirection,
  type LevelInfo,
  type SeniorityDirection,
} from "@/lib/organogram-levels";
import { buildOrgLayout } from "@/lib/orglayout";
import { clearLayoutOverrides, loadTextOverrides, saveTextOverrides, type TextOverrideMap } from "@/lib/layout-overrides";
import { fmtNum, fmtPct } from "@/lib/format";
import { can } from "@/lib/rbac";
import type { Employee } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { COMPACT_CARD, ORG_CARD, Organogram } from "../org/Organogram";
import { OrgChartBoundary } from "../org/OrgChartBoundary";
import { InfoTip } from "../org/InfoTip";
import { DataGate } from "../shell/Chrome";
import { Badge, Card, CardTitle, PageHeader } from "../ui/primitives";

/* ───────────────────────── level widgets ───────────────────────── */

function LevelPyramid({ levels, total }: { levels: LevelInfo[]; total: number }) {
  const max = Math.max(1, ...levels.map((l) => l.count));
  return (
    <div className="space-y-1">
      {levels.map((l) => (
        <div key={l.label} className="grid grid-cols-[52px_1fr_150px] items-center gap-2 text-[11px]">
          <span className="rounded-md px-1.5 py-0.5 text-center font-extrabold text-white" style={{ background: l.color }}>
            {l.label.replace(/^L/, "")}
          </span>
          <div className="flex justify-center">
            <div className="h-5 rounded-md" style={{ width: `${Math.max(3, (l.count / max) * 100)}%`, background: `linear-gradient(90deg, ${l.color}, ${l.color}bb)` }} />
          </div>
          <span className="truncate text-muted">
            <b className="text-fg">{fmtNum(l.count)}</b> · {((l.count / Math.max(1, total)) * 100).toFixed(1)}% · {l.band}
          </span>
        </div>
      ))}
    </div>
  );
}

function LevelLegend({
  levels,
  onPick,
  active,
  direction,
}: {
  levels: LevelInfo[];
  onPick?: (layer: number) => void;
  active?: number;
  direction: "high-top" | "low-top";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels.map((l) => {
        const layer = layerOfLevel(l.label, direction);
        return (
          <button
            key={l.label}
            type="button"
            onClick={() => onPick?.(layer)}
            disabled={!onPick}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-bold transition-all ${
              active === layer ? "border-[#00A8FF] bg-[#00A8FF]/10" : "border-line bg-white/40"
            } ${onPick ? "hover:border-[#00A8FF]" : ""}`}
            title={`${l.band} · avg age ${l.avgAge.toFixed(0)} · avg tenure ${l.avgTenure.toFixed(1)} yrs · ${l.topTitles.join(", ")}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-fg">{l.label.replace(/^L/, "")}</span>
            <span className="text-muted">{l.band}</span>
            <span className="rounded-md bg-black/5 px-1 text-fg">{fmtNum(l.count)}</span>
          </button>
        );
      })}
    </div>
  );
}

function LevelLanes({
  nodes,
  levels,
  matches,
  onSelect,
}: {
  nodes: OrgNode[];
  levels: LevelInfo[];
  matches: Set<string>;
  onSelect: (empId: string) => void;
}) {
  const byLevel = useMemo(() => {
    const map = new Map<string, OrgNode[]>();
    nodes.forEach((n) => {
      map.set(n.level, [...(map.get(n.level) ?? []), n]);
    });
    map.forEach((arr) => arr.sort((a, b) => b.total - a.total || a.emp.fullName.localeCompare(b.emp.fullName)));
    return map;
  }, [nodes]);
  return (
    <div className="space-y-2">
      {levels.map((l) => {
        const arr = byLevel.get(l.label) ?? [];
        const shown = arr.slice(0, 48);
        return (
          <div key={l.label} className="grid gap-2 rounded-xl border border-line bg-white/30 p-2 lg:grid-cols-[190px_1fr]">
            <div className="flex items-center gap-2 lg:border-r lg:border-line lg:pr-2">
              <span className="rounded-md px-2 py-1 text-xs font-extrabold text-white" style={{ background: l.color }}>
                {l.label.replace(/^L/, "")}
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-extrabold text-fg">{l.band}</div>
                <div className="text-[10px] text-muted">
                  {fmtNum(arr.length)} · avg {l.avgAge.toFixed(0)} yrs · {fmtNum(l.female)} F
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {shown.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelect(n.emp.id)}
                  title={`${n.emp.title} · ${n.emp.department}${n.children.length ? ` · ${n.children.length} direct reports` : ""}`}
                  className={`flex items-center gap-1 rounded-lg border border-line bg-white/50 px-1.5 py-1 text-left hover:border-[#00A8FF] ${
                    matches.has(n.id) ? "ring-2 ring-[#00A8FF]" : ""
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white" style={{ background: l.color }}>
                    {(n.emp.fullName || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="max-w-[120px] truncate text-[10px] font-bold text-fg">{n.emp.fullName}</span>
                  {n.children.length > 0 && <span className="rounded bg-black/5 px-1 text-[9px] font-bold text-muted">{n.children.length}</span>}
                </button>
              ))}
              {arr.length > shown.length && <span className="self-center px-1 text-[10px] font-semibold text-muted">+{fmtNum(arr.length - shown.length)} more</span>}
              {arr.length === 0 && <span className="self-center text-[10px] text-muted">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── print / report variant ───────────────────────── */

/**
 * Non-interactive compact organogram for reports (ported from the reference
 * `OrgChartPrint`). `expandPos` is an index into the analysed level list
 * (-1 = everyone).
 */
export function OrgChartPrint({
  data,
  division,
  department,
  expandPos,
  maxWidth = 1352,
}: {
  data: Employee[];
  division?: string;
  department?: string;
  expandPos: number;
  maxWidth?: number;
}) {
  const [overrides] = useState<OrgOverrides>(() => (typeof window === "undefined" ? { heads: {}, reporting: {} } : loadOrgOverrides()));
  const build = useMemo(() => buildOrgTree(data, overrides), [data, overrides]);
  const roots = useMemo(() => scopeRoots(build, division, department), [build, division, department]);
  const levels = useMemo(() => analyzeLevels(data, "high-top"), [data]);
  const isOpen = useMemo(() => {
    const limit =
      expandPos < 0
        ? Number.POSITIVE_INFINITY
        : layerOfLevel(levels[Math.min(expandPos, Math.max(0, levels.length - 1))]?.label ?? "L6", "high-top");
    return (id: string) => {
      const node = build.byId.get(id);
      return node ? layerOfLevel(node.level, "high-top") < limit : false;
    };
  }, [expandPos, levels, build]);
  const layout = useMemo(
    () => buildOrgLayout(roots, { card: COMPACT_CARD, isOpen, layerOf: (n) => layerOfLevel(n.level, "high-top"), levelAtLayer: levelAtLayer("high-top") }),
    [roots, isOpen]
  );
  return (
    <div style={{ width: maxWidth }}>
      <Organogram
        layout={layout}
        fullLayout={layout}
        roots={roots}
        title={`Organogram — ${department || division || "Whole organization"}`}
        subtitle={`${fmtNum(data.length)} employees · rows = levels`}
        onOpenEmployee={() => {}}
        readOnly
      />
    </div>
  );
}

/* ───────────────────────── main view ───────────────────────── */

function OrgInner() {
  const filtered = useDataStore((s) => s.filtered);
  const openEmployee = useUIStore((s) => s.openEmployee);
  const session = useUIStore((s) => s.session);
  const notify = useUIStore((s) => s.notify);

  const divisions = useMemo(() => [...new Set(filtered.map((e) => e.division).filter(Boolean))].sort(), [filtered]);

  const [division, setDivision] = useState(() => (divisions.length === 1 ? divisions[0] : ""));
  const [department, setDepartment] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"chart" | "lanes">("chart");
  const [compact, setCompact] = useState(false);
  const [directionPref, setDirectionPref] = useState<SeniorityDirection>("auto");
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [showLineEditor, setShowLineEditor] = useState(false);
  const [lineEmployee, setLineEmployee] = useState("");
  const [lineManager, setLineManager] = useState("");
  const [toggled, setToggled] = useState<Map<string, boolean>>(() => new Map());

  // Overrides load after mount so server and client render identical trees (no hydration error).
  const [overrides, setOverrides] = useState<OrgOverrides>({ heads: {}, reporting: {} });
  const [textOverrides, setTextOverrides] = useState<TextOverrideMap>({});
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setOverrides(loadOrgOverrides());
      setTextOverrides(loadTextOverrides());
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Which rows are revealed on first load (reference default: the top level only
  // for the whole organisation, down to L4 for a big division, everyone if small).
  const [expandLayer, setExpandLayer] = useState<number>(() => {
    const only = divisions.length === 1 ? divisions[0] : "";
    const dir = resolveSeniorityDirection("auto", filtered).direction;
    if (!only) return layerOfLevel("L6", dir);
    const inDivision = filtered.filter((e) => e.division === only);
    const depts = new Set(inDivision.map((e) => e.department).filter(Boolean));
    if (depts.size === 1 || inDivision.length <= 80) return Number.POSITIVE_INFINITY;
    return layerOfLevel("L4", dir);
  });

  /* ── data model ── */
  // Card text edits are applied on top of the HRIS rows before the tree is built,
  // so search, lanes, pyramid and every export show the edited text consistently.
  const displayData = useMemo(() => {
    if (Object.keys(textOverrides).length === 0) return filtered;
    return filtered.map((e) => {
      const ov = textOverrides[employeeOrgKey(e)];
      if (!ov) return e;
      return { ...e, fullName: ov.fullName ?? e.fullName, title: ov.title ?? e.title, department: ov.department ?? e.department };
    });
  }, [filtered, textOverrides]);

  const detection = useMemo(() => resolveSeniorityDirection(directionPref, displayData), [directionPref, displayData]);
  const direction = detection.direction;

  const build = useMemo(() => buildOrgTree(displayData, overrides, direction), [displayData, overrides, direction]);
  const roots = useMemo(() => scopeRoots(build, division || undefined, department || undefined), [build, division, department]);

  const inScope = useMemo(
    () => build.nodes.filter((n) => (!division || n.emp.division === division) && (!department || n.emp.department === department)),
    [build, division, department]
  );
  const levels = useMemo(() => analyzeLevels(displayData, direction), [displayData, direction]);
  const scopeLevels = useMemo(() => analyzeLevels(inScope.map((n) => n.emp), direction), [inScope, direction]);

  const departments = useMemo(
    () => (division ? [...new Set(displayData.filter((e) => e.division === division).map((e) => e.department).filter(Boolean))].sort() : []),
    [displayData, division]
  );
  const candidates = useMemo(
    () => (division ? rankDivisionHeadCandidates(displayData, division, overrides.heads?.[division], direction) : []),
    [displayData, division, overrides.heads, direction]
  );
  const selectedHead = build.divisionHeads.get(division);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(
      build.nodes
        .filter((n) => `${n.emp.fullName} ${n.emp.title} ${n.emp.employeeNo} ${n.emp.department} ${n.emp.email}`.toLowerCase().includes(q))
        .map((n) => n.id)
    );
  }, [query, build]);

  const matchAncestors = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((id) => ancestorIds(build, id).forEach((a) => set.add(a)));
    return set;
  }, [matches, build]);

  /* ── expansion / collapse ── */
  const isOpen = useMemo(() => {
    return (id: string): boolean => {
      const manual = toggled.get(id);
      if (manual !== undefined) return manual;
      if (matchAncestors.has(id)) return true;
      const node = build.byId.get(id);
      if (!node) return false;
      return layerOfLevel(node.level, direction) < expandLayer;
    };
  }, [toggled, matchAncestors, build, expandLayer, direction]);

  const onToggle = (id: string) => {
    setToggled((prev) => {
      const next = new Map(prev);
      next.set(id, !isOpen(id));
      return next;
    });
  };

  /* ── layout ── */
  const card = compact ? COMPACT_CARD : ORG_CARD;
  const layerOpts = useMemo(
    () => ({ layerOf: (n: OrgNode) => layerOfLevel(n.level, direction), levelAtLayer: levelAtLayer(direction) }),
    [direction]
  );
  const layout = useMemo(() => buildOrgLayout(roots, { card, isOpen, ...layerOpts }), [roots, card, isOpen, layerOpts]);
  // Downloads/print always use compact cards (reference behaviour): boxes stay small
  // and type keeps its designed size instead of a huge box with near-invisible text.
  const fullLayout = useMemo(
    () => buildOrgLayout(roots, { card: COMPACT_CARD, isOpen: () => true, gapMain: 42, ...layerOpts }),
    [roots, layerOpts]
  );
  const exportViewLayout = useMemo(
    () => buildOrgLayout(roots, { card: COMPACT_CARD, isOpen, gapMain: 42, ...layerOpts }),
    [roots, isOpen, layerOpts]
  );

  /* ── stable org-key per node (text edits must not change the key) ── */
  const empKeys = useMemo(() => {
    const map = new Map<string, string>();
    build.nodes.forEach((n) => {
      const index = Number(n.id.replace(/^n/, ""));
      const original = Number.isFinite(index) ? filtered[index] : undefined;
      map.set(n.id, employeeOrgKey(original ?? n.emp));
    });
    return map;
  }, [build, filtered]);
  const editedKeys = useMemo(() => new Set(Object.keys(textOverrides)), [textOverrides]);

  const statusCounts = useMemo(() => {
    let vacant = 0;
    let temporary = 0;
    inScope.forEach((n) => {
      const st = employeeStatus(n.emp);
      if (st.vacant) vacant++;
      else if (st.temporary) temporary++;
    });
    return { vacant, temporary };
  }, [inScope]);

  /* ── editors ── */
  const setHead = (key: string) => {
    const next: OrgOverrides = { ...overrides, heads: { ...(overrides.heads ?? {}), [division]: key }, reporting: overrides.reporting ?? {} };
    saveOrgOverrides(next);
    setOverrides(next);
  };
  const resetHead = () => {
    const heads = { ...(overrides.heads ?? {}) };
    delete heads[division];
    const next: OrgOverrides = { ...overrides, heads, reporting: overrides.reporting ?? {} };
    saveOrgOverrides(next);
    setOverrides(next);
  };

  const handleTextEdit = (key: string, field: "fullName" | "title", value: string | null) => {
    const next: TextOverrideMap = { ...textOverrides };
    const entry = { ...(next[key] ?? {}) };
    if (value === null) delete entry[field];
    else entry[field] = value;
    if (Object.keys(entry).length === 0) delete next[key];
    else next[key] = entry;
    saveTextOverrides(next);
    setTextOverrides(next);
  };

  const handleRewire = (childId: string, managerId: string): string | null => {
    if (managerId.startsWith("g:")) return "Drop onto a person card, not a roster of positions.";
    if (childId.startsWith("g:")) return "Roster cards cannot be rewired — open the person from their profile instead.";
    const child = build.byId.get(childId);
    const manager = build.byId.get(managerId);
    if (!child || !manager) return "Unknown card — the chart re-rendered mid-drag, try again.";
    if (child.id === manager.id) return "A person cannot report to themselves.";
    let cursor: OrgNode | undefined = manager;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      if (cursor.id === child.id) return `That would create a loop — ${manager.emp.fullName} already sits under ${child.emp.fullName}.`;
      seen.add(cursor.id);
      cursor = cursor.parentId ? build.byId.get(cursor.parentId) : undefined;
    }
    const childKey = empKeys.get(childId) ?? employeeOrgKey(child.emp);
    const managerKey = empKeys.get(managerId) ?? employeeOrgKey(manager.emp);
    const next: OrgOverrides = { heads: overrides.heads ?? {}, reporting: { ...(overrides.reporting ?? {}), [childKey]: managerKey } };
    saveOrgOverrides(next);
    setOverrides(next);
    return null;
  };

  const saveLine = () => {
    if (!lineEmployee) return;
    const reporting = { ...(overrides.reporting ?? {}) };
    if (lineManager) reporting[lineEmployee] = lineManager;
    else delete reporting[lineEmployee];
    const next: OrgOverrides = { heads: overrides.heads ?? {}, reporting };
    saveOrgOverrides(next);
    setOverrides(next);
    notify("success", lineManager ? "Reporting line saved" : "Reporting line reset", lineManager ? "Manual manager override stored in this browser." : "Back to the HRIS / automatic manager.");
  };

  const canManage = can(session.role, "manage_users");

  /* ── scope helpers ── */
  const changeDivision = (value: string) => {
    setDivision(value);
    setDepartment("");
    setToggled(new Map());
    if (!value) {
      setExpandLayer(layerOfLevel("L6", direction));
      return;
    }
    const size = filtered.filter((e) => e.division === value).length;
    setExpandLayer(size <= 80 ? Number.POSITIVE_INFINITY : layerOfLevel("L4", direction));
  };
  const changeDepartment = (value: string) => {
    setDepartment(value);
    setToggled(new Map());
    setExpandLayer(Number.POSITIVE_INFINITY);
  };

  const matched = query.trim()
    ? displayData
        .filter((e) => `${e.fullName} ${e.title} ${e.department}`.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const qlt = build.quality;
  const linkedPct = qlt.total ? (qlt.linked / qlt.total) * 100 : 0;
  const order = levelOrderLabel(levels);
  const scopeTitle = `${division || "All divisions"}${department ? ` · ${department}` : ""}`;
  const subtitle = `${fmtNum(roots.reduce((a, r) => a + r.total, 0))} people · ${layout.layers.length} level rows · ${averageDepth(build).toFixed(1)} average reporting layers`;
  const canRewire = (childId: string, managerId: string) => handleRewire(childId, managerId);

  return (
    <>
      <PageHeader eyebrow="Organization" title="Organogram" icon={<></>} subtitle={subtitle} />

      {/* Controls */}
      <div className="glass animate-fade-up relative z-10 mb-3 rounded-2xl p-3" data-no-capture="true">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[220px_240px_minmax(240px,1fr)_auto] xl:items-center">
          <label className="relative">
            <select
              className="field h-10 pl-9"
              value={division}
              onChange={(event) => changeDivision(event.target.value)}
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
            <select
              className="field h-10 pl-9 disabled:cursor-not-allowed disabled:opacity-50"
              value={department}
              disabled={!division}
              onChange={(event) => changeDepartment(event.target.value)}
              aria-label="Filter organogram by department"
            >
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="relative w-full">
            <input
              className="field h-10 pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a person to highlight on the chart…"
              aria-label="Find employee"
            />
            <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMode("chart")}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${mode === "chart" ? "bg-[#0D47A1] text-white" : "border border-line text-fg"}`}
              title="Hierarchy chart"
            >
              <GitBranch size={14} />
            </button>
            <button
              type="button"
              onClick={() => setMode("lanes")}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${mode === "lanes" ? "bg-[#0D47A1] text-white" : "border border-line text-fg"}`}
              title="Level swim-lanes"
            >
              <Layers size={14} />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowLineEditor((v) => !v)}
                className={`rounded-xl px-3 py-2 text-xs font-bold ${showLineEditor ? "bg-amber-500 text-white" : "border border-line text-fg"}`}
                title="Review / override reporting lines"
              >
                <Briefcase size={14} />
              </button>
            )}
            <span className="ml-1 text-[11px] text-muted">
              {fmtNum(qlt.linked)}/{fmtNum(qlt.total)} reporting lines resolved ·{" "}
              <span className={qlt.inferred ? "text-warning" : "text-success"}>{fmtNum(qlt.inferred)} inferred</span>
            </span>
          </div>
        </div>

        {division && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
            <span className="mr-1 text-[10px] font-bold tracking-wide text-muted uppercase">Department pages</span>
            <button
              type="button"
              onClick={() => {
                setDepartment("");
                setToggled(new Map());
                const size = displayData.filter((e) => e.division === division).length;
                setExpandLayer(size <= 80 ? Number.POSITIVE_INFINITY : layerOfLevel("L4", direction));
              }}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold ${!department ? "bg-[#0D47A1] text-white" : "border border-line text-fg hover:border-[#00A8FF]"}`}
            >
              All · {fmtNum(displayData.filter((e) => e.division === division).length)}
            </button>
            {departments.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => changeDepartment(d)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold ${department === d ? "bg-[#0D47A1] text-white" : "border border-line text-fg hover:border-[#00A8FF]"}`}
              >
                {d} · {fmtNum(displayData.filter((e) => e.division === division && e.department === d).length)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold tracking-wide text-muted uppercase">Expand down to</span>
          <select
            className="rounded-lg border border-line bg-white/60 px-2 py-1 text-xs font-semibold text-fg outline-none"
            value={String(expandLayer)}
            onChange={(event) => {
              setExpandLayer(Number(event.target.value));
              setToggled(new Map());
            }}
            aria-label="Expand chart down to level"
          >
            {scopeLevels.map((l) => (
              <option key={l.label} value={String(layerOfLevel(l.label, direction))}>
                {l.label.replace(/^L/, "")} · {l.band}
              </option>
            ))}
            <option value={String(Number.POSITIVE_INFINITY)}>Everyone</option>
          </select>
          <button
            type="button"
            onClick={() => setCompact(!compact)}
            className={`rounded-lg border px-2 py-1 text-[11px] font-bold ${compact ? "border-[#00A8FF] bg-[#00A8FF]/10 text-fg" : "border-line text-fg"}`}
          >
            Compact cards
          </button>
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted">
            <Info size={12} /> pan the canvas by dragging · click a card for the profile
          </span>
        </div>
      </div>

      {/* Levels + quality */}
      <div className="mb-3 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="animate-fade-up">
          <CardTitle
            title={
              <span className="flex items-center gap-2">
                <Layers size={16} className="text-[#00A8FF]" /> Company levels · {scopeTitle} <InfoTip text="Rows of the organogram are company levels. Click a level in the legend to expand the chart down to it." />
              </span>
            }
            subtitle={
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold tracking-wide text-muted uppercase">Top → bottom:</span>
                <span className="rounded-md bg-[#0D47A1]/10 px-1.5 py-0.5 font-bold text-[#0D47A1]">{order || "—"}</span>
                <button
                  type="button"
                  onClick={() => setDirectionPref(direction === "high-top" ? "low-top" : "high-top")}
                  className="flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 font-bold text-fg hover:border-[#00A8FF]"
                  title={detection.reason}
                >
                  <ArrowUpDown size={11} /> Flip
                </button>
                {directionPref !== "auto" && (
                  <button
                    type="button"
                    onClick={() => setDirectionPref("auto")}
                    className="rounded-md border border-line px-1.5 py-0.5 font-bold text-muted hover:border-[#00A8FF]"
                    title="Detect from titles / headcount"
                  >
                    Auto-detect
                  </button>
                )}
              </span>
            }
          />
          <div className="mb-2 flex items-start gap-1.5 text-[11px] text-muted">
            <Info size={12} className="mt-0.5 shrink-0" /> {detection.reason}
          </div>
          <LevelPyramid levels={scopeLevels} total={inScope.length} />
          <div className="mt-3">
            <LevelLegend
              levels={scopeLevels}
              direction={direction}
              active={expandLayer === Number.POSITIVE_INFINITY ? undefined : expandLayer}
              onPick={(layer) => {
                setExpandLayer(layer);
                setToggled(new Map());
              }}
            />
          </div>
        </Card>

        <Card className={`animate-fade-up ${linkedPct >= 90 ? "" : "border-amber-500/30"}`}>
          <CardTitle
            title={
              <span className="flex items-center gap-2">
                {linkedPct >= 90 ? <CheckCircle2 size={16} className="text-success" /> : <AlertTriangle size={16} className="text-warning" />} Reporting-line quality{" "}
                <InfoTip text="How employee rows were matched to their supervisor: e-mail and employee number are exact; names use fuzzy spelling; the rest are inferred from the level model." />
              </span>
            }
            subtitle={`${fmtPct(linkedPct)} of rows linked · ${fmtNum(qlt.roots)} root${qlt.roots === 1 ? "" : "s"}${build.top ? ` · top: ${build.top.emp.fullName}` : ""}${qlt.cycles > 0 ? ` · ${qlt.cycles} circular line${qlt.cycles > 1 ? "s" : ""} broken` : ""}`}
          />
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {[
              ["Linked", `${linkedPct.toFixed(1)}%`, `${qlt.linked} of ${qlt.total}`],
              ["By e-mail", String(qlt.byEmail), "supervisor e-mail match"],
              ["By name / ID", String(qlt.byName + qlt.byNo), "name or employee no."],
              ["Inferred", String(qlt.inferred), "attached by level"],
            ].map(([k, v, d]) => (
              <div key={k} className="rounded-xl border border-line bg-white/40 p-2">
                <div className="text-[10px] font-semibold text-muted">{k}</div>
                <div className="text-base font-extrabold text-fg">{v}</div>
                <div className="text-[10px] text-muted">{d}</div>
              </div>
            ))}
          </div>
          {qlt.unmatched.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowUnmatched((v) => !v)}
                className="text-[11px] font-bold text-[#0D47A1] hover:underline"
              >
                {showUnmatched ? "Hide" : "Show"} {qlt.unmatched.length} unmatched supervisor{qlt.unmatched.length > 1 ? "s" : ""}
              </button>
              {showUnmatched && (
                <div className="scroll-thin mt-2 max-h-36 space-y-1 overflow-y-auto">
                  {qlt.unmatched.slice(0, 60).map((u) => (
                    <div key={u.name} className="flex items-center justify-between rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[11px]">
                      <span className="truncate font-semibold text-fg">{u.name}</span>
                      <span className="text-muted">
                        {u.count} report{u.count > 1 ? "s" : ""} · inferred
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="mt-2 text-[10px] text-subtle">
            Resolved by: {fmtNum(qlt.byEmail)} e-mail · {fmtNum(qlt.byNo)} employee number · {fmtNum(qlt.byName)} name/fuzzy ·{" "}
            {fmtNum(qlt.inferred)} inferred. Dashed cards = inferred line; fix by adding the supervisor&apos;s e-mail / employee
            number in the HRIS export, or drag the ⛓ handle in Edit chart mode.
          </p>
        </Card>
      </div>

      {/* Division head candidates (existing module feature) */}
      {division && candidates.length > 0 && (
        <Card className="animate-fade-up mb-3">
          <CardTitle
            title={`Division head — ${division}`}
            subtitle={`Currently: ${selectedHead?.emp.fullName ?? "unresolved"} · choose a different head if the reporting data is incomplete`}
            actions={
              (overrides.heads?.[division] ? (
                <button type="button" onClick={resetHead} className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-bold text-fg">
                  Automatic
                </button>
              ) : undefined)
            }
          />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {candidates.slice(0, 6).map((candidate) => (
              <button
                key={candidate.key}
                type="button"
                onClick={() => setHead(candidate.key)}
                className={`rounded-xl border p-2.5 text-left transition-colors ${
                  candidate.selected ? "border-[#00A8FF] bg-[#00A8FF]/10" : "border-line bg-white/40 hover:border-[#00A8FF]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold text-fg">{candidate.employee.fullName}</span>
                  {candidate.selected && <Badge tone="success">Head</Badge>}
                  {candidate.manual && <Badge tone="warning">Manual</Badge>}
                </div>
                <p className="truncate text-[11px] text-muted">{candidate.employee.title}</p>
                <p className="mt-1 line-clamp-2 text-[10.5px] text-subtle">{candidate.reasons.slice(0, 3).join(" · ")}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Reporting-line exception editor (reference feature, admin only) */}
      {canManage && showLineEditor && (
        <Card className="animate-fade-up mb-3">
          <CardTitle
            title={
              <span className="flex items-center gap-2">
                <Link2 size={16} className="text-amber-500" /> Reporting-line exception
              </span>
            }
            subtitle="Exact supervisor e-mail / employee no / name is used first, with fuzzy spelling support. Use this only when the HRIS manager text is still ambiguous."
          />
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <select
              className="field h-9 text-xs"
              value={lineEmployee}
              onChange={(event) => {
                const key = event.target.value;
                setLineEmployee(key);
                setLineManager(key ? (overrides.reporting?.[key] ?? "") : "");
              }}
              aria-label="Select employee"
            >
              <option value="">Select employee…</option>
              {[...displayData]
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((e) => (
                  <option key={`e-${employeeOrgKey(e)}`} value={employeeOrgKey(e)}>
                    {e.fullName} — {e.title} ({e.division})
                  </option>
                ))}
            </select>
            <select
              className="field h-9 text-xs disabled:opacity-50"
              value={lineManager}
              disabled={!lineEmployee}
              onChange={(event) => setLineManager(event.target.value)}
              aria-label="Select manager"
            >
              <option value="">Use HRIS / automatic manager</option>
              {[...displayData]
                .filter((e) => employeeOrgKey(e) !== lineEmployee)
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((e) => (
                  <option key={`m-${employeeOrgKey(e)}`} value={employeeOrgKey(e)}>
                    {e.fullName} — {e.title} ({e.level})
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!lineEmployee}
              onClick={saveLine}
              className="rounded-lg bg-[#0D47A1] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              Save line
            </button>
          </div>
          {lineEmployee && (
            <div className="mt-1 text-[10px] text-muted">
              Current: {overrides.reporting?.[lineEmployee] ? "manual override" : "HRIS / automatic"}
            </div>
          )}
        </Card>
      )}

      {/* Chart */}
      <div className="glass overflow-hidden rounded-2xl" data-export-expand="true">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[11px]" data-no-capture="true">
          <span className="flex items-center gap-1.5 font-extrabold text-fg">
            {mode === "chart" ? <GitBranch size={14} className="text-[#00A8FF]" /> : <Layers size={14} className="text-[#00A8FF]" />}
            {mode === "chart" ? "Landscape organogram" : "Level swim-lanes"} · {scopeTitle}
          </span>
          <Badge>{fmtNum(inScope.length)} in scope</Badge>
          {roots.length > 1 && <Badge tone="warning">{roots.length} entry points</Badge>}
          {matches.size > 0 && <Badge tone="success">{matches.size} search hit{matches.size > 1 ? "s" : ""}</Badge>}
          <span className="ml-auto text-[10px] text-muted">
            <Search size={11} className="mr-1 inline" />
            {query.trim() ? "search hits ring-highlighted" : "type above to highlight people"} · rows = levels {order}
          </span>
        </div>
        <OrgChartBoundary
          onReset={() => {
            clearLayoutOverrides(division || "__all");
            setToggled(new Map());
          }}
        >
          {mode === "chart" ? (
            <Organogram
              layout={layout}
              fullLayout={fullLayout}
              exportViewLayout={exportViewLayout}
              roots={roots}
              divisionEmployees={division ? displayData.filter((employee) => employee.division === division) : undefined}
              division={division || undefined}
              title={scopeTitle}
              subtitle={subtitle}
              onOpenEmployee={openEmployee}
              matches={matches}
              isOpen={isOpen}
              onToggle={onToggle}
              onRewire={canRewire}
              onTextEdit={handleTextEdit}
              empKeys={empKeys}
              editedKeys={editedKeys}
              statusCounts={statusCounts}
            />
          ) : (
            <LevelLanes nodes={inScope} levels={scopeLevels} matches={matches} onSelect={openEmployee} />
          )}
        </OrgChartBoundary>
      </div>
    </>
  );
}

function BoundaryWithReset() {
  const [resetKey, setResetKey] = useState(0);
  return (
    <OrgChartBoundary onReset={() => setResetKey((k) => k + 1)}>
      <OrgInner key={resetKey} />
    </OrgChartBoundary>
  );
}

export default function OrgChartView() {
  return (
    <DataGate>
      <BoundaryWithReset />
    </DataGate>
  );
}
