"use client";

import { Check, Download, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { fmtDate, fmtNum, timestampSlug } from "@/lib/format";
import { LEVEL_ORDER } from "@/lib/organogram-levels";
import { appendLocalAudit, getAdapter } from "@/lib/storage";
import { PROVINCES, PROVINCE_REGION } from "@/lib/geo";
import type { Employee } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Badge, Button, Card, CardTitle, EmptyState, Modal, Spinner } from "../ui/primitives";

type Draft = Partial<Employee> & { __new?: boolean };

const LEVELS = [...LEVEL_ORDER];
const GENDERS = ["", "Male", "Female", "Unspecified"];
const MARITAL = ["", "Married", "Single", "Divorced", "Widowed", "Separated", "Other"];
const EXAPT = ["", "Local", "Expat", "Unspecified"];

function blank(): Draft {
  return {
    __new: true,
    id: `NEW-${timestampSlug()}`,
    employeeNo: "",
    hrisNo: "",
    fullName: "",
    fatherName: "",
    title: "",
    level: "L3",
    division: "",
    department: "",
    supervisor: "",
    supervisorEmail: "",
    dutyStation: "",
    contactNumber: "",
    email: "",
    nationality: "Afghan",
    gender: "Unspecified",
    province: "Unknown",
    maritalStatus: "",
    expatLocal: "",
    qualification: "",
    joinDate: "",
    dob: "",
    tazkira: "",
    bloodGroup: "",
    remarks: "",
    status: "Active",
    promoted: false,
  };
}

function Field({ label, value, onChange, type = "text", options, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; options?: string[]; placeholder?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold text-muted uppercase">{label}</span>
      {options ? (
        <select className="field mt-1 h-9" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o || "—"}
            </option>
          ))}
        </select>
      ) : (
        <input type={type} className="field mt-1 h-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="mt-0.5 block text-[10.5px] text-subtle">{hint}</span>}
    </label>
  );
}

