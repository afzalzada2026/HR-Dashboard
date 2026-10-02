import { ATOMA_MARK_PATHS } from "./brand";
import { downloadBlob } from "./format";
import { buildOrgLayout, groupCardGrid, type LNode, type OrgLayout } from "./orglayout";
import type { OrgExportOpts } from "./org-export";
import { LEVEL_COLORS } from "./org-export";
import { buildOrgTree, employeeStatus, scopeRoots, type OrgNode } from "./orgtree";
import type { Employee } from "./types";

export type Paper = "A4" | "A3" | "A2";

/** Landscape page sizes in PostScript points. */
export const PAPERS: Record<Paper, [number, number]> = {
  A4: [841.89, 595.28],
  A3: [1190.55, 841.89],
  A2: [1683.78, 1190.55],
};

const CARD_MM = 40; // 152 design px ≈ 40 mm at 96 dpi
const CARD_GAP_MM = 4;
const ROW_MM = 30; // card + vertical gap

export interface PrintSheet {
  layout: OrgLayout;
  index: number;
  total: number;
  caption: string;
  fromRow: number;
  toRow: number;
}

/** Approximate rows per sheet for planning hints (real packing uses row heights). */
export function rowsPerSheet(paper: Paper): number {
  const [, h] = PAPERS[paper];
  const usableMm = ((h - 130) / 72) * 25.4;
  return Math.max(2, Math.floor(usableMm / ROW_MM));
}

/** Splits rows into sheets sized exactly for the paper at the width-driven scale. */
function packRows(layout: OrgLayout, paper: Paper): [number, number][] {
  const [pw, ph] = PAPERS[paper];
  const usableW = pw - 52;
  const usableH = ph - 96;
  const scaleW = usableW / Math.max(1, layout.width);
  const heightBudget = usableH / scaleW - layout.gapMain;
  const runs: [number, number][] = [];
  let start = 0;
  let used = 0;
  layout.layers.forEach((layer, index) => {
    const need = layer.size + layout.gapMain;
    if (index > start && used + need > heightBudget) {
      runs.push([start, index - 1]);
      start = index;
      used = 0;
    }
    used += need;
  });
  if (start <= layout.layers.length - 1) runs.push([start, layout.layers.length - 1]);
  return runs.length ? runs : [[0, 0]];
}

/** Design width that keeps cards at readable size on the chosen paper. */
export function maxRowWidth(paper: Paper): number {
  const [w] = PAPERS[paper];
  const usableMm = ((w - 52) / 72) * 25.4;
  const perRow = Math.max(3, Math.floor((usableMm - 38) / (CARD_MM + CARD_GAP_MM)));
  // gutter + padding + cards + inter-card gaps + trailing margin (design px, 96dpi)
  return 84 + 22 + perRow * 152 + Math.max(0, perRow - 1) * 21 + 30;
}

/** Layout optimised for paper: level rows wrap so nothing shrinks below readable size. */
export function buildPrintLayout(roots: OrgNode[], paper: Paper): OrgLayout {
  return buildOrgLayout(roots, { maxRowWidth: maxRowWidth(paper) });
}

