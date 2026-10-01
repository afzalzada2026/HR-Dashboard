"use client";

import { Check, Plus, Search, Trash2, UserCog, Users } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { FIELD_DEFS, FIELD_LABEL } from "@/lib/fields";
import { fmtDate, fmtNum } from "@/lib/format";
import { normalizeRows } from "@/lib/normalize";
import { can, ROLES } from "@/lib/rbac";
import { logAudit, saveDatasetEmployees } from "@/lib/storage";
import type { Employee, FieldKey } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Badge, Button, Card, CardTitle, EmptyState, Modal, Spinner } from "../ui/primitives";

const MAPPING = Object.fromEntries(FIELD_DEFS.map((d) => [d.key, FIELD_LABEL[d.key]])) as Record<FieldKey, string>;

type FormRow = Partial<Record<FieldKey, string>>;

const FORM_KEYS: { key: FieldKey; label: string; wide?: boolean }[] = [
  { key: "fullName", label: "Full name" },
  { key: "title", label: "Position title" },
  { key: "level", label: "Level (L6 → L1)" },
  { key: "division", label: "Division" },
  { key: "department", label: "Department" },
  { key: "supervisor", label: "Line manager (name)" },
  { key: "supervisorEmail", label: "Line manager e-mail" },
  { key: "email", label: "E-mail" },
  { key: "contactNumber", label: "Phone" },
  { key: "dutyStation", label: "Duty station" },
  { key: "region", label: "Region / province" },
  { key: "gender", label: "Gender" },
  { key: "nationality", label: "Nationality" },
  { key: "qualification", label: "Qualification", wide: true },
  { key: "qualificationNew", label: "Qualification group" },
  { key: "expatLocal", label: "Expat / local" },
  { key: "maritalStatus", label: "Marital status" },
  { key: "bloodGroup", label: "Blood group" },
  { key: "joinDate", label: "Joining date (YYYY-MM-DD)" },
  { key: "dob", label: "Date of birth (YYYY-MM-DD)" },
  { key: "remarks", label: "Remarks", wide: true },
];

const EMPTY: FormRow = Object.fromEntries(FORM_KEYS.map((f) => [f.key, ""])) as FormRow;

function employeeToForm(e: Employee): FormRow {
  return {
    fullName: e.fullName, title: e.title, level: e.level, division: e.division, department: e.department,
    supervisor: e.supervisor, supervisorEmail: e.supervisorEmail, email: e.email, contactNumber: e.contactNumber,
    dutyStation: e.dutyStation, region: e.regionProvince || e.province, gender: e.gender, nationality: e.nationality,
    qualification: e.qualification, qualificationNew: e.qualificationNew, expatLocal: e.expatLocal, maritalStatus: e.maritalStatus,
    bloodGroup: e.bloodGroup, joinDate: e.joinDate, dob: e.dob, remarks: e.remarks,
  };
}

function formToEmployee(form: FormRow, existingId?: string): Employee {
  const raw: Record<string, unknown> = {};
  for (const def of FIELD_DEFS) raw[MAPPING[def.key]] = form[def.key] ?? "";
  const { employees } = normalizeRows([raw], MAPPING, Date.now());
  const created = employees[0];
  if (!created) throw new Error("The row could not be normalized.");
  return { ...created, id: existingId ?? created.id };
}

