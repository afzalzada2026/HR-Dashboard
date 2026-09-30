import { monthLabel } from "./format";
import { dice } from "./mapping";
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

/** Normalises person names for matching: Unicode, case, punctuation and spacing variants. */
export function personKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(key: string): string[] {
  return key.split(" ").filter(Boolean);
}

export function buildIndex(emps: Employee[]) {
  const byName = new Map<string, Employee>();
  const byEmail = new Map<string, Employee>();
  const roster: { employee: Employee; key: string; tokens: string[] }[] = [];
  for (const employee of emps) {
    const key = personKey(employee.fullName);
    if (key && !byName.has(key)) byName.set(key, employee);
    if (employee.email) byEmail.set(employee.email.toLowerCase(), employee);
    if (key) roster.push({ employee, key, tokens: nameTokens(key) });
  }
  return { byName, byEmail, roster };
}

/**
 * Resolves a supervisor from the source "Direct Supervisor" text: exact name, e-mail,
 * then tolerant name matching (spelling variants such as Mamoozai / Mamozai).
 */
export function findSupervisor(e: Employee, idx: ReturnType<typeof buildIndex>): Employee | null {
  const nameKey = personKey(e.supervisor);
  if (nameKey) {
    const exact = idx.byName.get(nameKey);
    if (exact && exact !== e) return exact;
    const tokens = nameTokens(nameKey);
    const distinctive = tokens.filter((token) => token.length >= 5);
    let best: Employee | null = null;
    let bestScore = 0;
    let second = 0;
    for (const candidate of idx.roster) {
      if (candidate.employee === e) continue;
      const shared = candidate.tokens.filter((token) => tokens.some((other) => token === other || (token.length >= 5 && other.length >= 5 && (token.startsWith(other.slice(0, 5)) || other.startsWith(token.slice(0, 5))))));
      const quick = shared.length >= Math.min(2, tokens.length) || (distinctive.length > 0 && shared.length >= 1);
      if (!quick) continue;
      const score = dice(nameKey, candidate.key);
      if (score > bestScore) {
        second = bestScore;
        bestScore = score;
        best = candidate.employee;
      } else if (score > second) {
        second = score;
      }
    }
    if (best && bestScore >= 0.7 && bestScore - second >= 0.03) return best;
  }
  if (e.supervisorEmail) {
    const byEmail = idx.byEmail.get(e.supervisorEmail.toLowerCase());
    if (byEmail && byEmail !== e) return byEmail;
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

export type OrgLevelCode = "L1" | "L2" | "L3" | "L3H" | "L4" | "L5" | "L6";
export type LevelDirection = "l1-senior" | "l6-senior";

export interface OrgNode {
  id: string;
  kind: "ceo" | "division" | "department" | "employee";
  label: string;
  person: Employee | null;
  levelCode: OrgLevelCode | null;
  headcount: number;
  femalePct: number;
  children: OrgNode[];
}

export interface OrganizationLevelProfile {
  direction: LevelDirection;
  evidence: number;
  confidence: number;
  sequence: OrgLevelCode[];
  counts: Record<OrgLevelCode, number>;
}

const ORG_LEVELS: OrgLevelCode[] = ["L1", "L2", "L3", "L3H", "L4", "L5", "L6"];
const CEO_RE = /chief executive|\bceo\b|managing director|country director|country manager|\bpresident\b|general director/i;
const DIV_HEAD_RE = /chief|director|\bvp\b|vice president|head of division|division head|general manager/i;
const DEPT_HEAD_RE = /head|manager|director|lead/i;

/** Normalizes forms such as L3H, L-3-H, Level 3H and "L4 - Senior". */
export function canonicalOrgLevel(value: string): OrgLevelCode | null {
  const normalized = value.toUpperCase().replace(/LEVEL/g, "L").replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/^L?(\d{1,2})(H)?/);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 6) return null;
  if (number === 3 && match[2]) return "L3H";
  return `L${number}` as OrgLevelCode;
}

function levelNumber(code: OrgLevelCode): number {
  return Number(code[1]);
}

