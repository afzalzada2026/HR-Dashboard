import { downloadBlob } from "./format";
import type { OrgLevelCode } from "./organogram-levels";
import { ATOMA_CARD, type LNode, type OrgLayout } from "./orglayout";
import { buildSheetSvg, downloadPrintPack, LEVEL_COLORS, printSheetSvg, type OrgExportOpts, type PrintSheet } from "./orgprint";
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

/** Single-page (or multi-page) vector PDF — no rasterisation anywhere. */
export async function downloadOrgVectorPdf(layout: OrgLayout, opts: OrgExportOpts): Promise<void> {
  await downloadPrintPack([singleSheet(layout)], opts, "A3", `ATOMA_Organogram_Vector_${stamp()}.pdf`);
}

/** One-landscape-page print of the current chart. */
export function printOrgSvg(layout: OrgLayout, opts: OrgExportOpts): boolean {
  return printSheetSvg(singleSheet(layout), opts);
}

const vdxText = (title: string, name: string) =>
  `<Section N="Character"><Row IX="0"><Cell N="Font" V="0"/><Cell N="Size" V="0.075"/><Cell N="Style" V="1"/><Cell N="Color" V="#0F172A"/></Row><Row IX="1"><Cell N="Font" V="0"/><Cell N="Size" V="0.068"/><Cell N="Style" V="0"/><Cell N="Color" V="#334155"/></Row></Section><Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/><Cell N="SpBefore" V="0"/><Cell N="SpAfter" V="0"/><Cell N="LineRule" V="0"/><Cell N="LineSpace" V="0.86"/></Row></Section><Text>${esc(title)}&#10;${esc(name)}</Text>`;

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
    shapes.push(rect(offX + n.x - ATOMA_CARD.w / 2, header + n.y, ATOMA_CARD.w, ATOMA_CARD.h, fill, dashed ? "#F59E0B" : "#94A3B8", dashed, vdxText(status.vacant ? "VACANT" : node?.emp.title ?? n.id, status.vacant ? "(Vacant)" : node?.emp.fullName ?? "")));
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
  const aspect = layout.width / (layout.height + 108);
  let sw = 50;
  let sh = sw / aspect;
  if (sh > 50) {
    sh = 50;
    sw = sh * aspect;
  }
  sh = Math.max(5.625, sh);
  sw = Math.max(10, sw);
  pptx.defineLayout({ name: "ATOMA_ORG", width: sw, height: sh });
  pptx.layout = "ATOMA_ORG";
  pptx.author = opts.generatedBy ?? "ATOMA";
  pptx.subject = "Editable ATOMA organogram";
  pptx.title = opts.title;
  pptx.company = "ATOMA";
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  const sx = sw / layout.width;
  const chartTop = 0.78;
  const sy = (sh - chartTop - 0.34) / layout.height;
  const X = (v: number) => v * sx;
  const Y = (v: number) => chartTop + v * sy;

  // Header band with the ATOMA double-chevron mark.
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: sw, h: 0.7, fill: { color: "062B5B" }, line: { color: "062B5B" } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.66, w: sw, h: 0.04, fill: { color: "00A8FF" }, line: { color: "00A8FF" } });
  slide.addShape(pptx.ShapeType.chevron, { x: 0.18, y: 0.1, w: 0.38, h: 0.42, fill: { color: "2948FF" }, line: { color: "2948FF", transparency: 100 } });
  slide.addShape(pptx.ShapeType.chevron, { x: 0.42, y: 0.1, w: 0.38, h: 0.42, fill: { color: "00BCEB", transparency: 4 }, line: { color: "00BCEB", transparency: 100 } });
  slide.addText("ATOMA", { x: 0.82, y: 0.12, w: 0.9, h: 0.24, fontSize: 16, bold: true, color: "00A8FF", margin: 0 });
  slide.addText(opts.title, { x: 1.62, y: 0.1, w: Math.max(2, sw - 2), h: 0.28, fontSize: 15, bold: true, color: "FFFFFF", margin: 0 });
  slide.addText(opts.subtitle, { x: 1.62, y: 0.39, w: Math.max(2, sw - 2), h: 0.16, fontSize: 7, color: "CFE8FF", margin: 0 });

  // Level rail and bands.
  slide.addShape(pptx.ShapeType.rect, { x: X(12), y: chartTop, w: X(54), h: sy * layout.height, fill: { color: "FDE68A", transparency: 8 }, line: { color: "FDE68A", transparency: 100 } });
  for (const layer of layout.layers) {
    const start = Math.max(0, layer.offset - layout.gapMain / 2);
    const size = layer.size + layout.gapMain;
    if (layer.index > 0) slide.addShape(pptx.ShapeType.line, { x: X(70), y: Y(start), w: X(layout.width - 84), h: 0, line: { color: "F8B900", width: 1.2 } });
    slide.addText(`${layer.level}${layer.continuation ? "*" : ""}`, { x: X(14), y: Y(start + size / 2) - 0.08, w: X(50), h: 0.16, fontSize: 7, bold: true, color: "0F172A", align: "center", margin: 0 });
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
        y: Y(Math.min(y1, y2)),
        w: Math.abs(x2 - x1) * sx,
        h: Math.abs(y2 - y1) * sy,
        flipH: x2 < x1,
        flipV: y2 < y1,
        line: { color, width: 0.8, dashType },
      });
    }
  }

  // Cards: shapes + independent text boxes.
  for (const n of layout.nodes) {
    const x = X(n.x - n.w / 2);
    const y = Y(n.y);
    const w = Math.max(0.35, n.w * sx);
    const h = Math.max(0.2, n.h * sy);
    if (n.kind === "group") {
      const members = n.members ?? [];
      const color = (LEVEL_COLORS[members[0]?.level ?? "L2"] ?? "64748B").replace("#", "");
      slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.03, fill: { color: "FFFFFF" }, line: { color, width: 0.7 } });
      const text = members.map((m) => `${employeeStatus(m.emp).vacant ? "VACANT" : m.emp.fullName} — ${m.emp.title}`).join("\n");
      slide.addText(text, { x: x + 0.04, y: y + 0.04, w: w - 0.08, h: h - 0.08, fontSize: Math.max(2.5, Math.min(5, w * 3)), color: "0F172A", margin: 0.02, fit: "shrink" });
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
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h: Math.min(0.045, h * 0.12), fill: { color }, line: { color } });
    slide.addText(String(emp.title || "Position not specified"), {
      x: x + 0.03,
      y: y + h * 0.16,
      w: w - 0.06,
      h: h * 0.42,
      fontSize: Math.max(3, Math.min(7, w * 4.4)),
      bold: true,
      color: "0F172A",
      align: "center",
      valign: "middle",
      margin: 0,
      fit: "shrink",
    });
    slide.addText(st.vacant ? "VACANT" : emp.fullName, {
      x: x + 0.03,
      y: y + h * 0.58,
      w: w - 0.06,
      h: h * 0.34,
      fontSize: Math.max(2.6, Math.min(6, w * 3.8)),
      color: "334155",
      align: "center",
      valign: "middle",
      margin: 0,
      fit: "shrink",
    });
    if (st.temporary) slide.addText("TEMP", { x: x + w - 0.22, y: y + 0.02, w: 0.2, h: 0.1, fontSize: 4, bold: true, color: "92400E", align: "right", margin: 0 });
  }

  // Legend + footer.
  const legY = sh - 0.42;
  let legX = Math.max(0.2, sw / 2 - 3.8);
  const addLeg = (label: string, fill: string, line: string, dashType: "solid" | "dash" = "solid") => {
    slide.addShape(pptx.ShapeType.rect, { x: legX, y: legY, w: 0.18, h: 0.1, fill: { color: fill }, line: { color: line, width: 0.5, dashType } });
    slide.addText(label, { x: legX + 0.22, y: legY - 0.01, w: 0.95, h: 0.12, fontSize: 4.5, color: "64748B", margin: 0 });
    legX += 1.17;
  };
  addLeg("Filled post", "FFFFFF", "94A3B8");
  addLeg("Vacant post", "FFFFFF", "64748B", "dash");
  addLeg("Temporary / contract", "FEF08A", "D97706");
  addLeg("Inferred line", "FFFFFF", "F59E0B", "dash");
  addLeg("Level band", "FDE68A", "FDE68A");
  slide.addText(opts.footer ?? "Made with ♥ by Mohibullah Afzalzada", { x: 0.2, y: sh - 0.22, w: sw - 0.4, h: 0.12, fontSize: 6, color: "64748B", align: "center", margin: 0 });
  await pptx.writeFile({ fileName: `ATOMA_Organogram_Editable_${stamp()}.pptx` });
}

export type { LNode, OrgLayout, PrintSheet };
