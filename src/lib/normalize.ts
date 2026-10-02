import { FIELD_DEFS } from "./fields";
import { matchProvince, PROVINCE_REGION } from "./geo";
import type { DataQuality, Employee, FieldKey, QualificationGroup } from "./types";

export const DAY_MS = 86_400_000;
export const YEAR_MS = 365.2425 * DAY_MS;

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function monthIndex(s: string): number | null {
  const k = s.toLowerCase().slice(0, 3);
  return k in MONTHS ? MONTHS[k] : null;
}

function mk(y: number, m: number, d: number): Date | null {
  if (y < 100) y += y > 40 ? 1900 : 2000;
  if (m < 0 || m > 11 || d < 1 || d > 31 || y < 1920 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCMonth() !== m) return null;
  return dt;
}

export function excelSerialToDate(n: number): Date {
  return new Date(Math.round((n - 25569) * DAY_MS));
}

/** Robust date parser: Date objects, Excel serials, ISO, dd/mm/yyyy, mm/dd/yyyy, dd-MMM-yyyy, "March 5, 2020"… */
export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : mk(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === "number") {
    if (!isFinite(v)) return null;
    if (Number.isInteger(v) && v >= 1920 && v <= 2100) return mk(v, 0, 1);
    if (v > 1000 && v < 80000) {
      const d = excelSerialToDate(v);
      return mk(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    if (v > 1e11) {
      const d = new Date(v);
      return mk(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    return null;
  }
  const s = String(v).trim();
  if (!s || /^(n\/?a|null|none|nil|-|—|0|unknown)$/i.test(s)) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(Number(s));
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return mk(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mk(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const y = +m[3];
    if (a > 12) return mk(y, b - 1, a);
    if (b > 12) return mk(y, a - 1, b);
    return mk(y, b - 1, a);
  }
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+([A-Za-z]{3,9})\.?[\s\-/.,]+(\d{2,4})/);
  if (m) {
    const mi = monthIndex(m[2]);
    if (mi !== null) return mk(+m[3], mi, +m[1]);
  }
  m = s.match(/^([A-Za-z]{3,9})\.?[\s\-/.]+(\d{1,2})(?:st|nd|rd|th)?[\s,\-/.]+(\d{2,4})/);
  if (m) {
    const mi = monthIndex(m[1]);
    if (mi !== null) return mk(+m[3], mi, +m[2]);
  }
  m = s.match(/^([A-Za-z]{3,9})\.?[\s\-/.,]+(\d{4})$/);
  if (m) {
    const mi = monthIndex(m[1]);
    if (mi !== null) return mk(+m[2], mi, 1);
  }
  m = s.match(/^(\d{4})$/);
  if (m) return mk(+m[1], 0, 1);
  const t = Date.parse(s);
  if (!isNaN(t)) {
    const d = new Date(t);
    return mk(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

/** Parses numbers and durations like "5.3", "5 years 3 months", "5Y 3M". */
export function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).toLowerCase().trim();
  const y = s.match(/(\d+(?:\.\d+)?)\s*(?:y|yr|yrs|year|years)\b/);
  const mo = s.match(/(\d+(?:\.\d+)?)\s*(?:m|mo|mos|mon|month|months)\b/);
  const dd = s.match(/(\d+)\s*(?:d|day|days)\b/);
  if (y || mo || dd) return (y ? +y[1] : 0) + (mo ? +mo[1] / 12 : 0) + (dd ? +dd[1] / 365 : 0);
  const n = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return n ? +n[0] : null;
}

const low = (v: string) => v.toLowerCase().trim();

export function normGender(v: string): string {
  const s = low(v);
  if (!s) return "Unspecified";
  if (/^(f|female|woman|women|mrs|ms|miss|girl|fem)\b/.test(s) || s.startsWith("female")) return "Female";
  if (/^(m|male|man|men|mr|boy)\b/.test(s) || s.startsWith("male")) return "Male";
  return "Unspecified";
}

export function normMarital(v: string): string {
  const s = low(v);
  if (!s) return "Unspecified";
  if (/unmarried|never|single|bachelor|spinster/.test(s)) return "Single";
  if (/married|marr/.test(s)) return "Married";
  if (/divorc/.test(s)) return "Divorced";
  if (/widow/.test(s)) return "Widowed";
  if (/separat/.test(s)) return "Separated";
  return "Other";
}

const DEMONYMS: Record<string, string> = {
  afghanistan: "Afghan", afghan: "Afghan", afg: "Afghan", af: "Afghan", afghani: "Afghan",
  india: "Indian", pakistan: "Pakistani", turkey: "Turkish", turkiye: "Turkish", "united kingdom": "British", uk: "British", britain: "British",
  "united states": "American", usa: "American", us: "American", america: "American", philippines: "Filipino", egypt: "Egyptian",
  jordan: "Jordanian", kenya: "Kenyan", germany: "German", tajikistan: "Tajik", uzbekistan: "Uzbek", iran: "Iranian",
  bangladesh: "Bangladeshi", "sri lanka": "Sri Lankan", nepal: "Nepali", canada: "Canadian", france: "French", china: "Chinese",
};

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function normNationality(v: string): string {
  const s = low(v);
  if (!s) return "Unspecified";
  return DEMONYMS[s] ?? titleCase(s);
}

export function normExpat(v: string, nationality: string): string {
  const s = low(v);
  if (/expat|international|foreign|ex pat|intl|overseas/.test(s)) return "Expat";
  if (/local|national|domestic|afghan/.test(s)) return "Local";
  if (nationality === "Afghan") return "Local";
  if (nationality && nationality !== "Unspecified") return "Expat";
  return "Unspecified";
}

export function normBlood(v: string): string {
  let s = v.toUpperCase().replace(/\s+/g, "");
  if (!s) return "Unknown";
  s = s.replace(/POSITIVE|POS|\+VE|RH\+/g, "+").replace(/NEGATIVE|NEG|-VE|RH-/g, "-").replace(/^0/, "O");
  const m = s.match(/^(AB|A|B|O)([+-])/);
  return m ? `${m[1]}${m[2]}` : "Unknown";
}

export function qualificationGroup(...values: string[]): QualificationGroup {
  for (const raw of values) {
    const s = ` ${low(raw)} `;
    if (!s.trim()) continue;
    if (/ph\.?\s?d|doctor|doctorate|dphil|d\.phil/.test(s)) return "PhD";
    if (/master|\bmsc\b|m\.sc|\bmba\b|\bma\b|m\.a\.|mphil|\bllm\b|\bms\b|m\.s\.|\bmeng\b|\bmpa\b|\bmph\b|postgraduate|post graduate/.test(s)) return "Master";
    if (/bachelor|\bbsc\b|b\.sc|\bba\b|b\.a\.|\bbba\b|\bbs\b|\bbeng\b|b\.eng|\bllb\b|\bmbbs\b|\bmd\b|licen|undergrad|graduate degree|\bdegree\b/.test(s)) return "Bachelor";
    if (/diploma|associate|14th|\bdip\b|certificate|vocational|technical|institute/.test(s)) return "Diploma";
    if (/high school|12th|grade 12|secondary|baccalaureate|matric|hssc|\bssc\b|school|10th|grade/.test(s)) return "High School";
  }
  return "Other";
}

const MANAGER_RE = /\b(manager|head|director|chief|lead|supervisor|ceo|cfo|coo|cto|vp|vice president|president)\b/i;

export function levelRank(level: string, title: string): number {
  const l = low(level);
  const num = l.match(/(\d{1,2})/);
  if (/executive|c-suite|c suite/.test(l)) return 10;
  if (num) return Math.max(1, Math.min(10, +num[1]));
  const t = low(title);
  if (/chief|\bceo\b|president/.test(t)) return 10;
  if (/director|\bvp\b/.test(t)) return 9;
  if (/head|senior manager/.test(t)) return 8;
  if (/manager/.test(t)) return 7;
  if (/lead|supervisor/.test(t)) return 6;
  if (/specialist|senior/.test(t)) return 5;
  if (/assistant|junior|intern|driver|guard|cleaner/.test(t)) return 1;
  return 3;
}

const SEPARATED_RE = /resign|terminat|separat|\bleft\b|\bexit|abscond|end of contract|dismiss|retired|deceased|inactive/i;

function isoDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export interface NormalizeResult {
  employees: Employee[];
  quality: DataQuality;
}

/** Transforms header-keyed raw rows into canonical Employee records using a field → header mapping. */
export function normalizeRows(rows: Record<string, unknown>[], mapping: Partial<Record<FieldKey, string>>, now = Date.now()): NormalizeResult {
  const out: Employee[] = [];
  const missing: Partial<Record<FieldKey, number>> = {};
  for (const def of FIELD_DEFS) missing[def.key] = 0;
  let invalidDates = 0;
  let unmatched = 0;
  let skipped = 0;
  let dup = 0;
  const seen = new Map<string, number>();

  rows.forEach((r, i) => {
    const raw = (k: FieldKey): unknown => {
      const h = mapping[k];
      return h ? r[h] : undefined;
    };
    const txt = (k: FieldKey): string => {
      const v = raw(k);
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
      return String(v).replace(/\s+/g, " ").trim();
    };

    let fullName = txt("fullName");
    let firstName = txt("firstName");
    let lastName = txt("lastName");
    const employeeNo = txt("employeeNo");
    const hrisNo = txt("hrisNo");
    if (!fullName) fullName = [firstName, lastName].filter(Boolean).join(" ");
    if (!fullName && !employeeNo && !hrisNo) {
      skipped++;
      return;
    }
    if (!fullName) fullName = employeeNo || hrisNo;
    if (!firstName) firstName = fullName.split(" ")[0] || "";
    if (!lastName) lastName = fullName.split(" ").slice(1).join(" ");

    for (const def of FIELD_DEFS) if (!txt(def.key)) missing[def.key] = (missing[def.key] ?? 0) + 1;

    const joinRaw = raw("joinDate");
    const dobRaw = raw("dob");
    const join = parseDate(joinRaw);
    const dob = parseDate(dobRaw);
    if (!join && joinRaw !== undefined && joinRaw !== "" && joinRaw !== null) invalidDates++;
    if (!dob && dobRaw !== undefined && dobRaw !== "" && dobRaw !== null) invalidDates++;
    const joinTs = join ? join.getTime() : null;
    const dobTs = dob ? dob.getTime() : null;
    const tenure = joinTs !== null ? Math.max(0, (now - joinTs) / YEAR_MS) : parseNumber(raw("tenure"));
    const age = dobTs !== null ? (now - dobTs) / YEAR_MS : parseNumber(raw("age"));

    const nationality = normNationality(txt("nationality"));
    const regionRaw = txt("region");
    const duty = txt("dutyStation");
    const province = matchProvince(regionRaw) ?? matchProvince(duty) ?? "Unknown";
    if (province === "Unknown" && (regionRaw || duty)) unmatched++;
    const title = txt("title");
    const level = txt("level");
    const remarks = txt("remarks");
    const qualification = txt("qualification");
    const qualificationNew = txt("qualificationNew");

    const base = employeeNo || hrisNo || `ROW-${i + 1}`;
    const count = (seen.get(base) || 0) + 1;
    seen.set(base, count);
    if (count > 1) dup++;

    out.push({
      id: count > 1 ? `${base}#${count}` : base,
      hrisNo,
      employeeNo: employeeNo || hrisNo,
      fullName,
      firstName,
      lastName,
      fatherName: txt("fatherName"),
      title: title || "Unspecified",
      division: txt("division") || "Unassigned",
      department: txt("department") || "Unassigned",
      supervisor: txt("supervisor"),
      supervisorEmail: txt("supervisorEmail"),
      dutyStation: duty || "Unspecified",
      contactNumber: txt("contactNumber"),
      level: level || "Unspecified",
      levelRank: levelRank(level, title),
      joinDate: isoDate(join),
      joinTs,
      tenure: tenure !== null && isFinite(tenure) ? Math.max(0, tenure) : null,
      dob: isoDate(dob),
      dobTs,
      age: age !== null && isFinite(age) && age > 10 && age < 100 ? age : null,
      qualification,
      qualificationNew,
      qualificationGroup: qualificationGroup(qualificationNew, qualification),
      expatLocal: normExpat(txt("expatLocal"), nationality),
      nationality,
      gender: normGender(txt("gender")),
      regionProvince: regionRaw,
      province,
      region: province !== "Unknown" ? PROVINCE_REGION[province] : regionRaw || "Unknown",
      maritalStatus: normMarital(txt("maritalStatus")),
      email: txt("email"),
      tazkira: txt("tazkira"),
      bloodGroup: normBlood(txt("bloodGroup")),
      remarks,
      status: SEPARATED_RE.test(remarks) ? "Separated" : "Active",
      promoted: /promot/i.test(remarks),
      isManager: false,
      directReports: 0,
    });
  });

  const totalMissing = Object.values(missing).reduce((s, v) => s + (v || 0), 0);
  const cells = out.length * FIELD_DEFS.length;
  return {
    employees: out,
    quality: {
      totalRows: rows.length,
      validRows: out.length,
      skippedRows: skipped,
      duplicateIds: dup,
      invalidDates,
      unmatchedProvinces: unmatched,
      completeness: cells ? Math.max(0, 1 - totalMissing / cells) : 0,
      missing,
    },
  };
}

/** Recomputes time-dependent and relational fields (age, tenure, direct reports, manager flag). */
export function enrichEmployees(emps: Employee[], now = Date.now()): Employee[] {
  const byName = new Map<string, number>();
  const byEmail = new Map<string, number>();
  for (const e of emps) {
    if (e.supervisor) {
      const k = e.supervisor.toLowerCase();
      byName.set(k, (byName.get(k) || 0) + 1);
    }
    if (e.supervisorEmail) {
      const k = e.supervisorEmail.toLowerCase();
      byEmail.set(k, (byEmail.get(k) || 0) + 1);
    }
  }
  return emps.map((e) => {
    const tenure = e.joinTs !== null ? Math.max(0, (now - e.joinTs) / YEAR_MS) : e.tenure;
    const age = e.dobTs !== null ? (now - e.dobTs) / YEAR_MS : e.age;
    const dr = Math.max(byName.get(e.fullName.toLowerCase()) || 0, e.email ? byEmail.get(e.email.toLowerCase()) || 0 : 0);
    return { ...e, tenure, age, directReports: dr, isManager: dr > 0 || MANAGER_RE.test(e.title) || e.levelRank >= 6 };
  });
}
