import { monthLabel } from "./format";
import { YEAR_MS } from "./normalize";
import type { Employee } from "./types";

export interface NameValue {
  name: string;
  value: number;
}

export const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

export function countBy(emps: Employee[], get: (e: Employee) => string, skipEmpty = false): NameValue[] {
  const m = new Map<string, number>();
  for (const e of emps) {
    let k = get(e);
    if (!k) {
      if (skipEmpty) continue;
      k = "Unspecified";
    }
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function topN(list: NameValue[], n: number, other = "Others"): NameValue[] {
  if (list.length <= n) return list;
  const rest = list.slice(n).reduce((s, x) => s + x.value, 0);
  return [...list.slice(0, n), { name: other, value: rest }];
}

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

const supKey = (s: string) => s.trim().toLowerCase();
const isRealSupervisor = (s: string) => !!s && !/^(board|n\/?a|none|-|self)/i.test(s.trim());

/* ------------------------------------------------------------------ KPIs */

export interface Kpis {
  total: number;
  male: number;
  female: number;
  femalePct: number;
  genderRatio: number;
  local: number;
  expat: number;
  avgAge: number;
  avgTenure: number;
  married: number;
  single: number;
  divisions: number;
  departments: number;
  dutyStations: number;
  nationalities: number;
  avgSpan: number;
  supervisors: number;
  joinedThisYear: number;
  joinedThisMonth: number;
  bachelorPlus: number;
  masterPlus: number;
  phd: number;
}

export function computeKpis(emps: Employee[], asOf: number, now: number): Kpis {
  let male = 0, female = 0, local = 0, expat = 0, married = 0, single = 0;
  let ageSum = 0, ageN = 0, tenSum = 0, tenN = 0, jy = 0, jm = 0, bach = 0, mast = 0, phd = 0;
  const divs = new Set<string>(), depts = new Set<string>(), stations = new Set<string>(), nats = new Set<string>();
  const sup = new Map<string, number>();
  const d = new Date(asOf);
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth();
  const shift = (now - asOf) / YEAR_MS;
  for (const e of emps) {
    if (e.gender === "Male") male++;
    else if (e.gender === "Female") female++;
    if (e.expatLocal === "Local") local++;
    else if (e.expatLocal === "Expat") expat++;
    if (e.maritalStatus === "Married") married++;
    else if (e.maritalStatus === "Single") single++;
    const age = e.dobTs !== null ? (asOf - e.dobTs) / YEAR_MS : e.age !== null ? e.age - shift : null;
    if (age !== null) { ageSum += age; ageN++; }
    const ten = e.joinTs !== null ? (asOf - e.joinTs) / YEAR_MS : e.tenure !== null ? e.tenure - shift : null;
    if (ten !== null && ten >= 0) { tenSum += ten; tenN++; }
    if (e.joinTs !== null && e.joinTs <= asOf) {
      const jd = new Date(e.joinTs);
      if (jd.getUTCFullYear() === y) {
        jy++;
        if (jd.getUTCMonth() === mo) jm++;
      }
    }
    const q = e.qualificationGroup;
    if (q === "PhD") { phd++; mast++; bach++; }
    else if (q === "Master") { mast++; bach++; }
    else if (q === "Bachelor") bach++;
    if (e.division && e.division !== "Unassigned") divs.add(e.division);
    if (e.department && e.department !== "Unassigned") depts.add(e.department);
    if (e.dutyStation && e.dutyStation !== "Unspecified") stations.add(e.dutyStation);
    if (e.nationality && e.nationality !== "Unspecified") nats.add(e.nationality);
    if (isRealSupervisor(e.supervisor)) {
      const k = supKey(e.supervisor);
      sup.set(k, (sup.get(k) || 0) + 1);
    }
  }
  let reports = 0;
  sup.forEach((v) => (reports += v));
  const total = emps.length;
  return {
    total, male, female,
    femalePct: total ? (female / total) * 100 : 0,
    genderRatio: female ? male / female : male ? Infinity : 0,
    local, expat,
    avgAge: ageN ? ageSum / ageN : 0,
    avgTenure: tenN ? tenSum / tenN : 0,
    married, single,
    divisions: divs.size, departments: depts.size, dutyStations: stations.size, nationalities: nats.size,
    avgSpan: sup.size ? reports / sup.size : 0,
    supervisors: sup.size,
    joinedThisYear: jy, joinedThisMonth: jm,
    bachelorPlus: bach, masterPlus: mast, phd,
  };
}

function monthEnd(now: number, monthsAgo: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsAgo + 1, 0, 23, 59, 59);
}

/** KPI snapshots at each of the last N month-ends (point-in-time reconstruction from joining dates). */
export function kpiSeries(emps: Employee[], now: number, points = 12): { labels: string[]; series: Kpis[] } {
  const labels: string[] = [];
  const series: Kpis[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const asOf = i === 0 ? now : monthEnd(now, i);
    const subset = emps.filter((e) => e.joinTs === null || e.joinTs <= asOf);
    series.push(computeKpis(subset, asOf, now));
    labels.push(monthLabel(asOf));
  }
  return { labels, series };
}

export function monthlyHires(emps: Employee[], now: number, months = 12): { labels: string[]; hires: number[] } {
  const d = new Date(now);
  const startY = d.getUTCFullYear();
  const startM = d.getUTCMonth();
  const hires = new Array(months).fill(0);
  const labels: string[] = [];
  for (let i = months - 1; i >= 0; i--) labels.push(monthLabel(Date.UTC(startY, startM - i, 1)));
  for (const e of emps) {
    if (e.joinTs === null) continue;
    const j = new Date(e.joinTs);
    const diff = (startY - j.getUTCFullYear()) * 12 + (startM - j.getUTCMonth());
    if (diff >= 0 && diff < months) hires[months - 1 - diff]++;
  }
  return { labels, hires };
}

export function hiresComparison(emps: Employee[], now: number) {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const lyStart = Date.UTC(y - 1, 0, 1);
  const lySame = Date.UTC(y - 1, d.getUTCMonth(), d.getUTCDate(), 23, 59, 59);
  const lmStart = Date.UTC(y, d.getUTCMonth() - 1, 1);
  const lmSame = Date.UTC(y, d.getUTCMonth() - 1, d.getUTCDate(), 23, 59, 59);
  let ytdLastYear = 0;
  let mtdLastMonth = 0;
  for (const e of emps) {
    if (e.joinTs === null) continue;
    if (e.joinTs >= lyStart && e.joinTs <= lySame) ytdLastYear++;
    if (e.joinTs >= lmStart && e.joinTs <= lmSame) mtdLastMonth++;
  }
  return { ytdLastYear, mtdLastMonth };
}

/* ------------------------------------------------------------- hierarchy */

export function buildIndex(emps: Employee[]) {
  const byName = new Map<string, Employee>();
  const byEmail = new Map<string, Employee>();
  for (const e of emps) {
    byName.set(e.fullName.toLowerCase(), e);
    if (e.email) byEmail.set(e.email.toLowerCase(), e);
  }
  return { byName, byEmail };
}

export function findSupervisor(e: Employee, idx: ReturnType<typeof buildIndex>): Employee | null {
  if (e.supervisor) {
    const s = idx.byName.get(e.supervisor.toLowerCase());
    if (s && s !== e) return s;
  }
  if (e.supervisorEmail) {
    const s = idx.byEmail.get(e.supervisorEmail.toLowerCase());
    if (s && s !== e) return s;
  }
  return null;
}

/** Reporting layer of each employee (1 = top of hierarchy). */
export function reportingDepths(emps: Employee[]): Map<string, number> {
  const idx = buildIndex(emps);
  const memo = new Map<string, number>();
  const depth = (e: Employee, guard: number): number => {
    const known = memo.get(e.id);
    if (known !== undefined) return known;
    if (guard > 25) return 1;
    const sup = findSupervisor(e, idx);
    const d = sup ? depth(sup, guard + 1) + 1 : 1;
    memo.set(e.id, d);
    return d;
  };
  for (const e of emps) depth(e, 0);
  return memo;
}

export function reportingChain(e: Employee, emps: Employee[]): Employee[] {
  const idx = buildIndex(emps);
  const chain: Employee[] = [];
  let cur: Employee | null = e;
  const seen = new Set<string>();
  while (cur && chain.length < 12) {
    const sup = findSupervisor(cur, idx);
    if (!sup || seen.has(sup.id)) break;
    seen.add(sup.id);
    chain.push(sup);
    cur = sup;
  }
  return chain;
}

export function directReportsOf(e: Employee, emps: Employee[]): Employee[] {
  const n = e.fullName.toLowerCase();
  const m = e.email.toLowerCase();
  return emps.filter((x) => x !== e && ((x.supervisor && x.supervisor.toLowerCase() === n) || (m && x.supervisorEmail && x.supervisorEmail.toLowerCase() === m)));
}

/* ------------------------------------------------------ strategic metrics */

export interface Strategic {
  headcount: number;
  headcount12mAgo: number;
  headcountGrowth: number | null;
  hires12m: number;
  hiringRate: number;
  genderDiversityIndex: number;
  nationalityDiversityIndex: number;
  avgDeptSize: number;
  managers: number;
  managementRatio: number;
  managerPct: number;
  separations: number;
  turnoverRate: number;
  retentionRate: number;
  promotions: number;
  promotionRatio: number;
  avgReportingLine: number;
  maxLayers: number;
  avgSpan: number;
  supervisors: number;
}

function blau(counts: number[]): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return 1 - counts.reduce((s, c) => s + (c / total) ** 2, 0);
}

