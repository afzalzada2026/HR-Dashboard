import { downloadBlob } from "./format";
import type { OrgLevelCode } from "./organogram-levels";
import { groupCardGrid, type LNode, type OrgLayout } from "./orglayout";
import { buildSheetSvg, cardTextLayout, downloadPrintPack, LEVEL_COLORS, printSheetSvg, sheetLayout, wrapCardText, type OrgExportOpts, type PrintSheet } from "./orgprint";
import { employeeStatus, type OrgNode } from "./orgtree";

/**
 * Public export API for the organogram.
 *
 * Every format (SVG / PDF / print / Visio) is rendered from the SAME geometry and the
 * same sheet renderer in `orgprint.ts`, so a chart can never look different depending
 * on which button the user pressed.
 */
export type { OrgExportOpts };
export { LEVEL_COLORS };

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

const esc = (value: unknown) =>
  String(value ?? "")
    .replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[char] ?? char);

const singleSheet = (layout: OrgLayout): PrintSheet => ({ layout, index: 0, total: 1, caption: "", fromRow: 0, toRow: 0 });

/** Editable SVG for the current chart (same pixels the user sees on screen). */
export function buildOrgSvg(layout: OrgLayout, opts: OrgExportOpts): string {
  return buildSheetSvg(singleSheet(layout), opts);
}

export function downloadOrgSvg(layout: OrgLayout, opts: OrgExportOpts): void {
  downloadBlob(new Blob([buildOrgSvg(layout, opts)], { type: "image/svg+xml;charset=utf-8" }), `ATOMA_Organogram_${stamp()}.svg`);
}

/** Vector PDF — no rasterisation anywhere. Big charts split into pages and the paper
 *  grows A4 → A3 → A2 so type never drops below the readable 0.7 pt/px floor. */
export async function downloadOrgVectorPdf(layout: OrgLayout, opts: OrgExportOpts): Promise<number> {
  const { paper, sheets } = sheetLayout(layout, "A3");
  return downloadPrintPack(sheets, opts, paper, `ATOMA_Organogram_Vector_${stamp()}.pdf`);
}

/** One-landscape-page print of the current chart. */
export function printOrgSvg(layout: OrgLayout, opts: OrgExportOpts): boolean {
  return printSheetSvg(singleSheet(layout), opts);
}

const vdxText = (titleLines: string[], name: string) =>
  `<Section N="Character"><Row IX="0"><Cell N="Font" V="0"/><Cell N="Size" V="0.075"/><Cell N="Style" V="1"/><Cell N="Color" V="#0F172A"/></Row><Row IX="1"><Cell N="Font" V="0"/><Cell N="Size" V="0.068"/><Cell N="Style" V="0"/><Cell N="Color" V="#334155"/></Row></Section><Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/><Cell N="SpBefore" V="0"/><Cell N="SpAfter" V="0"/><Cell N="LineRule" V="0"/><Cell N="LineSpace" V="0.86"/></Row></Section><Text>${[...titleLines, name].map(esc).join("&#10;")}</Text>`;