/** Applies ATOMA's fixed L6→L1 hierarchy and measures how well supervisor links agree with it. */
export function organizationLevelProfile(emps: Employee[]): OrganizationLevelProfile {
  const counts = Object.fromEntries(ORG_LEVELS.map((level) => [level, 0])) as Record<OrgLevelCode, number>;
  for (const employee of emps) {
    const code = canonicalOrgLevel(employee.level);
    if (code) counts[code]++;
  }
  const index = buildIndex(emps);
  let lowerSupervisor = 0;
  let higherSupervisor = 0;
  for (const employee of emps) {
    const supervisor = findSupervisor(employee, index);
    const employeeCode = canonicalOrgLevel(employee.level);
    const supervisorCode = supervisor ? canonicalOrgLevel(supervisor.level) : null;
    if (!employeeCode || !supervisorCode) continue;
    const employeeNumber = levelNumber(employeeCode);
    const supervisorNumber = levelNumber(supervisorCode);
    if (supervisorNumber < employeeNumber) lowerSupervisor++;
    else if (supervisorNumber > employeeNumber) higherSupervisor++;
  }
  const evidence = lowerSupervisor + higherSupervisor;
  const direction: LevelDirection = "l6-senior";
  const sequence: OrgLevelCode[] = ["L6", "L5", "L4", "L3H", "L3", "L2", "L1"];
  return { direction, evidence, confidence: evidence ? higherSupervisor / evidence : 0, sequence, counts };
}

function seniority(employee: Employee, profile: OrganizationLevelProfile): number {
  const code = canonicalOrgLevel(employee.level);
  if (code) return profile.sequence.length - profile.sequence.indexOf(code);
  return profile.direction === "l1-senior" ? 11 - employee.levelRank : employee.levelRank;
}

/** Maps a reporting scope to in-scope children, breaking malformed cycles. */
export function reportingChildren(emps: Employee[]): Map<string, Employee[]> {
  const index = buildIndex(emps);
  const inScope = new Set(emps.map((employee) => employee.id));
  const parents = new Map<string, string | null>();
  const kids = new Map<string, Employee[]>();
  for (const employee of emps) {
    const supervisor = findSupervisor(employee, index);
    const parentId = supervisor && supervisor.id !== employee.id && inScope.has(supervisor.id) ? supervisor.id : null;
    parents.set(employee.id, parentId);
    if (parentId) kids.set(parentId, [...(kids.get(parentId) ?? []), employee]);
  }
  for (const employee of emps) {
    const seen = new Set([employee.id]);
    let cursor = parents.get(employee.id) ?? null;
    while (cursor) {
      if (seen.has(cursor)) {
        parents.set(employee.id, null);
        kids.set(cursor, (kids.get(cursor) ?? []).filter((child) => child.id !== employee.id));
        break;
      }
      seen.add(cursor);
      cursor = parents.get(cursor) ?? null;
    }
  }
  return kids;
}

/** Number of in-scope descendants per employee (subtree size). */
export function descendantCounts(kids: Map<string, Employee[]>): Map<string, number> {
  const memo = new Map<string, number>();
  const count = (id: string, depth: number): number => {
    if (depth > 60) return 0;
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    let total = 0;
    for (const child of kids.get(id) ?? []) total += 1 + count(child.id, depth + 1);
    memo.set(id, total);
    return total;
  };
  for (const id of kids.keys()) count(id, 0);
  return memo;
}

const TITLE_BOOSTS: [RegExp, number][] = [
  [/\b(ceo|chief executive|managing director|president)\b/i, 60],
  [/\b(cio|cmo|cfo|coo|chro|cto|cso|cpo)\b|chief\s+[a-z&]+\s+officer/i, 55],
  [/\b(gm|dgm|agm|general manager|deputy general manager|country manager)\b/i, 48],
  [/\b(vice president|\bvp\b|director|division head|head of)\b/i, 42],
  [/\b(head|sr\.?\s*manager|senior manager|lead)\b/i, 26],
  [/\b(manager|supervisor|coordinator)\b/i, 12],
];

export function titleScore(title: string): number {
  let score = 0;
  for (const [pattern, boost] of TITLE_BOOSTS) if (pattern.test(title)) score = Math.max(score, boost);
  return score;
}

/**
 * Chooses the leader of a scope: the person with the largest real reporting subtree,
 * then the highest company band, then leadership title, then direct reports, then name.
 */
export function pickLeader(candidates: Employee[], options: { kids?: Map<string, Employee[]>; seniority: (employee: Employee) => number; titleRe?: RegExp; scopeName?: string }): Employee | null {
  const counts = options.kids ? descendantCounts(options.kids) : new Map<string, number>();
  const parentOf = new Map<string, string>();
  options.kids?.forEach((children, parentId) => children.forEach((child) => parentOf.set(child.id, parentId)));
  const scopeIds = new Set(candidates.map((candidate) => candidate.id));
  const scopeTokens = (options.scopeName ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && token !== "unit" && token !== "team");
  let best: Employee | null = null;
  let bestScore = -Infinity;
  for (const employee of candidates) {
    const descendants = counts.get(employee.id) ?? 0;
    const parentId = parentOf.get(employee.id);
    // The scope head normally reports outside the scope (e.g. division head → CEO).
    const scopeRoot = parentId && scopeIds.has(parentId) ? 0 : 80;
    const title = employee.title.toLowerCase();
    const scopeMatch = scopeTokens.length > 0 && scopeTokens.some((token) => title.includes(token)) ? 35 : 0;
    const score =
      scopeRoot +
      descendants * 1.35 +
      options.seniority(employee) * 26 +
      titleScore(employee.title) +
      scopeMatch +
      (options.titleRe?.test(employee.title) ? 24 : 0) +
      Math.min(employee.directReports, 80) * 0.6;
    const better = score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && best !== null && employee.fullName.localeCompare(best.fullName) < 0);
    if (best === null || better) {
      best = employee;
      bestScore = score;
    }
  }
  return best;
}

