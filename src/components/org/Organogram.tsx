"use client";

import { Building2, Download, FileDown, FileText, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { fmtNum, slugify, timestampSlug } from "@/lib/format";
import { LEVEL_COLORS, downloadOrgSvg, downloadOrgVectorPdf, downloadOrgVisio, printOrgSvg, type OrgExportOpts } from "@/lib/org-export";
import { ATOMA_CARD, RAIL_W, type LayerInfo, type LNode, type OrgLayout, type LEdge } from "@/lib/orglayout";
import { buildDepartmentSheets, downloadPrintPack, fitPrintPack, type Paper } from "@/lib/orgprint";
import type { Employee } from "@/lib/types";
import { employeeStatus, type OrgNode } from "@/lib/orgtree";
import { useUIStore } from "@/store/ui";
import { Badge, IconButton, Spinner } from "../ui/primitives";
import { loadLayoutOverrides, saveLayoutOverrides, clearLayoutOverrides, type PositionMap } from "@/lib/layout-overrides";

const levelColor = (level?: string) => LEVEL_COLORS[(level ?? "L2") as keyof typeof LEVEL_COLORS] ?? "#64748B";

function CardView({ node, onOpenEmployee, onPointerDown }: { node: LNode; onOpenEmployee: (id: string | null) => void; onPointerDown?: (id: string, ev: React.PointerEvent) => void }) {
  const orgNode = node.node as OrgNode;
  const e = orgNode.emp;
  const st = employeeStatus(e);
  const color = levelColor(orgNode.level);
  return (
    <button
      type="button"
      onClick={() => onOpenEmployee(e.id)}
      onPointerDown={(ev) => onPointerDown?.(node.id, ev)}
      className="absolute overflow-hidden rounded-[5px] border text-left transition-transform hover:z-20 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(6,43,91,0.25)]"
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        background: st.temporary ? "#FEF08A" : "#FFFFFF",
        borderColor: st.vacant ? "#64748B" : node.inferred ? "#F59E0B" : "#94A3B8",
        borderStyle: st.vacant || node.inferred ? "dashed" : "solid",
        borderWidth: node.inferred ? 1.8 : 1.1,
        touchAction: "none",
      }}
    >
      <span className="absolute inset-x-0 top-0 h-[5px]" style={{ background: color }} />
      <span className="absolute top-[11px] right-1.5 left-1.5 line-clamp-2 text-[11px] leading-[13px] font-bold text-slate-900">{st.vacant ? "VACANT" : e.title || "—"}</span>
      <span className="absolute right-1.5 bottom-1.5 left-1.5 truncate text-[10px] leading-[13px] text-slate-700">{st.vacant ? "(Vacant post)" : e.fullName}</span>
      {st.temporary && <span className="absolute top-[7px] right-1.5 text-[8px] font-bold text-amber-900">TEMP</span>}
    </button>
  );
}

function GroupView({ node, onOpenEmployee, onPointerDown }: { node: LNode; onOpenEmployee: (id: string | null) => void; onPointerDown?: (id: string, ev: React.PointerEvent) => void }) {
  const members = node.members ?? [];
  const color = levelColor(members[0]?.level);
  const cols = members.length <= 8 ? 2 : members.length <= 24 ? 3 : 4;
  return (
    <div
      className="absolute overflow-hidden rounded-[5px] border bg-white"
      onPointerDown={(ev) => onPointerDown?.(node.id, ev)}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h, borderColor: color, touchAction: "none" }}
    >
      <div className="absolute inset-x-0 top-0 h-[28px] bg-slate-50" />
      <span className="absolute top-[8px] left-2 text-[8.5px] font-bold text-slate-900">{members.length} positions at this level</span>
      <div className="absolute top-[32px] right-1.5 left-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {members.map((m) => {
          const st = employeeStatus(m.emp);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenEmployee(m.emp.id)}
              className="rounded-[3px] border px-1.5 py-1 text-left transition-colors hover:border-slate-400 hover:bg-white"
              style={{ background: st.temporary ? "#FEF08A" : "#F8FAFC", borderColor: st.vacant ? "#64748B" : "#E2E8F0", borderStyle: st.vacant ? "dashed" : "solid" }}
            >
              <span className="block truncate text-[8px] font-bold text-slate-900">{m.emp.title}</span>
              <span className="block truncate text-[7px] text-slate-500">{st.vacant ? "VACANT" : m.emp.fullName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function recomputeEdges(nodes: LNode[], layout: OrgLayout): LEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rowOf = new Map<string, number>();
  for (const n of nodes) rowOf.set(n.id, n.layer);
  const edges: LEdge[] = [];
  for (const n of nodes) {
    if (!n.parent) continue;
    const p = byId.get(n.parent);
    if (!p) continue;
    const ps = { w: p.w, h: p.h };
    const ns = { w: n.w, h: n.h };
    const x1 = p.x + ps.w / 2;
    const x2 = n.x + ns.w / 2;
    const y1 = p.y + ps.h;
    const y2 = n.y;
    const parentRow = layout.layers[p.layer];
    const busY = Math.min(parentRow.offset + parentRow.size + layout.gapMain * 0.4, y2 - 16);
    const d = `M${x1} ${y1} V${busY} H${x2} V${y2}`;
    edges.push({ id: `${p.id}->${n.id}`, from: p.id, to: n.id, inferred: n.inferred, points: [[x1, y1], [x1, busY], [x2, busY], [x2, y2]], d, kind: "bus" });
  }
  return edges;
}