/** Visio XML fallback (.vdx) with real shapes for cards, connectors, bands and legend. */
export function buildVisioVdx(layout: OrgLayout, opts: OrgExportOpts): string {
  const U = 1 / 96;
  const header = 92;
  const width = layout.width + 60;
  const height = header + layout.height + 130;
  const offX = 30;
  const toY = (y: number) => height - y;
  const shapes: string[] = [];
  let id = 1;
  const rect = (x: number, y: number, w: number, h: number, fill: string, stroke: string, dashed: boolean, text: string) =>
    `<Shape ID="${id++}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"><Cell N="PinX" V="${((x + w / 2) * U).toFixed(3)}"/><Cell N="PinY" V="${(toY(y + h / 2) * U).toFixed(3)}"/><Cell N="Width" V="${(w * U).toFixed(3)}"/><Cell N="Height" V="${(h * U).toFixed(3)}"/><Cell N="LocPinX" V="${((w / 2) * U).toFixed(3)}"/><Cell N="LocPinY" V="${((h / 2) * U).toFixed(3)}"/><Cell N="FillForegnd" V="${fill}"/><Cell N="FillPattern" V="1"/><Cell N="LineColor" V="${stroke}"/><Cell N="LineWeight" V="0.6"/><Cell N="LinePattern" V="${dashed ? 2 : 1}"/><Section N="Geometry" IX="0"><Cell N="NoFill" V="1"/><Cell N="NoLine" V="1"/><Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row><Row T="LineTo" IX="2"><Cell N="X" V="${(w * U).toFixed(3)}"/><Cell N="Y" V="0"/></Row><Row T="LineTo" IX="3"><Cell N="X" V="${(w * U).toFixed(3)}"/><Cell N="Y" V="${(h * U).toFixed(3)}"/></Row><Row T="LineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="${(h * U).toFixed(3)}"/></Row><Row T="LineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row></Section>${text}</Shape>`;
  const line = (points: [number, number][], stroke: string) => {
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const w = Math.max((Math.max(...xs) - minX) * U, 0.01);
    const h = Math.max((Math.max(...ys) - minY) * U, 0.01);
    const rows = points.map((point, i) => `<Row T="${i === 0 ? "MoveTo" : "LineTo"}" IX="${i + 1}"><Cell N="X" V="${((point[0] - minX) * U).toFixed(3)}"/><Cell N="Y" V="${((point[1] - minY) * U).toFixed(3)}"/></Row>`).join("");
    return `<Shape ID="${id++}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0"><Cell N="PinX" V="${(((minX + Math.max(...xs)) / 2) * U).toFixed(3)}"/><Cell N="PinY" V="${(((minY + Math.max(...ys)) / 2) * U).toFixed(3)}"/><Cell N="Width" V="${w.toFixed(3)}"/><Cell N="Height" V="${h.toFixed(3)}"/><Cell N="LocPinX" V="${(w / 2).toFixed(3)}"/><Cell N="LocPinY" V="${(h / 2).toFixed(3)}"/><Cell N="FillPattern" V="0"/><Cell N="LineColor" V="${stroke}"/><Cell N="LineWeight" V="0.6"/><Cell N="LinePattern" V="1"/><Section N="Geometry" IX="0"><Cell N="NoFill" V="1"/><Cell N="NoLine" V="0"/>${rows}</Section></Shape>`;
  };

  shapes.push(rect(offX, 18, width - 60, 42, "#062B5B", "#062B5B", false, `<Section N="Character"><Row IX="0"><Cell N="Font" V="0"/><Cell N="Size" V="0.15"/><Cell N="Style" V="1"/><Cell N="Color" V="#FFFFFF"/></Row></Section><Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/></Row></Section><Text>${esc(opts.title)}</Text>`));
  for (const layer of layout.layers) {
    const start = header + Math.max(0, layer.offset - layout.gapMain / 2);
    const size = layer.size + layout.gapMain;
    shapes.push(rect(offX, start, 54, size, "#FDE68A", "#F8B900", false, `<Section N="Character"><Row IX="0"><Cell N="Font" V="0"/><Cell N="Size" V="0.12"/><Cell N="Style" V="1"/><Cell N="Color" V="#0F172A"/></Row></Section><Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/></Row></Section><Text>${esc(layer.level)}${layer.continuation ? "*" : ""}</Text>`));
  }
  for (const edge of layout.edges) shapes.push(line(edge.points.map(([x, y]) => [offX + x, header + y]), edge.inferred ? "#F59E0B" : "#1F2937"));
  for (const n of layout.nodes) {
    const node = n.node as OrgNode | undefined;
    const status = node ? employeeStatus(node.emp) : { vacant: false, temporary: false };
    const fill = status.temporary ? "#FEF08A" : "#FFFFFF";
    const dashed = n.inferred || status.vacant;
    const titleLines = cardTextLayout(String(node?.emp.title || "Position not specified"), n.w).lines;
    const nameLine = wrapCardText(status.vacant ? "VACANT" : node?.emp.fullName ?? "", n.w - 16, 10.5, false, 1)[0] ?? "";
    shapes.push(rect(offX + n.x, header + n.y, n.w, n.h, fill, dashed ? "#F59E0B" : "#94A3B8", dashed, vdxText(titleLines, nameLine)));
  }
  return `<?xml version="1.0" encoding="UTF-8"?><VisioDocument xmlns="urn:schemas-microsoft-com:office:visio" genericType="0"><DocumentProperties><Title>${esc(opts.title)}</Title><Creator>ATOMA Workforce Intelligence</Creator></DocumentProperties><StyleSheets><StyleSheet ID="0" NameU="No Style" Name="No Style"><Cell N="FillForegnd" V="#FFFFFF"/><Cell N="FillPattern" V="1"/><Cell N="LineColor" V="#334155"/><Cell N="LineWeight" V="0.5"/></StyleSheet></StyleSheets><DocumentSheet NameU="Document" Name="Document"/><Masters/><Pages><Page ID="0" NameU="Page-1" Name="Page-1"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0"><Cell N="PageWidth" V="${(width * U).toFixed(2)}"/><Cell N="PageHeight" V="${(height * U).toFixed(2)}"/><Cell N="PrintPageOrientation" V="2"/><Cell N="DrawingSizeType" V="3"/><Cell N="DrawingScaleType" V="0"/></PageSheet><Shapes>${shapes.join("")}</Shapes></Page></Pages></VisioDocument>`;
}

