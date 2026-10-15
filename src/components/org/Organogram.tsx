"use client";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileDown,
  FileText,
  Link2,
  Maximize2,
  Pencil,
  Presentation,
  Printer,
  RotateCcw,
  Users,
  Workflow,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmtNum, slugify, timestampSlug } from "@/lib/format";
import {
  LEVEL_COLORS,
  downloadOrgPptx,
  downloadOrgSvg,
  downloadOrgVectorPdf,
  downloadOrgVisio,
  printOrgSvg,
  type OrgExportOpts,
} from "@/lib/org-export";
import { ATOMA_CARD, RAIL_W, type LayerInfo, type LEdge, type LNode, type OrgLayout } from "@/lib/orglayout";
import { buildDepartmentSheets, downloadPrintPack, fitPrintPack, type Paper } from "@/lib/orgprint";
import { employeeStatus, type OrgNode } from "@/lib/orgtree";
import type { Employee } from "@/lib/types";
import { useUIStore } from "@/store/ui";
import { Badge, IconButton, Spinner } from "../ui/primitives";
import { clearLayoutOverrides, loadLayoutOverrides, saveLayoutOverrides, type PositionMap } from "@/lib/layout-overrides";

/** Screen card sizes: the rich reference card and the compact print-style card. */
export const ORG_CARD = { w: 184, h: 100 };
export const COMPACT_CARD = ATOMA_CARD;

const levelColor = (level?: string) => LEVEL_COLORS[(level ?? "L2") as keyof typeof LEVEL_COLORS] ?? "#64748B";
const initialsOf = (name: string) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return `${parts[0][0] ?? ""}${parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : ""}`.toUpperCase();
};

/** Suppresses the click that follows a drag-to-pan / drag-to-move gesture. */
const dragGuard = { moved: false };

interface EditField {
  fullName: string;
  title: string;
}

interface CardCtx {
  matches?: Set<string>;
  editingId: string | null;
  editDraft: EditField;
  setEditDraft: (draft: EditField) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  startEdit: (id: string) => void;
  revertText: (id: string) => void;
  isEdited: (id: string) => boolean;
  editMode: boolean;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  select: (id: string) => void;
  startMove: (id: string, ev: React.PointerEvent) => void;
  startRewire: (id: string, ev: React.PointerEvent) => void;
  rewireTarget: string | null;
}

/* ---------------- cards ---------------- */