export function strategicMetrics(emps: Employee[], now: number): Strategic {
  const total = emps.length;
  const yearAgo = now - YEAR_MS;
  let hc12 = 0, hires = 0, managers = 0, seps = 0, promos = 0;
  const depts = new Set<string>();
  const sup = new Map<string, number>();
  for (const e of emps) {
    if (e.joinTs === null || e.joinTs <= yearAgo) hc12++;
    if (e.joinTs !== null && e.joinTs > yearAgo) hires++;
    if (e.isManager) managers++;
    if (e.status === "Separated") seps++;
    if (e.promoted) promos++;
    if (e.department) depts.add(`${e.division}|${e.department}`);
    if (isRealSupervisor(e.supervisor)) sup.set(supKey(e.supervisor), (sup.get(supKey(e.supervisor)) || 0) + 1);
  }
  const genders = countBy(emps, (e) => e.gender).filter((g) => g.name !== "Unspecified").map((g) => g.value);
  const nats = countBy(emps, (e) => e.nationality).map((g) => g.value);
  const gBlau = blau(genders);
  const depths = reportingDepths(emps);
  let dSum = 0, dMax = 0;
  depths.forEach((v) => { dSum += v; dMax = Math.max(dMax, v); });
  let reports = 0;
  sup.forEach((v) => (reports += v));
  const turnover = total ? (seps / total) * 100 : 0;
  return {
    headcount: total,
    headcount12mAgo: hc12,
    headcountGrowth: hc12 ? ((total - hc12) / hc12) * 100 : null,
    hires12m: hires,
    hiringRate: total ? (hires / total) * 100 : 0,
    genderDiversityIndex: (gBlau / 0.5) * 100,
    nationalityDiversityIndex: blau(nats) * 100,
    avgDeptSize: depts.size ? total / depts.size : 0,
    managers,
    managementRatio: managers ? (total - managers) / managers : 0,
    managerPct: total ? (managers / total) * 100 : 0,
    separations: seps,
    turnoverRate: turnover,
    retentionRate: total ? 100 - turnover : 0,
    promotions: promos,
    promotionRatio: total ? (promos / total) * 100 : 0,
    avgReportingLine: depths.size ? dSum / depths.size : 0,
    maxLayers: dMax,
    avgSpan: sup.size ? reports / sup.size : 0,
    supervisors: sup.size,
  };
}

