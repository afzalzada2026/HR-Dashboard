import { computeKpis, countBy, groupStats, reportingChain, strategicMetrics } from "./analytics";
import { generateDemoRows } from "./demo";
import { FIELD_DEFS } from "./fields";
import { fmtDate, fmtNum, fmtPct, fmtYears, downloadBlob, downloadDataUrl, slugify, timestampSlug } from "./format";
import { executiveSummary, generateInsights } from "./insights";
import type { Employee } from "./types";
import { safeSpreadsheetValue } from "./validation";

export interface ExportColumn {
  key: string;
  label: string;
  get: (e: Employee) => string | number;
}

const num1 = (n: number | null) => (n === null ? "" : Math.round(n * 10) / 10);

export const EMPLOYEE_COLUMNS: ExportColumn[] = [
  { key: "hrisNo", label: "HRIS No", get: (e) => e.hrisNo },
  { key: "employeeNo", label: "Employee No", get: (e) => e.employeeNo },
  { key: "fullName", label: "Employee Full Name", get: (e) => e.fullName },
  { key: "firstName", label: "Employee First Name", get: (e) => e.firstName },
  { key: "lastName", label: "Employee Last Name", get: (e) => e.lastName },
  { key: "fatherName", label: "Father Name", get: (e) => e.fatherName },
  { key: "title", label: "Title", get: (e) => e.title },
  { key: "division", label: "Division", get: (e) => e.division },
  { key: "department", label: "Department", get: (e) => e.department },
  { key: "supervisor", label: "Direct Supervisor", get: (e) => e.supervisor },
  { key: "supervisorEmail", label: "Supervisor Email", get: (e) => e.supervisorEmail },
  { key: "dutyStation", label: "Duty Station", get: (e) => e.dutyStation },
  { key: "contactNumber", label: "Contact Number", get: (e) => e.contactNumber },
  { key: "level", label: "Actual Level", get: (e) => e.level },
  { key: "joinDate", label: "Date of Joining", get: (e) => e.joinDate },
  { key: "tenure", label: "Tenure (years)", get: (e) => num1(e.tenure) },
  { key: "dob", label: "Date of Birth", get: (e) => e.dob },
  { key: "age", label: "Age", get: (e) => (e.age === null ? "" : Math.floor(e.age)) },
  { key: "qualification", label: "Qualification", get: (e) => e.qualification },
  { key: "qualificationNew", label: "Qualification Group", get: (e) => e.qualificationGroup },
  { key: "expatLocal", label: "Expat / Local", get: (e) => e.expatLocal },
  { key: "nationality", label: "Nationality", get: (e) => e.nationality },
  { key: "gender", label: "Gender", get: (e) => e.gender },
  { key: "province", label: "Province", get: (e) => e.province },
  { key: "region", label: "Region", get: (e) => e.region },
  { key: "maritalStatus", label: "Marital Status", get: (e) => e.maritalStatus },
  { key: "email", label: "Email ID", get: (e) => e.email },
  { key: "tazkira", label: "Tazkira Number", get: (e) => e.tazkira },
  { key: "bloodGroup", label: "Blood Group", get: (e) => e.bloodGroup },
  { key: "remarks", label: "Remarks", get: (e) => e.remarks },
];

export async function exportCSV(emps: Employee[], cols: ExportColumn[], filename: string): Promise<void> {
  const Papa = (await import("papaparse")).default;
  const csv = Papa.unparse({ fields: cols.map((c) => c.label), data: emps.map((e) => cols.map((c) => safeSpreadsheetValue(c.get(e)))) });
  downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), filename);
}

export interface SheetSpec {
  name: string;
  rows: (string | number)[][];
  widths?: number[];
}

export async function exportSheets(sheets: SheetSpec[], filename: string): Promise<void> {
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows.map((row) => row.map(safeSpreadsheetValue)));
    const widths = s.widths ?? (s.rows[0] ?? []).map((_, i) => Math.min(48, Math.max(10, ...s.rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))));
    ws["!cols"] = widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename, { compression: true });
}

