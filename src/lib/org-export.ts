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

export type { LNode, OrgLayout, PrintSheet };
