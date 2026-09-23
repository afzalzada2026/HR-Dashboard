"use client";

import { Check, Cloud, Database, EyeOff, FileClock, HardDrive, KeyRound, Lock, LockKeyhole, RefreshCw, Search, ShieldCheck, UserCheck, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn, fmtDateTime, fmtNum } from "@/lib/format";
import { can, DEMO_USERS, PERMISSIONS, ROLE_ORDER, ROLE_PERMISSIONS, ROLES } from "@/lib/rbac";
import type { AuditLog } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { switchAccount } from "../shell/Topbar";
import { Avatar, Badge, Button, Card, CardTitle, EmptyState, PageHeader, Spinner } from "../ui/primitives";

interface SystemInfo {
  database: string;
  azure: { configured: boolean; tenantId: string | null; clientId: string | null };
  counts: { datasets: number; auditLogs: number; reports: number } | null;
}

const CAT_TONE: Record<string, "primary" | "accent" | "warning" | "success" | "neutral"> = { data: "primary", export: "accent", security: "warning", reports: "success" };

function AuditTable() {
  const role = useUIStore((s) => s.session.role);
  const allowed = can(role, "view_audit");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ logs: AuditLog[]; total: number; categories: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const size = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: String(size), offset: String(page * size) });
      if (q.trim()) p.set("q", q.trim());
      if (cat) p.set("category", cat);
      const res = await fetch(`/api/audit?${p.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load audit logs");
      setData(json);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unavailable");
    } finally {
      setLoading(false);
    }
  }, [q, cat, page]);

  useEffect(() => {
    if (!allowed) return;
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load, allowed]);

  if (!allowed)
    return (
      <Card>
        <EmptyState icon={<Lock />} title="Audit logs are restricted" description={`Only HR Admins can review the audit trail. You are signed in as ${ROLES[role].label}.`} />
      </Card>
    );
  const pages = data ? Math.max(1, Math.ceil(data.total / size)) : 1;
  return (
    <Card className="animate-fade-up">
      <CardTitle
        icon={<FileClock />}
        title="Audit logs"
        subtitle={err ? err : `${fmtNum(data?.total ?? 0)} events · uploads, deletions, exports, sign-ins, role switches & schedules`}
        actions={
          <Button size="icon-sm" variant="ghost" onClick={() => load()} aria-label="Refresh audit logs">
            {loading ? <Spinner /> : <RefreshCw />}
          </Button>
        }
      />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input
            className="field h-9 pl-9"
            placeholder="Search action, user, details…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          className="field h-9 sm:w-48"
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All categories</option>
          {(data?.categories ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[820px] text-left text-[12px]">
          <thead>
            <tr className="border-y border-line bg-surface-muted text-[10.5px] tracking-wider text-muted uppercase">
              {["Time", "User", "Role", "Category", "Action", "Details", "IP"].map((h) => (
                <th key={h} className="px-4 py-2 font-semibold first:pl-5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.logs ?? []).map((l) => (
              <tr key={l.id} className="border-b border-line hover:bg-surface-muted/60">
                <td className="px-4 py-2 pl-5 whitespace-nowrap text-muted">{fmtDateTime(l.createdAt)}</td>
                <td className="px-4 py-2 font-medium whitespace-nowrap text-fg">{l.userName}</td>
                <td className="px-4 py-2 whitespace-nowrap text-muted">{ROLES[l.role as keyof typeof ROLES]?.label ?? l.role}</td>
                <td className="px-4 py-2">
                  <Badge tone={CAT_TONE[l.category] ?? "neutral"}>{l.category}</Badge>
                </td>
                <td className="px-4 py-2 font-mono text-[11px] whitespace-nowrap text-fg">{l.action}</td>
                <td className="max-w-[320px] truncate px-4 py-2 text-muted" title={l.details}>
                  {l.details || "—"}
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-subtle">{l.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.logs.length === 0 && <p className="py-10 text-center text-sm text-muted">No audit events match.</p>}
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-muted">
        Page {page + 1} of {pages}
        <Button size="xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Prev
        </Button>
        <Button size="xs" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
          Next
        </Button>
      </div>
    </Card>
  );
}

export default function SecurityView() {
  const session = useUIStore((s) => s.session);
  const storage = useUIStore((s) => s.storageMode);
  const records = useDataStore((s) => s.employees.length);
  const [sys, setSys] = useState<SystemInfo | null>(null);
  useEffect(() => {
    fetch("/api/system", { cache: "no-store" })
      .then((r) => r.json())
      .then(setSys)
      .catch(() => setSys(null));
  }, []);
  const role = ROLES[session.role];
  const policies = [
    { icon: <Users />, title: "Row-level security", desc: "Division Managers only receive employees of their own division — enforced in the API and the client." },
    { icon: <EyeOff />, title: "PII masking", desc: "Viewers see masked phone, email, Tazkira, date of birth and blood group values." },
    { icon: <FileClock />, title: "Immutable audit trail", desc: "Uploads, deletions, exports, profile downloads, sign-ins and schedule changes are logged with user, role and IP." },
    { icon: <LockKeyhole />, title: "Permission-gated APIs", desc: "Every mutating endpoint validates the caller's role before touching PostgreSQL." },
    { icon: <HardDrive />, title: "Local (no server) mode", desc: "Client-side version keeps datasets exclusively in this browser's IndexedDB." },
    { icon: <KeyRound />, title: "Azure AD / Entra ID SSO", desc: "Enterprise sign-in with Microsoft identities; demo tenant accounts are provided here." },
  ];
  return (
    <>
      <PageHeader eyebrow="Administration" title="Security & audit" icon={<ShieldCheck />} subtitle="Azure AD sign-in, role-based access control, permission policies and audit logging" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="animate-fade-up">
          <CardTitle icon={<UserCheck />} title="Current session" />
          <div className="flex items-center gap-3">
            <Avatar name={session.name} size={52} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-fg">{session.name}</p>
              <p className="truncate text-[12px] text-muted">{session.email}</p>
              <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white" style={{ background: role.color }}>
                <ShieldCheck className="h-3 w-3" /> {role.label}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[12.5px] text-muted">{role.description}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-lg bg-surface-muted px-2.5 py-2">
              <p className="text-[10px] text-subtle uppercase">Data scope</p>
              <p className="font-semibold text-fg">{session.role === "division_manager" ? session.division ?? "—" : "Organization-wide"}</p>
            </div>
            <div className="rounded-lg bg-surface-muted px-2.5 py-2">
              <p className="text-[10px] text-subtle uppercase">Visible records</p>
              <p className="font-semibold text-fg">{fmtNum(records)}</p>
            </div>
            <div className="rounded-lg bg-surface-muted px-2.5 py-2">
              <p className="text-[10px] text-subtle uppercase">Storage</p>
              <p className="flex items-center gap-1 font-semibold text-fg">
                {storage === "server" ? <Cloud className="h-3.5 w-3.5" /> : <HardDrive className="h-3.5 w-3.5" />} {storage === "server" ? "PostgreSQL" : "Local browser"}
              </p>
            </div>
            <div className="rounded-lg bg-surface-muted px-2.5 py-2">
              <p className="text-[10px] text-subtle uppercase">PII access</p>
              <p className="font-semibold text-fg">{can(session.role, "view_pii") ? "Granted" : "Masked"}</p>
            </div>
          </div>
        </Card>
        <Card className="animate-fade-up">
          <CardTitle icon={<KeyRound />} title="Azure AD (Microsoft Entra ID)" />
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <svg viewBox="0 0 23 23" className="h-8 w-8" aria-hidden>
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <div>
              <p className="text-[13px] font-semibold text-fg">{sys?.azure.configured ? "SSO configured" : "Demo SSO mode"}</p>
              <p className="text-[11.5px] text-muted">{sys?.azure.configured ? `Tenant ${sys.azure.tenantId} · Client ${sys.azure.clientId}` : "Set AZURE_AD_TENANT_ID & AZURE_AD_CLIENT_ID to enable production sign-in."}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-[12px]">
            {[
              ["Database", sys ? (sys.database === "connected" ? "Connected" : "Unavailable") : "Checking…", sys?.database === "connected"],
              ["Stored datasets", sys?.counts ? fmtNum(sys.counts.datasets) : "—", true],
              ["Audit events", sys?.counts ? fmtNum(sys.counts.auditLogs) : "—", true],
              ["Scheduled reports", sys?.counts ? fmtNum(sys.counts.reports) : "—", true],
            ].map(([l, v, ok]) => (
              <div key={String(l)} className="flex items-center justify-between rounded-lg bg-surface-muted px-2.5 py-1.5">
                <span className="flex items-center gap-1.5 text-muted">
                  <Database className="h-3.5 w-3.5" /> {l}
                </span>
                <span className={cn("font-semibold", ok ? "text-fg" : "text-danger")}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="animate-fade-up">
          <CardTitle icon={<Users />} title="Switch account" subtitle="Demo tenant — one account per role" />
          <div className="space-y-1.5">
            {DEMO_USERS.map((u) => (
              <button key={u.userId} type="button" onClick={() => switchAccount(u)} className={cn("flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors", u.userId === session.userId ? "border-accent/50 bg-accent/8" : "border-line hover:bg-surface-muted")}>
                <Avatar name={u.name} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-fg">{u.name}</span>
                  <span className="block truncate text-[11px] text-muted">{u.email}</span>
                </span>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: ROLES[u.role].color }}>
                  {ROLES[u.role].label}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card className="animate-fade-up mt-4">
        <CardTitle icon={<ShieldCheck />} title="Role-based access control" subtitle="Permission matrix · your current role is highlighted" />
        <div className="-mx-4 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[760px] text-left text-[12.5px]">
            <thead>
              <tr className="border-y border-line bg-surface-muted">
                <th className="px-5 py-2.5 text-[10.5px] font-semibold tracking-wider text-muted uppercase">Permission</th>
                {ROLE_ORDER.map((r) => (
                  <th key={r} className={cn("px-3 py-2.5 text-center text-[11px] font-semibold", r === session.role ? "bg-accent/12 text-fg" : "text-muted")}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: ROLES[r].color }} />
                      {ROLES[r].label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key} className="border-b border-line">
                  <td className="px-5 py-2.5">
                    <p className="font-medium text-fg">{p.label}</p>
                    <p className="text-[11px] text-muted">{p.description}</p>
                  </td>
                  {ROLE_ORDER.map((r) => (
                    <td key={r} className={cn("px-3 py-2.5 text-center", r === session.role && "bg-accent/8")}>
                      {ROLE_PERMISSIONS[r].includes(p.key) ? <Check className="mx-auto h-4 w-4 text-success" strokeWidth={3} /> : <X className="mx-auto h-4 w-4 text-subtle" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {policies.map((p, i) => (
          <div key={p.title} className="glass hover-lift animate-fade-up flex gap-3 rounded-2xl p-4" style={{ animationDelay: `${i * 40}ms` }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent [&_svg]:h-5 [&_svg]:w-5">{p.icon}</span>
            <div>
              <p className="text-[13.5px] font-semibold text-fg">{p.title}</p>
              <p className="mt-0.5 text-[12px] text-muted">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <AuditTable />
      </div>
    </>
  );
}