/* ---------------------------------------------------------- group stats */

export interface GroupStat {
  name: string;
  headcount: number;
  share: number;
  male: number;
  female: number;
  femalePct: number;
  avgAge: number;
  avgTenure: number;
  hires12m: number;
  growth: number;
  expat: number;
  expatPct: number;
  degreePct: number;
  managers: number;
  retirementRisk: number;
  separations: number;
  topQualification: string;
  topDepartment: string;
}

export function groupStats(emps: Employee[], key: (e: Employee) => string, now: number): GroupStat[] {
  const total = emps.length || 1;
  const yearAgo = now - YEAR_MS;
  const res: GroupStat[] = [];
  groupBy(emps, (e) => key(e) || "Unspecified").forEach((list, name) => {
    let male = 0, female = 0, hires = 0, expat = 0, deg = 0, mgr = 0, retire = 0, seps = 0;
    const ages: number[] = [];
    const tens: number[] = [];
    for (const e of list) {
      if (e.gender === "Male") male++;
      else if (e.gender === "Female") female++;
      if (e.joinTs !== null && e.joinTs > yearAgo) hires++;
      if (e.expatLocal === "Expat") expat++;
      if (["Bachelor", "Master", "PhD"].includes(e.qualificationGroup)) deg++;
      if (e.isManager) mgr++;
      if (e.age !== null) { ages.push(e.age); if (e.age >= 55) retire++; }
      if (e.tenure !== null) tens.push(e.tenure);
      if (e.status === "Separated") seps++;
    }
    const n = list.length;
    res.push({
      name, headcount: n, share: (n / total) * 100, male, female,
      femalePct: (female / n) * 100, avgAge: avg(ages), avgTenure: avg(tens),
      hires12m: hires, growth: (hires / n) * 100, expat, expatPct: (expat / n) * 100,
      degreePct: (deg / n) * 100, managers: mgr, retirementRisk: retire, separations: seps,
      topQualification: countBy(list, (e) => e.qualificationGroup)[0]?.name ?? "—",
      topDepartment: countBy(list, (e) => e.department)[0]?.name ?? "—",
    });
  });
  return res.sort((a, b) => b.headcount - a.headcount);
}