function NodeCard({ node, ctx }: { node: LNode; ctx: CardCtx }) {
  const org = node.node as OrgNode;
  const emp = org.emp;
  const st = employeeStatus(emp);
  const color = levelColor(org.level);
  const kids = org.children.length;
  const open = ctx.isOpen(org.id);
  const compact = node.h < 70;
  const editing = ctx.editingId === org.id;
  const highlighted = !!ctx.matches?.has(org.id);
  const target = ctx.rewireTarget === org.id;
  const edited = ctx.isEdited(org.id);
  const cardTitle = st.vacant ? "VACANT" : emp.title || "Position not specified";
  const cardName = st.vacant ? "(Vacant post)" : emp.fullName;

  const editForm = editing ? (
    <div
      className="absolute inset-0 z-30 flex flex-col gap-1 bg-white p-1.5 shadow-inner"
      onPointerDown={(ev) => ev.stopPropagation()}
      onClick={(ev) => ev.stopPropagation()}
      onDoubleClick={(ev) => ev.stopPropagation()}
      data-no-pan
    >
      <input
        autoFocus
        className="w-full rounded border border-line px-1.5 py-0.5 text-[11px] font-bold text-fg outline-none focus:border-[#00A8FF]"
        value={ctx.editDraft.fullName}
        placeholder="Name on card"
        onChange={(ev) => ctx.setEditDraft({ ...ctx.editDraft, fullName: ev.target.value })}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") ctx.commitEdit();
          if (ev.key === "Escape") ctx.cancelEdit();
        }}
        aria-label="Employee name on card"
      />
      <input
        className="w-full rounded border border-line px-1.5 py-0.5 text-[10px] text-fg outline-none focus:border-[#00A8FF]"
        value={ctx.editDraft.title}
        placeholder="Position title on card"
        onChange={(ev) => ctx.setEditDraft({ ...ctx.editDraft, title: ev.target.value })}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") ctx.commitEdit();
          if (ev.key === "Escape") ctx.cancelEdit();
        }}
        aria-label="Position title on card"
      />
      <div className="mt-auto flex items-center justify-end gap-1">
        {edited && (
          <button
            type="button"
            className="mr-auto rounded border border-line px-1 py-0.5 text-[9px] font-semibold text-muted hover:text-fg"
            onClick={() => ctx.revertText(org.id)}
            title="Revert to the original HRIS text"
          >
            Revert
          </button>
        )}
        <button
          type="button"
          className="grid h-5 w-5 place-items-center rounded bg-[#0D47A1] text-white hover:brightness-110"
          onClick={ctx.commitEdit}
          title="Save text (Enter)"
        >
          <Check size={11} />
        </button>
        <button
          type="button"
          className="grid h-5 w-5 place-items-center rounded border border-line text-muted hover:text-fg"
          onClick={ctx.cancelEdit}
          title="Cancel (Esc)"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  ) : null;

  const common = {
    "data-org-node": org.id,
    onClick: () => ctx.select(org.id),
    onDoubleClick: () => {
      if (ctx.editMode) ctx.startEdit(org.id);
    },
    onPointerDown: (ev: React.PointerEvent) => {
      if (ctx.editMode) ctx.startMove(org.id, ev);
    },
  } as const;

  if (compact) {
    return (
      <div
        {...common}
        title={`${emp.fullName} · ${emp.title}${org.link === "override" ? " · manual reporting override" : ""}`}
        className={`absolute cursor-pointer overflow-hidden rounded-[5px] border text-left transition-transform hover:z-20 hover:-translate-y-0.5 hover:shadow-[0_8px_22px_rgba(6,43,91,0.25)] ${
          highlighted ? "ring-2 ring-[#00A8FF]" : ""
        } ${target ? "ring-2 ring-[#F59E0B]" : ""}`}
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
        <span className="absolute top-[11px] right-1.5 left-1.5 line-clamp-2 text-[11px] leading-[13px] font-bold text-slate-900">
          {cardTitle}
        </span>
        <span
          className={`absolute right-5 bottom-1.5 truncate text-[10px] leading-[13px] text-slate-700 ${ctx.editMode ? "left-6" : "left-1.5"}`}
        >
          {cardName}
        </span>
        {st.temporary && <span className="absolute top-[7px] right-1.5 text-[8px] font-bold text-amber-900">TEMP</span>}
        {edited && <span className="absolute top-[7px] left-1.5 h-2 w-2 rounded-full bg-[#F59E0B]" title="Text edited" />}
        {kids > 0 && (
          <button
            type="button"
            data-no-pan
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation();
              if (!dragGuard.moved) ctx.toggle(org.id);
            }}
            className="absolute right-0.5 bottom-0.5 grid h-4 w-4 place-items-center rounded bg-black/5 text-muted hover:bg-[#0D47A1] hover:text-white"
            title={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}
        {ctx.editMode && (
          <button
            type="button"
            data-no-pan
            onPointerDown={(ev) => {
              ev.stopPropagation();
              ctx.startRewire(org.id, ev);
            }}
            className="absolute bottom-0.5 left-0.5 grid h-4 w-4 place-items-center rounded-full border border-[#0D47A1] bg-white text-[#0D47A1] shadow"
            title="Drag onto another card to change this person's manager"
          >
            <Link2 size={9} />
          </button>
        )}
        {editForm}
      </div>
    );
  }

  return (
    <div
      {...common}
      title={`${emp.fullName} · ${emp.title}${org.link === "override" ? " · manual reporting override" : org.link.startsWith("inferred") ? " · inferred line" : ""}`}
      className={`absolute cursor-pointer overflow-hidden rounded-lg border bg-white text-left shadow-md transition-shadow hover:shadow-xl ${
        highlighted ? "ring-2 ring-[#00A8FF]" : ""
      } ${target ? "ring-2 ring-[#F59E0B]" : ""} ${node.inferred || st.vacant ? "border-dashed" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        borderColor: st.vacant ? "#64748B" : node.inferred ? "#F59E0B" : undefined,
        background: st.temporary ? "#FEF08A" : undefined,
        touchAction: "none",
      }}
    >
      <div className="h-1.5" style={{ background: color }} />
      <div className="p-2">
        <div className="flex items-start gap-2">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
            style={{ background: st.vacant ? "#64748B" : `linear-gradient(135deg, ${color}, #00A8FF)` }}
          >
            {st.vacant ? "?" : initialsOf(emp.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`truncate text-xs font-extrabold ${st.temporary ? "text-slate-950" : "text-fg"}`}>{cardName}</div>
            <div className="line-clamp-2 text-[10px] leading-tight text-muted">{emp.title}</div>
          </div>
        </div>
        <div className={`mt-1.5 flex items-center gap-1 ${ctx.editMode ? "pl-6" : ""}`}>
          <span className="rounded-md px-1.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: color }}>
            {org.level.replace(/^L/, "")}
          </span>
          <span className="truncate text-[9px] text-muted">{emp.department}</span>
          {kids > 0 && (
            <span
              className="ml-auto flex items-center gap-0.5 rounded-md bg-black/5 px-1.5 py-0.5 text-[9px] font-bold text-muted"
              title={`${kids} direct · ${org.total - 1} total`}
            >
              <Users size={9} /> {kids}
            </span>
          )}
          {ctx.editMode && (
            <button
              type="button"
              data-no-pan
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation();
                ctx.startEdit(org.id);
              }}
              className="grid h-5 w-5 place-items-center rounded-md bg-[#0D47A1]/10 text-[#0D47A1] hover:bg-[#0D47A1] hover:text-white"
              title="Edit name / title on this card"
            >
              <Pencil size={11} />
            </button>
          )}
          {kids > 0 && (
            <button
              type="button"
              data-no-pan
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => {
                ev.stopPropagation();
                if (!dragGuard.moved) ctx.toggle(org.id);
              }}
              className="grid h-5 w-5 place-items-center rounded-md bg-[#0D47A1]/10 text-[#0D47A1] hover:bg-[#0D47A1] hover:text-white"
              title={open ? "Collapse" : "Expand"}
            >
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>
      </div>
      {edited && (
        <span className="absolute top-2.5 right-2 h-2 w-2 rounded-full bg-[#F59E0B]" title="Text edited — double-click to change" />
      )}
      {st.temporary && <span className="absolute top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-amber-700">TEMP</span>}
      {ctx.editMode && (
        <button
          type="button"
          data-no-pan
          onPointerDown={(ev) => {
            ev.stopPropagation();
            ctx.startRewire(org.id, ev);
          }}
          className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded-full border border-[#0D47A1] bg-white text-[#0D47A1] shadow"
          title="Drag onto another card to change this person's manager"
        >
          <Link2 size={11} />
        </button>
      )}
      {editForm}
    </div>
  );
}

function GroupView({ node, ctx }: { node: LNode; ctx: CardCtx }) {
  const members = node.members ?? [];
  const color = levelColor(members[0]?.level);
  const cols = members.length <= 8 ? 2 : members.length <= 24 ? 3 : 4;
  return (
    <div
      data-org-node={node.id}
      className="absolute overflow-hidden rounded-[5px] border bg-white shadow-sm"
      onPointerDown={(ev) => {
        if (ctx.editMode) ctx.startMove(node.id, ev);
      }}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h, borderColor: color, touchAction: "none" }}
    >
      <div className="absolute inset-x-0 top-0 flex h-[28px] items-center gap-1.5 bg-slate-50 px-2">
        <span className="rounded-md px-1.5 py-0.5 text-[8.5px] font-bold text-white" style={{ background: color }}>
          {(members[0]?.level ?? "L2").replace(/^L/, "")}
        </span>
        <span className="text-[8.5px] font-bold text-slate-900">{members.length} people at this level</span>
      </div>
      <div className="absolute inset-x-1.5 top-[32px] grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {members.map((m) => {
          const st = employeeStatus(m.emp);
          return (
            <button
              key={m.id}
              type="button"
              data-org-node={m.id}
              data-no-pan
              onClick={() => ctx.select(m.id)}
              title={`${m.emp.title} · ${m.emp.department}`}
              className={`flex h-[26px] items-center gap-1.5 rounded-md px-1 text-left transition-colors hover:bg-[#0D47A1]/10 ${
                st.temporary ? "bg-yellow-200 text-slate-950" : st.vacant ? "border border-dashed border-slate-400" : ""
              } ${ctx.matches?.has(m.id) ? "ring-2 ring-[#00A8FF]" : ""} ${ctx.rewireTarget === m.id ? "ring-2 ring-[#F59E0B]" : ""}`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white" style={{ background: color }}>
                {st.vacant ? "?" : initialsOf(m.emp.fullName)}
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-[10px] font-bold leading-tight ${st.temporary ? "text-slate-950" : "text-fg"}`}>
                  {st.vacant ? "VACANT" : m.emp.fullName}
                </span>
                <span className="block truncate text-[8.5px] leading-tight text-muted">{m.emp.title.split(",")[0]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Re-applies saved manual positions and rebuilds connectors from the new geometry. */
function applyPositions(layout: OrgLayout, overrides: PositionMap): OrgLayout {
  const nodes = layout.nodes.map((n) => ({ ...n }));
  const railRight = layout.padding + layout.gutter;
  nodes.forEach((n) => {
    const o = overrides[n.id];
    if (!o) return;
    const layer = layout.layers[n.layer];
    if (layer) {
      // Manual moves stay inside the card's own level band. Exports reuse the same
      // overrides against layouts with different row heights (full hierarchy, compact
      // export cards), and an absolute y saved under one geometry used to land boxes
      // ON the amber band separators in every downloaded/printed chart.
      const bandTop = Math.max(0, layer.offset - layout.gapMain / 2);
      const bandBottom = bandTop + layer.size + layout.gapMain;
      const minY = bandTop + 4;
      const maxY = bandBottom - n.h - 4;
      n.y = maxY > minY ? Math.min(maxY, Math.max(minY, o.y)) : bandTop + Math.max(0, (layer.size - n.h) / 2);
    } else {
      n.y = o.y;
    }
    const minX = railRight + 6;
    const maxX = Math.max(minX, layout.width - n.w - 16);
    n.x = Math.min(maxX, Math.max(minX, o.x));
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rowOf = new Map<string, number>();
  nodes.forEach((n) => rowOf.set(n.id, n.layer));
  const edges: LEdge[] = [];
  for (const n of nodes) {
    if (!n.parent) continue;
    const p = byId.get(n.parent);
    if (!p) continue;
    if (n.kind === "staff") {
      const yMid = p.y + p.h / 2;
      edges.push({
        id: `${p.id}->${n.id}`,
        from: p.id,
        to: n.id,
        inferred: n.inferred,
        kind: "staff",
        points: [
          [p.x + p.w, yMid],
          [n.x, yMid],
        ],
        d: `M ${p.x + p.w} ${yMid} L ${n.x} ${yMid}`,
      });
      continue;
    }
    const x1 = p.x + p.w / 2;
    const x2 = n.x + n.w / 2;
    const y1 = p.y + p.h;
    const y2 = n.y;
    const parentRow = layout.layers[rowOf.get(p.id) ?? 0];
    const busY = Math.min((parentRow?.offset ?? 0) + (parentRow?.size ?? 0) + layout.gapMain * 0.4, y2 - 16);
    const d = `M ${x1} ${y1} L ${x1} ${busY} L ${x2} ${busY} L ${x2} ${y2}`;
    edges.push({
      id: `${p.id}->${n.id}`,
      from: p.id,
      to: n.id,
      inferred: n.inferred,
      kind: "bus",
      points: [
        [x1, y1],
        [x1, busY],
        [x2, busY],
        [x2, y2],
      ],
      d,
    });
  }
  return { ...layout, nodes, edges, byId };
}

interface OrganogramProps {
  layout: OrgLayout;
  /** All-open layout used when "Full hierarchy" exports are enabled (compact export cards). */
  fullLayout: OrgLayout;
  /** Current-view layout with compact cards — exports stay compact even in rich screen mode. */
  exportViewLayout?: OrgLayout;
  roots: OrgNode[];
  divisionEmployees?: Employee[];
  division?: string;
  title: string;
  subtitle: string;
  generatedBy?: string;
  onOpenEmployee: (id: string | null) => void;
  readOnly?: boolean;
  /** Search hits to ring-highlight and scroll to. */
  matches?: Set<string>;
  isOpen?: (id: string) => boolean;
  onToggle?: (id: string) => void;
  /** Validate + persist a manager change; returns an error message or null. */
  onRewire?: (childId: string, managerId: string) => string | null;
  /** Persist an inline text edit; value null reverts the field. */
  onTextEdit?: (empKey: string, field: "fullName" | "title", value: string | null) => void;
  /** Original employee-org-key per node id (stable even after text edits). */
  empKeys?: Map<string, string>;
  /** Employee org keys whose card text has been edited. */
  editedKeys?: Set<string>;
  statusCounts?: { vacant: number; temporary: number };
}

/**
 * Interactive ATOMA organogram.
 *
 * Edit mode adds three capabilities on top of the reference chart:
 *   1. drag boxes to reposition them (saved per scope),
 *   2. double-click / pencil to edit the name and title text on a card,
 *   3. drag the link handle onto another card to rewire the reporting line.
 * Everything persists in browser localStorage — no backend involved.
 */
export function Organogram({
  layout,
  fullLayout,
  exportViewLayout,
  roots,
  divisionEmployees,
  division,
  title,
  subtitle,
  generatedBy,
  onOpenEmployee,
  readOnly = false,
  matches,
  isOpen,
  onToggle,
  onRewire,
  onTextEdit,
  empKeys,
  editedKeys,
  statusCounts,
}: OrganogramProps) {
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [paper, setPaper] = useState<Paper>("A3");
  const notify = useUIStore((state) => state.notify);
  const options: OrgExportOpts = useMemo(
    () => ({ title, subtitle, generatedBy, footer: "Made with ♥ by Mohibullah Afzalzada" }),
    [title, subtitle, generatedBy]
  );
  const people = useMemo(() => layout.nodes.reduce((a, n) => a + (n.kind === "group" ? n.members?.length ?? 0 : 1), 0), [layout]);
  const groups = layout.nodes.filter((n) => n.kind === "group").length;
  const inferred = layout.edges.filter((e) => e.inferred).length;

  const scope = division || "__all";
  const [overrides, setOverrides] = useState<PositionMap>({});
  const [editMode, setEditMode] = useState(false);
  const [exportFull, setExportFull] = useState(true);
  const [exportMsg, setExportMsg] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditField>({ fullName: "", title: "" });
  const [rewirePos, setRewirePos] = useState<{ fromId: string; x: number; y: number } | null>(null);
  const [rewireTarget, setRewireTarget] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // load overrides for this scope after paint (avoids sync setState-in-effect + hydration mismatch)
    const frame = requestAnimationFrame(() => setOverrides(loadLayoutOverrides(scope)));
    return () => cancelAnimationFrame(frame);
  }, [scope]);

  const adjustedLayout = useMemo(() => applyPositions(layout, overrides), [layout, overrides]);
  const exportLayout = useMemo(
    () => applyPositions(exportFull ? fullLayout : exportViewLayout ?? layout, overrides),
    [exportFull, fullLayout, exportViewLayout, layout, overrides]
  );

  const openFn = isOpen ?? (() => true);

  // fit-to-width on first mount / layout width change
  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      setZoom(Math.max(0.3, Math.min(1.4, (el.clientWidth - 24) / Math.max(1, layout.width))));
    }, 60);
    return () => window.clearTimeout(id);
  }, [layout.width]);

  // scroll the first search hit into view
  useEffect(() => {
    if (!matches || matches.size === 0) return;
    const id = window.setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const first = [...matches][0];
      const ln =
        adjustedLayout.byId.get(first) ??
        adjustedLayout.nodes.find((n) => n.kind === "group" && n.members?.some((m) => m.id === first));
      if (!ln) return;
      container.scrollTo({
        left: (ln.x + ln.w / 2) * zoom - container.clientWidth / 2,
        top: (ln.y + ln.h / 2) * zoom - container.clientHeight / 2,
        behavior: "smooth",
      });
    }, 120);
    return () => window.clearTimeout(id);
  }, [matches, zoom, adjustedLayout]);

  const run = async (kind: "pdf" | "svg" | "visio" | "pptx" | "print" | "pack" | "dept") => {
    setBusy(kind);
    setExportMsg("");
    try {
      if (kind === "svg") {
        downloadOrgSvg(exportLayout, options);
        setExportMsg("Editable SVG downloaded — vector quality at any zoom.");
      } else if (kind === "pdf") {
        const pages = await downloadOrgVectorPdf(exportLayout, options);
        setExportMsg(pages > 1 ? `Vector PDF downloaded — ${pages} pages, type kept at readable size.` : "Vector PDF downloaded — single page, vector quality at any zoom.");
      } else if (kind === "visio") {
        const stats = await downloadOrgVisio(exportLayout, options);
        setExportMsg(`Editable Visio downloaded — ${stats.shapes} shapes (${stats.format.toUpperCase()}).`);
      } else if (kind === "pptx") {
        await downloadOrgPptx(exportLayout, options);
        setExportMsg("Editable PowerPoint downloaded — cards, text and connector segments are shapes.");
      } else if (kind === "pack") {
        const pack = fitPrintPack(roots, paper);
        await downloadPrintPack(pack.sheets, options, pack.paper, `org-chart-${slugify(title)}-${pack.paper.toLowerCase()}-${timestampSlug()}.pdf`);
        notify("success", "Print pack ready", `${pack.sheets.length} sheet(s) on ${pack.paper} — type prints at ${(11.5 * pack.scale).toFixed(1)} pt.`);
        setExportMsg(`Print pack ready — ${pack.sheets.length} sheet(s) on ${pack.paper}.`);
      } else if (kind === "dept") {
        if (divisionEmployees && division) {
          const dept = buildDepartmentSheets(divisionEmployees, division, paper);
          await downloadPrintPack(dept.sheets, { ...options, title: `${title} · department sheets` }, dept.paper, `org-chart-${slugify(division)}-departments-${timestampSlug()}.pdf`);
          notify("success", "Department sheets ready", `${dept.sheets.length} department page(s) on ${dept.paper} — one department per landscape page.`);
          setExportMsg(`Department sheets downloaded — ${dept.sheets.length} department page(s) on ${dept.paper}.`);
        }
      } else if (!printOrgSvg(exportLayout, options)) {
        throw new Error("The browser blocked the print window. Allow pop-ups and try again.");
      } else {
        setExportMsg("Print preview opened.");
      }
    } catch (error) {
      console.error("[atoma] organogram export", error);
      setExportMsg(`Export failed: ${String(error).slice(0, 140)}`);
    } finally {
      setBusy(null);
    }
  };

  /* ---------- move drag ---------- */
  const dragRef = useRef<{ id: string; startX: number; startY: number; nodeX: number; nodeY: number; moved: boolean } | null>(null);
  /* ---------- rewire drag ---------- */
  const rewireRef = useRef<{ id: string; x: number; y: number } | null>(null);

  const canvasPoint = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: (clientX - rect.left + el.scrollLeft) / zoom, y: (clientY - rect.top + el.scrollTop) / zoom };
  };

  const overridesRef = useRef<PositionMap>(overrides);
  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);
  const rewireTargetRef = useRef<string | null>(null);
  useEffect(() => {
    rewireTargetRef.current = rewireTarget;
  }, [rewireTarget]);

  useEffect(() => {
    const onPointerMove = (ev: PointerEvent) => {
      const rewire = rewireRef.current;
      if (rewire) {
        ev.preventDefault();
        const pt = canvasPoint(ev.clientX, ev.clientY);
        setRewirePos({ fromId: rewire.id, x: pt.x, y: pt.y });
        const under = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const nodeEl = under?.closest("[data-org-node]") as HTMLElement | null;
        setRewireTarget(nodeEl?.getAttribute("data-org-node") ?? null);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      ev.preventDefault();
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      drag.moved = true;
      setOverrides((prev) => ({ ...prev, [drag.id]: { x: drag.nodeX + dx / zoom, y: drag.nodeY + dy / zoom } }));
    };

    const onPointerUp = () => {
      const rewire = rewireRef.current;
      if (rewire) {
        const target = rewireTargetRef.current;
        rewireRef.current = null;
        setRewirePos(null);
        setRewireTarget(null);
        dragGuard.moved = true;
        window.setTimeout(() => {
          dragGuard.moved = false;
        }, 0);
        if (target && target !== rewire.id) {
          const error = onRewire?.(rewire.id, target);
          if (error) notify("warning", "Reporting line unchanged", error);
          else if (onRewire) notify("success", "Reporting line updated", "The override was saved in this browser.");
        }
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (drag.moved) {
        dragGuard.moved = true;
        window.setTimeout(() => {
          dragGuard.moved = false;
        }, 0);
        saveLayoutOverrides(scope, overridesRef.current);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, scope, onRewire]);

  const startMove = (id: string, ev: React.PointerEvent) => {
    if (!editMode || editingId) return;
    ev.stopPropagation();
    ev.preventDefault();
    const target = ev.currentTarget as Element;
    target.setPointerCapture?.(ev.pointerId);
    const n = adjustedLayout.byId.get(id);
    if (!n) return;
    dragRef.current = { id, startX: ev.clientX, startY: ev.clientY, nodeX: n.x, nodeY: n.y, moved: false };
  };

  const startRewire = (id: string, ev: React.PointerEvent) => {
    if (!editMode) return;
    ev.stopPropagation();
    ev.preventDefault();
    const pt = canvasPoint(ev.clientX, ev.clientY);
    rewireRef.current = { id, x: pt.x, y: pt.y };
    setRewirePos({ fromId: id, x: pt.x, y: pt.y });
  };

  /* ---------- inline text editing ---------- */
  const startEdit = (id: string) => {
    if (!editMode) return;
    const n = adjustedLayout.byId.get(id) ?? layout.byId.get(id);
    const emp = n?.node?.emp;
    if (!emp) return;
    setEditingId(id);
    setEditDraft({ fullName: emp.fullName, title: emp.title });
  };
  const commitEdit = () => {
    if (!editingId) return;
    const key = empKeys?.get(editingId);
    const node = adjustedLayout.byId.get(editingId);
    const emp = node?.node?.emp;
    if (key && emp && onTextEdit) {
      const nextName = editDraft.fullName.trim();
      const nextTitle = editDraft.title.trim();
      if (nextName && nextName !== emp.fullName) onTextEdit(key, "fullName", nextName);
      if (nextTitle && nextTitle !== emp.title) onTextEdit(key, "title", nextTitle);
      notify("success", "Card text updated", "The edited text is saved in this browser.");
    }
    setEditingId(null);
  };
  const cancelEdit = () => setEditingId(null);

  /* ---------- pan ---------- */
  const panRef = useRef<{ x: number; y: number; sl: number; st: number; moved: boolean } | null>(null);
  const onPanDown = (ev: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || ev.button !== 0) return;
    const target = ev.target as HTMLElement;
    if (target.closest("button,input,select,textarea,[data-no-pan]")) return;
    const el = containerRef.current;
    if (!el) return;
    panRef.current = { x: ev.clientX, y: ev.clientY, sl: el.scrollLeft, st: el.scrollTop, moved: false };
  };
  const onPanMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = panRef.current;
    const el = containerRef.current;
    if (!d || !el) return;
    const dx = ev.clientX - d.x;
    const dy = ev.clientY - d.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    d.moved = true;
    el.scrollLeft = d.sl - dx;
    el.scrollTop = d.st - dy;
  };
  const onPanUp = () => {
    const moved = !!panRef.current?.moved;
    panRef.current = null;
    if (moved) {
      dragGuard.moved = true;
      window.setTimeout(() => {
        dragGuard.moved = false;
      }, 0);
    }
  };

  const resetLayout = () => {
    clearLayoutOverrides(scope);
    setOverrides({});
    notify("success", "Positions reset", "Manual box positions cleared for this scope.");
  };

  const saveLayout = () => {
    saveLayoutOverrides(scope, overrides);
    notify("success", "Layout saved", "Custom positions saved for this scope (local browser storage).");
  };

  const ctx: CardCtx = {
    matches,
    editingId,
    editDraft,
    setEditDraft,
    commitEdit,
    cancelEdit,
    startEdit,
    editMode: editMode && !readOnly,
    isOpen: openFn,
    toggle: (id) => onToggle?.(id),
    select: (id) => {
      if (dragGuard.moved || editingId) return;
      const node = adjustedLayout.byId.get(id);
      if (node?.node) {
        onOpenEmployee(node.node.emp.id);
        return;
      }
      const member = adjustedLayout.nodes
        .filter((n) => n.kind === "group")
        .flatMap((n) => n.members ?? [])
        .find((m) => m.id === id);
      onOpenEmployee(member ? member.emp.id : id);
    },
    startMove,
    startRewire,
    isEdited: (id) => {
      const key = empKeys?.get(id);
      return !!key && !!editedKeys?.has(key);
    },
    revertText: (id) => {
      const key = empKeys?.get(id);
      if (!key || !onTextEdit) return;
      onTextEdit(key, "fullName", null);
      onTextEdit(key, "title", null);
      setEditingId(null);
      notify("success", "Card text reverted", "Original HRIS text restored on this card.");
    },
    rewireTarget,
  };

  const fit = () => {
    const el = containerRef.current;
    if (!el) return;
    setZoom(Math.max(0.3, Math.min(1.4, (el.clientWidth - 24) / Math.max(1, layout.width))));
  };

  const rewireSource = rewirePos ? adjustedLayout.byId.get(rewirePos.fromId) : null;

  return (
    <div className="relative">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-muted" data-no-capture="true">
          <span className="font-semibold text-fg">{title}</span>
          <Badge tone="primary">{fmtNum(people)} people</Badge>
          <Badge tone="primary">{layout.layers.length} level rows</Badge>
          {groups > 0 && <Badge tone="accent">{groups} roster cards</Badge>}
          {inferred > 0 && <Badge tone="warning">{inferred} inferred lines</Badge>}
          {statusCounts && statusCounts.vacant > 0 && <Badge>{statusCounts.vacant} vacant</Badge>}
          {statusCounts && statusCounts.temporary > 0 && <Badge tone="warning">{statusCounts.temporary} temporary</Badge>}
          <span className="ml-auto flex items-center gap-1">
            <IconButton label="Fit to width" onClick={fit}>
              <Maximize2 />
            </IconButton>
            <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(2)))}>
              <ZoomOut />
            </IconButton>
            <span className="w-10 text-center font-semibold text-fg tabular-nums">{Math.round(zoom * 100)}%</span>
            <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(2)))}>
              <ZoomIn />
            </IconButton>

            <label className="ml-2 inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} /> Edit chart
            </label>
            {editMode && (
              <>
                <button onClick={saveLayout} className="ml-1 rounded-lg bg-[#0D47A1] px-3 py-1.5 text-[11px] font-bold text-white">
                  Save
                </button>
                <button onClick={resetLayout} className="ml-1 rounded-lg border border-line px-3 py-1.5 text-[11px] font-bold">
                  Reset positions
                </button>
              </>
            )}

            <span className="mx-1 h-5 w-px bg-line" />
            <label className="inline-flex items-center gap-1.5 text-[11px]" title="Exports include every level even when collapsed on screen">
              <input type="checkbox" checked={exportFull} onChange={(e) => setExportFull(e.target.checked)} className="accent-[#0D47A1]" /> Full
              hierarchy
            </label>
            <span className="mx-1 h-5 w-px bg-line" />
            <IconButton label="Single-page editable vector PDF" onClick={() => void run("pdf")} disabled={busy !== null}>
              {busy === "pdf" ? <Spinner /> : <FileDown />}
            </IconButton>
            <IconButton label="Editable SVG" onClick={() => void run("svg")} disabled={busy !== null}>
              {busy === "svg" ? <Spinner /> : <Download />}
            </IconButton>
            <IconButton label="Editable Microsoft Visio drawing" onClick={() => void run("visio")} disabled={busy !== null}>
              {busy === "visio" ? <Spinner /> : <Workflow />}
            </IconButton>
            <IconButton label="Editable PowerPoint" onClick={() => void run("pptx")} disabled={busy !== null}>
              {busy === "pptx" ? <Spinner /> : <Presentation />}
            </IconButton>
            <span className="mx-1 h-5 w-px bg-line" />
            <select
              className="field h-8 w-[70px] text-xs"
              value={paper}
              onChange={(event) => setPaper(event.target.value as Paper)}
              aria-label="Print paper size"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="A2">A2</option>
            </select>
            <IconButton label={`Multi-page print pack (${paper} · readable type)`} onClick={() => void run("pack")} disabled={busy !== null}>
              {busy === "pack" ? <Spinner /> : <FileText />}
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
      )}

      {editMode && !readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#0D47A1]/5 px-3 py-1.5 text-[10.5px] text-muted" data-no-capture="true">
          <span className="font-semibold text-fg">Edit mode:</span>
          <span>drag a box to move it · double-click or ✎ to edit the text · drag the ⛓ handle onto another card to change the manager</span>
          <span className="ml-auto">edits are stored in this browser (localStorage)</span>
        </div>
      )}

      {exportMsg && (
        <div className={`border-b border-line px-3 py-1.5 text-[11px] ${exportMsg.startsWith("Export failed") ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-700"}`} data-no-capture="true">
          {exportMsg}
        </div>
      )}

      <div
        ref={containerRef}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerLeave={onPanUp}
        className={`relative max-h-[74vh] overflow-auto ${readOnly ? "overflow-hidden" : "cursor-grab select-none active:cursor-grabbing"}`}
        data-export-expand="true"
        data-org-canvas
      >
        <div
          className="relative origin-top-left"
          style={{ width: adjustedLayout.width, height: adjustedLayout.height, transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {/* level rows */}
          {adjustedLayout.layers.map((layer: LayerInfo) => {
            const top = Math.max(0, layer.offset - adjustedLayout.gapMain / 2);
            const height = layer.size + adjustedLayout.gapMain;
            return (
              <div
                key={`${layer.level}-${layer.index}`}
                className="absolute"
                style={{ left: 0, top, width: adjustedLayout.width, height, background: layer.index % 2 ? "#F8FAFC" : "#FFFFFF" }}
              >
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
                  <span
                    className="mt-2 grid h-[22px] w-[22px] place-items-center rounded-full border-2 bg-white text-[9px] font-bold text-slate-900"
                    style={{ borderColor: levelColor(layer.level) }}
                  >
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
              <path
                key={edge.id}
                markerEnd={edge.inferred ? "url(#orgArrowInferred)" : "url(#orgArrow)"}
                d={edge.d}
                fill="none"
                stroke={edge.inferred ? "#F59E0B" : "#1F2937"}
                strokeWidth={edge.inferred ? 1.6 : 1.25}
                strokeDasharray={edge.inferred ? "5 4" : edge.kind === "staff" ? "4 3" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {rewirePos && rewireSource && (
              <g>
                <path
                  d={`M ${rewireSource.x + rewireSource.w / 2} ${rewireSource.y + rewireSource.h} L ${rewirePos.x} ${rewirePos.y}`}
                  stroke="#0D47A1"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  fill="none"
                />
                <circle cx={rewirePos.x} cy={rewirePos.y} r={6} fill="#0D47A1" fillOpacity={0.25} stroke="#0D47A1" strokeWidth={1.5} />
              </g>
            )}
          </svg>

          {adjustedLayout.nodes.map((node) =>
            node.kind === "group" ? (
              <GroupView key={node.id} node={node} ctx={ctx} />
            ) : (
              <NodeCard key={node.id} node={node} ctx={ctx} />
            )
          )}
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
        {!readOnly && (
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw size={11} /> Manual edits live in this browser only
          </span>
        )}
        <span className="ml-auto">
          Card size {Math.round(adjustedLayout.nodes[0]?.w ?? ATOMA_CARD.w)}×{adjustedLayout.nodes[0]?.h ?? ATOMA_CARD.h} · Made with{" "}
          <span className="text-rose-500">♥</span> by <span className="font-semibold text-fg">Mohibullah Afzalzada</span>
        </span>
      </div>
    </div>
  );
}
