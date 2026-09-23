"use client";

import { Briefcase, Building2, Calendar, Camera, ChevronRight, Copy, Droplet, FileDown, Flag, GraduationCap, Hash, Mail, MapPin, Phone, Printer, User, UserCog, Users, X } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { directReportsOf, reportingChain } from "@/lib/analytics";
import { contactText, downloadProfilePDF, printProfile } from "@/lib/exporters";
import { cn, fmtDate, fmtYears, hashHue, initials } from "@/lib/format";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/storage";
import type { Employee } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Avatar, Badge, Button, Drawer } from "../ui/primitives";

function Field({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: ReactNode; onClick?: () => void }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold tracking-wider text-subtle uppercase">{label}</p>
        {onClick ? (
          <button type="button" onClick={onClick} className="truncate text-left text-[13px] font-medium text-primary hover:underline dark:text-accent">
            {value}
          </button>
        ) : (
          <p className="text-[13px] font-medium break-words text-fg">{value || "—"}</p>
        )}
      </div>
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function ProfileDrawer() {
  const id = useUIStore((s) => s.selectedEmployeeId);
  const openEmployee = useUIStore((s) => s.openEmployee);
  const notify = useUIStore((s) => s.notify);
  const role = useUIStore((s) => s.session.role);
  const employees = useDataStore((s) => s.employees);
  const emp = useMemo(() => (id ? employees.find((e) => e.id === id) ?? null : null), [id, employees]);
  const chain = useMemo(() => (emp ? reportingChain(emp, employees) : []), [emp, employees]);
  const reports = useMemo(() => (emp ? directReportsOf(emp, employees) : []), [emp, employees]);
  const canExport = can(role, "export_data");
  const close = () => openEmployee(null);
  if (!emp) return null;
  const supervisor = chain[0] as Employee | undefined;
  const hue = hashHue(emp.fullName);

  return (
    <Drawer open={!!emp} onClose={close} width="max-w-[480px]" label="Employee profile">
      <div className="relative shrink-0 overflow-hidden rounded-tl-2xl px-5 pt-5 pb-6 text-white" style={{ background: "linear-gradient(135deg,#062B5B 0%,#0D47A1 60%,#00A8FF 100%)" }}>
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <span className="text-[10.5px] font-semibold tracking-[0.18em] text-white/70 uppercase">Employee profile</span>
          <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-white/80 hover:bg-white/15" aria-label="Close profile">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative mt-3 flex items-center gap-4">
          <div className="relative">
            <div className="grid h-20 w-20 place-items-center rounded-2xl text-2xl font-bold shadow-xl ring-4 ring-white/25" style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 40) % 360} 80% 60%))` }}>
              {initials(emp.fullName)}
            </div>
            <span className="absolute -right-1.5 -bottom-1.5 grid h-7 w-7 place-items-center rounded-full bg-white text-brand-700 shadow" title="Photo placeholder">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg leading-tight font-bold">{emp.fullName}</h2>
            <p className="mt-0.5 text-[13px] text-white/85">{emp.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-white/18 px-2 py-0.5 text-[10.5px] font-semibold">{emp.employeeNo}</span>
              <span className="rounded-full bg-white/18 px-2 py-0.5 text-[10.5px] font-semibold">{emp.level}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", emp.status === "Active" ? "bg-emerald-400/25 text-emerald-100" : "bg-rose-400/30 text-rose-100")}>{emp.status}</span>
            </div>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ["Age", emp.age === null ? "—" : `${Math.floor(emp.age)}`],
            ["Tenure", fmtYears(emp.tenure)],
            ["Direct reports", String(reports.length)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/12 px-2 py-2">
              <p className="text-[15px] font-bold">{v}</p>
              <p className="text-[10px] text-white/70 uppercase">{l}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-2 border-b border-line px-5 py-3">
        <Button
          size="sm"
          variant="primary"
          className="flex-1"
          disabled={!canExport}
          onClick={async () => {
            await downloadProfilePDF(emp, employees);
            logAudit("profile.downloaded", "export", `${emp.fullName} (${emp.employeeNo})`);
            notify("success", "Profile downloaded", emp.fullName);
          }}
        >
          <FileDown /> Download
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={!canExport}
          onClick={() => {
            printProfile(emp);
            logAudit("profile.printed", "export", `${emp.fullName} (${emp.employeeNo})`);
          }}
        >
          <Printer /> Print
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={async () => {
            const ok = await copyText(contactText(emp));
            notify(ok ? "success" : "error", ok ? "Contact copied" : "Copy failed", ok ? "Name, title, phone, email & location copied to clipboard." : undefined);
          }}
        >
          <Copy /> Copy contact
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <p className="mt-4 mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Personal</p>
        <div className="divide-y divide-line">
          <Field icon={<Hash />} label="Employee number" value={`${emp.employeeNo}${emp.hrisNo ? ` · ${emp.hrisNo}` : ""}`} />
          <Field icon={<User />} label="Full name / Gender" value={`${emp.fullName} · ${emp.gender}`} />
          <Field icon={<Flag />} label="Nationality" value={`${emp.nationality} · ${emp.expatLocal}`} />
          <Field icon={<GraduationCap />} label="Qualification" value={emp.qualification ? `${emp.qualification} (${emp.qualificationGroup})` : emp.qualificationGroup} />
          <Field icon={<Droplet />} label="Blood group / Marital status" value={`${emp.bloodGroup} · ${emp.maritalStatus}`} />
        </div>
        <p className="mt-4 mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Organization</p>
        <div className="divide-y divide-line">
          <Field icon={<Briefcase />} label="Title" value={emp.title} />
          <Field icon={<Building2 />} label="Department · Division" value={`${emp.department} · ${emp.division}`} />
          <Field icon={<UserCog />} label="Supervisor" value={emp.supervisor || "—"} onClick={supervisor ? () => openEmployee(supervisor.id) : undefined} />
          <Field icon={<Calendar />} label="Joining date · Tenure" value={`${fmtDate(emp.joinDate)} · ${fmtYears(emp.tenure)}`} />
        </div>
        <p className="mt-4 mb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Contact & location</p>
        <div className="divide-y divide-line">
          <Field icon={<Phone />} label="Phone" value={emp.contactNumber} />
          <Field icon={<Mail />} label="Email" value={emp.email} />
          <Field icon={<MapPin />} label="Location" value={`${emp.dutyStation}${emp.province !== "Unknown" ? `, ${emp.province} (${emp.region})` : ""}`} />
        </div>
        {emp.remarks && (
          <div className="mt-4 rounded-xl border border-line bg-surface-muted p-3 text-[12.5px] text-fg">
            <span className="text-[10.5px] font-semibold tracking-wider text-subtle uppercase">Remarks</span>
            <p className="mt-0.5">{emp.remarks}</p>
          </div>
        )}
        {chain.length > 0 && (
          <>
            <p className="mt-5 mb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">Reporting line</p>
            <div className="space-y-1.5">
              {chain.map((c, i) => (
                <button key={c.id} type="button" onClick={() => openEmployee(c.id)} className="flex w-full items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-surface-muted" style={{ marginLeft: Math.min(i, 4) * 10 }}>
                  <Avatar name={c.fullName} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-fg">{c.fullName}</span>
                    <span className="block truncate text-[11px] text-muted">{c.title}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-subtle" />
                </button>
              ))}
            </div>
          </>
        )}
        {reports.length > 0 && (
          <>
            <p className="mt-5 mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
              <Users className="h-3.5 w-3.5" /> Direct reports <Badge tone="primary">{reports.length}</Badge>
            </p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {reports.slice(0, 12).map((r) => (
                <button key={r.id} type="button" onClick={() => openEmployee(r.id)} className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-2 text-left hover:bg-surface-muted">
                  <Avatar name={r.fullName} size={26} />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-fg">{r.fullName}</span>
                    <span className="block truncate text-[10.5px] text-muted">{r.title}</span>
                  </span>
                </button>
              ))}
            </div>
            {reports.length > 12 && <p className="mt-2 text-[11px] text-subtle">+{reports.length - 12} more</p>}
          </>
        )}
      </div>
    </Drawer>
  );
}
