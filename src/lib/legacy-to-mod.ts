import type { Employee as RepoEmployee } from "./types";
import { buildOrgTree } from "./orgtree";
import { buildOrgLayout } from "./orglayout";
import { buildOrgSvg as buildExportSvg } from "./org-export";

/**
 * Adapter: legacy single-file org-chart data -> the repo's modular organogram API.
 *
 * This keeps the existing app architecture stable while allowing the attached
 * single-file version to be used as an input source with minimal friction.
 */

function levelRankFromLabel(level?: string): number {
  if (!level) return 0;
  const value = String(level).trim().toUpperCase().replace(/\s+/g, "");
  const match = value.match(/^L(\d{1,2})([A-Z]{0,2})?$/);
  if (!match) return 0;

  const n = Number(match[1]);
  if (Number.isNaN(n)) return 0;

  let rank = 4 + n;
  if (match[2] === "H") rank += 0.5;
  return rank;
}

function toRepoEmployee(legacy: Record<string, any>, idx: number): RepoEmployee {
  const id = legacy.id ? String(legacy.id) : `LEGACY-${idx}`;
  const level = String(legacy.actualLevel || legacy.level || legacy.Level || "").trim();
  const joinDate = legacy.dateOfJoining || legacy.joinDate || legacy.joiningDate || "";
  const dob = legacy.dateOfBirth || legacy.dob || "";
  const statusRaw = legacy.employmentStatus || legacy.status || "Active";
  const status = String(statusRaw).toLowerCase().startsWith("ex") ? "Separated" : "Active";

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
    supervisor: legacy.supervisor || legacy.directSupervisor || legacy["Direct Supervisor"] || "",
    supervisorEmail: legacy.supervisorEmail || legacy.supervisor_email || "",
    dutyStation: legacy.dutyStation || legacy.duty_station || "",
    contactNumber: legacy.contactNumber || legacy.contact_number || "",
    level,
    levelRank: levelRankFromLabel(level),
    joinDate: String(joinDate || ""),
    joinTs: null,
    tenure: typeof legacy.tenure === "number" ? legacy.tenure : Number(legacy.tenure || 0) || null,
    dob: String(dob || ""),
    dobTs: null,
    age: typeof legacy.age === "number" ? legacy.age : legacy.age ? Number(legacy.age) : null,
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

export function transformLegacyEmployees(legacyEmployees: Record<string, any>[]): RepoEmployee[] {
  return (legacyEmployees || []).map((employee, index) => toRepoEmployee(employee, index));
}

export function buildOrgFromLegacy(legacyEmployees: Record<string, any>[], overrides?: Record<string, any>) {
  const employees = transformLegacyEmployees(legacyEmployees);
  return buildOrgTree(employees, overrides as any);
}

export function layoutFromLegacy(legacyEmployees: Record<string, any>[], division?: string, department?: string) {
  const build = buildOrgFromLegacy(legacyEmployees);
  const roots = division || department ? build.roots : build.roots;
  const layout = buildOrgLayout(roots);
  return { build, layout };
}

export function exportSvgFromLegacy(legacyEmployees: Record<string, any>[], opts: { title: string; subtitle?: string; footer?: string }) {
  const { layout } = layoutFromLegacy(legacyEmployees);
  return buildExportSvg(layout, {
    title: opts.title,
    subtitle: opts.subtitle || "",
    generatedBy: undefined,
    footer: opts.footer || "Made with ♥ by Mohibullah Afzalzada",
  });
}
