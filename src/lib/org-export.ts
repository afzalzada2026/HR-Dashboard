import { ATOMA_ACCENT, ATOMA_BLUE, ATOMA_MARK_PATHS, ATOMA_NAVY } from "./brand";
import { CARD_H, CARD_W, type OrganogramLayout, RAIL_W } from "./organogram";

export interface OrganogramExportMeta {
  title: string;
  scope: string;
  generatedBy: string;
  background?: string;
}

const HEADER_H = 86;
const LEGEND_H = 54;
const FOOTER_H = 22;
const PAD = 26;

const INK = "#0F172A";
const MUTED = "#64748B";
const RAIL_BG = "#F1F5F9";
const AMBER = "#F59E0B";
const AMBER_FILL = "#FDE68A";
const LINE = "#334155";

function clip(text: string, max = 32): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

function contentSize(layout: OrganogramLayout) {
  return { width: layout.width + PAD * 2, height: HEADER_H + layout.height + LEGEND_H + FOOTER_H };
}

/** Editable SVG organogram: one page, true vector, opens in Illustrator / Visio / draw.io / Office. */
export function buildOrganogramSVG(layout: OrganogramLayout, meta: OrganogramExportMeta): string {
  const { width, height } = contentSize(layout);
  const offsetX = PAD;
  const offsetY = HEADER_H;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" font-family="Segoe UI, Arial, sans-serif">`);
  parts.push(`<rect width="${Math.round(width)}" height="${Math.round(height)}" fill="${meta.background ?? "#FFFFFF"}"/>`);
  parts.push(`<defs><linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${ATOMA_NAVY}"/><stop offset="0.65" stop-color="${ATOMA_BLUE}"/><stop offset="1" stop-color="${ATOMA_ACCENT}"/></linearGradient></defs>`);
  parts.push(`<rect width="${Math.round(width)}" height="${HEADER_H - 10}" fill="url(#hdr)"/>`);
  parts.push(`<rect y="${HEADER_H - 10}" width="${Math.round(width)}" height="3" fill="${ATOMA_ACCENT}"/>`);
  // ATOMA mark
  parts.push(`<g transform="translate(${PAD}, 12) scale(0.92)" fill="none" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">`);
  for (const path of ATOMA_MARK_PATHS) parts.push(`<path d="${path.d}" stroke="${path.stroke}" opacity="${path.opacity}"/>`);
  parts.push("</g>");
  parts.push(`<text x="${PAD + 62}" y="34" fill="#FFFFFF" font-size="16" font-weight="700" letter-spacing="3">ATOMA</text>`);
  parts.push(`<text x="${PAD + 62}" y="52" fill="#FFFFFF" font-size="12.5" font-weight="600">${escapeXml(meta.title)}</text>`);
  parts.push(`<text x="${PAD + 62}" y="68" fill="rgba(255,255,255,0.82)" font-size="10">${escapeXml(meta.scope)}</text>`);
  parts.push(`<text x="${Math.round(width) - PAD}" y="32" fill="rgba(255,255,255,0.88)" font-size="10" text-anchor="end">${escapeXml(new Date().toLocaleString())}</text>`);
  parts.push(`<text x="${Math.round(width) - PAD}" y="50" fill="rgba(255,255,255,0.88)" font-size="10" text-anchor="end">Prepared by ${escapeXml(meta.generatedBy)}</text>`);
  parts.push(`<text x="${Math.round(width) - PAD}" y="68" fill="rgba(255,255,255,0.88)" font-size="10" text-anchor="end">Levels L6 → L1 · vector · single page</text>`);

  for (const band of layout.bands) {
    parts.push(`<rect x="${offsetX}" y="${offsetY + band.y}" width="${RAIL_W}" height="${band.height}" fill="${RAIL_BG}" stroke="#CBD5E1" stroke-width="1"/>`);
    parts.push(`<text x="${offsetX + RAIL_W / 2}" y="${offsetY + band.y + band.height / 2 - 3}" text-anchor="middle" font-size="14" font-weight="700" fill="${INK}">${band.level}</text>`);
    parts.push(`<text x="${offsetX + RAIL_W / 2}" y="${offsetY + band.y + band.height / 2 + 11}" text-anchor="middle" font-size="7.5" fill="${MUTED}">${escapeXml(band.label)}</text>`);
    parts.push(`<line x1="${offsetX}" y1="${offsetY + band.y + band.height - 1}" x2="${Math.round(width) - PAD}" y2="${offsetY + band.y + band.height - 1}" stroke="${AMBER}" stroke-width="2"/>`);
  }

  for (const edge of layout.edges) {
    const points = edge.points.map(([x, y]) => `${x + offsetX},${y + offsetY}`).join(" ");
    parts.push(`<polyline points="${points}" fill="none" stroke="${LINE}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>`);
  }

  for (const item of layout.nodes) {
    const node = item.node;
    const x = item.x - CARD_W / 2 + offsetX;
    const y = item.y + offsetY;
    const fill = node.vacant ? "#FFFFFF" : node.temporary ? AMBER_FILL : "#FFFFFF";
    const stroke = node.vacant ? "#64748B" : node.temporary ? AMBER : "#334155";
    parts.push(`<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.2"${node.vacant || node.moreOf ? ' stroke-dasharray="5 3"' : ""}/>`);
    parts.push(`<text x="${x + CARD_W / 2}" y="${y + 21}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${INK}">${escapeXml(clip(node.title))}</text>`);
    parts.push(`<text x="${x + CARD_W / 2}" y="${y + 37}" text-anchor="middle" font-size="10" fill="#334155">${escapeXml(clip(node.name))}</text>`);
    if (node.reports > 0 && !node.moreOf) parts.push(`<text x="${x + CARD_W / 2}" y="${y + 50}" text-anchor="middle" font-size="8" fill="${MUTED}">${node.reports} direct reports</text>`);
    parts.push(`<text x="${x + CARD_W - 6}" y="${y + 12}" text-anchor="end" font-size="7.5" font-weight="700" fill="${MUTED}">${node.level}</text>`);
  }

  // Printed legend (always present on the export/print sheet).
  const legendY = HEADER_H + layout.height + 18;
  parts.push(`<line x1="${PAD}" y1="${legendY - 12}" x2="${Math.round(width) - PAD}" y2="${legendY - 12}" stroke="#E2E8F0" stroke-width="1"/>`);
  const legend: [string, string, string, boolean][] = [
    ["Filled post", "#FFFFFF", "#334155", false],
    ["Vacant post", "#FFFFFF", "#64748B", true],
    ["Temporary / contract", AMBER_FILL, AMBER, false],
    ["Level band", RAIL_BG, AMBER, false],
  ];
  let legendX = PAD;
  for (const [label, fill, stroke, dashed] of legend) {
    parts.push(`<rect x="${legendX}" y="${legendY}" width="30" height="16" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.2"${dashed ? ' stroke-dasharray="4 2"' : ""}/>`);
    if (label === "Level band") parts.push(`<line x1="${legendX}" y1="${legendY + 15}" x2="${legendX + 30}" y2="${legendY + 15}" stroke="${AMBER}" stroke-width="2"/>`);
    parts.push(`<text x="${legendX + 38}" y="${legendY + 12}" font-size="10" fill="#334155">${label}</text>`);
    legendX += 38 + label.length * 6.2 + 28;
  }
  parts.push(`<text x="${PAD}" y="${height - 8}" font-size="9" fill="${MUTED}">ATOMA · Organization chart · reporting lines follow each employee’s line manager · generated ${escapeXml(new Date().toLocaleString())}</text>`);
  parts.push("</svg>");
  return parts.join("");
}