function pickHead(list: Employee[], re: RegExp, profile: OrganizationLevelProfile, kids?: Map<string, Employee[]>, scopeName?: string): Employee | null {
  return pickLeader(list, { kids, seniority: (employee) => seniority(employee, profile), titleRe: re, ...(scopeName ? { scopeName } : {}) });
}

const femPct = (list: Employee[]) => (list.length ? (list.filter((employee) => employee.gender === "Female").length / list.length) * 100 : 0);

function employeeHierarchy(members: Employee[], allIndex: ReturnType<typeof buildIndex>, profile: OrganizationLevelProfile): OrgNode[] {
  const memberIds = new Set(members.map((employee) => employee.id));
  const parent = new Map<string, string>();
  for (const employee of members) {
    const supervisor = findSupervisor(employee, allIndex);
    if (supervisor && supervisor.id !== employee.id && memberIds.has(supervisor.id)) parent.set(employee.id, supervisor.id);
  }
  // Break malformed reporting cycles before constructing recursive nodes.
  for (const employee of members) {
    const seen = new Set([employee.id]);
    let current = parent.get(employee.id);
    while (current) {
      if (seen.has(current)) {
        parent.delete(employee.id);
        break;
      }
      seen.add(current);
      current = parent.get(current);
    }
  }
  const byParent = new Map<string, Employee[]>();
  for (const employee of members) {
    const parentId = parent.get(employee.id) ?? "root";
    const list = byParent.get(parentId) ?? [];
    list.push(employee);
    byParent.set(parentId, list);
  }
  const sort = (list: Employee[]) => [...list].sort((a, b) => seniority(b, profile) - seniority(a, profile) || b.directReports - a.directReports || a.fullName.localeCompare(b.fullName));
  const makeNode = (employee: Employee): OrgNode => {
    const children = sort(byParent.get(employee.id) ?? []).map(makeNode);
    return {
      id: `emp:${employee.id}`,
      kind: "employee",
      label: employee.fullName,
      person: employee,
      levelCode: canonicalOrgLevel(employee.level),
      headcount: 1 + children.reduce((sum, child) => sum + child.headcount, 0),
      femalePct: employee.gender === "Female" ? 100 : 0,
      children,
    };
  };
  return sort(byParent.get("root") ?? []).map(makeNode);
}

export function buildOrgTree(emps: Employee[]): OrgNode {
  const profile = organizationLevelProfile(emps);
  const allIndex = buildIndex(emps);
  const kids = reportingChildren(emps);
  let ceo: Employee | null = pickHead(emps, CEO_RE, profile, kids);
  const divisions: OrgNode[] = [];
  const byDiv = [...groupBy(emps, (employee) => employee.division || "Unassigned").entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [division, list] of byDiv) {
    const head = pickHead(list.filter((employee) => employee !== ceo), DIV_HEAD_RE, profile, kids, division);
    const departments: OrgNode[] = [];
    const byDepartment = [...groupBy(list, (employee) => employee.department || "General").entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [department, departmentEmployees] of byDepartment) {
      const departmentHead = pickHead(departmentEmployees.filter((employee) => employee !== ceo && employee !== head), DEPT_HEAD_RE, profile, kids, department);
      const members = departmentEmployees.filter((employee) => employee !== departmentHead && employee !== head && employee !== ceo);
      departments.push({
        id: `dept:${division}:${department}`,
        kind: "department",
        label: department,
        person: departmentHead,
        levelCode: departmentHead ? canonicalOrgLevel(departmentHead.level) : null,
        headcount: departmentEmployees.length,
        femalePct: femPct(departmentEmployees),
        children: employeeHierarchy(members, allIndex, profile),
      });
    }
    divisions.push({
      id: `div:${division}`,
      kind: "division",
      label: division,
      person: head,
      levelCode: head ? canonicalOrgLevel(head.level) : null,
      headcount: list.length,
      femalePct: femPct(list),
      children: departments,
    });
  }
  return {
    id: "ceo",
    kind: "ceo",
    label: ceo ? ceo.fullName : "Chief Executive Officer",
    person: ceo,
    levelCode: ceo ? canonicalOrgLevel(ceo.level) : null,
    headcount: emps.length,
    femalePct: femPct(emps),
    children: divisions,
  };
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