/** Admin-only editor for the active dataset: add, edit and remove employee rows locally. */
export function EmployeeEditor() {
  const dataset = useDataStore((s) => s.dataset);
  const employees = useDataStore((s) => s.employees);
  const setDataset = useDataStore((s) => s.setDataset);
  const session = useUIStore((s) => s.session);
  const notify = useUIStore((s) => s.notify);
  const allowed = can(session.role, "manage_users");

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormRow>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? employees.filter((e) => `${e.fullName} ${e.title} ${e.department} ${e.employeeNo}`.toLowerCase().includes(q)) : employees;
    return list.slice(0, 400);
  }, [employees, query]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setError("");
    setOpen(true);
  };
  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setForm(employeeToForm(employee));
    setError("");
    setOpen(true);
  };

  const persist = async (next: Employee[], message: string) => {
    if (!dataset) return;
    setBusy(true);
    try {
      await saveDatasetEmployees(dataset.id, next);
      setDataset({ ...dataset, rowCount: next.length }, next);
      logAudit("dataset.row_edited", "data", message);
      notify("success", "Saved", message);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the row.");
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!dataset) return;
    try {
      const employee = formToEmployee(form, editing?.id);
      const next = editing ? employees.map((e) => (e.id === editing.id ? employee : e)) : [...employees, employee];
      await persist(next, `${editing ? "Updated" : "Added"} ${employee.fullName} (${employee.employeeNo})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid row.");
    }
  };

  const remove = async (employee: Employee) => {
    if (!window.confirm(`Remove ${employee.fullName} from the active dataset?`)) return;
    await persist(employees.filter((e) => e.id !== employee.id), `Removed ${employee.fullName}`);
  };

  return (
    <Card className="animate-fade-up">
      <CardTitle
        icon={<UserCog />}
        title="Employee data editor"
        subtitle={allowed ? "Add, edit or remove rows in the active dataset — changes stay in this browser" : `Only ${ROLES.hr_admin.label} can edit dataset rows`}
        actions={
          allowed ? (
            <Button size="sm" variant="primary" onClick={openNew}>
              <Plus /> Add employee
            </Button>
          ) : undefined
        }
      />
      {!dataset ? (
        <EmptyState icon={<Users />} title="No active dataset" description="Import a file first, then edit its rows here." />
      ) : (
        <>
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input className="field h-9 pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, title, department or employee number…" />
          </div>
          <div className="max-h-[380px] overflow-y-auto rounded-xl border border-line">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-surface-muted text-[10px] tracking-wider text-muted uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Employee</th>
                  <th className="px-3 py-2 font-semibold">Position</th>
                  <th className="px-3 py-2 font-semibold">Level</th>
                  <th className="px-3 py-2 font-semibold">Department</th>
                  <th className="px-3 py-2 font-semibold">Joined</th>
                  <th className="px-3 py-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((employee) => (
                  <tr key={employee.id} className="border-t border-line hover:bg-surface-muted/60">
                    <td className="px-3 py-1.5">
                      <span className="block truncate font-medium text-fg">{employee.fullName}</span>
                      <span className="block truncate text-[10px] text-subtle">{employee.employeeNo}</span>
                    </td>
                    <td className="max-w-[190px] truncate px-3 py-1.5 text-muted">{employee.title}</td>
                    <td className="px-3 py-1.5">
                      <Badge tone="primary">{employee.level || "—"}</Badge>
                    </td>
                    <td className="max-w-[150px] truncate px-3 py-1.5 text-muted">{employee.department}</td>
                    <td className="px-3 py-1.5 text-muted">{fmtDate(employee.joinDate)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {allowed && (
                        <span className="inline-flex gap-1">
                          <Button size="xs" onClick={() => openEdit(employee)}>
                            Edit
                          </Button>
                          <Button size="icon-sm" variant="ghost" onClick={() => void remove(employee)} aria-label="Delete row" className="hover:text-danger">
                            <Trash2 />
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="py-8 text-center text-sm text-muted">No employees match.</p>}
          </div>
          <p className="mt-2 text-[11px] text-subtle">
            Showing {fmtNum(rows.length)} of {fmtNum(employees.length)} rows · edits recompute age, tenure, qualification group and province automatically.
          </p>
        </>
      )}

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={editing ? `Edit · ${editing.fullName}` : "Add employee"}
        subtitle="Derived fields (age, tenure, level rank, province) are recalculated on save"
        size="lg"
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => (document.getElementById("employee-row-form") as HTMLFormElement | null)?.requestSubmit()} disabled={busy}>
              {busy ? <Spinner /> : <Check />} Save row
            </Button>
          </>
        }
      >
        <form id="employee-row-form" onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FORM_KEYS.map((field) => (
            <div key={field.key} className={field.wide ? "sm:col-span-2" : undefined}>
              <label className="text-[11px] font-semibold text-muted uppercase">{field.label}</label>
              <input
                className="field mt-1"
                value={form[field.key] ?? ""}
                onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                placeholder={field.key === "level" ? "e.g. L3, L3H, L5" : field.key === "region" ? "e.g. Kabul, Herat, Wardak" : ""}
              />
            </div>
          ))}
          {error && <p className="sm:col-span-2 rounded-xl border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{error}</p>}
        </form>
      </Modal>
    </Card>
  );
}
