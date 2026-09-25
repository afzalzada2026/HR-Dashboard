"use client";

import {
  Bell, Camera, Check, ChevronRight, FileDown, FileSpreadsheet, FileText, Filter, Image as ImageIcon, Lock, LogOut, Menu, Moon, Palette, Search, ShieldCheck, Sun, Trash2, UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EMPLOYEE_COLUMNS, exportCSV, exportExecutivePDF, exportPNG, exportSnapshot, exportViewPDF, exportWorkbook } from "@/lib/exporters";
import { activeFilterCount, describeFilters } from "@/lib/filters";
import { cn, fmtDateTime, timestampSlug } from "@/lib/format";
import { LOCAL_ONLY } from "@/lib/mode";
import { can, DEMO_USERS, ROLES } from "@/lib/rbac";
import { logAudit } from "@/lib/storage";
import type { Session, Theme } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Avatar, Badge, Button, MenuItem, Modal, Popover, Spinner } from "../ui/primitives";
import { CAPTURE_BG, findNav, NAV_ITEMS } from "./nav";

function SearchBox({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const employees = useDataStore((s) => s.employees);
  const openEmployee = useUIStore((s) => s.openEmployee);
  const router = useRouter();
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const index = useMemo(() => employees.map((e) => ({ e, s: `${e.fullName} ${e.employeeNo} ${e.hrisNo} ${e.title} ${e.email} ${e.department}`.toLowerCase() })), [employees]);
  const s = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (s.length < 2) return [];
    const out = [];
    for (const it of index) {
      if (it.s.includes(s)) {
        out.push(it.e);
        if (out.length >= 7) break;
      }
    }
    return out;
  }, [s, index]);
  const pages = s ? NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(s) || n.description.toLowerCase().includes(s)).slice(0, 4) : [];
  const pick = (fn: () => void) => {
    fn();
    setQ("");
    setOpen(false);
    onDone?.();
  };
  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) pick(() => openEmployee(results[0].id));
        }}
        placeholder="Search employees, IDs, titles or pages…"
        className="field h-10 rounded-xl pr-14 pl-9"
        aria-label="Global search"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-subtle sm:block">⌘K</kbd>
      {open && s.length > 0 && (
        <div className="glass-strong animate-pop absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-auto rounded-xl p-1.5">
          {results.length > 0 && <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase">Employees</p>}
          {results.map((e) => (
            <button key={e.id} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => pick(() => openEmployee(e.id))} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted">
              <Avatar name={e.fullName} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg">{e.fullName}</span>
                <span className="block truncate text-[11px] text-muted">
                  {e.employeeNo} · {e.title} · {e.department}
                </span>
              </span>
            </button>
          ))}
          {pages.length > 0 && <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase">Pages</p>}
          {pages.map((p) => (
            <button key={p.href} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => pick(() => router.push(p.href))} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted">
              <span className="grid h-[30px] w-[30px] place-items-center rounded-lg bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
                <p.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-fg">{p.label}</span>
                <span className="block truncate text-[11px] text-muted">{p.description}</span>
              </span>
            </button>
          ))}
          {!results.length && !pages.length && <p className="px-3 py-5 text-center text-xs text-muted">{s.length < 2 ? "Keep typing…" : "No results"}</p>}
        </div>
      )}
    </div>
  );
}

type ExportKind = "pdf" | "png" | "snapshot" | "xlsx" | "csv" | "exec";
const EXPORT_LABEL: Record<ExportKind, string> = { pdf: "PDF", png: "PNG image", snapshot: "Dashboard snapshot", xlsx: "Excel workbook", csv: "CSV", exec: "Executive PDF report" };

