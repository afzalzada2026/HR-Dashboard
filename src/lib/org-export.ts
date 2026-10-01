import { ATOMA_MARK_PATHS } from "./brand";
import { downloadBlob } from "./format";
import { LEVEL_ORDER, type OrgLevelCode } from "./organogram-levels";
import { groupCardGrid, type LayerInfo, type LNode, type OrgLayout } from "./orglayout";
import { employeeStatus, type OrgNode } from "./orgtree";
import type { Employee } from "./types";

export interface OrgExportOpts {
  title: string;
  subtitle: string;
  generatedBy?: string;
  footer?: string;
}

export const LEVEL_COLORS: Record<OrgLevelCode, string> = {
  L6: "#062B5B",
  L5: "#0D47A1",
  L4: "#1E6FE0",
  L3H: "#F59E0B",
  L3: "#00A8FF",
  L2: "#64748B",
  L1: "#94A3B8",
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

const displayLevel = (s?: string) => (s || "—").replace(/^L/i, "");
const initials = (e: Employee) => `${e.firstName?.[0] ?? e.fullName?.[0] ?? ""}${e.lastName?.[0] ?? ""}`.toUpperCase();
const levelColor = (level?: OrgLevelCode) => LEVEL_COLORS[(level ?? "L2") as OrgLevelCode] ?? "#64748B";

function wrap(text: string, max = 28, lines = 2): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max && line) {
      out.push(line);
      line = word;
      if (out.length === lines - 1) break;
    } else line = `${line} ${word}`.trim();
  }
  if (line && out.length < lines) out.push(line);
  const used = out.join(" ").split(/\s+/).length;
  if (used < words.length && out.length) out[out.length - 1] = `${out[out.length - 1].replace(/…$/, "")}…`;
  return out;
}

function nodeSvg(n: LNode): string {
  const node = n.node as OrgNode;
  const e = node.emp;
  const st = employeeStatus(e);
  const color = levelColor(node.level);
  const fill = st.temporary ? "#FEF08A" : "#FFFFFF";
  const dash = st.vacant || n.inferred ? ` stroke-dasharray="5 4"` : "";
  const stroke = st.vacant ? "#64748B" : n.inferred ? "#F59E0B" : "#94A3B8";
  // Position title (bold, top) then employee name beneath — maximum readable type per card.
  const title = wrap(e.title || "Position not specified", Math.max(16, Math.floor(n.w / 8.6)), 2);
  const startY = title.length > 1 ? n.y + 17 : n.y + 24;
  return `<g data-employee="${esc(e.employeeNo)}" style="cursor:pointer">
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="${n.inferred ? 1.8 : 1.2}"${dash}/>
    <rect x="${n.x}" y="${n.y + 6}" width="4" height="${n.h - 12}" fill="${color}"/>
    ${title.map((line, i) => `<text x="${n.x + n.w / 2}" y="${startY + i * 15}" text-anchor="middle" font-size="12" font-weight="700" fill="#0F172A">${esc(line)}</text>`).join("")}
    <text x="${n.x + n.w / 2}" y="${startY + title.length * 15 + 1}" text-anchor="middle" font-size="11" fill="#334155">${esc(st.vacant ? "VACANT" : e.fullName)}</text>
    ${st.temporary ? `<text x="${n.x + n.w - 7}" y="${n.y + 15}" text-anchor="end" font-size="8" font-weight="700" fill="#92400E">TEMP</text>` : ""}
  </g>`;
}

