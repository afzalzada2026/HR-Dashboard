export type Theme = "light" | "dark" | "atoma";
export type StorageMode = "server" | "local";

export type Role = "hr_admin" | "hr_officer" | "executive" | "division_manager" | "viewer";

export type Permission =
  | "view_dashboard"
  | "view_directory"
  | "view_pii"
  | "export_data"
  | "upload_data"
  | "delete_data"
  | "manage_reports"
  | "view_audit"
  | "manage_users";

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  division?: string;
}

export type FieldKey =
  | "hrisNo"
  | "employeeNo"
  | "fullName"
  | "firstName"
  | "lastName"
  | "fatherName"
  | "title"
  | "division"
  | "department"
  | "supervisor"
  | "supervisorEmail"
  | "dutyStation"
  | "contactNumber"
  | "level"
  | "joinDate"
  | "tenure"
  | "dob"
  | "age"
  | "qualification"
  | "qualificationNew"
  | "expatLocal"
  | "nationality"
  | "gender"
  | "region"
  | "maritalStatus"
  | "email"
  | "tazkira"
  | "bloodGroup"
  | "remarks";

export type QualificationGroup = "PhD" | "Master" | "Bachelor" | "Diploma" | "High School" | "Other";

export interface Employee {
  id: string;
  hrisNo: string;
  employeeNo: string;
  fullName: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  title: string;
  division: string;
  department: string;
  supervisor: string;
  supervisorEmail: string;
  dutyStation: string;
  contactNumber: string;
  level: string;
  levelRank: number;
  joinDate: string;
  joinTs: number | null;
  tenure: number | null;
  dob: string;
  dobTs: number | null;
  age: number | null;
  qualification: string;
  qualificationNew: string;
  qualificationGroup: QualificationGroup;
  expatLocal: string;
  nationality: string;
  gender: string;
  regionProvince: string;
  province: string;
  region: string;
  maritalStatus: string;
  email: string;
  tazkira: string;
  bloodGroup: string;
  remarks: string;
  status: "Active" | "Separated";
  promoted: boolean;
  isManager: boolean;
  directReports: number;
}

export type MultiKey =
  | "division"
  | "department"
  | "title"
  | "level"
  | "supervisor"
  | "gender"
  | "nationality"
  | "maritalStatus"
  | "qualification"
  | "expatLocal"
  | "bloodGroup"
  | "region"
  | "province"
  | "dutyStation";

export interface Filters extends Record<MultiKey, string[]> {
  joinFrom: string;
  joinTo: string;
  dobFrom: string;
  dobTo: string;
  ageMin: number | null;
  ageMax: number | null;
  tenureMin: number | null;
  tenureMax: number | null;
}

export interface DataQuality {
  totalRows: number;
  validRows: number;
  skippedRows: number;
  duplicateIds: number;
  invalidDates: number;
  unmatchedProvinces: number;
  completeness: number;
  missing: Partial<Record<FieldKey, number>>;
}

export interface DatasetMeta {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  mapping: Partial<Record<FieldKey, string>>;
  quality: DataQuality | null;
  source: "upload" | "demo";
  uploadedBy: string;
  uploadedRole: string;
  isActive: boolean;
  createdAt: string;
  storage: "server" | "local" | "memory";
}

export interface DatasetPayload {
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  columnCount: number;
  mapping: Partial<Record<FieldKey, string>>;
  quality: DataQuality | null;
  source: "upload" | "demo";
  employees: Employee[];
}

export interface AuditLog {
  id: number;
  action: string;
  category: string;
  details: string;
  userName: string;
  userEmail: string;
  role: string;
  ip: string;
  createdAt: string;
}

export interface ScheduledReport {
  id: number;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  format: "pdf" | "xlsx" | "csv" | "png";
  recipients: string;
  sections: string[];
  timeOfDay: string;
  dayOfWeek: number;
  dayOfMonth: number;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  createdBy: string;
  createdAt: string;
}
