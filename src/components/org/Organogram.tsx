"use client";

import { ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn, fmtNum } from "@/lib/format";
import { CARD_H, CARD_W, layoutOrganogram, RAIL_W, buildDivisionOrganogram, type OrganogramNode, type PlacedNode } from "@/lib/organogram";
import type { Employee } from "@/lib/types";
import { Avatar, Badge, IconButton } from "../ui/primitives";

const LEVEL_FILL: Record<string, string> = {
  L6: "#062B5B", L5: "#0D47A1", L4: "#1E6FE0", L3H: "#F59E0B", L3: "#00A8FF", L2: "#64748B", L1: "#94A3B8",
};

function Card({ item, onOpen, highlight }: { item: PlacedNode; onOpen: (id?: string) => void; highlight: string | null }) {
  const node: OrganogramNode = item.node;
  const active = highlight === node.id;
  return (
    <div
      id={`org-${node.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
      onClick={() => node.employeeId && onOpen(node.employeeId)}
      role={node.employeeId ? "button" : undefined}
      tabIndex={node.employeeId ? 0 : undefined}
      onKeyDown={(event) => {
        if (node.employeeId && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(node.employeeId);
        }
      }}
      className={cn(
        "absolute flex flex-col justify-center rounded-[3px] border bg-white px-2.5 py-1.5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.16)] transition-transform",
        node.employeeId && "cursor-pointer hover:z-20 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(6,43,91,0.22)]",
        node.vacant ? "border-dashed border-slate-500 bg-white/85" : node.temporary ? "border-amber-500 bg-amber-200" : "border-slate-700",
        active && "z-20 ring-4 ring-amber-400/70"
      )}
      style={{ left: item.x - item.width / 2, top: item.y, width: item.width, height: CARD_H }}
    >
      <p className={cn("truncate text-[10.5px] leading-tight font-bold text-slate-900", node.vacant && "italic")}>{node.title}</p>
      <p className="truncate text-[10px] leading-tight text-slate-700">
        {node.name}
        {node.vacant ? "" : ""}
      </p>
      {node.reports > 0 && (
        <span className="absolute -top-2 -right-2 rounded-full border border-white bg-slate-700 px-1.5 text-[9px] leading-[15px] font-semibold text-white shadow">{node.reports}</span>
      )}
    </div>
  );
}

/**
 * ATOMA divisional organogram: vertical level rail (L6 at the top through L1 at the bottom),
 * centred subtrees, right-angle connectors, dotted vacant posts and highlighted temporary staff.
 */
export function Organogram({ employees, scopeLabel, onOpenEmployee }: { employees: Employee[]; scopeLabel: string; onOpenEmployee: (id: string | null) => void }) {
  const [zoom, setZoom] = useState(1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tree = useMemo(() => buildDivisionOrganogram(employees), [employees]);
  const layout = useMemo(() => layoutOrganogram(tree), [tree]);

  if (!tree) return <div className="grid h-72 place-items-center text-sm text-muted">No employees in this scope.</div>;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted">
        <span className="font-semibold text-fg">{scopeLabel}</span>
        <Badge tone="primary">{fmtNum(employees.length)} employees</Badge>
        <Badge tone="primary">{layout.bands.length} level bands</Badge>
        {layout.vacantCount > 0 && <Badge tone="warning">Dotted = {layout.vacantCount} vacant post{layout.vacantCount === 1 ? "" : "s"}</Badge>}
        {layout.temporaryCount > 0 && <Badge tone="warning">Yellow = {layout.temporaryCount} temporary</Badge>}
        <span className="ml-auto flex items-center gap-1">
          <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.45, +(z - 0.1).toFixed(2)))}><ZoomOut /></IconButton>
          <span className="w-10 text-center font-semibold text-fg tabular-nums">{Math.round(zoom * 100)}%</span>
          <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}><ZoomIn /></IconButton>
        </span>
      </div>

      <div ref={scroller} className="relative max-h-[70vh] overflow-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_27px,rgba(6,43,91,0.035)_28px)]" data-export-expand="true">
        <div className="relative origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          {/* level rail */}
          <div className="absolute top-0 left-0 border-r border-slate-300 bg-slate-50" style={{ width: RAIL_W, height: layout.height }}>
            {layout.bands.map((band) => (
              <div key={band.level} className="absolute flex flex-col items-center justify-center border-b-2 border-amber-500" style={{ top: band.y, height: band.height, width: RAIL_W }}>
                <span className="text-[15px] leading-none font-extrabold text-slate-800">{band.level}</span>
                <span className="mt-1 text-[8.5px] leading-tight text-slate-500 uppercase">{band.label}</span>
                <span className="mt-1 rounded-full px-1.5 text-[8.5px] font-semibold text-white" style={{ background: LEVEL_FILL[band.level] ?? "#64748B" }}>{band.count}</span>
              </div>
            ))}
          </div>

          {/* band separators */}
          {layout.bands.map((band) => (
            <div key={`sep-${band.level}`} className="absolute right-0 left-0 h-[2px] bg-amber-500/85" style={{ top: band.y + band.height - 1, marginLeft: RAIL_W }} />
          ))}

          {/* connectors */}
          <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height} aria-hidden>
            {layout.edges.map((edge, index) => (
              <path key={index} d={edge.d} fill="none" stroke="#334155" strokeWidth={edge.kind === "stack" ? 1.6 : 1.6} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>

          {/* cards */}
          {layout.nodes.map((item) => (
            <div key={item.node.id}>
              <Card item={item} onOpen={(id) => { setHighlight(item.node.id); onOpenEmployee(id ?? null); }} highlight={highlight} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-slate-700 bg-white" /> Filled post</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-dashed border-slate-500 bg-white" /> Vacant post</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-amber-500 bg-amber-200" /> Temporary / contract</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border-b-2 border-amber-500 bg-slate-100" /> Level band</span>
        <span className="ml-auto inline-flex items-center gap-1"><Avatar name={tree.name} size={18} /> {tree.name} · {tree.title}</span>
      </div>
    </div>
  );
}
