"use client";

import { Download, FileDown, FileText, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtNum, slugify, timestampSlug } from "@/lib/format";
import { LEVEL_ORDER } from "@/lib/organogram-levels";
import type { LayerInfo, LNode, OrgLayout } from "@/lib/orglayout";
import { downloadOrgSvg, downloadOrgVectorPdf, downloadOrgVisio, LEVEL_COLORS, printOrgSvg, type OrgExportOpts } from "@/lib/org-export";
import { employeeStatus, type OrgNode } from "@/lib/orgtree";
import { Badge, IconButton, Spinner } from "../ui/primitives";

const displayLevel = (s?: string) => (s || "—").replace(/^L/i, "");
const initials = (name: string, first = "", last = "") => ((first[0] ?? name[0] ?? "") + (last[0] ?? "")).toUpperCase();
const levelColor = (level?: string) => LEVEL_COLORS[(level ?? "L2") as keyof typeof LEVEL_COLORS] ?? "#64748B";

function CardView({ node, layout, onOpenEmployee }: { node: LNode; layout: OrgLayout; onOpenEmployee: (id: string | null) => void }) {
  const orgNode = node.node as OrgNode;
  const e = orgNode.emp;
  const st = employeeStatus(e);
  const color = levelColor(orgNode.level);
  return (
    <button
      type="button"
      onClick={() => onOpenEmployee(e.id)}
      className="absolute overflow-hidden rounded-[5px] border text-left shadow-[0_1px_2px_rgba(15,23,42,0.18)] transition-transform hover:z-20 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(6,43,91,0.25)]"
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        background: st.temporary ? "#FEF08A" : "#FFFFFF",
        borderColor: st.vacant ? "#64748B" : node.inferred ? "#F59E0B" : "#94A3B8",
        borderStyle: st.vacant || node.inferred ? "dashed" : "solid",
        borderWidth: node.inferred ? 1.8 : 1.2,
      }}
    >
      <span className="absolute inset-y-1 left-0 w-1 rounded-l-[4px]" style={{ background: color }} />
      <span className="absolute top-[9px] right-2 left-3 line-clamp-2 text-[12px] leading-[15px] font-bold text-slate-900">{e.title || "Position not specified"}</span>
      <span className="absolute right-2 bottom-[8px] left-3 truncate text-[11px] text-slate-700">{st.vacant ? "VACANT" : e.fullName}</span>
      {st.temporary && <span className="absolute top-[6px] right-2 text-[8px] font-bold text-amber-900">TEMP</span>}
    </button>
  );
}