/** Crops a layout to a run of rows, rebasing coordinates so every sheet starts at the origin. */
export function sliceRows(layout: OrgLayout, fromRow: number, toRow: number): OrgLayout {
  const layerIndexes = layout.layers.filter((l) => l.index >= fromRow && l.index <= toRow).map((l) => l.index);
  const keep = new Set(layerIndexes);
  const offsetY = layout.layers[fromRow]?.offset ?? 0;
  const nodes = layout.nodes.filter((n) => keep.has(n.layer)).map((n) => ({ ...n, y: n.y - offsetY }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = layout.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ ...e, points: e.points.map(([x, y]) => [x, y - offsetY] as [number, number]), d: e.points.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y - offsetY}`).join(" ") }));
  const layers = layerIndexes.map((index) => {
    const l = layout.layers[index];
    return { ...l, index: l.index - fromRow, offset: l.offset - offsetY };
  });
  const width = Math.max(720, ...nodes.map((n) => n.x + n.w)) + 30;
  const height = Math.max(200, ...nodes.map((n) => n.y + n.h)) + 20;
  return { ...layout, nodes, edges, layers, width, height, byId: new Map(nodes.map((n) => [n.id, n])) };
}

/** Splits a layout into paper-sized sheets with continuation captions. */
export function buildPrintSheets(layout: OrgLayout, paper: Paper): PrintSheet[] {
  const runs = packRows(layout, paper);
  const total = runs.length;
  return runs.map(([from, to], index) => ({
    layout: sliceRows(layout, from, to),
    index,
    total,
    caption: total === 1 ? "" : to < layout.layers.length - 1 ? `Continues on sheet ${index + 2} →` : `← Continued from sheet ${index}`,
    fromRow: from,
    toRow: to,
  }));
}

/** One sheet per department (division head retained on top) for large divisions. */
export function buildDepartmentSheets(employees: Employee[], division: string, paper: Paper): PrintSheet[] {
  const build = buildOrgTree(employees);
  const departments = [...new Set(employees.filter((e) => e.division === division).map((e) => e.department))].sort();
  const out: PrintSheet[] = [];
  for (const department of departments) {
    const roots = scopeRoots(build, division, department);
    const layout = buildPrintLayout(roots, paper);
    const sheets = buildPrintSheets(layout, paper);
    sheets.forEach((sheet, i) => {
      out.push({ ...sheet, caption: `${division} · ${department}${sheet.caption ? ` · ${sheet.caption}` : ""}`, index: out.length, total: 0, fromRow: sheet.fromRow, toRow: sheet.toRow, layout: sheet.layout });
      void i;
    });
  }
  return out.map((sheet, index) => ({ ...sheet, index, total: out.length }));
}

/* ────────────────────────────── rendering ────────────────────────────── */

const esc = (s: unknown) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
const levelColor = (level?: string) => LEVEL_COLORS[(level ?? "L2") as keyof typeof LEVEL_COLORS] ?? "#64748B";
const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

function cardSvg(n: LNode): string {
  const node = n.node as OrgNode;
  const st = employeeStatus(node.emp);
  const color = levelColor(node.level);
  const fill = st.temporary ? "#FEF08A" : "#FFFFFF";
  const stroke = st.vacant ? "#64748B" : n.inferred ? "#F59E0B" : "#94A3B8";
  const title = String(node.emp.title || "Position not specified");
  const titleLines = title.length > 26 ? [title.slice(0, 26), title.slice(26, 52)] : [title];
  const startY = n.y + (titleLines.length > 1 ? 17 : 23);
  return `<g>
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="${n.inferred ? 1.8 : 1.1}" ${st.vacant || n.inferred ? 'stroke-dasharray="5 4"' : ""}/>
    <rect x="${n.x}" y="${n.y + 5}" width="3.5" height="${n.h - 10}" fill="${color}"/>
    ${titleLines.map((line, i) => `<text x="${n.x + n.w / 2}" y="${startY + i * 14}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0F172A">${esc(line)}</text>`).join("")}
    <text x="${n.x + n.w / 2}" y="${startY + titleLines.length * 14 + 1}" text-anchor="middle" font-size="10.5" fill="#334155">${esc(st.vacant ? "VACANT" : node.emp.fullName)}</text>
    ${st.temporary ? `<text x="${n.x + n.w - 6}" y="${n.y + 13}" text-anchor="end" font-size="7.5" font-weight="700" fill="#92400E">TEMP</text>` : ""}
  </g>`;
}

function groupSvg(n: LNode): string {
  const members = n.members ?? [];
  const color = levelColor(members[0]?.level);
  const grid = groupCardGrid(members.length);
  const colW = (n.w - 12) / grid.cols;
  const rows = members
    .map((m, i) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      const x = n.x + 6 + col * colW;
      const y = n.y + 32 + row * 26;
      const st = employeeStatus(m.emp);
      return `<rect x="${x}" y="${y}" width="${colW - 4}" height="23" rx="3" fill="${st.temporary ? "#FEF08A" : "#F8FAFC"}" stroke="${st.vacant ? "#64748B" : "#E2E8F0"}" ${st.vacant ? 'stroke-dasharray="3 2"' : ""}/>
      <text x="${x + 5}" y="${y + 9}" font-size="7.5" font-weight="700" fill="#0F172A">${esc(st.vacant ? "VACANT" : m.emp.title).slice(0, 24)}</text>
      <text x="${x + 5}" y="${y + 18}" font-size="7" fill="#64748B">${esc(m.emp.fullName).slice(0, 26)}</text>`;
    })
    .join("");
  return `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="5" fill="#fff" stroke="${color}" stroke-width="1.1"/>
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="26" rx="5" fill="#F8FAFC"/>
    <text x="${n.x + 8}" y="${n.y + 17}" font-size="9" font-weight="700" fill="#0F172A">${esc(members[0]?.level ?? "")} roster · ${members.length} positions</text>${rows}</g>`;
}

/** One paper sheet as SVG (also used for editable per-sheet downloads). */
export function buildSheetSvg(sheet: PrintSheet, opts: OrgExportOpts): string {
  const layout = sheet.layout;
  const headerH = 78;
  const footerH = 56;
  const width = Math.max(900, layout.width + 120);
  const height = layout.height + headerH + footerH;
  const railX = 12;
  const railW = 54;
  const bands = layout.layers
    .map((L) => {
      const start = Math.max(0, L.offset - layout.gapMain / 2);
      const size = L.size + layout.gapMain;
      return `<rect x="0" y="${start + headerH}" width="${width}" height="${size}" fill="${L.index % 2 ? "#F8FAFC" : "#FFFFFF"}"/>
      ${L.index > 0 ? `<line x1="${railX + railW + 6}" y1="${start + headerH}" x2="${width - 12}" y2="${start + headerH}" stroke="#F8B900" stroke-width="2"/>` : ""}
      <rect x="${railX}" y="${start + headerH}" width="${railW}" height="${size}" fill="#FDE68A" fill-opacity=".92"/>
      <text x="${railX + railW / 2}" y="${start + headerH + size / 2 - 8}" text-anchor="middle" font-size="15" font-weight="800" fill="#0F172A">${esc(L.level)}${L.continuation ? "*" : ""}</text>
      <circle cx="${railX + railW / 2}" cy="${start + headerH + size / 2 + 13}" r="11" fill="${levelColor(L.level)}"/>
      <text x="${railX + railW / 2}" y="${start + headerH + size / 2 + 17}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${L.count}</text>`;
    })
    .join("");
  const edges = layout.edges
    .map((e) => `<path d="${e.d}" fill="none" stroke="${e.inferred ? "#F59E0B" : "#1F2937"}" stroke-width="1.2" ${e.inferred || e.kind === "staff" ? 'stroke-dasharray="5 4"' : ""}/>`)
    .join("");
  const nodes = layout.nodes.map((n) => (n.kind === "group" ? groupSvg(n) : cardSvg(n))).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <rect width="${width}" height="${headerH - 6}" fill="#062B5B"/><rect y="${headerH - 6}" width="${width}" height="3" fill="#00A8FF"/>
  <g transform="translate(18 12) scale(0.9)" fill="none" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">${ATOMA_MARK_PATHS.map((p) => `<path d="${p.d}" stroke="${p.stroke}" opacity="${p.opacity}"/>`).join("")}</g>
  <text x="82" y="32" font-family="Arial" font-size="19" font-weight="800" fill="#fff">${esc(opts.title)}</text>
  <text x="82" y="52" font-family="Arial" font-size="10" fill="#CFE8FF">${esc(opts.subtitle)}${sheet.caption ? ` · ${esc(sheet.caption)}` : ""}</text>
  <text x="${width - 18}" y="30" text-anchor="end" font-family="Arial" font-size="10" fill="#CFE8FF">Sheet ${sheet.index + 1} of ${sheet.total}</text>
  <text x="${width - 18}" y="48" text-anchor="end" font-family="Arial" font-size="9" fill="#CFE8FF">${esc(opts.generatedBy ?? "")}</text>
  <g transform="translate(0 ${headerH})">${bands}${edges}${nodes}</g>
  <line x1="18" y1="${height - footerH + 6}" x2="${width - 18}" y2="${height - footerH + 6}" stroke="#E2E8F0"/>
  <g transform="translate(${Math.max(18, width / 2 - 300)} ${height - footerH + 16})" font-family="Arial" font-size="8" fill="#475569">
    <rect x="0" y="0" width="22" height="12" rx="2" fill="#fff" stroke="#94A3B8"/><text x="28" y="9">Filled post</text>
    <rect x="96" y="0" width="22" height="12" rx="2" fill="#fff" stroke="#64748B" stroke-dasharray="4 3"/><text x="124" y="9">Vacant post</text>
    <rect x="196" y="0" width="22" height="12" rx="2" fill="#FEF08A" stroke="#D97706"/><text x="224" y="9">Temporary / contract</text>
    <line x1="348" y1="6" x2="370" y2="6" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="5 4"/><text x="376" y="9">Inferred line</text>
    <rect x="452" y="0" width="12" height="12" fill="#FDE68A"/><text x="470" y="9">Level band</text>
  </g>
  <text x="${width / 2}" y="${height - 12}" text-anchor="middle" font-family="Arial" font-size="9" fill="#64748B">${esc(opts.footer ?? "Made with ♥ by Mohibullah Afzalzada")}</text>
