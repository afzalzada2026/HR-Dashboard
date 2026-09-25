import type { Employee, Permission, Role, Session } from "./types";

export const ROLES: Record<Role, { label: string; description: string; color: string }> = {
  hr_admin: { label: "HR Admin", description: "Full platform control: data, users, security & audit.", color: "#0D47A1" },
  hr_officer: { label: "HR Officer", description: "Uploads data, manages directory & reports.", color: "#00A8FF" },
  executive: { label: "Executive", description: "Organization-wide analytics & executive exports.", color: "#7C3AED" },
  division_manager: { label: "Division Manager", description: "Row-level access limited to own division.", color: "#F59E0B" },
  viewer: { label: "Viewer", description: "Read-only dashboards with masked PII.", color: "#64748B" },
};

export const ROLE_ORDER: Role[] = ["hr_admin", "hr_officer", "executive", "division_manager", "viewer"];

export const PERMISSIONS: { key: Permission; label: string; description: string }[] = [
  { key: "view_dashboard", label: "View dashboards", description: "Executive overview, analytics, visuals, map & insights" },
  { key: "view_directory", label: "Employee directory", description: "Browse employees and open profile drill-through" },
  { key: "view_pii", label: "View personal data (PII)", description: "Phone, email, Tazkira, date of birth, blood group" },
  { key: "export_data", label: "Export data", description: "PDF, Excel, CSV, PNG and dashboard snapshots" },
  { key: "upload_data", label: "Upload datasets", description: "Import Excel / CSV files and load demo data" },
  { key: "delete_data", label: "Delete datasets", description: "Remove stored datasets permanently" },
  { key: "manage_reports", label: "Schedule reports", description: "Create and manage daily / weekly / monthly reports" },
  { key: "view_audit", label: "Audit logs", description: "Review the platform audit trail" },
  { key: "manage_users", label: "Manage roles", description: "Assign roles and permission policies" },
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  hr_admin: ["view_dashboard", "view_directory", "view_pii", "export_data", "upload_data", "delete_data", "manage_reports", "view_audit", "manage_users"],
  hr_officer: ["view_dashboard", "view_directory", "view_pii", "export_data", "upload_data", "manage_reports"],
  executive: ["view_dashboard", "view_directory", "view_pii", "export_data", "manage_reports"],
  division_manager: ["view_dashboard", "view_directory", "view_pii", "export_data"],
  viewer: ["view_dashboard", "view_directory"],
};

export function can(role: Role, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export const DEMO_USERS: Session[] = [
  { userId: "u-admin", name: "Mariam Karimi", email: "mariam.karimi@atoma.af", role: "hr_admin" },
  { userId: "u-officer", name: "Farid Ahmadzai", email: "farid.ahmadzai@atoma.af", role: "hr_officer" },
  { userId: "u-exec", name: "Hamid Sultani", email: "hamid.sultani@atoma.af", role: "executive" },
  { userId: "u-divmgr", name: "Nasir Popal", email: "nasir.popal@atoma.af", role: "division_manager", division: "Operations" },
  { userId: "u-viewer", name: "Laila Noori", email: "laila.noori@atoma.af", role: "viewer" },
];

export const DEFAULT_SESSION: Session = DEMO_USERS[0];
export const SESSION_COOKIE = "atoma_session";

export function encodeSession(s: Session): string {
  return encodeURIComponent(JSON.stringify(s));
}

export function decodeSession(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(decodeURIComponent(raw)) as Session;
    if (s && typeof s.name === "string" && s.role in ROLES) return s;
  } catch {
    /* ignore */
  }
  return null;
}

function maskTail(v: string, keep = 2): string {
  if (!v) return v;
  return v.replace(/[A-Za-z0-9]/g, "•").slice(0, Math.max(0, v.length - keep)) + v.slice(-keep);
}

export function maskEmail(v: string): string {
  if (!v || !v.includes("@")) return v ? "•••" : v;
  const [u, d] = v.split("@");
  return `${u.slice(0, 1)}•••@${d}`;
}

export function maskEmployee(e: Employee): Employee {
  return {
    ...e,
    contactNumber: e.contactNumber ? `${e.contactNumber.slice(0, 3)} ••• ••• ••••` : "",
    email: maskEmail(e.email),
    supervisorEmail: maskEmail(e.supervisorEmail),
    tazkira: maskTail(e.tazkira, 2),
    dob: e.dob ? "••••-••-••" : "",
    bloodGroup: "•••",
    fatherName: e.fatherName ? `${e.fatherName.slice(0, 1)}•••` : "",
  };
}

/** Row-level security (division scope) + PII masking according to the user's role. */
export function applyRowLevelSecurity(emps: Employee[], session: Session): Employee[] {
  let res = emps;
  if (session.role === "division_manager" && session.division) {
    const d = session.division.toLowerCase();
    res = res.filter((e) => e.division.toLowerCase() === d);
  }
  if (!can(session.role, "view_pii")) res = res.map(maskEmployee);
  return res;
}