export async function runExport(kind: ExportKind, title: string, captureId = "atoma-capture"): Promise<void> {
  const ui = useUIStore.getState();
  const data = useDataStore.getState();
  const { session, theme } = ui;
  const filters = describeFilters(data.filters);
  const background = CAPTURE_BG[theme] ?? "#F4F8FC";
  const meta = { title, subtitle: data.dataset?.name ?? "", filters, user: `${session.name} · ${ROLES[session.role].label}`, background };
  const ctx = { title: `${title} — Workforce Report`, datasetName: data.dataset?.name ?? "—", user: session.name, role: ROLES[session.role].label, filters, employees: data.filtered, now: data.now || Date.now() };
  try {
    if (!can(session.role, "export_data")) throw new Error("Your role does not permit exports.");
    if (kind === "pdf" || kind === "png" || kind === "snapshot") {
      const el = document.getElementById(captureId);
      if (!el) throw new Error("Nothing to capture on this page");
      ui.setExporting(true);
      await new Promise((r) => setTimeout(r, 900));
      if (kind === "pdf") await exportViewPDF(el, meta);
      else if (kind === "png") await exportPNG(el, title, background);
      else await exportSnapshot(el, meta);
    } else if (kind === "xlsx") await exportWorkbook(ctx);
    else if (kind === "csv") await exportCSV(data.filtered, EMPLOYEE_COLUMNS, `atoma-employees-${timestampSlug()}.csv`);
    else await exportExecutivePDF(ctx);
    logAudit(`export.${kind}`, "export", `${title} · ${data.filtered.length} records`, { filters });
    ui.notify("success", "Export complete", `${EXPORT_LABEL[kind]} generated for ${title}.`);
  } catch (e) {
    ui.notify("error", "Export failed", e instanceof Error ? e.message : undefined);
  } finally {
    ui.setExporting(false);
  }
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const page = findNav(usePathname());
  const role = useUIStore((s) => s.session.role);
  const allowed = can(role, "export_data");
  const go = async (k: ExportKind) => {
    setOpen(false);
    setBusy(k);
    await runExport(k, page.label);
    setBusy(null);
  };
  const items: { k: ExportKind; icon: React.ReactNode; label: string; hint: string }[] = [
    { k: "pdf", icon: <FileDown />, label: "Export PDF", hint: "view" },
    { k: "xlsx", icon: <FileSpreadsheet />, label: "Export Excel", hint: "7 sheets" },
    { k: "csv", icon: <FileText />, label: "Export CSV", hint: "filtered" },
    { k: "png", icon: <ImageIcon />, label: "Export PNG", hint: "view" },
    { k: "snapshot", icon: <Camera />, label: "Dashboard Snapshot", hint: "branded" },
    { k: "exec", icon: <FileText />, label: "Executive PDF Report", hint: "summary" },
  ];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="right"
      width={270}
      trigger={
        <Button variant="primary" size="md" onClick={() => setOpen((v) => !v)} className="px-3 sm:px-4" aria-label="Export">
          {busy ? <Spinner /> : <FileDown />}
          <span className="hidden sm:inline">{busy ? "Exporting…" : "Export"}</span>
        </Button>
      }
    >
      <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase">Export · {page.label}</p>
      {items.map((it) => (
        <MenuItem key={it.k} icon={allowed ? it.icon : <Lock />} onClick={() => go(it.k)} disabled={!allowed || !!busy} hint={it.hint}>
          {it.label}
        </MenuItem>
      ))}
      {!allowed && <p className="px-2.5 py-2 text-[11px] text-warning">Your role ({ROLES[role].label}) cannot export data.</p>}
    </Popover>
  );
}

const THEMES: { value: Theme; label: string; icon: React.ReactNode; swatch: string }[] = [
  { value: "light", label: "Light", icon: <Sun />, swatch: "linear-gradient(135deg,#FFFFFF,#E3F2FD)" },
  { value: "dark", label: "Dark", icon: <Moon />, swatch: "linear-gradient(135deg,#0E1B2E,#060E1A)" },
  { value: "atoma", label: "ATOMA", icon: <Palette />, swatch: "linear-gradient(135deg,#062B5B,#0D47A1 60%,#00A8FF)" },
];

function ThemeMenu() {
  const [open, setOpen] = useState(false);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const cur = THEMES.find((t) => t.value === theme) ?? THEMES[0];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="right"
      width={220}
      trigger={
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Theme">
          {cur.icon}
        </Button>
      }
    >
      <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase">Theme engine</p>
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => {
            setTheme(t.value);
            setOpen(false);
          }}
          className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-fg hover:bg-surface-muted", theme === t.value && "bg-primary/10 dark:bg-accent/15")}
        >
          <span className="h-6 w-6 rounded-md border border-line-strong" style={{ background: t.swatch }} />
          <span className="flex-1">{t.label} mode</span>
          {theme === t.value && <Check className="h-4 w-4 text-accent" />}
        </button>
      ))}
      <p className="px-2.5 pt-1 pb-1.5 text-[10.5px] text-subtle">Your selection is remembered on this device.</p>
    </Popover>
  );
}

function NotificationMenu() {
  const [open, setOpen] = useState(false);
  const items = useUIStore((s) => s.notifications);
  const markAllRead = useUIStore((s) => s.markAllRead);
  const clear = useUIStore((s) => s.clearNotifications);
  const unread = items.filter((n) => !n.read).length;
  const tone = { success: "bg-success", info: "bg-accent", warning: "bg-warning", error: "bg-danger" };
  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) markAllRead();
      }}
      align="right"
      width={330}
      trigger={
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)} aria-label="Notifications" className="relative">
          <Bell />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
        </Button>
      }
    >
      <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
        <p className="text-[13px] font-semibold text-fg">Notifications</p>
        {items.length > 0 && (
          <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg">
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="max-h-80 overflow-auto">
        {items.length === 0 && <p className="px-3 py-8 text-center text-xs text-muted">You&apos;re all caught up.</p>}
        {items.map((n) => (
          <div key={n.id} className={cn("flex gap-2.5 rounded-lg px-2.5 py-2", !n.read && "bg-surface-muted")}>
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", tone[n.kind])} />
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-fg">{n.title}</p>
              {n.message && <p className="text-[11.5px] text-muted">{n.message}</p>}
              <p className="mt-0.5 text-[10.5px] text-subtle">{fmtDateTime(new Date(n.at).toISOString())}</p>
            </div>
          </div>
        ))}
      </div>
    </Popover>
  );
}

