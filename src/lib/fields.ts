import type { FieldKey } from "./types";

export interface FieldDef {
  key: FieldKey;
  label: string;
  group: "Identity" | "Organization" | "Employment" | "Personal" | "Contact" | "Location";
  kind: "text" | "date" | "number";
  synonyms: string[];
  important?: boolean;
}

/** Canonical ATOMA HR dataset dictionary (29 fields) with synonyms used by the auto-mapper. */
export const FIELD_DEFS: FieldDef[] = [
  { key: "hrisNo", label: "HRIS No", group: "Identity", kind: "text", synonyms: ["hris no", "hris number", "hris id", "hris", "hris code", "hris #"] },
  { key: "employeeNo", label: "Employee No", group: "Identity", kind: "text", important: true, synonyms: ["employee no", "employee number", "emp no", "emp id", "employee id", "staff id", "staff no", "staff number", "emp number", "employee code", "emp code", "badge no", "id"] },
  { key: "fullName", label: "Employee Full Name", group: "Identity", kind: "text", important: true, synonyms: ["employee full name", "full name", "employee name", "name", "staff name", "emp name", "complete name"] },
  { key: "firstName", label: "Employee First Name", group: "Identity", kind: "text", synonyms: ["employee first name", "first name", "given name", "fname", "forename"] },
  { key: "lastName", label: "Employee Last Name", group: "Identity", kind: "text", synonyms: ["employee last name", "last name", "surname", "family name", "lname"] },
  { key: "fatherName", label: "Father Name", group: "Personal", kind: "text", synonyms: ["father name", "fathers name", "father s name", "father", "father full name"] },
  { key: "title", label: "Title", group: "Organization", kind: "text", important: true, synonyms: ["title", "job title", "position", "designation", "position title", "job role", "role", "job"] },
  { key: "division", label: "Division", group: "Organization", kind: "text", important: true, synonyms: ["division", "directorate", "business unit", "bu", "division name", "sector"] },
  { key: "department", label: "Department", group: "Organization", kind: "text", important: true, synonyms: ["department", "dept", "department name", "section", "function", "unit"] },
  { key: "supervisor", label: "Direct Supervisor", group: "Organization", kind: "text", synonyms: ["direct supervisor", "supervisor", "supervisor name", "line manager", "manager", "reports to", "reporting manager", "reporting to", "direct manager"] },
  { key: "supervisorEmail", label: "Supervisor Email", group: "Contact", kind: "text", synonyms: ["supervisor email", "supervisor e mail", "manager email", "line manager email", "supervisor email id", "reporting manager email"] },
  { key: "dutyStation", label: "Duty Station", group: "Location", kind: "text", important: true, synonyms: ["duty station", "work location", "location", "office", "station", "city", "branch", "office location", "base"] },
  { key: "contactNumber", label: "Contact Number", group: "Contact", kind: "text", synonyms: ["contact number", "contact no", "phone", "phone number", "mobile", "mobile number", "cell", "telephone", "phone no", "mobile no"] },
  { key: "level", label: "Actual Level", group: "Employment", kind: "text", synonyms: ["actual level", "level", "grade", "job level", "band", "pay grade", "job grade", "position level"] },
  { key: "joinDate", label: "Date of Joining", group: "Employment", kind: "date", important: true, synonyms: ["date of joining", "joining date", "hire date", "doj", "start date", "date joined", "date of hire", "join date", "employment date"] },
  { key: "tenure", label: "Tenure", group: "Employment", kind: "number", synonyms: ["tenure", "service years", "years of service", "length of service", "service length", "tenure years"] },
  { key: "dob", label: "Date of Birth", group: "Personal", kind: "date", synonyms: ["date of birth", "dob", "birth date", "birthdate", "d o b", "birthday"] },
  { key: "age", label: "Age", group: "Personal", kind: "number", synonyms: ["age", "age years", "current age"] },
  { key: "qualification", label: "Qualification", group: "Personal", kind: "text", synonyms: ["qualification", "education", "degree", "highest qualification", "education level", "academic qualification", "highest education"] },
  { key: "qualificationNew", label: "Qualification New", group: "Personal", kind: "text", synonyms: ["qualification new", "new qualification", "qualification group", "qualification category", "education category", "degree level", "qualification level"] },
  { key: "expatLocal", label: "Expat / Local", group: "Employment", kind: "text", synonyms: ["expat local", "expat or local", "local expat", "employee type", "staff category", "staff type", "expat", "local international", "national international"] },
  { key: "nationality", label: "Nationality", group: "Personal", kind: "text", synonyms: ["nationality", "citizenship", "country of citizenship", "nation"] },
  { key: "gender", label: "Gender", group: "Personal", kind: "text", important: true, synonyms: ["gender", "sex", "m f"] },
  { key: "region", label: "Region / Province", group: "Location", kind: "text", important: true, synonyms: ["region province", "region or province", "province", "region", "province region", "state", "wilayat"] },
  { key: "maritalStatus", label: "Marital Status", group: "Personal", kind: "text", synonyms: ["marital status", "marital", "civil status", "married single"] },
  { key: "email", label: "Email ID", group: "Contact", kind: "text", synonyms: ["email id", "email", "e mail", "email address", "work email", "official email", "office email", "mail"] },
  { key: "tazkira", label: "Tazkira Number", group: "Personal", kind: "text", synonyms: ["tazkira number", "tazkira", "tazkira no", "tazkera", "national id", "nic", "id card", "e tazkira", "national id number"] },
  { key: "bloodGroup", label: "Blood Group", group: "Personal", kind: "text", synonyms: ["blood group", "blood type", "blood", "bg"] },
  { key: "remarks", label: "Remarks", group: "Employment", kind: "text", synonyms: ["remarks", "remark", "notes", "comments", "comment", "note", "status"] },
];

export const FIELD_LABEL = Object.fromEntries(FIELD_DEFS.map((d) => [d.key, d.label])) as Record<FieldKey, string>;
export const FIELD_KEYS = FIELD_DEFS.map((d) => d.key);