/* ------------------------------------------------------------ buckets */

export interface RangeBucket {
  label: string;
  min: number | null;
  max: number | null;
}

export const AGE_BUCKETS: RangeBucket[] = [
  { label: "20-25", min: null, max: 25 },
  { label: "26-30", min: 26, max: 30 },
  { label: "31-35", min: 31, max: 35 },
  { label: "36-40", min: 36, max: 40 },
  { label: "41-45", min: 41, max: 45 },
  { label: "46-50", min: 46, max: 50 },
  { label: "50+", min: 51, max: null },
];

export const TENURE_BUCKETS: RangeBucket[] = [
  { label: "0-1 years", min: null, max: 0.999 },
  { label: "1-3 years", min: 1, max: 2.999 },
  { label: "3-5 years", min: 3, max: 4.999 },
  { label: "5-10 years", min: 5, max: 9.999 },
  { label: "10+ years", min: 10, max: null },
];

export function ageBucketIndex(age: number): number {
  const a = Math.floor(age);
  if (a <= 25) return 0;
  if (a <= 30) return 1;
  if (a <= 35) return 2;
  if (a <= 40) return 3;
  if (a <= 45) return 4;
  if (a <= 50) return 5;
  return 6;
}

export function tenureBucketIndex(t: number): number {
  if (t < 1) return 0;
  if (t < 3) return 1;
  if (t < 5) return 2;
  if (t < 10) return 3;
  return 4;
}

export function ageDistribution(emps: Employee[]) {
  const total = new Array(AGE_BUCKETS.length).fill(0);
  const male = new Array(AGE_BUCKETS.length).fill(0);
  const female = new Array(AGE_BUCKETS.length).fill(0);
  for (const e of emps) {
    if (e.age === null) continue;
    const i = ageBucketIndex(e.age);
    total[i]++;
    if (e.gender === "Male") male[i]++;
    else if (e.gender === "Female") female[i]++;
  }
  return { labels: AGE_BUCKETS.map((b) => b.label), total, male, female };
}

export function tenureDistribution(emps: Employee[]) {
  const values = new Array(TENURE_BUCKETS.length).fill(0);
  for (const e of emps) if (e.tenure !== null) values[tenureBucketIndex(e.tenure)]++;
  return { labels: TENURE_BUCKETS.map((b) => b.label), values };
}

export function hiringTrend(emps: Employee[], now: number, months = 36) {
  const { labels, hires } = monthlyHires(emps, now, months);
  const firstStart = (() => {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months + 1, 1);
  })();
  let base = 0;
  for (const e of emps) if (e.joinTs === null || e.joinTs < firstStart) base++;
  const cumulative: number[] = [];
  let run = base;
  for (const h of hires) {
    run += h;
    cumulative.push(run);
  }
  return { labels, hires, cumulative };
}