function groupSvg(n: LNode): string {
  const members = n.members ?? [];
  const level = members[0] ? members[0].level : "L2";
  const color = levelColor(level);
  const grid = groupCardGrid(members.length);
  const colW = (n.w - 12) / grid.cols;
  const rowH = 26;
  const rows = members
    .map((m, i) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      const x = n.x + 6 + col * colW;
      const y = n.y + 36 + row * rowH;
      const st = employeeStatus(m.emp);
      const fill = st.temporary ? "#FEF08A" : st.vacant ? "#fff" : "#F8FAFC";
      return `<rect x="${x}" y="${y}" width="${colW - 4}" height="${rowH - 3}" rx="3" fill="${fill}" stroke="${st.vacant ? "#64748B" : "#E2E8F0"}" ${st.vacant ? `stroke-dasharray="3 2"` : ""}/>
      <text x="${x + 5}" y="${y + 9}" font-size="7.5" font-weight="700" fill="#0F172A">${esc(st.vacant ? "VACANT" : m.emp.fullName).slice(0, 25)}</text>
      <text x="${x + 5}" y="${y + 18}" font-size="6.8" fill="#64748B">${esc(m.emp.title).slice(0, 31)}</text>`;
    })
    .join("");
  return `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="5" fill="#fff" stroke="${color}" stroke-width="1.2"/>
    <rect x="${n.x}" y="${n.y}" width="${n.w}" height="30" rx="5" fill="#F8FAFC"/>
    <rect x="${n.x + 8}" y="${n.y + 8}" width="26" height="14" rx="3" fill="${color}"/>
    <text x="${n.x + 21}" y="${n.y + 18}" text-anchor="middle" font-size="8" font-weight="700" fill="#fff">${esc(displayLevel(level))}</text>
    <text x="${n.x + 40}" y="${n.y + 18}" font-size="8.5" font-weight="700" fill="#0F172A">${members.length} positions at this level</text>${rows}</g>`;
}