/**
 * Native editable Microsoft Visio drawing (.vsdx) through the SVG→Visio converter,
 * with a Visio XML (.vdx) fallback so the download always succeeds.
 */
export async function downloadOrgVisio(layout: OrgLayout, opts: OrgExportOpts): Promise<{ format: "vsdx" | "vdx"; shapes: number }> {
  const svgText = buildOrgSvg(layout, opts);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-9999";
  host.innerHTML = svgText;
  document.body.appendChild(host);
  try {
    const svg = host.querySelector("svg") as SVGSVGElement | null;
    if (!svg) throw new Error("SVG not available");
    const { svgElementToVsdx } = await import("@klyratech/mermaid-to-visio");
    const { bytes } = svgElementToVsdx(svg, { title: opts.title }) as { bytes: ArrayBuffer };
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(new Uint8Array(bytes));
    downloadBlob(new Blob([copy.buffer as ArrayBuffer], { type: "application/vnd.ms-visio.drawing" }), `ATOMA_Organogram_${stamp()}.vsdx`);
    return { format: "vsdx", shapes: layout.nodes.length + layout.edges.length };
  } catch {
    downloadBlob(new Blob([buildVisioVdx(layout, opts)], { type: "application/vnd.ms-visio" }), `ATOMA_Organogram_${stamp()}.vdx`);
    return { format: "vdx", shapes: layout.nodes.length + layout.edges.length };
  } finally {
    host.remove();
  }
}

/**
 * Editable PowerPoint (.pptx): cards are shapes, names/titles are text boxes and every
 * connector segment is a line shape — recipients can restyle the whole chart in PowerPoint.
 */
