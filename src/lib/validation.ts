import { FIELD_KEYS } from "./fields";
import { matchProvince, PROVINCE_REGION, validateEmployeeMapCoverage } from "./geo";
import type { DataQuality, DatasetPayload, Employee, FieldKey, QualificationGroup } from "./types";

const QUALIFICATIONS = new Set<QualificationGroup>(["PhD", "Master", "Bachelor", "Diploma", "High School", "Other"]);
const FIELD_KEY_SET = new Set<string>(FIELD_KEYS);

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Converts any untrusted value to bounded plain text and removes non-printing controls. */
export function safeText(value: unknown, max = 300): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function finite(value: unknown, min: number, max: number, fallback: number | null = null): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function timestamp(value: unknown): number | null {
  const number = finite(value, 0, 4_102_444_800_000);
  return number === null ? null : Math.round(number);
}

function iso(value: unknown): string {
  const text = safeText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? text : "";
}

function bool(value: unknown): boolean {
  return value === true;
}

function qualification(value: unknown): QualificationGroup {
  const text = safeText(value, 30) as QualificationGroup;
  return QUALIFICATIONS.has(text) ? text : "Other";
}

/**
 * Validates an employee received by the API. The server never stores arbitrary client JSON:
 * every field is selected, bounded and normalized, and province is recalculated canonically.
 */
export function sanitizeEmployee(value: unknown, index: number): Employee {
  const source = record(value);
  const employeeNo = safeText(source.employeeNo, 80);
  const hrisNo = safeText(source.hrisNo, 80);
  const fullName = safeText(source.fullName, 180) || employeeNo || hrisNo || `Row ${index + 1}`;
  const dutyStation = safeText(source.dutyStation, 120) || "Unspecified";
  const regionProvince = safeText(source.regionProvince, 120) || safeText(source.province, 120);
  const province = matchProvince(safeText(source.province, 120)) ?? matchProvince(regionProvince) ?? matchProvince(dutyStation) ?? "Unknown";
  const age = finite(source.age, 10, 100);
  const tenure = finite(source.tenure, 0, 80);
  const levelRank = finite(source.levelRank, 1, 10, 3) ?? 3;
  const directReports = finite(source.directReports, 0, 100_000, 0) ?? 0;
  return {
    id: safeText(source.id, 120) || employeeNo || hrisNo || `ROW-${index + 1}`,
    hrisNo,
    employeeNo: employeeNo || hrisNo,
    fullName,
    firstName: safeText(source.firstName, 90) || fullName.split(" ")[0] || "",
    lastName: safeText(source.lastName, 90) || fullName.split(" ").slice(1).join(" "),
    fatherName: safeText(source.fatherName, 180),
    title: safeText(source.title, 180) || "Unspecified",
    division: safeText(source.division, 150) || "Unassigned",
    department: safeText(source.department, 150) || "Unassigned",
    supervisor: safeText(source.supervisor, 180),
    supervisorEmail: safeText(source.supervisorEmail, 254),
    dutyStation,
    contactNumber: safeText(source.contactNumber, 80),
    level: safeText(source.level, 100) || "Unspecified",
    levelRank: Math.round(levelRank),
    joinDate: iso(source.joinDate),
    joinTs: timestamp(source.joinTs),
    tenure,
    dob: iso(source.dob),
    dobTs: timestamp(source.dobTs),
    age,
    qualification: safeText(source.qualification, 240),
    qualificationNew: safeText(source.qualificationNew, 120),
    qualificationGroup: qualification(source.qualificationGroup),
    expatLocal: ["Local", "Expat"].includes(safeText(source.expatLocal, 20)) ? safeText(source.expatLocal, 20) : "Unspecified",
    nationality: safeText(source.nationality, 100) || "Unspecified",
    gender: ["Male", "Female"].includes(safeText(source.gender, 20)) ? safeText(source.gender, 20) : "Unspecified",
    regionProvince,
    province,
    region: province === "Unknown" ? safeText(source.region, 100) || "Unknown" : PROVINCE_REGION[province],
    maritalStatus: safeText(source.maritalStatus, 40) || "Unspecified",
    email: safeText(source.email, 254),
    tazkira: safeText(source.tazkira, 100),
    bloodGroup: safeText(source.bloodGroup, 20) || "Unknown",
    remarks: safeText(source.remarks, 2_000),
    status: source.status === "Separated" ? "Separated" : "Active",
    promoted: bool(source.promoted),
    isManager: bool(source.isManager),
    directReports: Math.round(directReports),
  };
}

export function sanitizeMapping(value: unknown): Partial<Record<FieldKey, string>> {
  const source = record(value);
  const result: Partial<Record<FieldKey, string>> = {};
  for (const [key, header] of Object.entries(source)) {
    if (FIELD_KEY_SET.has(key)) result[key as FieldKey] = safeText(header, 200);
  }
  return result;
}

export function sanitizeQuality(value: unknown, rowCount: number, unmatchedProvinces: number): DataQuality | null {
  if (!value || typeof value !== "object") return null;
  const source = record(value);
  const missingSource = record(source.missing);
  const missing: Partial<Record<FieldKey, number>> = {};
  for (const key of FIELD_KEYS) {
    const count = finite(missingSource[key], 0, rowCount, 0);
    if (count) missing[key] = Math.round(count);
  }
  return {
    totalRows: Math.round(finite(source.totalRows, rowCount, Math.max(rowCount, 1_000_000), rowCount) ?? rowCount),
    validRows: rowCount,
    skippedRows: Math.round(finite(source.skippedRows, 0, 1_000_000, 0) ?? 0),
    duplicateIds: Math.round(finite(source.duplicateIds, 0, rowCount, 0) ?? 0),
    invalidDates: Math.round(finite(source.invalidDates, 0, rowCount * 2, 0) ?? 0),
    unmatchedProvinces,
    completeness: finite(source.completeness, 0, 1, 0) ?? 0,
    missing,
  };
}

export interface SanitizedDataset extends DatasetPayload {
  mapCoverage: ReturnType<typeof validateEmployeeMapCoverage>;
}

export function sanitizeDatasetPayload(value: unknown): SanitizedDataset {
  const source = record(value);
  if (!Array.isArray(source.employees) || source.employees.length === 0) throw new Error("Dataset must contain at least one employee record.");
  if (source.employees.length > 150_000) throw new Error("Dataset exceeds 150,000 rows.");
  const employees = source.employees.map(sanitizeEmployee);
  const mapCoverage = validateEmployeeMapCoverage(employees.map((employee) => employee.province));
  return {
    name: safeText(source.name || source.fileName, 200) || "Untitled dataset",
    fileName: safeText(source.fileName, 255) || "dataset",
    fileType: safeText(source.fileType, 20).toLowerCase() || "unknown",
    fileSize: Math.round(finite(source.fileSize, 0, 1_000_000_000, 0) ?? 0),
    columnCount: Math.round(finite(source.columnCount, 0, 10_000, 0) ?? 0),
    mapping: sanitizeMapping(source.mapping),
    quality: sanitizeQuality(source.quality, employees.length, mapCoverage.unknown),
    source: source.source === "demo" ? "demo" : "upload",
    employees,
    mapCoverage,
  };
}

/** Neutralizes formula execution when exported files are opened in spreadsheet software. */
export function safeSpreadsheetValue(value: string | number): string | number {
  return typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