/** Editable SVG in the approved ATOMA organogram style. */
export function buildOrgSvg(layout: OrgLayout, opts: OrgExportOpts): string {
  const headerH = 74;
  const footerH = 58;
  const chartY = headerH;
  const width = Math.max(900, layout.width);
  const height = layout.height + headerH + footerH;
  const bands = layout.layers
    .map((L: LayerInfo) => {
      const start = Math.max(0, L.offset - layout.gapMain / 2) + chartY;
      const size = L.size + layout.gapMain;
      return `<rect x="0" y="${start}" width="${width}" height="${size}" fill="${L.index % 2 ? "#F8FAFC" : "#FFFFFF"}"/>
      <rect x="12" y="${start}" width="48" height="${size}" fill="#FDE68A" fill-opacity="0.9"/>
      ${L.index > 0 ? `<line x1="12" y1="${start}" x2="${width - 12}" y2="${start}" stroke="#F8B900" stroke-width="2"/>` : ""}
      <text x="36" y="${start + size / 2 - 8}" text-anchor="middle" font-size="15" font-weight="800" fill="#0F172A">${esc(L.level + (L.continuation ? "*" : ""))}</text>
      <circle cx="36" cy="${start + size / 2 + 13}" r="11" fill="${LEVEL_COLORS[(L.level as OrgLevelCode) ?? "L2"]}"/>
      <text x="36" y="${start + size / 2 + 17}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${L.count}</text>
      <text x="70" y="${start + 13}" font-size="8" font-weight="700" fill="#64748B">${esc(L.band)}</text>`;
    })
    .join("");
  const edges = layout.edges
    .map((e) => `<path d="${e.d}" fill="none" stroke="${e.inferred ? "#F59E0B" : "#1F2937"}" stroke-width="1.25" ${e.inferred ? `stroke-dasharray="5 4"` : ""} ${e.kind === "staff" ? `stroke-dasharray="4 3"` : ""}/>`)
    .join("");
  const nodes = layout.nodes.map((n) => (n.kind === "group" ? groupSvg(n) : nodeSvg(n))).join("");
  const footer = opts.footer ?? "Made with \u2665 by Mohibullah Afzalzada";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <metadata>ATOMA Workforce Intelligence · generated ${new Date().toISOString()} · editable vector organogram</metadata>
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <rect width="${width}" height="${headerH}" fill="#062B5B"/>
  <rect y="${headerH - 4}" width="${width}" height="4" fill="#00A8FF"/>
  <rect x="18" y="13" width="60" height="46" rx="9" fill="#fff" fill-opacity=".96"/>
  <g transform="translate(22 17) scale(0.82)" fill="none" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
    ${ATOMA_MARK_PATHS.map((p) => `<path d="${p.d}" stroke="${p.stroke}" opacity="${p.opacity}"/>`).join("")}
  </g>
  <text x="88" y="34" font-family="Arial,sans-serif" font-size="20" font-weight="800" fill="#fff">${esc(opts.title)}</text>
  <text x="88" y="52" font-family="Arial,sans-serif" font-size="10" fill="#CFE8FF">${esc(opts.subtitle)}</text>
  <text x="${width - 20}" y="35" text-anchor="end" font-family="Arial,sans-serif" font-size="9" fill="#CFE8FF">ATOMA · Workforce Intelligence</text>
  <g transform="translate(0 ${chartY})">${bands}${edges}${nodes}</g>
  <line x1="20" y1="${height - footerH + 4}" x2="${width - 20}" y2="${height - footerH + 4}" stroke="#E2E8F0"/>
  <g transform="translate(${Math.max(20, width / 2 - 300)} ${height - footerH + 12})" font-family="Arial,sans-serif" font-size="8" fill="#475569">
    <rect x="0" y="0" width="22" height="12" rx="2" fill="#fff" stroke="#94A3B8"/><text x="28" y="9">Filled post</text>
    <rect x="96" y="0" width="22" height="12" rx="2" fill="#fff" stroke="#64748B" stroke-dasharray="4 3"/><text x="124" y="9">Vacant post</text>
    <rect x="196" y="0" width="22" height="12" rx="2" fill="#FEF08A" stroke="#D97706"/><text x="224" y="9">Temporary / contract</text>
    <line x1="348" y1="6" x2="370" y2="6" stroke="#F59E0B" stroke-width="1.5" stroke-dasharray="5 4"/><text x="376" y="9">Inferred line</text>
    <rect x="462" y="0" width="12" height="12" fill="#FDE68A"/><text x="480" y="9">Level band</text>
  </g>
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9.5" fill="#64748B">${esc(footer)}</text>
</svg>`;
}

export function downloadOrgSvg(layout: OrgLayout, opts: OrgExportOpts): void {
  downloadBlob(new Blob([buildOrgSvg(layout, opts)], { type: "image/svg+xml;charset=utf-8" }), `ATOMA_Organogram_${stamp()}.svg`);
}

/** Single-page editable vector PDF: every card, line and label stays selectable text/paths. */
export async function downloadOrgVectorPdf(layout: OrgLayout, opts: OrgExportOpts): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const aspect = layout.width / (layout.height + 132);
  const maxMm = 1200;
  let targetW = maxMm;
  let targetH = targetW / aspect;
  if (targetH > maxMm) {
    targetH = maxMm;
    targetW = targetH * aspect;
  }
  const doc = new jsPDF({ orientation: targetW >= targetH ? "landscape" : "portrait", unit: "mm", format: [Math.max(160, targetW), Math.max(100, targetH)], compress: true });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const header = Math.min(22, PH * 0.16);
  const footer = Math.min(18, PH * 0.13);
  const margin = Math.min(5, PW * 0.006);
  const scale = Math.min((PW - margin * 2) / layout.width, (PH - header - footer) / layout.height);
  const ox = (PW - layout.width * scale) / 2;
  const oy = header;
  const X = (v: number) => ox + v * scale;
  const Y = (v: number) => oy + v * scale;
  const mm = (v: number) => v * scale;
  const rgb = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "").padEnd(6, "0");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const fillHex = (h: string) => doc.setFillColor(...rgb(h));
  const strokeHex = (h: string) => doc.setDrawColor(...rgb(h));

  fillHex("#062B5B");
  doc.rect(0, 0, PW, header, "F");
  fillHex("#00A8FF");
  doc.rect(0, header - 1, PW, 1.4, "F");
  fillHex("#FFFFFF");
  doc.roundedRect(margin + 1, header * 0.12, header * 1.05, header * 0.68, 2, 2, "F");
  doc.setLineWidth(Math.max(1, header * 0.08));
  doc.setLineCap("round");
  for (const path of ATOMA_MARK_PATHS) {
    strokeHex(path.stroke);
    const nums = (path.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (let i = 2; i + 1 < nums.length; i += 2) {
      doc.line(margin + 5 + nums[i - 2] * 0.55, header * 0.2 + nums[i - 1] * 0.55, margin + 5 + nums[i] * 0.55, header * 0.2 + nums[i + 1] * 0.55);
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(Math.max(8, header * 0.7));
  doc.text(opts.title, margin + header * 1.2, header * 0.45);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 232, 255);
  doc.setFontSize(Math.max(4, header * 0.3));
  doc.text(opts.subtitle, margin + header * 1.2, header * 0.74);

  for (const L of layout.layers) {
    const start = Math.max(0, L.offset - layout.gapMain / 2);
    const size = L.size + layout.gapMain;
    fillHex(L.index % 2 ? "#F8FAFC" : "#FFFFFF");
    doc.rect(X(0), Y(start), mm(layout.width), mm(size), "F");
    fillHex("#FDE68A");
    doc.rect(X(12), Y(start), mm(48), mm(size), "F");
    if (L.index > 0) {
      strokeHex("#F8B900");
      doc.setLineWidth(Math.max(0.15, scale * 2));
      doc.line(X(12), Y(start), X(layout.width - 12), Y(start));
    }
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(4, mm(14)));
    doc.text(L.level + (L.continuation ? "*" : ""), X(36), Y(start + size / 2 - mm(6)), { align: "center" });
    const countColor = LEVEL_COLORS[(L.level as OrgLevelCode) ?? "L2"] ?? "#64748B";
    fillHex(countColor);
    doc.circle(X(36), Y(start + size / 2) + mm(13), mm(11), "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(Math.max(3, mm(9)));
    doc.text(String(L.count), X(36), Y(start + size / 2) + mm(16), { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(2, mm(8)));
    doc.setTextColor(71, 85, 105);
    doc.text(L.band, X(70), Y(start + 12));
  }

  for (const edge of layout.edges) {
    strokeHex(edge.inferred ? "#F59E0B" : "#1F2937");
    doc.setLineWidth(Math.max(0.1, scale * (edge.inferred ? 1.5 : 1.25)));
    doc.setLineDashPattern(edge.inferred ? [Math.max(0.5, mm(5)), Math.max(0.4, mm(4))] : [], 0);
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
    const w = mm(n.w);
    const h = mm(n.h);
    if (n.kind === "group") {
      const members = n.members ?? [];
      const color = levelColor(members[0]?.level ?? "L2");
      fillHex("#FFFFFF");
      strokeHex(color);
      doc.setLineWidth(Math.max(0.1, scale));
      doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
      fillHex("#F8FAFC");
      doc.rect(x, y, w, mm(30), "F");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(Math.max(2.2, mm(9)));
      doc.text(`${members.length} positions at this level`, x + mm(40), y + mm(19));
      const grid = groupCardGrid(members.length);
      const colW = (n.w - 12) / grid.cols;
      members.forEach((m, i) => {
        const mx = x + mm(6 + (i % grid.cols) * colW);
        const my = y + mm(36 + Math.floor(i / grid.cols) * 26);
        const st = employeeStatus(m.emp);
        fillHex(st.temporary ? "#FEF08A" : "#F8FAFC");
        strokeHex(st.vacant ? "#64748B" : "#E2E8F0");
        doc.roundedRect(mx, my, mm(colW - 4), mm(23), 1, 1, "FD");
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(Math.max(1.8, mm(7.2)));
        doc.text((st.vacant ? "VACANT" : m.emp.fullName).slice(0, 25), mx + mm(5), my + mm(9));
        doc.setFont("helvetica", "normal");
        doc.setFontSize(Math.max(1.6, mm(6.6)));
        doc.setTextColor(100, 116, 139);
        doc.text(m.emp.title.slice(0, 31), mx + mm(5), my + mm(18));
      });
      continue;
    }
    const node = n.node as OrgNode;
    const e = node.emp;
    const st = employeeStatus(e);
    const color = levelColor(node.level);
    fillHex(st.temporary ? "#FEF08A" : "#FFFFFF");
    strokeHex(st.vacant ? "#64748B" : n.inferred ? "#F59E0B" : "#94A3B8");
    doc.setLineWidth(Math.max(0.1, scale * (n.inferred ? 1.8 : 1.2)));
    doc.setLineDashPattern(st.vacant || n.inferred ? [Math.max(0.4, mm(4)), Math.max(0.3, mm(3))] : [], 0);
    doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
    doc.setLineDashPattern([], 0);
    fillHex(color);
    doc.rect(x + mm(1), y + mm(5), mm(3), h - mm(10), "F");
    const titleLines = doc.splitTextToSize(e.title || "Position not specified", w - mm(14)).slice(0, 2) as string[];
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(3.4, mm(11.5)));
    doc.text(titleLines, x + w / 2, y + (titleLines.length > 1 ? mm(16) : mm(21)), { align: "center", maxWidth: w - mm(12) });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(Math.max(3.2, mm(10.5)));
    doc.setTextColor(51, 65, 85);
    doc.text(st.vacant ? "VACANT" : e.fullName, x + w / 2, y + mm(21) + titleLines.length * mm(13), { align: "center", maxWidth: w - mm(10) });
    if (st.temporary) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(146, 64, 14);
      doc.text("TEMP", x + w - mm(8), y + mm(14), { align: "right" });
    }
  }

  const ly = PH - footer + 2;
  const boxW = 5;
  const boxH = 3.2;
  let lx = Math.max(margin, PW / 2 - 82);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(Math.max(3.2, footer * 0.26));
  doc.setTextColor(71, 85, 105);
  const legendBox = (label: string, fill: string, stroke: string, dashed = false) => {
    fillHex(fill);
    strokeHex(stroke);
    doc.setLineDashPattern(dashed ? [1.2, 1] : [], 0);
    doc.rect(lx, ly, boxW, boxH, "FD");
    doc.setLineDashPattern([], 0);
    doc.text(label, lx + boxW + 1.5, ly + boxH * 0.82);
    lx += boxW + doc.getTextWidth(label) + 7;
  };
  legendBox("Filled post", "#FFFFFF", "#94A3B8");
  legendBox("Vacant post", "#FFFFFF", "#64748B", true);
  legendBox("Temporary / contract", "#FEF08A", "#D97706");
  strokeHex("#F59E0B");
  doc.setLineDashPattern([1.2, 1], 0);
  doc.line(lx, ly + boxH / 2, lx + boxW, ly + boxH / 2);
  doc.setLineDashPattern([], 0);
  doc.text("Inferred line", lx + boxW + 1.5, ly + boxH * 0.82);
  lx += boxW + doc.getTextWidth("Inferred line") + 7;
  legendBox("Level band", "#FDE68A", "#FDE68A");

  doc.setFontSize(Math.max(4, footer * 0.34));
  doc.setTextColor(100, 116, 139);
  const footerText = opts.footer ?? "Made with \u2665 by Mohibullah Afzalzada";
  doc.text(footerText, (PW - doc.getTextWidth(footerText)) / 2, PH - footer * 0.32);
  doc.save(`ATOMA_Organogram_Vector_${stamp()}.pdf`);
}

/** Prints one landscape page with the full sheet (legend included). */
export function printOrgSvg(layout: OrgLayout, opts: OrgExportOpts): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  try {
    win.opener = null;
  } catch {
    /* ignore */
  }
  win.document.write(`<!doctype html><html><head><title>${esc(opts.title)}</title><style>@page{size:landscape;margin:6mm}html,body{margin:0;background:#fff}svg{width:100%;height:auto;display:block}</style></head><body>${buildOrgSvg(layout, opts)}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\\/script></body></html>`);
  win.document.close();
  return true;
}

/** Native editable Microsoft Visio drawing (.vsdx); falls back to Visio XML (.vdx). */
export async function downloadOrgVisio(layout: OrgLayout, opts: OrgExportOpts): Promise<{ format: "vsdx" | "vdx"; shapes: number }> {
  const svgText = buildOrgSvg(layout, opts);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-9999";
  host.innerHTML = svgText;
  document.body.appendChild(host);
  try {
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) throw new Error("SVG not available for conversion");
    const { svgElementToVsdx } = await import("@klyratech/mermaid-to-visio");
    const { bytes } = svgElementToVsdx(svg, { title: opts.title }) as { bytes: ArrayBuffer; stats: { shapes: number; texts: number } };
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(new Uint8Array(bytes));
    downloadBlob(new Blob([copy.buffer as ArrayBuffer], { type: "application/vnd.ms-visio.drawing" }), `ATOMA_Organogram_Editable_${stamp()}.vsdx`);
    return { format: "vsdx", shapes: layout.nodes.length + layout.edges.length };
  } catch {
    const xml = buildVisioVdx(layout, opts);
    downloadBlob(new Blob([xml], { type: "application/vnd.ms-visio" }), `ATOMA_Organogram_Editable_${stamp()}.vdx`);
    return { format: "vdx", shapes: layout.nodes.length + layout.edges.length };
  } finally {
    host.remove();
  }
}