export async function downloadOrgPptx(layout: OrgLayout, opts: OrgExportOpts): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  // One design-px → inch mapping for the WHOLE slide (chart + header + legend), so a
  // zoomed-to-100% PowerPoint slide shows the same proportions as the SVG/print output.
  // Text size = design px × sx × 72 pt — no caps: capped 6–7 pt type on a 50" slide was
  // the "tiny invisible font in the ppt" in the bug report.
  const HEADER_PX = 78;
  const FOOTER_PX = 56;
  const designH = layout.height + HEADER_PX + FOOTER_PX;
  const aspect = layout.width / designH;
  let sw = 50;
  let sh = sw / aspect;
  if (sh > 50) {
    sh = 50;
    sw = sh * aspect;
  }
  sh = Math.max(5.625, sh);
  sw = Math.max(10, sw);
  if (sw < sh) {
    // All organogram prints are landscape — widen a narrow canvas rather than
    // shipping a portrait-ish slide.
    sw = sh;
  }
  pptx.defineLayout({ name: "ATOMA_ORG", width: sw, height: sh });
  pptx.layout = "ATOMA_ORG";
  pptx.author = opts.generatedBy ?? "ATOMA";
  pptx.subject = "Editable ATOMA organogram";
  pptx.title = opts.title;
  pptx.company = "ATOMA";
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  const sx = sw / layout.width;
  const sy = sh / designH;
  const X = (v: number) => v * sx;
  const Y = (v: number) => v * sy; // absolute design y (0 = slide top)
  const CY = (v: number) => Y(HEADER_PX + v); // chart-space y
  const fnt = (px: number) => Math.max(3.2, px * sx * 72);

  // Header band with the ATOMA double-chevron mark (same geometry as the SVG sheet).
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: sw, h: Y(72), fill: { color: "062B5B" }, line: { color: "062B5B" } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: Y(72), w: sw, h: Y(3), fill: { color: "00A8FF" }, line: { color: "00A8FF" } });
  slide.addShape(pptx.ShapeType.chevron, { x: X(18), y: Y(14), w: X(34), h: Y(40), fill: { color: "2948FF" }, line: { color: "2948FF", transparency: 100 } });
  slide.addShape(pptx.ShapeType.chevron, { x: X(46), y: Y(14), w: X(34), h: Y(40), fill: { color: "00BCEB", transparency: 4 }, line: { color: "00BCEB", transparency: 100 } });
  slide.addText(opts.title, { x: X(88), y: Y(12), w: X(Math.max(200, layout.width - 320)), h: Y(26), fontSize: fnt(19), bold: true, color: "FFFFFF", margin: 0, valign: "middle" });
  slide.addText(opts.subtitle, { x: X(88), y: Y(40), w: X(Math.max(200, layout.width - 320)), h: Y(18), fontSize: fnt(10), color: "CFE8FF", margin: 0, valign: "middle" });
  slide.addText("Sheet 1 of 1", { x: X(Math.max(600, layout.width - 240)), y: Y(16), w: X(222), h: Y(16), fontSize: fnt(10), color: "CFE8FF", align: "right", margin: 0 });
  slide.addText(opts.generatedBy ?? "", { x: X(Math.max(600, layout.width - 240)), y: Y(36), w: X(222), h: Y(14), fontSize: fnt(9), color: "CFE8FF", align: "right", margin: 0 });

  // Level bands: alternating row fill, amber separator and the left level rail — same
  // `start = offset − gap/2` math as the SVG sheet, so cards always sit inside their band.
  for (const layer of layout.layers) {
    const start = Math.max(0, layer.offset - layout.gapMain / 2);
    const size = layer.size + layout.gapMain;
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: CY(start),
      w: sw,
      h: Y(size),
      fill: { color: layer.index % 2 ? "F8FAFC" : "FFFFFF" },
      line: { color: layer.index % 2 ? "F8FAFC" : "FFFFFF", transparency: 100 },
    });
    if (layer.index > 0) slide.addShape(pptx.ShapeType.line, { x: X(70), y: CY(start), w: X(layout.width - 84), h: 0, line: { color: "F8B900", width: 1.4 } });
    slide.addShape(pptx.ShapeType.rect, { x: X(12), y: CY(start), w: X(54), h: Y(size), fill: { color: "FDE68A", transparency: 8 }, line: { color: "FDE68A", transparency: 100 } });
    const cy = start + size / 2;
    slide.addText(`${layer.level}${layer.continuation ? "*" : ""}`, { x: X(12), y: CY(cy - 21), w: X(54), h: Y(18), fontSize: fnt(15), bold: true, color: "0F172A", align: "center", valign: "middle", margin: 0 });
    slide.addShape(pptx.ShapeType.ellipse, { x: X(28), y: CY(cy + 2), w: X(22), h: Y(22), fill: { color: (LEVEL_COLORS[layer.level as keyof typeof LEVEL_COLORS] ?? "#64748B").replace("#", "") }, line: { color: "FFFFFF", transparency: 100 } });
    slide.addText(String(layer.count), { x: X(28), y: CY(cy + 2), w: X(22), h: Y(22), fontSize: fnt(9), bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0 });
  }

  // Editable connector line segments (one shape per leg).
  for (const edge of layout.edges) {
    const color = edge.inferred ? "F59E0B" : "1F2937";
    const dashType = edge.inferred ? ("dash" as const) : ("solid" as const);
    for (let i = 1; i < edge.points.length; i++) {
      const [x1, y1] = edge.points[i - 1];
      const [x2, y2] = edge.points[i];
      slide.addShape(pptx.ShapeType.line, {
        x: X(Math.min(x1, x2)),
        y: CY(Math.min(y1, y2)),
        w: Math.abs(x2 - x1) * sx,
        h: Math.abs(y2 - y1) * sy,
        flipH: x2 < x1,
        flipV: y2 < y1,
        line: { color, width: 0.8, dashType },
      });
    }
  }

  // Cards: shapes + text boxes placed by the SAME cardTextLayout the SVG sheet uses.
  for (const n of layout.nodes) {
    const x = X(n.x); // n.x is the card's LEFT edge — same as screen/SVG/PDF
    const y = CY(n.y);
    const w = X(n.w);
    const h = Y(n.h);
    if (n.kind === "group") {
      const members = n.members ?? [];
      const color = (LEVEL_COLORS[members[0]?.level ?? "L2"] ?? "64748B").replace("#", "");
      slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.03, fill: { color: "FFFFFF" }, line: { color, width: 0.7 } });
      slide.addShape(pptx.ShapeType.rect, { x, y, w, h: Y(26), fill: { color: "F8FAFC" }, line: { color: "F8FAFC", transparency: 100 } });
      const head = wrapCardText(`${members[0]?.level ?? ""} roster · ${members.length} positions`, n.w - 16, 9, true, 1)[0] ?? "";
      slide.addText(head, { x: x + X(8), y: CY(n.y + 6), w: w - X(16), h: Y(16), fontSize: fnt(9), bold: true, color: "0F172A", margin: 0, valign: "top" });
      const grid = groupCardGrid(members.length, members.length);
      const colW = (n.w - 12) / grid.cols;
      members.forEach((m, i) => {
        const col = i % grid.cols;
        const row = Math.floor(i / grid.cols);
        const cellX = X(n.x + 6 + col * colW);
        const cellY = CY(n.y + 32 + row * 26);
        const cellW = X(colW - 4);
        const st = employeeStatus(m.emp);
        slide.addShape(pptx.ShapeType.roundRect, {
          x: cellX,
          y: cellY,
          w: cellW,
          h: Y(23),
          rectRadius: 0.02,
          fill: { color: st.temporary ? "FEF08A" : "F8FAFC" },
          line: { color: st.vacant ? "64748B" : "E2E8F0", width: 0.5, dashType: st.vacant ? "dash" : "solid" },
        });
        slide.addText(wrapCardText(String(st.vacant ? "VACANT" : m.emp.title), colW - 9, 7.5, true, 1)[0] ?? "", {
          x: cellX + X(5),
          y: cellY + Y(2),
          w: X(colW - 9),
          h: Y(10),
          fontSize: fnt(7.5),
          bold: true,
          color: "0F172A",
          margin: 0,
          valign: "top",
        });
        slide.addText(wrapCardText(String(m.emp.fullName), colW - 9, 7, false, 1)[0] ?? "", {
          x: cellX + X(5),
          y: cellY + Y(11),
          w: X(colW - 9),
          h: Y(10),
          fontSize: fnt(7),
          color: "64748B",
          margin: 0,
          valign: "top",
        });
      });
      continue;
    }
    const emp = n.node?.emp;
    if (!emp) continue;
    const st = employeeStatus(emp);
    const level = n.node?.level ?? "L2";
    const color = (LEVEL_COLORS[level] ?? "64748B").replace("#", "");
    const fill = st.temporary ? "FEF08A" : "FFFFFF";
    slide.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w,
      h,
      rectRadius: 0.03,
      fill: { color: fill },
      line: { color: st.vacant ? "64748B" : n.inferred ? "F59E0B" : "94A3B8", width: 0.7, dashType: st.vacant || n.inferred ? "dash" : "solid" },
    });
    slide.addShape(pptx.ShapeType.rect, { x: x + X(1), y: CY(n.y + 5), w: X(3.5), h: Y(n.h - 10), fill: { color }, line: { color } });
    const title = String(emp.title || "Position not specified");
    const { lines, startY } = cardTextLayout(title, n.w);
    const nameLine = wrapCardText(st.vacant ? "VACANT" : emp.fullName, n.w - 16, 10.5, false, 1)[0] ?? "";
    slide.addText(lines.join("\n"), {
      x: x + X(6),
      y: CY(n.y + startY - 11),
      w: w - X(12),
      h: Y(lines.length * 14 + 4),
      fontSize: fnt(11.5),
      bold: true,
      color: "0F172A",
      align: "center",
      valign: "top",
      margin: 0,
    });
    slide.addText(nameLine, {
      x: x + X(8),
      y: CY(n.y + startY + lines.length * 14 + 1 - 10),
      w: w - X(16),
      h: Y(14),
      fontSize: fnt(10.5),
      color: "334155",
      align: "center",
      valign: "top",
      margin: 0,
    });
    if (st.temporary) slide.addText("TEMP", { x: x + w - X(34), y: CY(n.y + 3), w: X(30), h: Y(12), fontSize: fnt(7.5), bold: true, color: "92400E", align: "right", margin: 0 });
  }

  // Legend + footer — same design-px coordinates as the SVG sheet.
  const legY = HEADER_PX + layout.height + 16;
  const originX = Math.max(18, layout.width / 2 - 300);
  const addLegBox = (dx: number, fill: string, lineColor: string, dashType: "solid" | "dash" = "solid", wPx = 22) =>
    slide.addShape(pptx.ShapeType.rect, { x: X(originX + dx), y: Y(legY), w: X(wPx), h: Y(12), fill: { color: fill }, line: { color: lineColor, width: 0.5, dashType } });
  const addLegText = (dx: number, label: string) =>
    slide.addText(label, { x: X(originX + dx), y: Y(legY - 2), w: X(150), h: Y(16), fontSize: fnt(8), color: "475569", margin: 0, valign: "middle" });
  addLegBox(0, "FFFFFF", "94A3B8");
  addLegText(28, "Filled post");
  addLegBox(96, "FFFFFF", "64748B", "dash");
  addLegText(124, "Vacant post");
  addLegBox(196, "FEF08A", "D97706");
  addLegText(224, "Temporary / contract");
  slide.addShape(pptx.ShapeType.line, { x: X(originX + 348), y: Y(legY + 6), w: X(22), h: 0, line: { color: "F59E0B", width: 1.2, dashType: "dash" } });
  addLegText(376, "Inferred line");
  addLegBox(452, "FDE68A", "FDE68A", "solid", 12);
  addLegText(470, "Level band");
  slide.addText(opts.footer ?? "Made with ♥ by Mohibullah Afzalzada", { x: X(18), y: Y(HEADER_PX + layout.height + FOOTER_PX - 21), w: X(layout.width - 36), h: Y(14), fontSize: fnt(9), color: "64748B", align: "center", margin: 0 });
  await pptx.writeFile({ fileName: `ATOMA_Organogram_Editable_${stamp()}.pptx` });
}

export type { LNode, OrgLayout, PrintSheet };
