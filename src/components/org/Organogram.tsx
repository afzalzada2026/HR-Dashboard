"use client";

import { FileDown, FileText, FileType2, Image as ImageIcon, Plus, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn, downloadBlob, downloadDataUrl, fmtNum, slugify, timestampSlug } from "@/lib/format";
import { useUIStore } from "@/store/ui";
import { captureElement } from "@/lib/exporters";
import { buildOrganogramSVG, exportOrganogramPDF, exportOrganogramVisio, printOrganogram, type OrganogramExportMeta } from "@/lib/org-export";
import { buildDivisionOrganogram, CARD_H, CARD_W, DEFAULT_CHILD_CAP, layoutOrganogram, RAIL_W, toDisplayTree, type OrganogramNode, type PlacedNode } from "@/lib/organogram";
import type { Employee } from "@/lib/types";
import { Badge, IconButton, Spinner } from "../ui/primitives";

const LEVEL_FILL: Record<string, string> = {
  L6: "#062B5B", L5: "#0D47A1", L4: "#1E6FE0", L3H: "#F59E0B", L3: "#00A8FF", L2: "#64748B", L1: "#94A3B8",
};

function Card({ item, onActivate, highlight }: { item: PlacedNode; onActivate: (node: OrganogramNode) => void; highlight: string | null }) {
  const node = item.node;
  const isMore = Boolean(node.moreOf);
  const active = highlight === node.id;
  return (
    <div
      id={`org-${node.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
      onClick={() => onActivate(node)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate(node);
        }
      }}
      className={cn(
        "absolute flex cursor-pointer flex-col justify-center rounded-[3px] border bg-white px-2.5 py-1.5 text-center shadow-[0_1px_2px_rgba(0,0,0,0.16)] transition-transform hover:z-20 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(6,43,91,0.22)]",
        node.vacant ? "border-dashed border-slate-500 bg-white/85" : node.temporary ? "border-amber-500 bg-amber-200" : isMore ? "border-dashed border-sky-500 bg-sky-50" : "border-slate-700",
        active && "z-20 ring-4 ring-amber-400/70"
      )}
      style={{ left: item.x - item.width / 2, top: item.y, width: item.width, height: CARD_H }}
    >
      <p className={cn("truncate text-[10.5px] leading-tight font-bold", isMore ? "text-sky-700" : "text-slate-900", node.vacant && "italic")}>
        {isMore && <Plus className="mr-0.5 inline h-3 w-3" />}
        {node.title}
      </p>
      <p className="truncate text-[10px] leading-tight text-slate-700">
        {node.name}
        <span className="ml-1 rounded-full bg-slate-100 px-1 text-[8px] font-bold text-slate-500">{node.level}</span>
      </p>
      {node.reports > 0 && !isMore && (
        <span className="absolute -top-2 -right-2 rounded-full border border-white bg-slate-700 px-1.5 text-[9px] leading-[15px] font-semibold text-white shadow">{node.reports}</span>
      )}
    </div>
  );
}

/**
 * ATOMA divisional organogram: vertical L6→L1 level rail, centred subtrees with
 * right-angle connectors (reports spread left/right of the reporting line), dotted
 * vacant posts, yellow temporary cards and expandable “+N more” groups.
 */
export function Organogram({ employees, context, scopeLabel, onOpenEmployee }: { employees: Employee[]; context?: Employee[]; scopeLabel: string; onOpenEmployee: (id: string | null) => void }) {
  const [zoom, setZoom] = useState(1);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const notify = useUIStore((state) => state.notify);
  const session = useUIStore((state) => state.session);
  const canvas = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildDivisionOrganogram(context ?? employees, employees), [employees, context]);
  const display = useMemo(() => (tree ? toDisplayTree(tree, caps) : null), [tree, caps]);
  const layout = useMemo(() => layoutOrganogram(display?.tree ?? null), [display]);

  const meta: OrganogramExportMeta = {
    title: `Organization Chart · ${scopeLabel}`,
    scope: `${fmtNum(employees.length)} employees · L6 → L1 hierarchy · ATOMA`,
    generatedBy: `${session.name}`,
  };

  if (!tree || !display) return <div className="grid h-72 place-items-center text-sm text-muted">No employees in this scope.</div>;

  const activate = (node: OrganogramNode) => {
    if (node.moreOf) {
      setCaps((current) => ({ ...current, [node.moreOf as string]: (current[node.moreOf as string] ?? DEFAULT_CHILD_CAP) + 12 }));
      return;
    }
    setHighlight(node.id);
    onOpenEmployee(node.employeeId ?? null);
  };

  const run = async (kind: "pdf" | "svg" | "png" | "print" | "visio") => {
    setBusy(kind);
    try {
      const stamp = `${slugify(scopeLabel)}-${timestampSlug()}`;
      if (kind === "visio") {
        await exportOrganogramVisio(layout, meta, `org-chart-${stamp}.vdx`);
        notify("success", "Visio file downloaded", "Open the .vdx in Microsoft Visio to edit every box and line, then save as .vsd/.vsdx.");
      } else if (kind === "svg") {
        downloadBlob(new Blob([buildOrganogramSVG(layout, meta)], { type: "image/svg+xml;charset=utf-8" }), `org-chart-${stamp}.svg`);
        notify("success", "SVG exported", "Fully editable vector — opens in Illustrator, Visio, draw.io or Office.");
      } else if (kind === "pdf") {
        await exportOrganogramPDF(layout, meta, `org-chart-${stamp}.pdf`);
        notify("success", "PDF exported", "Single-page vector PDF — zoom without quality loss and edit in PDF tools.");
      } else if (kind === "png") {
        const element = canvas.current;
        if (!element) return;
        const shot = await captureElement(element, "#FFFFFF", 2.4);
        downloadDataUrl(shot.toDataURL("image/png"), `org-chart-${stamp}.png`);
        notify("success", "PNG exported", "High-resolution raster image.");
      } else {
        printOrganogram(layout, meta);
      }
    } catch (error) {
      notify("error", "Export failed", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted" data-no-capture="true">
        <span className="font-semibold text-fg">{scopeLabel}</span>
        <Badge tone="primary">{fmtNum(employees.length)} employees</Badge>
        <Badge tone="primary">{layout.bands.length} level bands</Badge>
        {layout.vacantCount > 0 && <Badge tone="warning">Dotted = {layout.vacantCount} vacant</Badge>}
        {layout.temporaryCount > 0 && <Badge tone="warning">Yellow = {layout.temporaryCount} temporary</Badge>}
        {display.hiddenCount > 0 && <Badge tone="accent">{fmtNum(display.hiddenCount)} in “+N more” groups</Badge>}
        <span className="ml-auto flex flex-wrap items-center gap-1">
          <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.1).toFixed(2)))}><ZoomOut /></IconButton>
          <span className="w-10 text-center font-semibold text-fg tabular-nums">{Math.round(zoom * 100)}%</span>
          <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}><ZoomIn /></IconButton>
          <span className="mx-1 h-5 w-px bg-line" />
          <IconButton label="Export single-page vector PDF" onClick={() => void run("pdf")} disabled={busy !== null}>{busy === "pdf" ? <Spinner /> : <FileDown />}</IconButton>
          <IconButton label="Export editable SVG" onClick={() => void run("svg")} disabled={busy !== null}>{busy === "svg" ? <Spinner /> : <FileType2 />}</IconButton>
          <IconButton label="Export high-resolution PNG" onClick={() => void run("png")} disabled={busy !== null}>{busy === "png" ? <Spinner /> : <ImageIcon />}</IconButton>
          <IconButton label="Download editable Visio drawing (.vdx)" onClick={() => void run("visio")} disabled={busy !== null}>{busy === "visio" ? <Spinner /> : <FileText />}</IconButton>
          <IconButton label="Print one page" onClick={() => void run("print")} disabled={busy !== null}><Printer /></IconButton>
        </span>
      </div>

      <div ref={canvas} className="relative max-h-[72vh] overflow-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_27px,rgba(6,43,91,0.035)_28px)]" data-export-expand="true">
        <div className="relative origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          <div className="absolute top-0 left-0 border-r border-slate-300 bg-slate-50" style={{ width: RAIL_W, height: layout.height }}>
            {layout.bands.map((band) => (
              <div key={band.level} className="absolute flex flex-col items-center justify-center border-b-2 border-amber-500" style={{ top: band.y, height: band.height, width: RAIL_W }}>
                <span className="text-[15px] leading-none font-extrabold text-slate-800">{band.level}</span>
                <span className="mt-1 text-[8.5px] leading-tight text-slate-500 uppercase">{band.label}</span>
                <span className="mt-1 rounded-full px-1.5 text-[8.5px] font-semibold text-white" style={{ background: LEVEL_FILL[band.level] ?? "#64748B" }}>{band.count}</span>
              </div>
            ))}
          </div>

          {layout.bands.map((band) => (
            <div key={`sep-${band.level}`} className="absolute right-0 left-0 h-[2px] bg-amber-500/85" style={{ top: band.y + band.height - 1, marginLeft: RAIL_W }} />
          ))}

          <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height} aria-hidden>
            {layout.edges.map((edge, index) => (
              <path key={index} d={edge.d} fill="none" stroke="#334155" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>

          {layout.nodes.map((item) => (
            <Card key={item.node.id} item={item} onActivate={activate} highlight={highlight} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-3 py-2 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-slate-700 bg-white" /> Filled post</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-dashed border-slate-500 bg-white" /> Vacant post</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-amber-500 bg-amber-200" /> Temporary / contract</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border border-dashed border-sky-500 bg-sky-50" /> Click to expand</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-5 rounded-[2px] border-b-2 border-amber-500 bg-slate-100" /> Level band</span>
        <span className="ml-auto">Reports sit centred under their manager (left / right of the reporting line)</span>
      </div>
    </div>
  );
}