</svg>`;
}

/** Multi-page vector PDF: one page per sheet, sized to the chosen paper at readable scale. */
export async function downloadPrintPack(sheets: PrintSheet[], opts: OrgExportOpts, paper: Paper, fileName?: string): Promise<number> {
  const { jsPDF } = await import("jspdf");
  const [pw, ph] = PAPERS[paper];
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [pw, ph], compress: true });
  const margin = 26;
  const header = 62;
  const footer = 34;
  const usableW = pw - margin * 2;
  const usableH = ph - header - footer;

  sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    const layout = sheet.layout;
    const scale = Math.min(usableW / layout.width, usableH / layout.height);
    const ox = (pw - layout.width * scale) / 2;
    const oy = header;
    const X = (v: number) => ox + v * scale;
    const Y = (v: number) => oy + v * scale;
    const S = (v: number) => v * scale;
    const rgb = (hex: string): [number, number, number] => {
      const h = hex.replace("#", "").padEnd(6, "0");
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    };
    const fillHex = (hex: string) => doc.setFillColor(...rgb(hex));
    const strokeHex = (hex: string) => doc.setDrawColor(...rgb(hex));

    fillHex("#062B5B");
    doc.rect(0, 0, pw, header - 8, "F");
    fillHex("#00A8FF");
    doc.rect(0, header - 8, pw, 3, "F");
    doc.setLineCap("round");
    doc.setLineJoin("round");
    doc.setLineWidth(3);
    for (const path of ATOMA_MARK_PATHS) {
      strokeHex(path.stroke);
      const nums = (path.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      for (let i = 2; i + 1 < nums.length; i += 2) doc.line(margin + 12 + nums[i - 2] * 0.55, 14 + nums[i - 1] * 0.55, margin + 12 + nums[i] * 0.55, 14 + nums[i + 1] * 0.55);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(opts.title, margin + 52, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(207, 232, 255);
    doc.text(`${opts.subtitle}${sheet.caption ? ` · ${sheet.caption}` : ""}`, margin + 52, 40);
    doc.text(`Sheet ${sheet.index + 1} of ${sheet.total}`, pw - margin, 22, { align: "right" });
    doc.text(opts.generatedBy ?? "", pw - margin, 40, { align: "right" });

    // right-hand level rail (matches the approved drawing)
    const railW = 46;
    const railX = 12;
    for (const L of layout.layers) {
      const start = Math.max(0, L.offset - layout.gapMain / 2);
      const size = L.size + layout.gapMain;
      const cy = start + size / 2;
      fillHex(L.index % 2 ? "#F8FAFC" : "#FFFFFF");
      doc.rect(X(0), Y(start), S(layout.width), S(size), "F");
      if (L.index > 0) {
        strokeHex("#F8B900");
        doc.setLineWidth(Math.max(0.15, 1.8 * scale));
        doc.line(X(railX + railW + 6), Y(start), X(layout.width - 12), Y(start));
      }
      fillHex("#FDE68A");
      doc.rect(X(railX), Y(start), S(railW), S(size), "F");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(7, 14 * scale));
      doc.text(`${L.level}${L.continuation ? "*" : ""}`, X(railX + railW / 2), Y(cy - 9), { align: "center" });
      strokeHex(levelColor(L.level));
      fillHex("#FFFFFF");
      doc.setLineWidth(Math.max(0.3, 1.4 * scale));
      doc.circle(X(railX + railW / 2), Y(cy + 12), Math.max(5, 11 * scale), "FD");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(Math.max(5, 9 * scale));
      doc.text(String(L.count), X(railX + railW / 2), Y(cy + 12) + 3 * scale, { align: "center" });
    }

    for (const edge of layout.edges) {
      strokeHex(edge.inferred ? "#F59E0B" : "#1F2937");
      doc.setLineWidth(Math.max(0.1, scale * 1.2));
      doc.setLineDashPattern(edge.inferred || edge.kind === "staff" ? [Math.max(0.5, 4 * scale), Math.max(0.4, 3 * scale)] : [], 0);
      for (let i = 1; i < edge.points.length; i++) {
        const [x1, y1] = edge.points[i - 1];
        const [x2, y2] = edge.points[i];
        doc.line(X(x1), Y(y1), X(x2), Y(y2));
      }
      doc.setLineDashPattern([], 0);
    }

    for (const n of layout.nodes) {
      const x = X(n.x);
      const y = Y(n.y);
      const w = S(n.w);
      const h = S(n.h);
      if (n.kind === "group") {
        const members = n.members ?? [];
        const color = levelColor(members[0]?.level);
        fillHex("#FFFFFF");
        strokeHex(color);
        doc.roundedRect(x, y, w, h, 2, 2, "FD");
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(Math.max(3.5, 8 * scale));
        doc.text(`${members[0]?.level ?? ""} roster · ${members.length} positions`, x + S(8), y + S(17));
        const grid = groupCardGrid(members.length);
        const colW = (n.w - 12) / grid.cols;
        members.forEach((m, i) => {
          const mx = x + S(6 + (i % grid.cols) * colW);
          const my = y + S(32 + Math.floor(i / grid.cols) * 26);
          const st = employeeStatus(m.emp);
          fillHex(st.temporary ? "#FEF08A" : "#F8FAFC");
          strokeHex(st.vacant ? "#64748B" : "#E2E8F0");
          doc.roundedRect(mx, my, S(colW - 4), S(23), 1, 1, "FD");
          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(Math.max(3, 7.4 * scale));
          doc.text(String(st.vacant ? "VACANT" : m.emp.title).slice(0, 24), mx + S(5), my + S(9));
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(Math.max(2.8, 7 * scale));
          doc.text(String(m.emp.fullName).slice(0, 26), mx + S(5), my + S(18));
        });
        continue;
      }
      const node = n.node as OrgNode;
      const st = employeeStatus(node.emp);
      const color = levelColor(node.level);
      fillHex(st.temporary ? "#FEF08A" : "#FFFFFF");
      strokeHex(st.vacant ? "#64748B" : n.inferred ? "#F59E0B" : "#94A3B8");
      doc.setLineWidth(Math.max(0.1, scale * (n.inferred ? 1.8 : 1.1)));
      doc.setLineDashPattern(st.vacant || n.inferred ? [Math.max(0.5, 4 * scale), Math.max(0.4, 3 * scale)] : [], 0);
      doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
      doc.setLineDashPattern([], 0);
      fillHex(color);
      doc.rect(x + S(1), y + S(5), S(3.5), h - S(10), "F");
      const title = String(node.emp.title || "Position not specified");
      const lines = doc.splitTextToSize(title, w - S(14)).slice(0, 2) as string[];
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(5, 11.5 * scale));
      doc.text(lines, x + w / 2, y + (lines.length > 1 ? S(17) : S(23)), { align: "center", maxWidth: w - S(12) });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(4.6, 10.5 * scale));
      doc.setTextColor(51, 65, 85);
      doc.text(st.vacant ? "VACANT" : String(node.emp.fullName).slice(0, 28), x + w / 2, y + S(23) + lines.length * S(14), { align: "center", maxWidth: w - S(10) });
      if (st.temporary) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(Math.max(3.5, 7 * scale));
        doc.setTextColor(146, 64, 14);
        doc.text("TEMP", x + w - S(6), y + S(13), { align: "right" });
      }
    }

    // legend + footer
    const ly = ph - footer + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    let lx = margin;
    const legendBox = (label: string, fill: string, stroke: string, dashed = false) => {
      fillHex(fill);
      strokeHex(stroke);
      doc.setLineDashPattern(dashed ? [1.2, 1] : [], 0);
      doc.rect(lx, ly, 16, 10, "FD");
      doc.setLineDashPattern([], 0);
      doc.text(label, lx + 20, ly + 8);
      lx += 24 + doc.getTextWidth(label) + 12;
    };
    legendBox("Filled post", "#FFFFFF", "#94A3B8");
    legendBox("Vacant post", "#FFFFFF", "#64748B", true);
    legendBox("Temporary", "#FEF08A", "#D97706");
    strokeHex("#F59E0B");
    doc.setLineDashPattern([1.2, 1], 0);
    doc.line(lx, ly + 5, lx + 16, ly + 5);
    doc.setLineDashPattern([], 0);
    doc.text("Inferred line", lx + 20, ly + 8);
    lx += 24 + doc.getTextWidth("Inferred line") + 12;
    legendBox("Level band", "#FDE68A", "#FDE68A");
    const footerText = `${opts.footer ?? "Made with ♥ by Mohibullah Afzalzada"}${sheet.caption ? ` · ${sheet.caption}` : ""}`;
    doc.text(footerText, (pw - doc.getTextWidth(footerText)) / 2, ph - 10);
  });

  doc.save(fileName ?? `ATOMA_Organogram_${paper}_${stamp()}.pdf`);
  return sheets.length;
}