export function yearlyHires(emps: Employee[], now: number, years = 10) {
  const y = new Date(now).getUTCFullYear();
  const labels: string[] = [];
  const hires: number[] = [];
  const headcount: number[] = [];
  for (let yr = y - years + 1; yr <= y; yr++) {
    labels.push(String(yr));
    const start = Date.UTC(yr, 0, 1);
    const end = Date.UTC(yr + 1, 0, 1);
    let h = 0, hc = 0;
    for (const e of emps) {
      if (e.joinTs === null) { hc++; continue; }
      if (e.joinTs >= start && e.joinTs < end) h++;
      if (e.joinTs < end) hc++;
    }
    hires.push(h);
    headcount.push(hc);
  }
  return { labels, hires, headcount };
}

export interface SunNode {
  name: string;
  value?: number;
  children?: SunNode[];
}

export function sunburstData(emps: Employee[], titlesPerDept = 6): SunNode[] {
  const res: SunNode[] = [];
  groupBy(emps, (e) => e.division).forEach((dl, div) => {
    const depts: SunNode[] = [];
    groupBy(dl, (e) => e.department).forEach((pl, dept) => {
      const titles = topN(countBy(pl, (e) => e.title), titlesPerDept, "Other titles");
      depts.push({ name: dept, children: titles.map((t) => ({ name: t.name, value: t.value })) });
    });
    res.push({ name: div, children: depts });
  });
  return res;
}

export function supervisorLoad(emps: Employee[], n = 20): NameValue[] {
  return countBy(emps.filter((e) => isRealSupervisor(e.supervisor)), (e) => e.supervisor).slice(0, n);
}

export function spanDistribution(emps: Employee[]) {
  const labels = ["1-3", "4-6", "7-9", "10-12", "13-15", "16+"];
  const values = new Array(labels.length).fill(0);
  const counts = countBy(emps.filter((e) => isRealSupervisor(e.supervisor)), (e) => e.supervisor);
  for (const c of counts) {
    const v = c.value;
    values[v <= 3 ? 0 : v <= 6 ? 1 : v <= 9 ? 2 : v <= 12 ? 3 : v <= 15 ? 4 : 5]++;
  }
  return { labels, values, overloaded: counts.filter((c) => c.value > 12).length, narrow: counts.filter((c) => c.value < 3).length };
}

export function layerDistribution(emps: Employee[]) {
  const depths = reportingDepths(emps);
  const m = new Map<number, number>();
  depths.forEach((d) => m.set(d, (m.get(d) || 0) + 1));
  const keys = [...m.keys()].sort((a, b) => a - b);
  return { labels: keys.map((k) => `Layer ${k}`), values: keys.map((k) => m.get(k) || 0) };
}

export function heatMatrix(emps: Employee[], rowGet: (e: Employee) => string, colGet: (e: Employee) => string, rowOrder?: string[], colOrder?: string[]) {
  const rows = rowOrder ?? countBy(emps, rowGet).map((x) => x.name);
  const cols = colOrder ?? countBy(emps, colGet).map((x) => x.name);
  const ri = new Map(rows.map((r, i) => [r, i]));
  const ci = new Map(cols.map((c, i) => [c, i]));
  const grid: number[][] = rows.map(() => cols.map(() => 0));
  for (const e of emps) {
    const r = ri.get(rowGet(e) || "Unspecified");
    const c = ci.get(colGet(e) || "Unspecified");
    if (r !== undefined && c !== undefined) grid[r][c]++;
  }
  let max = 0;
  const data: [number, number, number][] = [];
  grid.forEach((row, r) => row.forEach((v, c) => { data.push([c, r, v]); max = Math.max(max, v); }));
  return { rows, cols, grid, data, max };
}

export function levelDistribution(emps: Employee[]): NameValue[] {
  const m = new Map<string, { v: number; r: number }>();
  for (const e of emps) {
    const cur = m.get(e.level);
    if (cur) cur.v++;
    else m.set(e.level, { v: 1, r: e.levelRank });
  }
  return [...m.entries()].sort((a, b) => b[1].r - a[1].r || a[0].localeCompare(b[0])).map(([name, x]) => ({ name, value: x.v }));
}

/* ------------------------------------------------------------ org tree */

export interface OrgNode {
  id: string;
  kind: "ceo" | "division" | "department" | "employee";
  label: string;
  person: Employee | null;
  headcount: number;
  femalePct: number;
  children: OrgNode[];
}

const CEO_RE = /chief executive|\bceo\b|managing director|country director|country manager|\bpresident\b|general director/i;
const DIV_HEAD_RE = /chief|director|\bvp\b|vice president|head of division|division head|general manager/i;
const DEPT_HEAD_RE = /head|manager|director|lead/i;