const vdxText = (title: string, name: string, chip: string) =>
  `<Section N="Character"><Row IX="0"><Cell N="Font" V="0"/><Cell N="Size" V="0.075"/><Cell N="Style" V="1"/><Cell N="Color" V="#0F172A"/></Row><Row IX="1"><Cell N="Font" V="0"/><Cell N="Size" V="0.068"/><Cell N="Style" V="0"/><Cell N="Color" V="#334155"/></Row></Section><Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/><Cell N="SpBefore" V="0"/><Cell N="SpAfter" V="0"/><Cell N="LineRule" V="0"/><Cell N="LineSpace" V="0.86"/></Row></Section><Text>${esc(title)}${name ? `&#10;${esc(name)}` : ""}${chip ? ` &#10;${esc(chip)}` : ""}</Text>`;

/** Compact Visio XML fallback: real shapes for cards, connectors, bands and legend. */
export function buildVisioVdx(layout: OrgLayout, opts: OrgExportOpts): string {
  const U = 1 / 96;
  const header = 90;
  const width = layout.width + 60;
  const height = header + layout.height + 130;
  const offX = 30;
  const toY = (y: number) => height - y;
  const shapes: string[] = [];
  let id = 1;
  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke: string, dashed: boolean, text: string) =>
    `<Shape ID="${id++}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"><Cell N="PinX" V="${((x + w / 2) * U).toFixed(3)}"/><Cell N="PinY" V="${(toY(y + h / 2) * U).toFixed(3)}"/><Cell N="Width" V="${(w * U).toFixed(3)}"/><Cell N="Height" V="${(h * U).toFixed(3)}"/><Cell N="LocPinX" V="${((w / 2) * U).toFixed(3)}"/><Cell N="LocPinY" V="${((h / 2) * U).toFixed(3)}"/><Cell N="FillForegnd" V="${fill}"/><Cell N="FillPattern" V="1"/><Cell N="LineColor" V="${stroke}"/><Cell N="LineWeight" V="0.6"/><Cell N="LinePattern" V="${dashed ? 2 : 1}"/><Section N="Geometry" IX="0"><Cell N="NoFill" V="1"/><Cell N="NoLine" V="1"/><Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row><Row T="LineTo" IX="2"><Cell N="X" V="${(w * U).toFixed(3)}"/><Cell N="Y" V="0"/></Row><Row T="LineTo" IX="3"><Cell N="X" V="${(w * U).toFixed(3)}"/><Cell N="Y" V="${(h * U).toFixed(3)}"/></Row><Row T="LineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="${(h * U).toFixed(3)}"/></Row><Row T="LineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row></Section>${text}</Shape>`;
  const line = (points: [number, number][], stroke: string) => {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max((Math.max(...xs) - minX) * U, 0.01);
    const h = Math.max((Math.max(...ys) - minY) * U, 0.01);
    const rows = points.map((p, i) => `<Row T="${i === 0 ? "MoveTo" : "LineTo"}" IX="${i + 1}"><Cell N="X" V="${((p[0] - minX) * U).toFixed(3)}"/><Cell N="Y" V="${((p[1] - minY) * U).toFixed(3)}"/></Row>`).join("");
    return `<Shape ID="${id++}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"><Cell N="PinX" V="${(((minX + Math.max(...xs)) / 2) * U).toFixed(3)}"/><Cell N="PinY" V="${(((minY + Math.max(...ys)) / 2) * U).toFixed(3)}"/><Cell N="Width" V="${w.toFixed(3)}"/><Cell N="Height" V="${h.toFixed(3)}"/><Cell N="LocPinX" V="${(w / 2).toFixed(3)}"/><Cell N="LocPinY" V="${(h / 2).toFixed(3)}"/><Cell N="FillPattern" V="0"/><Cell N="LineColor" V="${stroke}"/><Cell N="LineWeight" V="0.6"/><Cell N="LinePattern" V="1"/><Section N="Geometry" IX="0"><Cell N="NoFill" V="1"/><Cell N="NoLine" V="0"/>${rows}</Section></Shape>`;
  };

  shapes.push(rect(offX, 20, width - 60, 40, "#062B5B", "#062B5B", false, `<Section N="Character"><Row IX="0"><Cell N="Font" V="0"/><Cell N="Size" V="0.15"/><Cell N="Style" V="1"/><Cell N="Color" V="#FFFFFF"/></Row></Section><Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/></Row></Section><Text>${esc(opts.title)}</Text>`));
  for (const L of layout.layers) {
    const start = header + Math.max(0, L.offset - layout.gapMain / 2);
    const size = L.size + layout.gapMain;
    shapes.push(rect(offX, start, 48, size, "#FDE68A", "#F8B900", false, `<Section N="Character"><Row IX="0"><Cell N="Font" V="0"/><Cell N="Size" V="0.12"/><Cell N="Style" V="1"/><Cell N="Color" V="#0F172A"/></Row></Section><Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/></Row></Section><Text>${displayLevel(L.level)}${L.continuation ? " cont." : ""}</Text>`));
  }
  for (const edge of layout.edges) shapes.push(line(edge.points.map(([x, y]) => [offX + x, header + y]), edge.inferred ? "#F59E0B" : "#1F2937"));
  for (const n of layout.nodes) {
    const node = n.node as OrgNode;
    const st = node ? employeeStatus(node.emp) : { vacant: false, temporary: false };
    const color = levelColor(node?.level);
    const fill = st.temporary ? "#FEF08A" : "#FFFFFF";
    const dashed = n.inferred || st.vacant;
    shapes.push(rect(offX + n.x, header + n.y, n.w, n.h, fill, dashed ? "#F59E0B" : "#94A3B8", dashed, vdxText(n.kind === "group" ? `${n.members?.length ?? 0} positions at this level` : st.vacant ? "VACANT" : node.emp.fullName, n.kind === "group" ? "" : node.emp.title, displayLevel(node?.level))));
    void color;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><VisioDocument xmlns="urn:schemas-microsoft-com:office:visio" genericType="0"><DocumentProperties><Title>${esc(opts.title)}</Title><Creator>ATOMA Workforce Intelligence</Creator></DocumentProperties><StyleSheets><StyleSheet ID="0" NameU="No Style" Name="No Style"><Cell N="FillForegnd" V="#FFFFFF"/><Cell N="FillPattern" V="1"/><Cell N="LineColor" V="#334155"/><Cell N="LineWeight" V="0.5"/></StyleSheet></StyleSheets><DocumentSheet NameU="Document" Name="Document"/><Masters/><Pages><Page ID="0" NameU="Page-1" Name="Page-1"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0"><Cell N="PageWidth" V="${(width * U).toFixed(2)}"/><Cell N="PageHeight" V="${(height * U).toFixed(2)}"/><Cell N="PrintPageOrientation" V="2"/><Cell N="DrawingSizeType" V="3"/><Cell N="DrawingScaleType" V="0"/></PageSheet><Shapes>${shapes.join("")}</Shapes></Page></Pages></VisioDocument>`;
}

export type { Employee, OrgNode };
export type { LayerInfo, LNode, OrgLayout };
export { LEVEL_ORDER };