export async function exportEmployeesXLSX(emps: Employee[], cols: ExportColumn[], filename: string): Promise<void> {
  await exportSheets([{ name: "Employees", rows: [cols.map((c) => c.label), ...emps.map((e) => cols.map((c) => c.get(e)))] }], filename);
}

export interface ReportContext {
  title: string;
  datasetName: string;
  user: string;
  role: string;
  filters: string[];
  employees: Employee[];
  now: number;
}

/** Multi-sheet executive workbook: summary KPIs, strategic metrics, insights, breakdowns and employee list. */
export async function exportWorkbook(ctx: ReportContext): Promise<void> {
  const { employees: emps, now } = ctx;
  const k = computeKpis(emps, now, now);
  const s = strategicMetrics(emps, now);
  const ins = generateInsights(emps, now);
  const divs = groupStats(emps, (e) => e.division, now);
  const depts = groupStats(emps, (e) => e.department, now);
  const stations = groupStats(emps, (e) => e.dutyStation, now);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const summary: (string | number)[][] = [
    ["ATOMA — Workforce Intelligence Report"],
    [ctx.title],
    ["Generated", new Date(now).toLocaleString()],
    ["Dataset", ctx.datasetName],
    ["Prepared by", `${ctx.user} (${ctx.role})`],
    ["Filters", ctx.filters.length ? ctx.filters.join(" | ") : "None (full workforce)"],
    [],
    ["KPI", "Value"],
    ["Total Employees", k.total], ["Male Employees", k.male], ["Female Employees", k.female], ["Female %", r1(k.femalePct)],
    ["Gender Ratio (M:F)", isFinite(k.genderRatio) ? r1(k.genderRatio) : "n/a"], ["Local Staff", k.local], ["Expat Staff", k.expat],
    ["Average Age", r1(k.avgAge)], ["Average Tenure (yrs)", r1(k.avgTenure)], ["Married", k.married], ["Single", k.single],
    ["Divisions", k.divisions], ["Departments", k.departments], ["Duty Stations", k.dutyStations], ["Nationalities", k.nationalities],
    ["Average Span of Control", r1(k.avgSpan)], ["Joined This Year", k.joinedThisYear], ["Joined This Month", k.joinedThisMonth],
    ["Bachelor Degree+", k.bachelorPlus], ["Master Degree+", k.masterPlus], ["PhD Holders", k.phd],
  ];
  const strategic: (string | number)[][] = [
    ["Metric", "Value", "Definition"],
    ["Headcount Growth %", s.headcountGrowth === null ? "n/a" : r1(s.headcountGrowth), "Change in headcount vs 12 months ago"],
    ["Hiring Rate %", r1(s.hiringRate), "Hires in last 12 months / headcount"],
    ["Gender Diversity Index", r1(s.genderDiversityIndex), "Normalized Blau index (100 = parity)"],
    ["Nationality Diversity Index", r1(s.nationalityDiversityIndex), "Blau index × 100"],
    ["Average Department Size", r1(s.avgDeptSize), "Headcount / departments"],
    ["Management Ratio (staff per manager)", r1(s.managementRatio), "Non-managers / managers"],
    ["Retention Rate %", r1(s.retentionRate), "100 − turnover rate"],
    ["Turnover Rate %", r1(s.turnoverRate), "Separated (remarks) / headcount"],
    ["Promotion Ratio %", r1(s.promotionRatio), "Promoted (remarks) / headcount"],
    ["Average Reporting Line", r1(s.avgReportingLine), "Mean hierarchy depth from the top"],
  ];
  const groupRows = (list: ReturnType<typeof groupStats>) => [
    ["Name", "Headcount", "Share %", "Male", "Female", "Female %", "Avg Age", "Avg Tenure", "Hires 12m", "Expat %", "Degree %", "Managers", "Age 55+"],
    ...list.map((g) => [g.name, g.headcount, r1(g.share), g.male, g.female, r1(g.femalePct), r1(g.avgAge), r1(g.avgTenure), g.hires12m, r1(g.expatPct), r1(g.degreePct), g.managers, g.retirementRisk]),
  ];
  await exportSheets(
    [
      { name: "Executive Summary", rows: summary, widths: [34, 60] },
      { name: "Strategic Metrics", rows: strategic, widths: [38, 12, 48] },
      { name: "AI Insights", rows: [["Category", "Insight", "Headline", "Narrative", "Recommended Action"], ...ins.map((i) => [i.category, i.title, i.headline, i.narrative, i.action ?? ""])], widths: [16, 30, 26, 90, 60] },
      { name: "By Division", rows: groupRows(divs) },
      { name: "By Department", rows: groupRows(depts) },
      { name: "By Duty Station", rows: groupRows(stations) },
      { name: "Employees", rows: [EMPLOYEE_COLUMNS.map((c) => c.label), ...emps.map((e) => EMPLOYEE_COLUMNS.map((c) => c.get(e)))] },
    ],
    `${slugify(ctx.title)}-${timestampSlug()}.xlsx`
  );
}