function pickHead(list: Employee[], re: RegExp): Employee | null {
  let best: Employee | null = null;
  let bestScore = -1;
  for (const e of list) {
    const s = e.levelRank * 10 + (re.test(e.title) ? 25 : 0) + Math.min(e.directReports, 60) * 0.4;
    if (s > bestScore) { best = e; bestScore = s; }
  }
  return best;
}

const femPct = (l: Employee[]) => (l.length ? (l.filter((e) => e.gender === "Female").length / l.length) * 100 : 0);

export function buildOrgTree(emps: Employee[]): OrgNode {
  let ceo: Employee | null = emps.find((e) => CEO_RE.test(e.title)) ?? null;
  if (!ceo && emps.length) {
    const top = [...emps].sort((a, b) => b.levelRank - a.levelRank || b.directReports - a.directReports)[0];
    ceo = top && top.levelRank >= 9 ? top : null;
  }
  const divisions: OrgNode[] = [];
  const byDiv = [...groupBy(emps, (e) => e.division || "Unassigned").entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [div, list] of byDiv) {
    const head = pickHead(list.filter((e) => e !== ceo), DIV_HEAD_RE);
    const depts: OrgNode[] = [];
    const byDept = [...groupBy(list, (e) => e.department || "General").entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [dept, dl] of byDept) {
      const dhead = pickHead(dl.filter((e) => e !== ceo && e !== head), DEPT_HEAD_RE);
      const members = dl
        .filter((e) => e !== dhead && e !== head && e !== ceo)
        .sort((a, b) => b.levelRank - a.levelRank || a.fullName.localeCompare(b.fullName));
      depts.push({
        id: `dept:${div}:${dept}`, kind: "department", label: dept, person: dhead, headcount: dl.length, femalePct: femPct(dl),
        children: members.map((m) => ({ id: `emp:${m.id}`, kind: "employee", label: m.fullName, person: m, headcount: 1, femalePct: 0, children: [] })),
      });
    }
    divisions.push({ id: `div:${div}`, kind: "division", label: div, person: head, headcount: list.length, femalePct: femPct(list), children: depts });
  }
  return { id: "ceo", kind: "ceo", label: ceo ? ceo.fullName : "Chief Executive Officer", person: ceo, headcount: emps.length, femalePct: femPct(emps), children: divisions };
}

/* ------------------------------------------------------------ province */

export interface ProvinceStat {
  name: string;
  headcount: number;
  male: number;
  female: number;
  femalePct: number;
  avgAge: number;
  avgTenure: number;
  expat: number;
  topQualification: string;
  topDepartment: string;
  topDivision: string;
  stations: NameValue[];
}

export function provinceStats(emps: Employee[]): Map<string, ProvinceStat> {
  const res = new Map<string, ProvinceStat>();
  groupBy(emps, (e) => e.province).forEach((list, name) => {
    const male = list.filter((e) => e.gender === "Male").length;
    const female = list.filter((e) => e.gender === "Female").length;
    res.set(name, {
      name, headcount: list.length, male, female,
      femalePct: (female / list.length) * 100,
      avgAge: avg(list.filter((e) => e.age !== null).map((e) => e.age as number)),
      avgTenure: avg(list.filter((e) => e.tenure !== null).map((e) => e.tenure as number)),
      expat: list.filter((e) => e.expatLocal === "Expat").length,
      topQualification: countBy(list, (e) => e.qualificationGroup)[0]?.name ?? "—",
      topDepartment: countBy(list, (e) => e.department)[0]?.name ?? "—",
      topDivision: countBy(list, (e) => e.division)[0]?.name ?? "—",
      stations: countBy(list, (e) => e.dutyStation),
    });
  });
  return res;
}

/* ------------------------------------------------------------ memo */

const memoStore = new WeakMap<object, Map<string, unknown>>();
/** Memoizes derived analytics per filtered-array identity (shared across components). */
export function memo<T>(ref: object, key: string, fn: () => T): T {
  let m = memoStore.get(ref);
  if (!m) {
    m = new Map();
    memoStore.set(ref, m);
  }
  if (m.has(key)) return m.get(key) as T;
  const v = fn();
  m.set(key, v);
  return v;
}