export function EmployeeEditor() {
  const employees = useDataStore((s) => s.employees);
  const dataset = useDataStore((s) => s.dataset);
  const mode = useUIStore((s) => s.storageMode);
  const session = useUIStore((s) => s.session);
  const notify = useUIStore((s) => s.notify);
  const updateEmployees = useDataStore((s) => s.updateEmployees);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const size = 25;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? employees.filter((e) => `${e.fullName} ${e.employeeNo} ${e.title} ${e.department} ${e.division} ${e.supervisor}`.toLowerCase().includes(q)) : employees;
    return list.slice(page * size, page * size + size);
  }, [employees, query, page]);
  const total = query ? employees.filter((e) => `${e.fullName} ${e.employeeNo} ${e.title} ${e.department}`.toLowerCase().includes(query.trim().toLowerCase())).length : employees.length;
  const pages = Math.max(1, Math.ceil(total / size));

  const save = async () => {
    if (!draft) return;
    const name = draft.fullName?.trim();
    const number = draft.employeeNo?.trim();
    if (!name && !number) {
      notify("warning", "Name or employee number required");
      return;
    }
    setBusy(true);
    try {
      const province = draft.province || "Unknown";
      const next: Employee = {
        ...(blank() as unknown as Employee),
        ...draft,
        __new: undefined,
        id: draft.__new ? `${number || `NEW-${timestampSlug()}`}` : draft.id!,
        employeeNo: number || `NEW-${timestampSlug()}`,
        fullName: name || number || "Unnamed",
        province,
        region: PROVINCE_REGION[province] ?? draft.region ?? "Unknown",
      } as Employee;
      const list = draft.__new ? [...employees, next] : employees.map((e) => (e.id === next.id ? next : e));
      updateEmployees(list);
      if (dataset) await getAdapter(mode).update(dataset, list);
      await appendLocalAudit(draft.__new ? "employee.created" : "employee.updated", "data", `${next.fullName} · ${next.employeeNo}`);
      notify("success", draft.__new ? "Employee added" : "Employee updated", next.fullName);
      setDraft(null);
    } catch (error) {
      notify("error", "Save failed", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (employee: Employee) => {
    if (!window.confirm(`Delete ${employee.fullName}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const list = employees.filter((e) => e.id !== employee.id);
      updateEmployees(list);
      if (dataset) await getAdapter(mode).update(dataset, list);
      await appendLocalAudit("employee.deleted", "data", `${employee.fullName} · ${employee.employeeNo}`);
      notify("info", "Employee deleted", employee.fullName);
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Card className="animate-fade-up">
      <CardTitle
        icon={<UserRound />}
        title="Overall employee records"
        subtitle={`${fmtNum(employees.length)} rows in ${dataset?.name ?? "active dataset"} · edits stay on this device`}
        actions={
          <>
            <Button size="sm" onClick={() => setDraft(blank())}>
              <Plus /> Add employee
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const { exportEmployeesXLSX } = await import("@/lib/exporters");
                await exportEmployeesXLSX(employees, (await import("@/lib/exporters")).EMPLOYEE_COLUMNS, `atoma-employees-${timestampSlug()}.xlsx`);
              }}
            >
              <Download /> Export current rows
            </Button>
          </>
        }
      />
      <div className="relative mb-3 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input className="field h-9 pl-9" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search name, number, position, department…" />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<UserRound />} title="No records match" description="Adjust the search or add a new employee row." />
      ) : (
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[980px] text-left text-[12px]">
            <thead>
              <tr className="border-y border-line bg-surface-muted text-[10px] tracking-wider text-muted uppercase">
                {["Employee No", "Name", "Position", "Level", "Division", "Department", "Supervisor", "Location", ""].map((h) => (
                  <th key={h} className="px-3 py-2 font-semibold first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line hover:bg-surface-muted/60">
                  <td className="px-3 py-2 pl-5 font-mono text-[11px] text-muted">{e.employeeNo || "—"}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap text-fg">{e.fullName}</td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-fg">{e.title}</td>
                  <td className="px-3 py-2">
                    <Badge tone={e.level === "L3H" ? "warning" : "primary"}>{e.level}</Badge>
                  </td>
                  <td className="px-3 py-2 text-fg">{e.division}</td>
                  <td className="px-3 py-2 text-fg">{e.department}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-muted">{e.supervisor || <span className="text-subtle">— none (top of hierarchy)</span>}</td>
                  <td className="px-3 py-2 text-muted">{e.dutyStation}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button size="icon-sm" variant="ghost" onClick={() => setDraft({ ...e })} aria-label={`Edit ${e.fullName}`}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => void remove(e)} aria-label={`Delete ${e.fullName}`} className="hover:text-danger">
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted">
        <span>
          {fmtNum(total)} rows · page {page + 1} of {pages}
        </span>
        <div className="flex gap-1.5">
          <Button size="xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button size="xs" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      <Modal
        open={!!draft}
        onClose={() => !busy && setDraft(null)}
        title={draft?.__new ? "Add employee record" : `Edit · ${draft?.fullName ?? ""}`}
        subtitle="Changes are saved to the active dataset and reflected across every module"
        size="lg"
        footer={
          <>
            <Button onClick={() => setDraft(null)} disabled={busy}>
              <X /> Cancel
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={busy}>
              {busy ? <Spinner /> : <Check />} Save record
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Position / job title" value={draft.title ?? ""} onChange={(v) => set({ title: v })} placeholder="e.g. Manager – Retail Sales" />
            <Field label="Employee name" value={draft.fullName ?? ""} onChange={(v) => set({ fullName: v })} hint="Required unless an employee number is provided" />
            <Field label="Employee number" value={draft.employeeNo ?? ""} onChange={(v) => set({ employeeNo: v })} />
            <Field label="HRIS number" value={draft.hrisNo ?? ""} onChange={(v) => set({ hrisNo: v })} />
            <Field label="Level" value={draft.level ?? ""} onChange={(v) => set({ level: v })} options={LEVELS} />
            <Field label="Division" value={draft.division ?? ""} onChange={(v) => set({ division: v })} placeholder="e.g. Sales and Distribution" />
            <Field label="Department" value={draft.department ?? ""} onChange={(v) => set({ department: v })} />
            <Field label="Direct supervisor" value={draft.supervisor ?? ""} onChange={(v) => set({ supervisor: v })} hint="Leave empty for the top of the hierarchy (e.g. CEO)" />
            <Field label="Supervisor email" value={draft.supervisorEmail ?? ""} onChange={(v) => set({ supervisorEmail: v })} />
            <Field label="Duty station" value={draft.dutyStation ?? ""} onChange={(v) => set({ dutyStation: v })} placeholder="e.g. Kabul" />
            <Field label="Home province" value={draft.province ?? ""} onChange={(v) => set({ province: v })} options={["Unknown", ...PROVINCES.map((p) => p.name)]} />
            <Field label="Gender" value={draft.gender ?? ""} onChange={(v) => set({ gender: v })} options={GENDERS} />
            <Field label="Nationality" value={draft.nationality ?? ""} onChange={(v) => set({ nationality: v })} />
            <Field label="Expat / Local" value={draft.expatLocal ?? ""} onChange={(v) => set({ expatLocal: v })} options={EXAPT} />
            <Field label="Date of joining" value={draft.joinDate ?? ""} onChange={(v) => set({ joinDate: v })} type="date" />
            <Field label="Date of birth" value={draft.dob ?? ""} onChange={(v) => set({ dob: v })} type="date" />
            <Field label="Qualification" value={draft.qualification ?? ""} onChange={(v) => set({ qualification: v })} />
            <Field label="Marital status" value={draft.maritalStatus ?? ""} onChange={(v) => set({ maritalStatus: v })} options={MARITAL} />
            <Field label="Email" value={draft.email ?? ""} onChange={(v) => set({ email: v })} type="email" />
            <Field label="Contact number" value={draft.contactNumber ?? ""} onChange={(v) => set({ contactNumber: v })} />
            <Field label="Tazkira number" value={draft.tazkira ?? ""} onChange={(v) => set({ tazkira: v })} />
            <Field label="Blood group" value={draft.bloodGroup ?? ""} onChange={(v) => set({ bloodGroup: v })} placeholder="e.g. O+" />
            <Field label="Remarks" value={draft.remarks ?? ""} onChange={(v) => set({ remarks: v })} placeholder="e.g. Temporary contract" />
            <label className="flex items-center gap-2 self-end pb-2 text-[12px] text-fg">
              <input type="checkbox" className="accent-[#00A8FF]" checked={draft.status === "Separated"} onChange={(e) => set({ status: e.target.checked ? "Separated" : "Active" })} />
              Mark as separated / inactive
            </label>
          </div>
        )}
      </Modal>
    </Card>
  );
}