/**
 * Interactive ATOMA organogram with an Edit mode that allows dragging boxes and saving per-scope positions.
 */
export function Organogram({ layout, roots, divisionEmployees, division, title, subtitle, generatedBy, onOpenEmployee }: { layout: OrgLayout; roots: OrgNode[]; divisionEmployees?: Employee[]; division?: string; title: string; subtitle: string; generatedBy?: string; onOpenEmployee: (id: string | null) => void }) {
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [paper, setPaper] = useState<Paper>("A3");
  const notify = useUIStore((state) => state.notify);
  const options: OrgExportOpts = useMemo(() => ({ title, subtitle, generatedBy, footer: "Made with \u2665 by Mohibullah Afzalzada" }), [title, subtitle, generatedBy]);
  const people = useMemo(() => layout.nodes.reduce((a, n) => a + (n.kind === "group" ? n.members?.length ?? 0 : 1), 0), [layout]);
  const groups = layout.nodes.filter((n) => n.kind === "group").length;
  const inferred = layout.edges.filter((e) => e.inferred).length;

  const scope = division || "__all";
  const [overrides, setOverrides] = useState<PositionMap>({});
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    // load overrides for this scope
    const map = loadLayoutOverrides(scope);
    setOverrides(map);
  }, [scope]);

  // adjusted nodes/edges reflect manual positions
  const adjustedLayout = useMemo(() => {
    const nodes = layout.nodes.map((n) => ({ ...n }));
    nodes.forEach((n) => {
      const o = overrides[n.id];
      if (o) { n.x = o.x; n.y = o.y; }
    });
    const edges = recomputeEdges(nodes, layout);
    return { ...layout, nodes, edges } as OrgLayout & { edges: LEdge[] };
  }, [layout, overrides]);

  useEffect(() => {
    // update zoom to fit width on mount
    const id = window.setTimeout(() => {
      const el = document.querySelector('[data-org-canvas]') as HTMLElement | null;
      if (!el) return;
      setZoom(Math.max(0.35, Math.min(1.8, (el.clientWidth - 24) / Math.max(1, layout.width))));
    }, 60);
    return () => window.clearTimeout(id);
  }, [layout.width]);

  const run = async (kind: "pdf" | "svg" | "visio" | "print" | "pack" | "dept") => {
    setBusy(kind);
    try {
      if (kind === "svg") downloadOrgSvg(adjustedLayout as any, options);
      else if (kind === "pdf") await downloadOrgVectorPdf(adjustedLayout as any, options);
      else if (kind === "visio") await downloadOrgVisio(adjustedLayout as any, options);
      else if (kind === "pack") {
        const pack = fitPrintPack(roots, paper);
        await downloadPrintPack(pack.sheets, options, pack.paper, `org-chart-${slugify(title)}-${pack.paper.toLowerCase()}-${timestampSlug()}.pdf`);
        notify("success", "Print pack ready", `${pack.sheets.length} sheet(s) on ${pack.paper} — type prints at ${(11.5 * pack.scale).toFixed(1)} pt.`);
      } else if (kind === "dept") {
        if (divisionEmployees && division) {
          const sheets = buildDepartmentSheets(divisionEmployees, division, paper);
          await downloadPrintPack(sheets, { ...options, title: `${title} · department sheets` }, paper, `org-chart-${slugify(division)}-departments-${timestampSlug()}.pdf`);
        }
      } else printOrgSvg(adjustedLayout as any, options);
    } catch (error) {
      console.error("[atoma] organogram export", error);
    } finally {
      setBusy(null);
    }
  };

  // dragging state
  const dragRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);

  useEffect(() => {
    const onPointerMove = (ev: PointerEvent) => {
      const d = dragRef.current; if (!d) return;
      ev.preventDefault();
      const dx = ev.clientX - d.startX; const dy = ev.clientY - d.startY;
      setOverrides((prev) => {
        const next = { ...prev };
        next[d.id] = { x: d.nodeX + dx / zoom, y: d.nodeY + dy / zoom };
        return next;
      });
    };
    const onPointerUp = () => {
      const d = dragRef.current; if (!d) return;
      // persist
      saveLayoutOverrides(scope, overridesRef.current);
      dragRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [zoom]);

  const overridesRef = useRef<PositionMap>(overrides);
  useEffect(() => { overridesRef.current = overrides; }, [overrides]);

  const handlePointerDown = (id: string, ev: React.PointerEvent) => {
    if (!editMode) return;
    ev.preventDefault(); const target = ev.currentTarget as HTMLElement;
    (target as Element).setPointerCapture(ev.pointerId);
    const n = adjustedLayout.nodes.find((x) => x.id === id);
    if (!n) return;
    dragRef.current = { id, startX: ev.clientX, startY: ev.clientY, nodeX: n.x, nodeY: n.y };
  };

  const resetLayout = () => {
    clearLayoutOverrides(scope);
    setOverrides({});
  };

  const saveLayout = () => {
    saveLayoutOverrides(scope, overrides);
    notify("success", "Layout saved", "Custom positions saved for this scope (local browser storage).");
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted" data-no-capture="true">
        <span className="font-semibold text-fg">{title}</span>
        <Badge tone="primary">{fmtNum(people)} people</Badge>
        <Badge tone="primary">{layout.layers.length} level rows</Badge>
        {groups > 0 && <Badge tone="accent">{groups} roster cards</Badge>}
        {inferred > 0 && <Badge tone="warning">{inferred} inferred lines</Badge>}
        <span className="ml-auto flex items-center gap-1">
          <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.1).toFixed(2)))}>
            <ZoomOut />
          </IconButton>
          <span className="w-10 text-center font-semibold text-fg tabular-nums">{Math.round(zoom * 100)}%</span>
          <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}>
            <ZoomIn />
          </IconButton>

          <label className="ml-2 inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} /> Edit layout
          </label>
          {editMode && (
            <>
              <button onClick={saveLayout} className="ml-2 rounded-lg bg-[#0D47A1] px-3 py-1.5 text-[11px] font-bold text-white">Save</button>
              <button onClick={resetLayout} className="ml-2 rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold">Reset</button>
            </>
          )}

          <span className="mx-1 h-5 w-px bg-line" />
          <IconButton label="Single-page editable vector PDF" onClick={() => void run("pdf")} disabled={busy !== null}>
            {busy === "pdf" ? <Spinner /> : <FileDown />}
          </IconButton>
          <IconButton label="Editable SVG" onClick={() => void run("svg")} disabled={busy !== null}>
            <Download />
          </IconButton>
          <IconButton label="Editable Microsoft Visio drawing" onClick={() => void run("visio")} disabled={busy !== null}>
            {busy === "visio" ? <Spinner /> : <FileText />}
          </IconButton>
          <span className="mx-1 h-5 w-px bg-line" />
          <select className="field h-8 w-[70px] text-xs" value={paper} onChange={(event) => setPaper(event.target.value as Paper)} aria-label="Print paper size">
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="A2">A2</option>
          </select>
          <IconButton label={`Multi-page print pack (${paper} · readable type)`} onClick={() => void run("pack")} disabled={busy !== null}>
            {busy === "pack" ? <Spinner /> : <FileDown />}
          </IconButton>
          {divisionEmployees && division && (
            <IconButton label="Department print sheets (division head on every sheet)" onClick={() => void run("dept")} disabled={busy !== null}>
              {busy === "dept" ? <Spinner /> : <Building2 />}
            </IconButton>
          )}
          <IconButton label="Print one page" onClick={() => void run("print")} disabled={busy !== null}>
            <Printer />
          </IconButton>
        </span>
      </div>

      <div className="relative max-h-[74vh] overflow-auto" data-export-expand="true" data-org-canvas>
        <div className="relative origin-top-left" style={{ width: adjustedLayout.width, height: adjustedLayout.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          {/* level rows */}
          {adjustedLayout.layers.map((layer: LayerInfo) => {
            const top = Math.max(0, layer.offset - adjustedLayout.gapMain / 2);
            const height = layer.size + adjustedLayout.gapMain;
            return (
              <div key={`${layer.level}-${layer.index}`} className="absolute" style={{ left: 0, top, width: adjustedLayout.width, height, background: layer.index % 2 ? "#F8FAFC" : "#FFFFFF" }}>
                {layer.index > 0 && <div className="absolute top-0 right-3 left-3 h-[2px] bg-amber-500" />}
              </div>
            );
          })}

          {/* level rail */}
          <div className="absolute top-0 bg-amber-200/85" style={{ left: 0, width: RAIL_W, height: adjustedLayout.height }}>
            {adjustedLayout.layers.map((layer: LayerInfo) => {
              const top = Math.max(0, layer.offset - adjustedLayout.gapMain / 2);
              const height = layer.size + adjustedLayout.gapMain;
              return (
                <div key={`rail-${layer.level}-${layer.index}`} className="absolute inset-x-0 flex flex-col items-center justify-center" style={{ top, height }}>
                  <span className="text-[14px] leading-none font-extrabold text-slate-900">
                    {layer.level}
                    {layer.continuation ? " cont." : ""}
                  </span>
                  <span className="mt-2 grid h-[22px] w-[22px] place-items-center rounded-full border-2 bg-white text-[9px] font-bold text-slate-900" style={{ borderColor: levelColor(layer.level) }}>
                    {layer.count}
                  </span>
                </div>
              );
            })}
          </div>

          <svg className="pointer-events-none absolute inset-0" width={adjustedLayout.width} height={adjustedLayout.height} aria-hidden>
            <defs>
              <marker id="orgArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#1F2937" />
              </marker>
              <marker id="orgArrowInferred" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#F59E0B" />
              </marker>
            </defs>
            {adjustedLayout.edges.map((edge) => (
              <path key={edge.id} markerEnd={edge.inferred ? "url(#orgArrowInferred)" : "url(#orgArrow)"} d={edge.d} fill="none" stroke={edge.inferred ? "#F59E0B" : "#1F2937"} strokeWidth={edge.inferred ? 1.6 : 1.25} strokeDasharray={edge.inferred ? "5 4" : edge.kind === "staff" ? "4 3" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>

          {adjustedLayout.nodes.map((node) => (node.kind === "group" ? <GroupView key={node.id} node={node} onOpenEmployee={onOpenEmployee} onPointerDown={handlePointerDown} /> : <CardView key={node.id} node={node} onOpenEmployee={onOpenEmployee} onPointerDown={handlePointerDown} />))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-[2px] border border-slate-400 bg-white" /> Filled post
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-[2px] border border-dashed border-slate-500 bg-white" /> Vacant post
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-[2px] border border-amber-500 bg-amber-200" /> Temporary / contract
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="22" height="12" aria-hidden>
            <line x1="1" y1="6" x2="21" y2="6" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="5 4" />
          </svg>
          Inferred line
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-5 rounded-[2px] bg-amber-200" /> Level band
        </span>
        <span className="ml-auto">
          Card size {ATOMA_CARD.w}×{ATOMA_CARD.h} · Made with <span className="text-rose-500">♥</span> by <span className="font-semibold text-fg">Mohibullah Afzalzada</span>
        </span>
      </div>
    </div>
  );
}
