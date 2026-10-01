"use client";

import { Building2, Download, FileDown, FileText, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtNum, slugify, timestampSlug } from "@/lib/format";
import { LEVEL_COLORS, downloadOrgSvg, downloadOrgVectorPdf, downloadOrgVisio, printOrgSvg, type OrgExportOpts } from "@/lib/org-export";
import { ATOMA_CARD, RAIL_W, type LayerInfo, type LNode, type OrgLayout } from "@/lib/orglayout";
import { buildDepartmentSheets, buildPrintLayout, buildPrintSheets, downloadPrintPack, type Paper } from "@/lib/orgprint";
import type { Employee } from "@/lib/types";
import { employeeStatus, type OrgNode } from "@/lib/orgtree";
import { Badge, IconButton, Spinner } from "../ui/primitives";

const levelColor = (level?: string) => LEVEL_COLORS[(level ?? "L2") as keyof typeof LEVEL_COLORS] ?? "#64748B";

function CardView({ node, onOpenEmployee }: { node: LNode; onOpenEmployee: (id: string | null) => void }) {
  const orgNode = node.node as OrgNode;
  const e = orgNode.emp;
  const st = employeeStatus(e);
  const color = levelColor(orgNode.level);
  return (
    <button
      type="button"
      onClick={() => onOpenEmployee(e.id)}
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
      }}
    >
      <span className="absolute inset-x-0 top-0 h-[5px]" style={{ background: color }} />
      <span className="absolute top-[11px] right-1.5 left-1.5 line-clamp-2 text-[11px] leading-[13px] font-bold text-slate-900">{st.vacant ? "VACANT" : e.title || "—"}</span>
      <span className="absolute right-1.5 bottom-1.5 left-1.5 truncate text-[10px] leading-[13px] text-slate-700">{st.vacant ? "(Vacant post)" : e.fullName}</span>
      {st.temporary && <span className="absolute top-[7px] right-1.5 text-[8px] font-bold text-amber-900">TEMP</span>}
    </button>
  );
}

function GroupView({ node, onOpenEmployee }: { node: LNode; onOpenEmployee: (id: string | null) => void }) {
  const members = node.members ?? [];
  const color = levelColor(members[0]?.level);
  const cols = members.length <= 8 ? 2 : members.length <= 24 ? 3 : 4;
  return (
    <div className="absolute overflow-hidden rounded-[5px] border bg-white" style={{ left: node.x, top: node.y, width: node.w, height: node.h, borderColor: color }}>
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

/**
 * Interactive ATOMA organogram: landscape level rows, right-hand level rail with
 * employee-count circles, roster cards for large teams and bus connectors.
 */
export function Organogram({ layout, roots, divisionEmployees, division, title, subtitle, generatedBy, onOpenEmployee }: { layout: OrgLayout; roots: OrgNode[]; divisionEmployees?: Employee[]; division?: string; title: string; subtitle: string; generatedBy?: string; onOpenEmployee: (id: string | null) => void }) {
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [paper, setPaper] = useState<Paper>("A3");
  const options: OrgExportOpts = useMemo(() => ({ title, subtitle, generatedBy, footer: "Made with \u2665 by Mohibullah Afzalzada" }), [title, subtitle, generatedBy]);
  const people = useMemo(() => layout.nodes.reduce((a, n) => a + (n.kind === "group" ? n.members?.length ?? 0 : 1), 0), [layout]);
  const groups = layout.nodes.filter((n) => n.kind === "group").length;
  const inferred = layout.edges.filter((e) => e.inferred).length;

  const run = async (kind: "pdf" | "svg" | "visio" | "print" | "pack" | "dept") => {
    setBusy(kind);
    try {
      if (kind === "svg") downloadOrgSvg(layout, options);
      else if (kind === "pdf") await downloadOrgVectorPdf(layout, options);
      else if (kind === "visio") await downloadOrgVisio(layout, options);
      else if (kind === "pack") {
        const sheets = buildPrintSheets(buildPrintLayout(roots, paper), paper);
        await downloadPrintPack(sheets, options, paper, `org-chart-${slugify(title)}-${paper.toLowerCase()}-${timestampSlug()}.pdf`);
      } else if (kind === "dept") {
        if (divisionEmployees && division) {
          const sheets = buildDepartmentSheets(divisionEmployees, division, paper);
          await downloadPrintPack(sheets, { ...options, title: `${title} · department sheets` }, paper, `org-chart-${slugify(division)}-departments-${timestampSlug()}.pdf`);
        }
      } else printOrgSvg(layout, options);
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

      <div className="relative max-h-[74vh] overflow-auto" data-export-expand="true">
        <div className="relative origin-top-left" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
          {/* level rows — height flexes with the content of each row */}
          {layout.layers.map((layer: LayerInfo) => {
            const top = Math.max(0, layer.offset - layout.gapMain / 2);
            const height = layer.size + layout.gapMain;
            return (
              <div key={`${layer.level}-${layer.index}`} className="absolute" style={{ left: 0, top, width: layout.width, height, background: layer.index % 2 ? "#F8FAFC" : "#FFFFFF" }}>
                {layer.index > 0 && <div className="absolute top-0 right-3 left-3 h-[2px] bg-amber-500" />}
              </div>
            );
          })}

          {/* right-hand level rail: bold code + employee count circle */}
          <div className="absolute top-0 bg-amber-200/85" style={{ right: 0, width: RAIL_W, height: layout.height }}>
            {layout.layers.map((layer: LayerInfo) => {
              const top = Math.max(0, layer.offset - layout.gapMain / 2);
              const height = layer.size + layout.gapMain;
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

          {layout.nodes.map((node) => (node.kind === "group" ? <GroupView key={node.id} node={node} onOpenEmployee={onOpenEmployee} /> : <CardView key={node.id} node={node} onOpenEmployee={onOpenEmployee} />))}
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
