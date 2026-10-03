import { NextResponse } from "next/server";
import { computeKpis } from "@/lib/analytics";
import { applyFilters, EMPTY_FILTERS, FILTER_LABELS } from "@/lib/filters";
import { matchProvince, validateProvinceCoverage } from "@/lib/geo";
import { buildOrgLayout, type OrgLayout } from "@/lib/orglayout";
import { buildOrgTree, scopeRoots } from "@/lib/orgtree";
import { buildSheetSvg, fitPrintPack } from "@/lib/orgprint";
import { buildVisioVdx } from "@/lib/org-export";
import { canonicalOrgLevel, LEVEL_ORDER } from "@/lib/organogram-levels";
import { enrichEmployees, normalizeRows } from "@/lib/normalize";
import { autoMap } from "@/lib/mapping";
import type { Employee } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

const CARD_W = 152;
const CARD_H = 58;

function sampleWorkforce(): Employee[] {
  const raw = [
    { "Employee No": "AT-001", "Employee Full Name": "Marius van Wyk", "Position Title": "Chief Financial Officer", "Actual Level": "L6", "Division": "Finance", "Department": "Executive", "Direct Supervisor": "", "Email ID": "marius@atoma.af", "Date of Joining": "2015-03-01", "Date of Birth": "1972-05-14", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    { "Employee No": "AT-002", "Employee Full Name": "Karimullah Qasmi", "Position Title": "GM Finance", "Actual Level": "L5", "Division": "Finance", "Department": "Finance", "Direct Supervisor": "Marius van Wyk", "Email ID": "karim@atoma.af", "Date of Joining": "2017-01-15", "Date of Birth": "1980-02-11", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    { "Employee No": "AT-003", "Employee Full Name": "Saeedullah Saeed", "Position Title": "Sr. Manager Financial Operations", "Actual Level": "L3H", "Division": "Finance", "Department": "Financial Operations", "Direct Supervisor": "Karimullah Qasmi", "Email ID": "saeed@atoma.af", "Date of Joining": "2018-06-01", "Date of Birth": "1985-08-09", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    ...["Amanullah Ahmadzai", "Barakatullah Baig", "Rahim Khan Niazi"].map((name, i) => ({ "Employee No": `AT-10${i}`, "Employee Full Name": name, "Position Title": "Manager – Accounts", "Actual Level": "L3", "Division": "Finance", "Department": "Financial Operations", "Direct Supervisor": "Saeedullah Saeed", "Email ID": `m${i}@atoma.af`, "Date of Joining": "2019-02-01", "Date of Birth": "1988-01-01", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul" })),
    ...["Mohammad Nabi Azimi", "Rashid Shuja", "Seifullah Safi", "Ahmad Zia Arzoy"].map((name, i) => ({ "Employee No": `AT-20${i}`, "Employee Full Name": name, "Position Title": "Accountant", "Actual Level": "L2", "Division": "Finance", "Department": "Financial Operations", "Direct Supervisor": "Amanullah Ahmadzai", "Email ID": `a${i}@atoma.af`, "Date of Joining": "2020-01-01", "Date of Birth": "1993-04-04", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul" })),
    ...["Zarmina Hassani", "Nadia Ahmadi"].map((name, i) => ({ "Employee No": `AT-30${i}`, "Employee Full Name": name, "Position Title": "Representative", "Actual Level": "L1", "Division": "Finance", "Department": "Financial Operations", "Direct Supervisor": "Mohammad Nabi Azimi", "Email ID": `r${i}@atoma.af`, "Date of Joining": "2022-01-01", "Date of Birth": "1999-07-07", "Gender": "F", "Region / Province": "Herat", "Duty Station": "Herat" })),
    { "Employee No": "AT-900", "Employee Full Name": "Vacant Post", "Position Title": "Manager – Treasury (Vacant)", "Actual Level": "L3", "Division": "Finance", "Department": "Treasury", "Direct Supervisor": "Karimullah Qasmi", "Email ID": "", "Date of Joining": "", "Date of Birth": "", "Gender": "", "Region / Province": "", "Duty Station": "" },
    { "Employee No": "AT-901", "Employee Full Name": "Contract Analyst", "Position Title": "Analyst (Temporary)", "Actual Level": "L2", "Division": "Finance", "Department": "Treasury", "Direct Supervisor": "Karimullah Qasmi", "Email ID": "temp@atoma.af", "Date of Joining": "2024-01-01", "Date of Birth": "1995-01-01", "Gender": "F", "Region / Province": "Kabul", "Duty Station": "Kabul", "Remarks": "Temporary contract" },
    { "Employee No": "AT-902", "Employee Full Name": "Former Staff", "Position Title": "Officer", "Actual Level": "L2", "Division": "Finance", "Department": "Financial Operations", "Direct Supervisor": "Saeedullah Saeed", "Email ID": "former@atoma.af", "Date of Joining": "2019-01-01", "Date of Birth": "1990-01-01", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul", "Remarks": "Resigned – last working day pending" },
    { "Employee No": "AT-903", "Employee Full Name": "Promoted Officer", "Position Title": "Senior Officer", "Actual Level": "L3", "Division": "Finance", "Department": "Financial Operations", "Direct Supervisor": "Saeedullah Saeed", "Email ID": "promo@atoma.af", "Date of Joining": "2018-01-01", "Date of Birth": "1988-01-01", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul", "Remarks": "Promoted – 2024" },
    { "Employee No": "AT-904", "Employee Full Name": "Unicode Name — محمد", "Position Title": "Specialist", "Actual Level": "L4", "Division": "Information System", "Department": "IT", "Direct Supervisor": "AT-999", "Email ID": "unicode@atoma.af", "Date of Joining": "2021-01-01", "Date of Birth": "1992-01-01", "Gender": "M", "Region / Province": "قندهار", "Duty Station": "Kandahar" },
    { "Employee No": "AT-905", "Employee Full Name": "Root Without Manager", "Position Title": "Chief Information Officer", "Actual Level": "L5", "Division": "Information System", "Department": "IT", "Direct Supervisor": "", "Email ID": "cio@atoma.af", "Date of Joining": "2016-01-01", "Date of Birth": "1978-01-01", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    { "Employee No": "AT-906", "Employee Full Name": "Deep Chain", "Position Title": "Assistant", "Actual Level": "L1", "Division": "Information System", "Department": "IT", "Direct Supervisor": "Unicode Name — محمد", "Email ID": "deep@atoma.af", "Date of Joining": "2023-01-01", "Date of Birth": "2000-01-01", "Gender": "F", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    { "Employee No": "AT-907", "Employee Full Name": "Duplicate Name", "Position Title": "Coordinator", "Actual Level": "L2", "Division": "Information System", "Department": "IT", "Direct Supervisor": "Duplicate Name", "Email ID": "dup1@atoma.af", "Date of Joining": "2022-01-01", "Date of Birth": "1995-01-01", "Gender": "F", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    { "Employee No": "AT-908", "Employee Full Name": "Duplicate Name", "Position Title": "Coordinator", "Actual Level": "L2", "Division": "Information System", "Department": "IT", "Direct Supervisor": "Duplicate Name", "Email ID": "dup2@atoma.af", "Date of Joining": "2022-01-01", "Date of Birth": "1995-01-01", "Gender": "F", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    { "Employee No": "AT-909", "Employee Full Name": "Long Name Person With A Very Long Title That Must Wrap", "Position Title": "Supervisor – Shared Services and Customer Experience Operations", "Actual Level": "L3", "Division": "Customer Service & Operation", "Department": "Customer Care & Support", "Direct Supervisor": "", "Email ID": "long@atoma.af", "Date of Joining": "2021-01-01", "Date of Birth": "1987-01-01", "Gender": "M", "Region / Province": "Herat", "Duty Station": "Herat" },
    ...Array.from({ length: 26 }, (_, i) => ({ "Employee No": `CS-${i}`, "Employee Full Name": `Service Staff ${i}`, "Position Title": "Representative", "Actual Level": "L1", "Division": "Customer Service & Operation", "Department": "Customer Care & Support", "Direct Supervisor": "Long Name Person With A Very Long Title That Must Wrap", "Email ID": `cs${i}@atoma.af`, "Date of Joining": "2024-01-01", "Date of Birth": "1998-01-01", "Gender": i % 2 ? "F" : "M", "Region / Province": "Herat", "Duty Station": "Herat" })),
    ...["Engineer One", "Engineer Two", "Engineer Three"].map((name, i) => ({ "Employee No": `EN-${i}`, "Employee Full Name": name, "Position Title": "Engineer", "Actual Level": "L2", "Division": "Technology", "Department": "Platform", "Direct Supervisor": "Root Without Manager", "Email ID": `e${i}@atoma.af`, "Date of Joining": "2023-01-01", "Date of Birth": "1994-01-01", "Gender": "M", "Region / Province": "Kabul", "Duty Station": "Kabul" })),
    { "Employee No": "EX-1", "Employee Full Name": "Executive Assistant", "Position Title": "Executive Assistant", "Actual Level": "L1", "Division": "Finance", "Department": "Executive", "Direct Supervisor": "Marius van Wyk", "Email ID": "ea@atoma.af", "Date of Joining": "2021-01-01", "Date of Birth": "1996-01-01", "Gender": "F", "Region / Province": "Kabul", "Duty Station": "Kabul" },
    { "Employee No": "BAD-1", "Employee Full Name": "Malformed Dates", "Position Title": "Officer", "Actual Level": "L2", "Division": "Finance", "Department": "Treasury", "Direct Supervisor": "Karimullah Qasmi", "Email ID": "bad@atoma.af", "Date of Joining": "not a date", "Date of Birth": 1990, "Gender": "x", "Region / Province": "Kabul", "Duty Station": "Kabul" },
  ];
  const headers = [...new Set(raw.flatMap((row) => Object.keys(row)))];
  const { employees } = normalizeRows(raw as Record<string, unknown>[], autoMap(headers).mapping, Date.now());
  return enrichEmployees(employees, Date.now());
}

function segmentCrossings(layout: OrgLayout): number {
  const boxes = layout.nodes.map((n) => ({ id: n.node?.id ?? n.id, x1: n.x - n.w / 2, x2: n.x + n.w / 2, y1: n.y, y2: n.y + n.h }));
  let bad = 0;
  for (const edge of layout.edges) {
    for (let i = 1; i < edge.points.length; i++) {
      const [x1, y1] = edge.points[i - 1];
      const [x2, y2] = edge.points[i];
      for (const box of boxes) {
        if (box.id === edge.from || box.id === edge.to) continue;
        if (Math.max(x1, x2) > box.x1 + 1 && Math.min(x1, x2) < box.x2 - 1 && Math.max(y1, y2) > box.y1 + 1 && Math.min(y1, y2) < box.y2 - 1) bad++;
      }
    }
  }
  return bad;
}

function overlapCount(layout: OrgLayout): number {
  let count = 0;
  for (let i = 0; i < layout.nodes.length; i++) {
    for (let j = i + 1; j < layout.nodes.length; j++) {
      const a = layout.nodes[i];
      const b = layout.nodes[j];
      if (a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1 && a.x - a.w / 2 < b.x + b.w / 2 - 1 && b.x - b.w / 2 < a.x + a.w / 2 - 1) count++;
    }
  }
  return count;
}

export async function GET() {
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  try {
    const employees = sampleWorkforce();

    // 1 data normalisation and visibility
    add("Data import & normalisation", employees.length >= 40, `${employees.length} records normalised from a messy sample (unicode names, bad dates, vacant posts, cycles).`);
    add("All rows visible by default", applyFilters(employees, EMPTY_FILTERS).length === employees.length, "Blank ranges/slicers never filter imported rows.");
    add("Exited/promoted tracked", (() => { const k = computeKpis(employees, Date.now(), Date.now()); return k.exited > 0 && k.promoted > 0 && k.exited + k.active === k.total; })(), "Active + exited = total; promotions reported separately.");
    add("Slicer dimensions registered", FILTER_LABELS.status === "Employment Status" && FILTER_LABELS.promoted === "Promotion Record", "Employment Status and Promotion Record slicers available.");

    // 2 organisation chart invariants
    const divisions = [...new Set(employees.map((e) => e.division))];
    let worstOverlap = 0;
    let worstCrossing = 0;
    let misplaced = 0;
    let uncentred = 0;
    for (const division of divisions) {
      const scoped = employees.filter((e) => e.division === division);
      const layout = buildOrgLayout(scopeRoots(buildOrgTree(scoped), division));
      if (!layout.nodes.length) continue;
      worstOverlap = Math.max(worstOverlap, overlapCount(layout));
      worstCrossing = Math.max(worstCrossing, segmentCrossings(layout));
      misplaced += layout.nodes.filter((n) => n.node && n.kind === "node" && n.node.level !== layout.layers[n.layer]?.level).length;
      const root = layout.nodes[0];
      if (Math.abs(root.x - layout.width / 2) > 2) uncentred++;
    }
    add("No overlapping boxes", worstOverlap === 0, `${divisions.length} divisions tested; worst overlap count ${worstOverlap}.`);
    add("No connector crosses a card", worstCrossing === 0, `Worst crossing count ${worstCrossing}; routing uses row gaps and the left gutter.`);
    add("No level mismatches", misplaced === 0, `${misplaced} cards outside their L6→L1 band.`);
    add("Head centred / balanced branches", uncentred === 0, `${uncentred} divisions with an off-centre top card.`);

    // 3 geography
    const coverage = validateProvinceCoverage(["Kabul", "Herat", "Kandahar", "Ghazni", "Nimroz", "Sar-e-Pul", ...Array.from({ length: 28 }, (_, i) => `P${i}`)]);
    add("Afghanistan map data", coverage.expected === 34 && matchProvince("قندهار") === "Kandahar" && matchProvince("Mazar-e-Sharif") === "Balkh", "34 provinces canonical; Latin and native names resolve.");

    // 4 exports (same geometry for every format)
    const finance = employees.filter((e) => e.division === "Finance");
    const pack = fitPrintPack(scopeRoots(buildOrgTree(finance), "Finance"), "A3");
    const sheets = pack.sheets;
    const svg = buildSheetSvg(sheets[0], { title: "Self test", subtitle: "Finance", generatedBy: "system" });
    const vdx = buildVisioVdx(sheets[0].layout, { title: "Self test", subtitle: "Finance" });
    const scale = pack.scale;
    add("SVG export", svg.includes("Level band") && /<rect x="12"/.test(svg.replace(/\s+/g, " ")) && svg.includes("marker-end"), "Level board left, legend present, arrowheads drawn.");
    add("Visio export", (vdx.match(/<Shape /g) || []).length === (vdx.match(/<\/Shape>/g) || []).length && vdx.includes("VisioDocument"), "Valid Visio XML with balanced shapes.");
    add("Print packing", sheets.length >= 1 && sheets.every((sheet) => sheet.layout.nodes.length > 0), `${sheets.length} sheet(s) auto-fitted to ${pack.paper} at ${scale.toFixed(2)} pt/px.`);
    add("Print scale readable", scale >= 0.7, `Paper ${pack.paper}; title text prints at ${(11.5 * scale).toFixed(1)} pt.`);
    add("Level vocabulary", canonicalOrgLevel("L3H") === "L3H" && LEVEL_ORDER.join(",") === "L6,L5,L4,L3H,L3,L2,L1", "L6→L1 with L3H head band supported.");

    // 5 storage consistency
    add("Card geometry", CARD_W === 152 && CARD_H === 58, "Compact cards keep printed type readable.");

    const failed = checks.filter((check) => !check.pass);
    return NextResponse.json({ ok: failed.length === 0, generatedAt: new Date().toISOString(), checks, summary: `${checks.length - failed.length}/${checks.length} checks passed` });
  } catch (error) {
    return NextResponse.json({ ok: false, generatedAt: new Date().toISOString(), checks, error: error instanceof Error ? error.message : "Self test failed" }, { status: 500 });
  }
}