function GroupView({ node, onOpenEmployee }: { node: LNode; onOpenEmployee: (id: string | null) => void }) {
  const members = node.members ?? [];
  const color = levelColor(members[0]?.level ?? "L2");
  const cols = members.length <= 8 ? 2 : members.length <= 24 ? 3 : 4;
  const colW = (node.w - 12) / cols;
  return (
    <div className="absolute rounded-[5px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.16)]" style={{ left: node.x, top: node.y, width: node.w, height: node.h, borderColor: color }}>
      <div className="absolute inset-x-0 top-0 h-[30px] rounded-t-[5px] bg-slate-50" />
      <span className="absolute top-[8px] left-[8px] rounded-[3px] px-1.5 py-0.5 text-[8px] font-bold text-white" style={{ background: color }}>
        {members[0]?.level ?? ""}
      </span>
      <span className="absolute top-[10px] left-[40px] text-[8.5px] font-bold text-slate-900">{members.length} positions at this level</span>
      <div className="absolute top-[36px] right-1.5 left-1.5">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
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
                <span className="block truncate text-[7.5px] font-bold text-slate-900">{st.vacant ? "VACANT" : m.emp.fullName}</span>
                <span className="block truncate text-[6.8px] text-slate-500">{m.emp.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive ATOMA landscape organogram: horizontal level rows with a level rail,
 * roster cards for large teams, orthogonal bus connectors and the approved legend.
 */
export function Organogram({ layout, title, subtitle, generatedBy, onOpenEmployee }: { layout: OrgLayout; title: string; subtitle: string; generatedBy?: string; onOpenEmployee: (id: string | null) => void }) {
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const options: OrgExportOpts = useMemo(
    () => ({ title, subtitle, generatedBy, footer: "Made with \u2665 by Mohibullah Afzalzada" }),
    [title, subtitle, generatedBy]
  );
  const counts = useMemo(
    () => ({
      people: layout.nodes.reduce((a, n) => a + (n.kind === "group" ? n.members?.length ?? 0 : 1), 0),
      groups: layout.nodes.filter((n) => n.kind === "group").length,
      inferred: layout.edges.filter((e) => e.inferred).length,
    }),
    [layout]
  );

  const run = async (kind: "pdf" | "svg" | "visio" | "print") => {
    setBusy(kind);
    try {
      if (kind === "svg") downloadOrgSvg(layout, options);
      else if (kind === "pdf") await downloadOrgVectorPdf(layout, options);
      else if (kind === "visio") await downloadOrgVisio(layout, options);
      else printOrgSvg(layout, options);
    } catch (error) {
      console.error("[atoma] organogram export", error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted" data-no-capture="true">
        <span className="font-semibold text-fg">{title}</span>
        <Badge tone="primary">{fmtNum(counts.people)} people</Badge>
        <Badge tone="primary">{layout.layers.length} level rows</Badge>
        {counts.groups > 0 && <Badge tone="accent">{counts.groups} roster cards</Badge>}
        {counts.inferred > 0 && <Badge tone="warning">{counts.inferred} inferred lines</Badge>}
        <span className="ml-auto flex items-center gap-1">
          <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.35, +(z - 0.1).toFixed(2)))}>
            <ZoomOut />
          </IconButton>
          <span className="w-10 text-center font-semibold text-fg tabular-nums">{Math.round(zoom * 100)}%</span>
          <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}>
            <ZoomIn />
          </IconButton>
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
          <IconButton label="Print one page" onClick={() => void run("print")} disabled={busy !== null}>
            <Printer />
          </IconButton>
        </span>
      </div>

      <div className="relative max-h-[74vh] overflow-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_27px,rgba(6,43,91,0.035)_28px)]" data-export-expand="true">
        <div className="relative origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          {layout.layers.map((layer: LayerInfo) => (
            <div
              key={`${layer.level}-${layer.index}`}
              className={layer.index % 2 ? "absolute" : "absolute"}
              style={{ left: 0, top: Math.max(0, layer.offset - layout.gapMain / 2), width: layout.width, height: layer.size + layout.gapMain, background: layer.index % 2 ? "#F8FAFC" : "#FFFFFF" }}
            >
              <div className="absolute top-0 left-3 h-full bg-amber-200/80" style={{ width: 48 }} />
              {layer.index > 0 && <div className="absolute top-0 right-3 left-3 h-[2px] bg-amber-500" />}
              <div className="absolute top-1/2 left-3 flex w-12 -translate-y-1/2 flex-col items-center">
                <span className="text-[15px] leading-none font-extrabold text-slate-900">
                  {layer.level}
                  {layer.continuation ? "*" : ""}
                </span>
                <span className="mt-1.5 grid h-6 w-6 place-items-center rounded-full text-[9px] font-bold text-white shadow-sm" style={{ background: levelColor(layer.level) }}>
                  {layer.count}
                </span>
              </div>
              <span className="absolute top-2.5 left-[70px] text-[8px] font-bold tracking-wide text-slate-500 uppercase">{layer.band}</span>
            </div>
          ))}

          <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height} aria-hidden>
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke={edge.inferred ? "#F59E0B" : "#1F2937"}
                strokeWidth={edge.inferred ? 1.6 : 1.25}
                strokeDasharray={edge.inferred ? "5 4" : edge.kind === "staff" ? "4 3" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </svg>

          {layout.nodes.map((node) => (node.kind === "group" ? <GroupView key={node.id} node={node} onOpenEmployee={onOpenEmployee} /> : <CardView key={node.id} node={node} layout={layout} onOpenEmployee={onOpenEmployee} />))}
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
        <span className="ml-auto">Made with <span className="text-rose-500">♥</span> by <span className="font-semibold text-fg">Mohibullah Afzalzada</span></span>
      </div>
    </div>
  );
}

export { LEVEL_ORDER, slugify, timestampSlug };