export function switchAccount(u: Session): void {
  const ui = useUIStore.getState();
  const data = useDataStore.getState();
  const session: Session = u.role === "division_manager" ? { ...u, division: u.division && data.divisions.includes(u.division) ? u.division : data.divisions[0] ?? u.division } : u;
  ui.setSession(session);
  logAudit("auth.role_switched", "security", `${session.name} signed in as ${ROLES[session.role].label}${session.division ? ` (${session.division})` : ""}`);
  void data.reload();
  ui.notify("info", `Signed in as ${session.name}`, `${ROLES[session.role].label}${session.division ? ` · scope: ${session.division}` : ""}`);
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const session = useUIStore((s) => s.session);
  const divisions = useDataStore((s) => s.divisions);
  const router = useRouter();
  const role = ROLES[session.role];
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="right"
      width={310}
      trigger={
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-xl py-1 pr-2 pl-1 transition-colors hover:bg-surface-muted" aria-label="Account">
          <Avatar name={session.name} size={32} />
          <span className="hidden text-left leading-tight xl:block">
            <span className="block text-[12.5px] font-semibold text-fg">{session.name}</span>
            <span className="block text-[10.5px] text-muted">{role.label}</span>
          </span>
        </button>
      }
    >
      <div className="flex items-center gap-3 border-b border-line px-2.5 pt-1.5 pb-3">
        <Avatar name={session.name} size={40} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-fg">{session.name}</p>
          <p className="truncate text-[11px] text-muted">{session.email}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: role.color }}>
            <ShieldCheck className="h-3 w-3" /> {role.label}
            {session.division ? ` · ${session.division}` : ""}
          </span>
        </div>
      </div>
      <p className="px-2.5 pt-2.5 pb-1 text-[10px] font-semibold tracking-wider text-subtle uppercase">{LOCAL_ONLY ? "Switch local profile" : "Switch account · Azure AD (demo)"}</p>
      {DEMO_USERS.map((u) => (
        <MenuItem
          key={u.userId}
          icon={<UserRound />}
          active={u.userId === session.userId}
          hint={ROLES[u.role].label}
          onClick={() => {
            setOpen(false);
            switchAccount(u);
          }}
        >
          {u.name}
        </MenuItem>
      ))}
      {session.role === "division_manager" && divisions.length > 0 && (
        <div className="px-2.5 py-2">
          <label className="text-[10.5px] font-semibold text-subtle uppercase">Division scope</label>
          <select className="field mt-1 h-8 text-xs" value={session.division ?? ""} onChange={(e) => switchAccount({ ...session, division: e.target.value })}>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mt-1 border-t border-line pt-1">
        <Link href="/security" onClick={() => setOpen(false)}>
          <MenuItem icon={<ShieldCheck />}>Security & permissions</MenuItem>
        </Link>
        <MenuItem
          icon={<LogOut />}
          danger
          onClick={() => {
            logAudit("auth.signed_out", "security", session.name);
            router.push("/login");
          }}
        >
          Sign out
        </MenuItem>
      </div>
    </Popover>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const page = findNav(pathname);
  const setMobileNav = useUIStore((s) => s.setMobileNav);
  const setFilterPane = useUIStore((s) => s.setFilterPane);
  const filters = useDataStore((s) => s.filters);
  const count = activeFilterCount(filters);
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface-strong/85 backdrop-blur-xl" data-no-capture="true">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
          <Menu />
        </Button>
        <div className="hidden min-w-0 shrink-0 md:block md:w-48 xl:w-56">
          <div className="flex items-center gap-1 text-[10.5px] font-medium text-subtle">
            <span>ATOMA</span>
            <ChevronRight className="h-3 w-3" />
            <span>{page.section}</span>
          </div>
          <p className="truncate text-[14px] font-semibold text-fg">{page.label}</p>
        </div>
        <div className="hidden min-w-0 flex-1 justify-center md:flex">
          <div className="w-full max-w-lg">
            <SearchBox />
          </div>
        </div>
        <div className="flex-1 md:hidden" />
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search">
            <Search />
          </Button>
          <Button variant="secondary" size="md" onClick={() => setFilterPane(true)} className="relative px-3" aria-label="Filters">
            <Filter />
            <span className="hidden sm:inline">Filters</span>
            {count > 0 && <Badge tone="accent" className="ml-0.5 px-1.5">{count}</Badge>}
          </Button>
          <ExportMenu />
          <ThemeMenu />
          <NotificationMenu />
          <UserMenu />
        </div>
      </div>
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search" size="sm">
        <div className="min-h-[50vh]">
          <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      </Modal>
    </header>
  );
}