/* ------------------------------------------------------------ images */

export async function captureElement(el: HTMLElement, background: string, scale = 1.6): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas-pro")).default;
  return html2canvas(el, {
    backgroundColor: background,
    scale: Math.min(scale, 2),
    useCORS: true,
    logging: false,
    ignoreElements: (node: Element) => node instanceof HTMLElement && node.dataset.noCapture === "true",
  });
}

export async function exportPNG(el: HTMLElement, title: string, background: string): Promise<void> {
  const canvas = await captureElement(el, background, 2);
  downloadDataUrl(canvas.toDataURL("image/png"), `${slugify(title)}-${timestampSlug()}.png`);
}

export interface SnapshotMeta {
  title: string;
  subtitle: string;
  filters: string[];
  user: string;
  background: string;
}

/** Branded composite snapshot: ATOMA header band + context (filters, author, timestamp) + dashboard capture. */
export async function exportSnapshot(el: HTMLElement, meta: SnapshotMeta): Promise<void> {
  const shot = await captureElement(el, meta.background, 1.5);
  const s = 1.5;
  const pad = Math.round(32 * s);
  const headerH = Math.round(132 * s);
  const footerH = Math.round(40 * s);
  const c = document.createElement("canvas");
  c.width = shot.width + pad * 2;
  c.height = headerH + shot.height + footerH + pad;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.fillStyle = meta.background;
  ctx.fillRect(0, 0, c.width, c.height);
  const g = ctx.createLinearGradient(0, 0, c.width, headerH);
  g.addColorStop(0, "#062B5B");
  g.addColorStop(0.65, "#0D47A1");
  g.addColorStop(1, "#00A8FF");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, headerH);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `800 ${Math.round(30 * s)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText("ATOMA", pad, Math.round(50 * s));
  ctx.font = `400 ${Math.round(13 * s)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("Workforce Intelligence Platform · Dashboard Snapshot", pad, Math.round(72 * s));
  ctx.font = `600 ${Math.round(20 * s)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(meta.title, pad, Math.round(104 * s));
  ctx.textAlign = "right";
  ctx.font = `400 ${Math.round(12 * s)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(new Date().toLocaleString(), c.width - pad, Math.round(46 * s));
  ctx.fillText(`Prepared by ${meta.user}`, c.width - pad, Math.round(66 * s));
  ctx.fillText(meta.subtitle, c.width - pad, Math.round(86 * s));
  const f = meta.filters.length ? `Filters: ${meta.filters.join("  •  ")}` : "Filters: none (full workforce)";
  ctx.fillText(f.length > 140 ? `${f.slice(0, 137)}…` : f, c.width - pad, Math.round(106 * s));
  ctx.textAlign = "left";
  ctx.drawImage(shot, pad, headerH + Math.round(pad / 2));
  ctx.font = `400 ${Math.round(11 * s)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = "#8A9AB0";
  ctx.fillText("Confidential — generated by ATOMA HR Workforce Analytics. Contains personal data; handle per company policy.", pad, c.height - Math.round(16 * s));
  downloadDataUrl(c.toDataURL("image/png"), `${slugify(meta.title)}-snapshot-${timestampSlug()}.png`);
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Multi-page landscape PDF of any dashboard view with ATOMA header/footer on every page. */
export async function exportViewPDF(el: HTMLElement, meta: SnapshotMeta): Promise<void> {
  const [{ jsPDF }, shot] = await Promise.all([import("jspdf"), captureElement(el, meta.background, 1.6)]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const margin = 22;
  const headerH = 58;
  const footerH = 24;
  const usableW = W - margin * 2;
  const usableH = H - headerH - footerH - 8;
  const ratio = usableW / shot.width;
  const slicePx = Math.floor(usableH / ratio);
  const pages = Math.max(1, Math.ceil(shot.height / slicePx));
  const bg = meta.background.startsWith("#") ? rgb(meta.background) : ([244, 248, 252] as [number, number, number]);
  for (let p = 0; p < pages; p++) {
    if (p > 0) pdf.addPage();
    pdf.setFillColor(...bg);
    pdf.rect(0, 0, W, H, "F");
    pdf.setFillColor(6, 43, 91);
    pdf.rect(0, 0, W, 46, "F");
    pdf.setFillColor(0, 168, 255);
    pdf.rect(0, 46, W, 3, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("ATOMA", margin, 22);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`Workforce Intelligence · ${meta.title}`, margin, 36);
    pdf.text(new Date().toLocaleString(), W - margin, 22, { align: "right" });
    pdf.text(`Prepared by ${meta.user}`, W - margin, 36, { align: "right" });
    const y = p * slicePx;
    const h = Math.min(slicePx, shot.height - y);
    const slice = document.createElement("canvas");
    slice.width = shot.width;
    slice.height = h;
    slice.getContext("2d")?.drawImage(shot, 0, y, shot.width, h, 0, 0, shot.width, h);
    pdf.addImage(slice.toDataURL("image/jpeg", 0.9), "JPEG", margin, headerH, usableW, h * ratio);
    pdf.setTextColor(120, 134, 156);
    pdf.setFontSize(8);
    const f = meta.filters.length ? `Filters: ${meta.filters.join(" • ")}` : "Filters: none";
    pdf.text(f.length > 150 ? `${f.slice(0, 147)}…` : f, margin, H - 10);
    pdf.text(`Page ${p + 1} of ${pages} · Confidential`, W - margin, H - 10, { align: "right" });
  }
  pdf.save(`${slugify(meta.title)}-${timestampSlug()}.pdf`);
}

type AutoTableDoc = { lastAutoTable?: { finalY: number } };

/** Text-based executive PDF report (crisp vector text + tables). */
export async function exportExecutivePDF(ctx: ReportContext): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default;
  const { employees: emps, now } = ctx;
  const k = computeKpis(emps, now, now);
  const s = strategicMetrics(emps, now);
  const ins = generateInsights(emps, now);
  const summary = executiveSummary(emps, now);
  const divs = groupStats(emps, (e) => e.division, now);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  doc.setFillColor(6, 43, 91);
  doc.rect(0, 0, W, 120, "F");
  doc.setFillColor(0, 168, 255);
  doc.rect(0, 120, W, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("ATOMA", M, 50);
  doc.setFontSize(15);
  doc.text(ctx.title, M, 78);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Dataset: ${ctx.datasetName}`, M, 98);
  doc.text(`Generated ${new Date(now).toLocaleString()} · ${ctx.user} (${ctx.role})`, M, 111);
  let y = 146;
  doc.setTextColor(11, 27, 51);
  doc.setFontSize(9);
  const filterText = ctx.filters.length ? `Scope: ${ctx.filters.join(" • ")}` : "Scope: full workforce (no filters applied)";
  doc.text(doc.splitTextToSize(filterText, W - M * 2), M, y);
  y += 20;
  const tiles: [string, string][] = [
    ["Total Employees", fmtNum(k.total)], ["Female %", fmtPct(k.femalePct)], ["Average Age", k.avgAge.toFixed(1)], ["Average Tenure", `${k.avgTenure.toFixed(1)} yrs`],
    ["Local / Expat", `${fmtNum(k.local)} / ${fmtNum(k.expat)}`], ["Divisions", String(k.divisions)], ["Departments", String(k.departments)], ["Duty Stations", String(k.dutyStations)],
    ["Hires (12m)", fmtNum(s.hires12m)], ["Headcount Growth", s.headcountGrowth === null ? "—" : fmtPct(s.headcountGrowth)], ["Turnover", fmtPct(s.turnoverRate)], ["Span of Control", s.avgSpan.toFixed(1)],
  ];
  const tw = (W - M * 2 - 3 * 10) / 4;
  tiles.forEach(([label, value], i) => {
    const cx = M + (i % 4) * (tw + 10);
    const cy = y + Math.floor(i / 4) * 54;
    doc.setFillColor(240, 246, 253);
    doc.setDrawColor(210, 225, 245);
    doc.roundedRect(cx, cy, tw, 46, 6, 6, "FD");
    doc.setTextColor(91, 107, 130);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), cx + 10, cy + 16);
    doc.setTextColor(13, 71, 161);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(value, cx + 10, cy + 36);
    doc.setFont("helvetica", "normal");
  });
  y += 54 * 3 + 12;
  doc.setTextColor(6, 43, 91);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Executive Summary", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(40, 52, 72);
  y += 16;
  for (const para of summary) {
    const lines = doc.splitTextToSize(para, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 12 + 8;
  }
  autoTable(doc, {
    startY: y + 4,
    head: [["Strategic Metric", "Value"]],
    body: [
      ["Headcount Growth", s.headcountGrowth === null ? "—" : fmtPct(s.headcountGrowth)],
      ["Hiring Rate", fmtPct(s.hiringRate)],
      ["Gender Diversity Index", `${s.genderDiversityIndex.toFixed(0)} / 100`],
      ["Nationality Diversity Index", `${s.nationalityDiversityIndex.toFixed(0)} / 100`],
      ["Average Department Size", s.avgDeptSize.toFixed(1)],
      ["Management Ratio", `1 : ${s.managementRatio.toFixed(1)}`],
      ["Retention Rate", fmtPct(s.retentionRate)],
      ["Turnover Rate", fmtPct(s.turnoverRate)],
      ["Promotion Ratio", fmtPct(s.promotionRatio)],
      ["Average Reporting Line", `${s.avgReportingLine.toFixed(1)} levels`],
    ],
    theme: "grid",
    headStyles: { fillColor: [13, 71, 161], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 5 },
    margin: { left: M, right: M },
  });
  y = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY ?? y) + 18;
  autoTable(doc, {
    startY: y,
    head: [["Division", "Headcount", "Share", "Female %", "Avg Age", "Avg Tenure", "Hires 12m", "Expat %"]],
    body: divs.map((d) => [d.name, fmtNum(d.headcount), fmtPct(d.share), fmtPct(d.femalePct), d.avgAge.toFixed(1), d.avgTenure.toFixed(1), fmtNum(d.hires12m), fmtPct(d.expatPct)]),
    theme: "striped",
    headStyles: { fillColor: [6, 43, 91], textColor: 255 },
    styles: { fontSize: 8.5, cellPadding: 4 },
    margin: { left: M, right: M },
  });
  y = ((doc as unknown as AutoTableDoc).lastAutoTable?.finalY ?? y) + 18;
  autoTable(doc, {
    startY: y,
    head: [["AI Insight", "Finding"]],
    body: ins.map((i) => [`${i.title}\n${i.headline}`, `${i.narrative}${i.action ? `\n→ ${i.action}` : ""}`]),
    theme: "grid",
    headStyles: { fillColor: [0, 168, 255], textColor: 255 },
    columnStyles: { 0: { cellWidth: 140, fontStyle: "bold" } },
    styles: { fontSize: 8.5, cellPadding: 5, valign: "top" },
    margin: { left: M, right: M },
  });
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(138, 154, 176);
    doc.text(`ATOMA · Confidential · Page ${p} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 16, { align: "right" });
  }
  doc.save(`${slugify(ctx.title)}-${timestampSlug()}.pdf`);
}

/* ------------------------------------------------------------ profile */

export function profileFields(e: Employee): [string, string][] {
  return [
    ["Employee Number", e.employeeNo || "—"],
    ["HRIS No", e.hrisNo || "—"],
    ["Full Name", e.fullName],
    ["Father Name", e.fatherName || "—"],
    ["Age", e.age === null ? "—" : `${Math.floor(e.age)} years`],
    ["Gender", e.gender],
    ["Nationality", e.nationality],
    ["Expat / Local", e.expatLocal],
    ["Marital Status", e.maritalStatus],
    ["Qualification", e.qualification ? `${e.qualification} (${e.qualificationGroup})` : e.qualificationGroup],
    ["Title", e.title],
    ["Actual Level", e.level],
    ["Department", e.department],
    ["Division", e.division],
    ["Supervisor", e.supervisor || "—"],
    ["Joining Date", fmtDate(e.joinDate)],
    ["Tenure", fmtYears(e.tenure)],
    ["Phone", e.contactNumber || "—"],
    ["Email", e.email || "—"],
    ["Location", `${e.dutyStation}${e.province !== "Unknown" ? `, ${e.province}` : ""}`],
    ["Blood Group", e.bloodGroup],
    ["Tazkira Number", e.tazkira || "—"],
    ["Remarks", e.remarks || "—"],
  ];
}

export async function downloadProfilePDF(e: Employee, all: Employee[]): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 44;
  doc.setFillColor(6, 43, 91);
  doc.rect(0, 0, W, 150, "F");
  doc.setFillColor(0, 168, 255);
  doc.rect(0, 150, W, 4, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(M + 38, 76, 38, "F");
  doc.setTextColor(13, 71, 161);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  const ini = e.fullName.split(/\s+/).filter(Boolean);
  doc.text(((ini[0]?.[0] ?? "") + (ini.length > 1 ? ini[ini.length - 1][0] : "")).toUpperCase(), M + 38, 85, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(e.fullName, M + 96, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${e.title} · ${e.department}`, M + 96, 84);
  doc.setFontSize(9);
  doc.text(`${e.division} Division · ${e.dutyStation}`, M + 96, 102);
  doc.text("ATOMA · Employee Profile", W - M, 30, { align: "right" });
  let y = 188;
  const fields = profileFields(e);
  const colW = (W - M * 2 - 20) / 2;
  fields.forEach(([label, value], i) => {
    const cx = M + (i % 2) * (colW + 20);
    const cy = y + Math.floor(i / 2) * 40;
    doc.setTextColor(120, 134, 156);
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), cx, cy);
    doc.setTextColor(11, 27, 51);
    doc.setFontSize(10.5);
    doc.text(doc.splitTextToSize(value, colW)[0] ?? "", cx, cy + 14);
    doc.setDrawColor(226, 234, 244);
    doc.line(cx, cy + 22, cx + colW, cy + 22);
  });
  y += Math.ceil(fields.length / 2) * 40 + 10;
  const chain = reportingChain(e, all);
  if (chain.length) {
    doc.setTextColor(6, 43, 91);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Reporting Line", M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(40, 52, 72);
    doc.text(doc.splitTextToSize([e.fullName, ...chain.map((c) => `${c.fullName} (${c.title})`)].join("  →  "), W - M * 2), M, y + 16);
  }
  doc.setFontSize(8);
  doc.setTextColor(138, 154, 176);
  doc.text(`Generated ${new Date().toLocaleString()} · Confidential personal data`, M, doc.internal.pageSize.getHeight() - 20);
  doc.save(`profile-${slugify(e.fullName)}.pdf`);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function printProfile(e: Employee): void {
  const rows = profileFields(e).map(([l, v]) => `<div class="f"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join("");
  const ini = e.fullName.split(/\s+/).filter(Boolean);
  const initials = ((ini[0]?.[0] ?? "") + (ini.length > 1 ? ini[ini.length - 1][0] : "")).toUpperCase();
  const html = `<!doctype html><html><head><title>${esc(e.fullName)} — ATOMA Profile</title><style>
  *{box-sizing:border-box;font-family:"Segoe UI",Arial,sans-serif}body{margin:0;color:#0B1B33}
  .h{background:linear-gradient(135deg,#062B5B,#0D47A1);color:#fff;padding:28px 36px;display:flex;gap:20px;align-items:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .a{width:72px;height:72px;border-radius:50%;background:#fff;color:#0D47A1;display:grid;place-items:center;font-size:26px;font-weight:800}
  h1{margin:0;font-size:22px}p{margin:4px 0 0;opacity:.85}.g{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;padding:24px 36px}
  .f{padding:10px 0;border-bottom:1px solid #E2EAF4}.f span{display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#78869C}.f b{font-size:13px;font-weight:600}
  .ft{padding:0 36px;font-size:10px;color:#8A9AB0}</style></head><body>
  <div class="h"><div class="a">${esc(initials)}</div><div><h1>${esc(e.fullName)}</h1><p>${esc(e.title)} · ${esc(e.department)}</p><p>${esc(e.division)} Division · ${esc(e.dutyStation)}</p></div></div>
  <div class="g">${rows}</div><div class="ft">ATOMA · Confidential · Printed ${esc(new Date().toLocaleString())}</div></body></html>`;
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const d = iframe.contentWindow?.document;
  if (!d) return;
  d.open();
  d.write(html);
  d.close();
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 2000);
  }, 300);
}

export function contactText(e: Employee): string {
  return [e.fullName, `${e.title} — ${e.department}, ${e.division}`, `Phone: ${e.contactNumber || "—"}`, `Email: ${e.email || "—"}`, `Location: ${e.dutyStation}`].join("\n");
}

/* ------------------------------------------------------------ template */

export async function downloadTemplate(format: "xlsx" | "csv"): Promise<void> {
  const { rows } = generateDemoRows(40, 3, new Date());
  const headers = FIELD_DEFS.map((d) => d.label);
  const sample = rows.slice(0, 6).map((r) => headers.map((h) => r[h] ?? ""));
  if (format === "csv") {
    const Papa = (await import("papaparse")).default;
    downloadBlob(new Blob(["\ufeff" + Papa.unparse({ fields: headers, data: sample })], { type: "text/csv;charset=utf-8" }), "atoma-hr-template.csv");
    return;
  }
  await exportSheets(
    [
      { name: "Employees", rows: [headers, ...sample] },
      { name: "Field Guide", rows: [["Field", "Group", "Type", "Accepted synonyms"], ...FIELD_DEFS.map((d) => [d.label, d.group, d.kind, d.synonyms.join(", ")])], widths: [24, 14, 10, 90] },
    ],
    "atoma-hr-template.xlsx"
  );
}

export function summarizeForToast(emps: Employee[]): string {
  const top = countBy(emps, (e) => e.division)[0];
  return `${fmtNum(emps.length)} employees${top ? ` · largest division ${top.name}` : ""}`;
}
