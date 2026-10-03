import type { Employee as RepoEmployee } from "./types";
import { buildOrgTree } from "./orgtree";
import { buildOrgLayout } from "./orglayout";
import { buildOrgSvg as buildExportSvg } from "./org-export";
import { canonicalOrgLevel } from "./organogram-levels";

/**
 * Adapter to convert the single-file (legacy) employee shape into the repo's
 * normalized Employee type and then call the modular organogram API.
 *
 * This file intentionally keeps the conversion small and conservative so the
 * existing app modules can be reused without changing behaviour.
 */

function levelRankFromLabel(level?: string): number {
  if (!level) return 0;
  const L = (String(level) || "").toUpperCase().replace(/\s+/g, "");
  const m = L.match(/^L(\d{1,2})([A-Z]{0,2})?$/);
  if (!m) return 0;
  let n = Number(m[1]);
  if (Number.isNaN(n)) return 0;
  // produce a simple numeric rank compatible with fallbackLevel heuristics
  let rank = 4 + n; // L1 -> 5, L6 -> 10 (approx)
  if (m[2] === "H") rank += 0.5;
  return rank;
}

function toRepoEmployee(legacy: any, idx: number): RepoEmployee {
  // Map legacy single-file fields into the repository canonical shape.
  // The legacy file uses names like actualLevel, dateOfJoining, tazkiraNumber etc.
  const id = legacy.id ? String(legacy.id) : `LEGACY-${idx}`;
  const level = legacy.actualLevel || legacy.level || legacy.Level || "";
  const joinDate = legacy.dateOfJoining || legacy.joinDate || legacy.joiningDate || "";
  const dob = legacy.dateOfBirth || legacy.dob || legacy.dateOfBirth || "";

  const status = (legacy.employmentStatus || legacy.status || "Active").toLowerCase().startsWith("ex") ? "Separated" : "Active";

  return {
    id,
    hrisNo: legacy.hrisNo || legacy.HRIS || "",
    employeeNo: legacy.employeeNo || legacy.EmployeeNo || "",
    fullName: legacy.fullName || legacy.full_name || legacy.name || "",
    firstName: legacy.firstName || legacy.first_name || "",
    lastName: legacy.lastName || legacy.last_name || "",
    fatherName: legacy.fatherName || legacy.father_name || "",
    title: legacy.title || legacy.positionTitle || "",
    division: legacy.division || legacy.Division || "",
    department: legacy.department || legacy.Department || "",
    supervisor: legacy.supervisor || legacy.directSupervisor || legacy."Direct Supervisor" || "",
    supervisorEmail: legacy.supervisorEmail || legacy.supervisor_email || legacy.supervisorEmail || "",
    dutyStation: legacy.dutyStation || legacy.duty_station || "",
    contactNumber: legacy.contactNumber || legacy.contact_number || "",
    level: String(level || "").replace(/Actual Level:\s*/i, "") || "",
    levelRank: levelRankFromLabel(level),
    joinDate: String(joinDate || ""),
    joinTs: null,
    tenure: typeof legacy.tenure === "number" ? legacy.tenure : legacy.tenure ? Number(legacy.tenure) : null,
    dob: String(dob || ""),
    dobTs: null,
    age: legacy.age ?? null,
    qualification: legacy.qualification || "",
    qualificationNew: legacy.qualificationNew || "",
    qualificationGroup: "Other",
    expatLocal: legacy.expatLocal || legacy.expat_local || "",
    nationality: legacy.nationality || legacy.Nationality || "",
    gender: legacy.gender || legacy.Gender || "",
    regionProvince: legacy.regionProvince || legacy.region || legacy.province || "",
    province: legacy.regionProvince || legacy.province || "",
    region: legacy.region || "",
    maritalStatus: legacy.maritalStatus || legacy.marital_status || "",
    email: legacy.email || legacy.emailId || legacy.emailID || "",
    tazkira: legacy.tazkiraNumber || legacy.tazkira || "",
    bloodGroup: legacy.bloodGroup || legacy.blood_group || "",
    remarks: legacy.remarks || "",
    status: status as RepoEmployee["status"],
    promoted: !!legacy.promotionStatus || !!legacy.promoted || false,
    isManager: false,
    directReports: 0,
  } as RepoEmployee;
}

export function transformLegacyEmployees(legacyEmployees: any[]): RepoEmployee[] {
  return (legacyEmployees || []).map((e, i) => toRepoEmployee(e, i));
}

export function buildOrgFromLegacy(legacyEmployees: any[], overrides?: any) {
  const employees = transformLegacyEmployees(legacyEmployees);
  // The repo's buildOrgTree accepts overrides of a specific shape — keep pass-through
  // so callers can provide heads/reporting objects if available.
  // @ts-ignore - let the underlying function validate runtime shape.
  const build = buildOrgTree(employees, overrides);
  return build;
}

export function layoutFromLegacy(legacyEmployees: any[], division?: string, department?: string) {
  const build = buildOrgFromLegacy(legacyEmployees);
  const roots = build.roots;
  const layout = buildOrgLayout(roots);
  return layout;
}

export function exportSvgFromLegacy(legacyEmployees: any[], opts: { title: string; subtitle?: string; footer?: string }) {
  const layout = layoutFromLegacy(legacyEmployees);
  return buildExportSvg(layout, { title: opts.title, subtitle: opts.subtitle || "", generatedBy: undefined, footer: opts.footer || "" });
}
