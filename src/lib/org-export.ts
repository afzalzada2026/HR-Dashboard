import { CARD_H, CARD_W, type OrganogramLayout, RAIL_W } from "./organogram";

export interface OrganogramExportMeta {
  title: string;
  scope: string;
  generatedBy: string;
  background?: string;
}

const HEADER_H = 78;
const FOOTER_H = 26;
const PAD = 26;

const NAVY = "#062B5B";
const BLUE = "#0D47A1";
const ACCENT = "#00A8FF";
const INK = "#0F172A";
const MUTED = "#64748B";
const RAIL_BG = "#F1F5F9";
const AMBER = "#F59E0B";
const AMBER_FILL = "#FDE68A";
const LINE = "#334155";

function clip(text: string, max = 34): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function contentSize(layout: OrganogramLayout) {
  return { width: layout.width + PAD * 2, height: HEADER_H + layout.height + FOOTER_H + PAD };
}

/** Editable SVG organogram: one page, true vector, opens in Illustrator / Visio / draw.io / Office. */
export function buildOrganogramSVG(layout: OrganogramLayout, meta: OrganogramExportMeta): string {
  const { width, height } = contentSize(layout);
  const offsetX = PAD;
  const offsetY = HEADER_H;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${Math.round(width)} ${Math.round(height)}" font-family="Segoe UI, Arial, sans-serif">`);
  parts.push(`<rect width="${Math.round(width)}" height="${Math.round(height)}" fill="${meta.background ?? "#FFFFFF"}"/>`);
  parts.push(`<rect width="${Math.round(width)}" height="${HEADER_H - 8}" fill="url(#hdr)"/>`);
  parts.push(`<defs><linearGradient id="hdr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY}"/><stop offset="0.65" stop-color="${BLUE}"/><stop offset="1" stop-color="${ACCENT}"/></linearGradient></defs>`);
  parts.push(`<rect y="${HEADER_H - 8}" width="${Math.round(width)}" height="3" fill="${ACCENT}"/>`);
  parts.push(`<text x="${PAD}" y="30" fill="#FFFFFF" font-size="15" font-weight="700">ATOMA</text>`);
  parts.push(`<text x="${PAD}" y="50" fill="#FFFFFF" font-size="13" font-weight="600">${escapeXml(meta.title)}</text>`);
  parts.push(`<text x="${PAD}" y="66" fill="rgba(255,255,255,0.82)" font-size="10">${escapeXml(meta.scope)}</text>`);
  parts.push(`<text x="${Math.round(width) - PAD}" y="30" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="end">${escapeXml(new Date().toLocaleString())}</text>`);
  parts.push(`<text x="${Math.round(width) - PAD}" y="48" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="end">Prepared by ${escapeXml(meta.generatedBy)}</text>`);
  parts.push(`<text x="${Math.round(width) - PAD}" y="64" fill="rgba(255,255,255,0.85)" font-size="10" text-anchor="end">Levels L6 → L1 · vector output</text>`);

  // level rail + separators
  for (const band of layout.bands) {
    parts.push(`<rect x="${offsetX}" y="${offsetY + band.y}" width="${RAIL_W}" height="${band.height}" fill="${RAIL_BG}" stroke="#CBD5E1" stroke-width="1"/>`);
    parts.push(`<text x="${offsetX + RAIL_W / 2}" y="${offsetY + band.y + band.height / 2 - 4}" text-anchor="middle" font-size="15" font-weight="700" fill="${INK}">${band.level}</text>`);
    parts.push(`<text x="${offsetX + RAIL_W / 2}" y="${offsetY + band.y + band.height / 2 + 11}" text-anchor="middle" font-size="8" fill="${MUTED}">${escapeXml(band.label)}</text>`);
    parts.push(`<line x1="${offsetX}" y1="${offsetY + band.y + band.height - 1}" x2="${Math.round(width) - PAD}" y2="${offsetY + band.y + band.height - 1}" stroke="${AMBER}" stroke-width="2"/>`);
  }

  for (const edge of layout.edges) {
    const points = edge.points.map(([x, y]) => `${x + offsetX},${y + offsetY}`).join(" ");
    parts.push(`<polyline points="${points}" fill="none" stroke="${LINE}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>`);
  }

  for (const item of layout.nodes) {
    const node = item.node;
    const x = item.x - CARD_W / 2 + offsetX;
    const y = item.y + offsetY;
    const fill = node.vacant ? "#FFFFFF" : node.temporary ? AMBER_FILL : "#FFFFFF";
    const stroke = node.vacant ? "#64748B" : node.temporary ? AMBER : "#334155";
    parts.push(`<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.3"${node.vacant || node.moreOf ? ' stroke-dasharray="5 3"' : ""}/>`);
    parts.push(`<text x="${x + CARD_W / 2}" y="${y + 22}" text-anchor="middle" font-size="11" font-weight="700" fill="${INK}">${escapeXml(clip(node.title))}</text>`);
    parts.push(`<text x="${x + CARD_W / 2}" y="${y + 39}" text-anchor="middle" font-size="10.5" fill="#334155">${escapeXml(clip(node.name))}</text>`);
    if (node.reports > 0 && !node.moreOf) parts.push(`<text x="${x + CARD_W / 2}" y="${y + 53}" text-anchor="middle" font-size="8.5" fill="${MUTED}">${node.reports} direct reports</text>`);
  }

  parts.push(`<text x="${PAD}" y="${height - 8}" font-size="9" fill="${MUTED}">ATOMA · Organization chart · dotted card = vacant post · yellow card = temporary/contract</text>`);
  parts.push("</svg>");
  return parts.join("");
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
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

  // Page-one header band (this export is a single page by design).
  doc.setFillColor(6, 43, 91);
  doc.rect(mapX(0), mapY(0), content.width * scale, (HEADER_H - 8) * scale, "F");
  doc.setFillColor(0, 168, 255);
  doc.rect(mapX(0), mapY(HEADER_H - 8), content.width * scale, 3 * scale, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(7, 15 * scale));
  doc.text("ATOMA", mapX(PAD), mapY(30));
  doc.setFontSize(Math.max(7, 13 * scale));
  doc.text(meta.title, mapX(PAD), mapY(50));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(Math.max(5.5, 10 * scale));
  doc.text(meta.scope, mapX(PAD), mapY(66));
  doc.text(new Date().toLocaleString(), mapX(content.width - PAD), mapY(30), { align: "right" });
  doc.text(`Prepared by ${meta.generatedBy}`, mapX(content.width - PAD), mapY(48), { align: "right" });

  const offsetX = PAD;
  const offsetY = HEADER_H;
  for (const band of layout.bands) {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(mapX(offsetX), mapY(offsetY + band.y), RAIL_W * scale, band.height * scale, "FD");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(5, 15 * scale));
    doc.text(band.level, mapX(offsetX + RAIL_W / 2), mapY(offsetY + band.y + band.height / 2), { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(Math.max(3.6, 8 * scale));
    doc.text(band.label, mapX(offsetX + RAIL_W / 2), mapY(offsetY + band.y + band.height / 2 + 11 * scale), { align: "center" });
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(1.6 * scale);
    doc.line(mapX(offsetX), mapY(offsetY + band.y + band.height - 1), mapX(content.width - PAD), mapY(offsetY + band.y + band.height - 1));
  }

  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(Math.max(0.5, 1.3 * scale));
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
    doc.setFontSize(Math.max(4, 10.5 * scale));
    const title = doc.splitTextToSize(clip(node.title), Math.max(20, w - 8 * scale))[0];
    doc.text(title, x + w / 2, y + h * 0.36, { align: "center", maxWidth: w - 8 * scale });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(Math.max(3.8, 9.5 * scale));
    doc.text(doc.splitTextToSize(clip(node.name), Math.max(20, w - 8 * scale))[0], x + w / 2, y + h * 0.62, { align: "center", maxWidth: w - 8 * scale });
    if (node.reports > 0 && !node.moreOf) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(Math.max(3.2, 8 * scale));
      doc.text(`${node.reports} direct reports`, x + w / 2, y + h * 0.82, { align: "center" });
    }
  }

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(Math.max(4, 9 * scale));
  doc.text("ATOMA · Organization chart · dotted = vacant post · yellow = temporary/contract · single-page vector", mapX(PAD), mapY(content.height - 8));
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
