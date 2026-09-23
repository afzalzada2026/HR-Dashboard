import type { Employee, Filters, MultiKey } from "./types";

export const EMPTY_FILTERS: Filters = {
  division: [], department: [], title: [], level: [], supervisor: [],
  gender: [], nationality: [], maritalStatus: [], qualification: [], expatLocal: [], bloodGroup: [],
  region: [], province: [], dutyStation: [],
  joinFrom: "", joinTo: "", dobFrom: "", dobTo: "",
  ageMin: null, ageMax: null, tenureMin: null, tenureMax: null,
};

export const MULTI_KEYS: MultiKey[] = ["division", "department", "title", "level", "supervisor", "gender", "nationality", "maritalStatus", "qualification", "expatLocal", "bloodGroup", "region", "province", "dutyStation"];

export const HIERARCHY: MultiKey[] = ["division", "department", "title"];

export const FILTER_LABELS: Record<MultiKey, string> = {
  division: "Division", department: "Department", title: "Title", level: "Actual Level", supervisor: "Supervisor",
  gender: "Gender", nationality: "Nationality", maritalStatus: "Marital Status", qualification: "Qualification",
  expatLocal: "Expat / Local", bloodGroup: "Blood Group", region: "Region", province: "Province", dutyStation: "Duty Station",
};

export const ACCESSOR: Record<MultiKey, (e: Employee) => string> = {
  division: (e) => e.division,
  department: (e) => e.department,
  title: (e) => e.title,
  level: (e) => e.level,
  supervisor: (e) => e.supervisor || "—",
  gender: (e) => e.gender,
  nationality: (e) => e.nationality,
  maritalStatus: (e) => e.maritalStatus,
  qualification: (e) => e.qualificationGroup,
  expatLocal: (e) => e.expatLocal,
  bloodGroup: (e) => e.bloodGroup,
  region: (e) => e.region,
  province: (e) => e.province,
  dutyStation: (e) => e.dutyStation,
};

type Pred = (e: Employee) => boolean;

const toTs = (iso: string, end = false) => {
  if (!iso) return null;
  const t = Date.parse(`${iso}T${end ? "23:59:59" : "00:00:00"}Z`);
  return isNaN(t) ? null : t;
};

/** Compiles filters into fast predicates. `skip` excludes one dimension (for cascading option lists). */
export function compile(f: Filters, skip?: MultiKey): Pred[] {
  const preds: Pred[] = [];
  for (const k of MULTI_KEYS) {
    if (k === skip || !f[k].length) continue;
    const set = new Set(f[k]);
    const get = ACCESSOR[k];
    preds.push((e) => set.has(get(e)));
  }
  const jf = toTs(f.joinFrom), jt = toTs(f.joinTo, true), df = toTs(f.dobFrom), dt = toTs(f.dobTo, true);
  if (jf !== null) preds.push((e) => e.joinTs !== null && e.joinTs >= jf);
  if (jt !== null) preds.push((e) => e.joinTs !== null && e.joinTs <= jt);
  if (df !== null) preds.push((e) => e.dobTs !== null && e.dobTs >= df);
  if (dt !== null) preds.push((e) => e.dobTs !== null && e.dobTs <= dt);
  const { ageMin, ageMax, tenureMin, tenureMax } = f;
  if (ageMin !== null) preds.push((e) => e.age !== null && Math.floor(e.age) >= ageMin);
  if (ageMax !== null) preds.push((e) => e.age !== null && Math.floor(e.age) <= ageMax);
  if (tenureMin !== null) preds.push((e) => e.tenure !== null && e.tenure >= tenureMin);
  if (tenureMax !== null) preds.push((e) => e.tenure !== null && e.tenure <= tenureMax);
  return preds;
}

export function applyFilters(emps: Employee[], f: Filters): Employee[] {
  const preds = compile(f);
  if (!preds.length) return emps;
  return emps.filter((e) => {
    for (const p of preds) if (!p(e)) return false;
    return true;
  });
}

export interface Option {
  value: string;
  count: number;
}

/** Power BI-style cascading slicer options: values available given all *other* active filters. */
export function availableOptions(emps: Employee[], f: Filters, key: MultiKey): Option[] {
  const preds = compile(f, key);
  const get = ACCESSOR[key];
  const m = new Map<string, number>();
  outer: for (const e of emps) {
    for (const p of preds) if (!p(e)) continue outer;
    const v = get(e);
    m.set(v, (m.get(v) || 0) + 1);
  }
  const selected = f[key];
  for (const s of selected) if (!m.has(s)) m.set(s, 0);
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function activeFilterCount(f: Filters): number {
  let n = 0;
  for (const k of MULTI_KEYS) if (f[k].length) n++;
  if (f.joinFrom || f.joinTo) n++;
  if (f.dobFrom || f.dobTo) n++;
  if (f.ageMin !== null || f.ageMax !== null) n++;
  if (f.tenureMin !== null || f.tenureMax !== null) n++;
  return n;
}

export function describeFilters(f: Filters): string[] {
  const out: string[] = [];
  for (const k of MULTI_KEYS) if (f[k].length) out.push(`${FILTER_LABELS[k]}: ${f[k].join(", ")}`);
  if (f.joinFrom || f.joinTo) out.push(`Joining: ${f.joinFrom || "…"} → ${f.joinTo || "…"}`);
  if (f.dobFrom || f.dobTo) out.push(`Birth date: ${f.dobFrom || "…"} → ${f.dobTo || "…"}`);
  if (f.ageMin !== null || f.ageMax !== null) out.push(`Age: ${f.ageMin ?? "min"}–${f.ageMax ?? "max"}`);
  if (f.tenureMin !== null || f.tenureMax !== null) out.push(`Tenure: ${f.tenureMin ?? 0}–${f.tenureMax ?? "max"} yrs`);
  return out;
}