const PAGE_SIZES: [number, number][] = [
  [841.89, 595.28], // A4 landscape
  [1190.55, 841.89], // A3
  [1683.78, 1190.55], // A2
  [2383.94, 1683.78], // A1
  [3370.39, 2383.94], // A0
];

/** Single-page vector PDF (no rasterisation): chooses A4→A0 so the chart stays legible and editable. */
export async function exportOrganogramPDF(layout: OrganogramLayout, meta: OrganogramExportMeta, fileName: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const content = contentSize(layout);
  const margin = 24;
  let page = PAGE_SIZES[PAGE_SIZES.length - 1];
  for (const size of PAGE_SIZES) {
    const scale = Math.min((size[0] - margin * 2) / content.width, (size[1] - margin * 2) / content.height);
    if (scale >= 0.55) {
      page = size;
      break;
    }
  }
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: page });
  const scale = Math.min((page[0] - margin * 2) / content.width, (page[1] - margin * 2) / content.height);
  const originX = (page[0] - content.width * scale) / 2;
  const originY = (page[1] - content.height * scale) / 2;
  const mapX = (x: number) => originX + x * scale;
  const mapY = (y: number) => originY + y * scale;

  doc.setFillColor(6, 43, 91);
  doc.rect(mapX(0), mapY(0), content.width * scale, (HEADER_H - 10) * scale, "F");
  doc.setFillColor(0, 168, 255);
  doc.rect(mapX(0), mapY(HEADER_H - 10), content.width * scale, 3 * scale, "F");

  // ATOMA mark (three chevrons)
  doc.setLineCap("round");
  doc.setLineJoin("round");
  doc.setLineWidth(Math.max(1, 11 * scale));
  for (const path of ATOMA_MARK_PATHS) {
    const rgb = [parseInt(path.stroke.slice(1, 3), 16), parseInt(path.stroke.slice(3, 5), 16), parseInt(path.stroke.slice(5, 7), 16)] as [number, number, number];
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    const pairs = path.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let index = 2; index + 1 < pairs.length; index += 2) {
      doc.line(mapX(PAD + pairs[index - 2] * 0.92), mapY(12 + pairs[index - 1] * 0.92), mapX(PAD + pairs[index] * 0.92), mapY(12 + pairs[index + 1] * 0.92));
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(7, 16 * scale));
  doc.text("ATOMA", mapX(PAD + 62), mapY(34));
  doc.setFontSize(Math.max(6, 12.5 * scale));
  doc.text(meta.title, mapX(PAD + 62), mapY(52));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(Math.max(5, 10 * scale));
  doc.text(meta.scope, mapX(PAD + 62), mapY(68));
  doc.text(new Date().toLocaleString(), mapX(content.width - PAD), mapY(32), { align: "right" });
  doc.text(`Prepared by ${meta.generatedBy}`, mapX(content.width - PAD), mapY(50), { align: "right" });

  const offsetX = PAD;
  const offsetY = HEADER_H;
  for (const band of layout.bands) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(mapX(offsetX), mapY(offsetY + band.y), RAIL_W * scale, band.height * scale, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(5, 14 * scale));
    doc.text(band.level, mapX(offsetX + RAIL_W / 2), mapY(offsetY + band.y + band.height / 2), { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(Math.max(3.6, 7.5 * scale));
    doc.text(band.label, mapX(offsetX + RAIL_W / 2), mapY(offsetY + band.y + band.height / 2 + 11 * scale), { align: "center" });
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(1.6 * scale);
    doc.line(mapX(offsetX), mapY(offsetY + band.y + band.height - 1), mapX(content.width - PAD), mapY(offsetY + band.y + band.height - 1));
  }

  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(Math.max(0.5, 1.2 * scale));
  for (const edge of layout.edges) {
    for (let index = 1; index < edge.points.length; index++) {
      const [x1, y1] = edge.points[index - 1];
      const [x2, y2] = edge.points[index];
      doc.line(mapX(x1 + offsetX), mapY(y1 + offsetY), mapX(x2 + offsetX), mapY(y2 + offsetY));
    }
  }

  for (const item of layout.nodes) {
    const node = item.node;
    const x = mapX(item.x - CARD_W / 2 + offsetX);
    const y = mapY(item.y + offsetY);
    const w = CARD_W * scale;
    const h = CARD_H * scale;
    const fill: [number, number, number] = node.temporary ? [253, 230, 138] : [255, 255, 255];
    const stroke: [number, number, number] = node.vacant ? [100, 116, 139] : node.temporary ? [245, 158, 11] : [51, 65, 85];
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
    if (node.vacant || node.moreOf) doc.setLineDashPattern([3, 2], 0);
    doc.setLineWidth(Math.max(0.4, 1.1 * scale));
    doc.roundedRect(x, y, w, h, 2 * scale, 2 * scale, "FD");
    if (node.vacant || node.moreOf) doc.setLineDashPattern([], 0);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(4, 10 * scale));
    doc.text(doc.splitTextToSize(clip(node.title), Math.max(20, w - 8 * scale))[0], x + w / 2, y + h * 0.36, { align: "center", maxWidth: w - 8 * scale });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(Math.max(3.8, 9 * scale));
    doc.text(doc.splitTextToSize(clip(node.name), Math.max(20, w - 8 * scale))[0], x + w / 2, y + h * 0.62, { align: "center", maxWidth: w - 8 * scale });
    if (node.reports > 0 && !node.moreOf) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(Math.max(3.2, 7.5 * scale));
      doc.text(`${node.reports} direct reports`, x + w / 2, y + h * 0.82, { align: "center" });
    }
  }

  // Printed legend
  const legendY = HEADER_H + layout.height + 18;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(scale);
  doc.line(mapX(PAD), mapY(legendY - 12), mapX(content.width - PAD), mapY(legendY - 12));
  const legend: [string, [number, number, number], [number, number, number], boolean][] = [
    ["Filled post", [255, 255, 255], [51, 65, 85], false],
    ["Vacant post", [255, 255, 255], [100, 116, 139], true],
    ["Temporary / contract", [253, 230, 138], [245, 158, 11], false],
    ["Level band", [241, 245, 249], [245, 158, 11], false],
  ];
  let legendX = PAD;
  doc.setFontSize(Math.max(3.8, 9.5 * scale));
  for (const [label, fill, stroke, dashed] of legend) {
    doc.setFillColor(fill[0], fill[1], fill[2]);
    doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
    if (dashed) doc.setLineDashPattern([3, 2], 0);
    doc.rect(mapX(legendX), mapY(legendY), 30 * scale, 16 * scale, "FD");
    if (dashed) doc.setLineDashPattern([], 0);
    if (label === "Level band") {
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(2 * scale);
      doc.line(mapX(legendX), mapY(legendY + 15), mapX(legendX + 30), mapY(legendY + 15));
    }
    doc.setTextColor(51, 65, 85);
    doc.text(label, mapX(legendX + 38), mapY(legendY + 11));
    legendX += 38 + label.length * 5.6 + 26;
  }
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(Math.max(4, 8.5 * scale));
  doc.text("ATOMA · Organization chart · reporting lines follow each employee’s line manager", mapX(PAD), mapY(content.height - 8));
  doc.save(fileName);
}

/** Prints the organogram on one landscape page via a hidden frame (no popup blockers involved). */
export function printOrganogram(layout: OrganogramLayout, meta: OrganogramExportMeta): void {
  const svg = buildOrganogramSVG(layout, meta);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(frame);
  const doc = frame.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(`<!doctype html><html><head><title>${escapeXml(meta.title)}</title><style>
    @page { size: landscape; margin: 8mm; }
    html,body { margin:0; padding:0; background:#fff; }
    svg { width: 100%; height: auto; display:block; }
  </style></head><body>${svg}</body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 2_000);
  }, 250);
}
