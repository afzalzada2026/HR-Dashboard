"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, FileSpreadsheet, FileText, Lock, RotateCcw, Search, Users } from "lucide-react";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { exportCSV, exportEmployeesXLSX, type ExportColumn } from "@/lib/exporters";
import { cn, fmtDate, fmtNum, timestampSlug } from "@/lib/format";
import { can } from "@/lib/rbac";
import { logAudit } from "@/lib/storage";
import type { Employee } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { DataGate } from "../shell/Chrome";
import { Avatar, Badge, Button, PageHeader, Popover } from "../ui/primitives";

interface Col {
  key: string;
  label: string;
  width: number;
  get: (e: Employee) => string | number;
  num?: boolean;
  def?: boolean;
  render?: (e: Employee) => ReactNode;
}

const r1 = (n: number | null) => (n === null ? "" : Math.round(n * 10) / 10);

const COLS: Col[] = [
  {
    key: "fullName", label: "Employee Name", width: 260, def: true, get: (e) => e.fullName,
    render: (e) => (
      <span className="flex min-w-0 items-center gap-2.5">
        <Avatar name={e.fullName} size={30} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-fg">{e.fullName}</span>
          <span className="block truncate text-[11px] text-muted">{e.level}</span>
        </span>
      </span>
    ),
  },
  { key: "employeeNo", label: "ID", width: 110, def: true, get: (e) => e.employeeNo },
  { key: "title", label: "Title", width: 210, def: true, get: (e) => e.title },
  { key: "division", label: "Division", width: 160, def: true, get: (e) => e.division },
  { key: "department", label: "Department", width: 190, def: true, get: (e) => e.department },
  { key: "supervisor", label: "Supervisor", width: 180, def: true, get: (e) => e.supervisor },
  { key: "contactNumber", label: "Phone", width: 150, def: true, get: (e) => e.contactNumber },
  { key: "email", label: "Email", width: 240, def: true, get: (e) => e.email },
  { key: "qualification", label: "Qualification", width: 130, def: true, get: (e) => e.qualificationGroup, render: (e) => <Badge tone="primary">{e.qualificationGroup}</Badge> },
  { key: "location", label: "Location", width: 160, def: true, get: (e) => e.dutyStation },
  { key: "hrisNo", label: "HRIS No", width: 110, get: (e) => e.hrisNo },
  { key: "gender", label: "Gender", width: 95, get: (e) => e.gender },
  { key: "age", label: "Age", width: 70, num: true, get: (e) => (e.age === null ? "" : Math.floor(e.age)) },
  { key: "tenure", label: "Tenure (yrs)", width: 105, num: true, get: (e) => r1(e.tenure) },
  { key: "joinDate", label: "Joining Date", width: 120, get: (e) => e.joinDate, render: (e) => <span>{fmtDate(e.joinDate)}</span> },
  { key: "level", label: "Actual Level", width: 150, get: (e) => e.level },
  { key: "nationality", label: "Nationality", width: 115, get: (e) => e.nationality },
  { key: "expatLocal", label: "Expat / Local", width: 110, get: (e) => e.expatLocal },
  { key: "province", label: "Province", width: 120, get: (e) => e.province },
  { key: "region", label: "Region", width: 130, get: (e) => e.region },
  { key: "maritalStatus", label: "Marital Status", width: 120, get: (e) => e.maritalStatus },
  { key: "bloodGroup", label: "Blood Group", width: 100, get: (e) => e.bloodGroup },
  { key: "status", label: "Status", width: 100, get: (e) => e.status, render: (e) => <Badge tone={e.status === "Active" ? "success" : "danger"}>{e.status}</Badge> },
];
const DEFAULT_VISIBLE = COLS.filter((c) => c.def).map((c) => c.key);
const PAGE_SIZES = [25, 50, 100, 250, 500, 0];

function DirectoryInner() {
  const filtered = useDataStore((s) => s.filtered);
  const total = useDataStore((s) => s.employees.length);
  const openEmployee = useUIStore((s) => s.openEmployee);
  const role = useUIStore((s) => s.session.role);
  const notify = useUIStore((s) => s.notify);
  const canExport = can(role, "export_data");
  const [q, setQ] = useState("");
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>({ key: "fullName", dir: 1 });
  const [visible, setVisible] = useState<string[]>(DEFAULT_VISIBLE);
  const [colsOpen, setColsOpen] = useState(false);
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const cols = useMemo(() => COLS.filter((c) => visible.includes(c.key)), [visible]);
  const totalWidth = cols.reduce((s, c) => s + c.width, 0);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    let res = filtered;
    if (s) res = res.filter((e) => `${e.fullName} ${e.employeeNo} ${e.hrisNo} ${e.title} ${e.department} ${e.division} ${e.email} ${e.contactNumber} ${e.dutyStation} ${e.supervisor}`.toLowerCase().includes(s));
    const active = Object.entries(colFilters).filter(([, v]) => v.trim());
    if (active.length) {
      const getters = active.map(([k, v]) => [COLS.find((c) => c.key === k)?.get, v.trim().toLowerCase()] as const);
      res = res.filter((e) => getters.every(([g, v]) => !g || String(g(e)).toLowerCase().includes(v)));
    }
    if (sort) {
      const col = COLS.find((c) => c.key === sort.key);
      if (col) {
        res = [...res].sort((a, b) => {
          const x = col.get(a);
          const y = col.get(b);
          if (col.num) return ((Number(x) || 0) - (Number(y) || 0)) * sort.dir;
          return String(x).localeCompare(String(y)) * sort.dir;
        });
      }
    }
    return res;
  }, [filtered, q, colFilters, sort]);

  const size = pageSize || rows.length || 1;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const safePage = Math.min(page, pages - 1);
  const paged = useMemo(() => (pageSize ? rows.slice(safePage * size, safePage * size + size) : rows), [rows, pageSize, safePage, size]);

  const virtualizer = useVirtualizer({ count: paged.length, getScrollElement: () => scrollRef.current, estimateSize: () => 52, overscan: 12 });
  const items = virtualizer.getVirtualItems();

  const toggleSort = (key: string) => setSort((s) => (!s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null));
  const exportCols: ExportColumn[] = cols.map((c) => ({ key: c.key, label: c.label, get: c.get }));
  const doExport = async (kind: "csv" | "xlsx") => {
    const name = `atoma-directory-${timestampSlug()}.${kind}`;
    if (kind === "csv") await exportCSV(rows, exportCols, name);
    else await exportEmployeesXLSX(rows, exportCols, name);
    logAudit(`directory.export_${kind}`, "export", `${rows.length} employees · ${cols.length} columns`);
    notify("success", "Directory exported", `${fmtNum(rows.length)} rows · ${kind.toUpperCase()}`);
  };

  const from = rows.length ? safePage * size + 1 : 0;
  const to = pageSize ? Math.min(rows.length, (safePage + 1) * size) : rows.length;

  return (
    <>
      <PageHeader eyebrow="Workforce" title="Employee directory" icon={<Users />} subtitle={`${fmtNum(rows.length)} of ${fmtNum(total)} employees · virtualized grid with frozen header & first column`} />
      <div className="glass animate-fade-up rounded-2xl">
        <div className="flex flex-col gap-2 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between" data-no-capture="true">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Global search: name, ID, title, email, phone, location…"
              className="field h-10 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Object.values(colFilters).some((v) => v) && (
              <Button size="sm" variant="ghost" onClick={() => setColFilters({})}>
                <RotateCcw /> Reset column filters
              </Button>
            )}
            <Popover
              open={colsOpen}
              onOpenChange={setColsOpen}
              align="right"
              width={260}
              trigger={
                <Button size="sm" onClick={() => setColsOpen((v) => !v)}>
                  <Columns3 /> Columns ({cols.length})
                </Button>
              }
            >
              <div className="flex items-center justify-between px-2 pt-1 pb-2">
                <span className="text-[11px] font-semibold text-subtle uppercase">Column selection</span>
                <button type="button" className="text-[11px] font-medium text-primary dark:text-accent" onClick={() => setVisible(DEFAULT_VISIBLE)}>
                  Reset
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {COLS.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-fg hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      className="accent-[#00A8FF]"
                      checked={visible.includes(c.key)}
                      disabled={c.key === "fullName"}
                      onChange={(e) => setVisible((v) => (e.target.checked ? COLS.map((x) => x.key).filter((k) => v.includes(k) || k === c.key) : v.filter((k) => k !== c.key)))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </Popover>
            <Button size="sm" onClick={() => doExport("csv")} disabled={!canExport}>
              {canExport ? <FileText /> : <Lock />} CSV
            </Button>
            <Button size="sm" variant="primary" onClick={() => doExport("xlsx")} disabled={!canExport}>
              {canExport ? <FileSpreadsheet /> : <Lock />} Excel
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="relative overflow-auto" style={{ height: "max(440px, calc(100vh - 360px))" }}>
          <div style={{ width: totalWidth, minWidth: "100%" }}>
            <div className="sticky top-0 z-20 bg-surface-strong shadow-[0_1px_0_var(--border)]">
              <div className="flex">
                {cols.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={cn("flex h-10 shrink-0 items-center gap-1 px-3 text-left text-[10.5px] font-bold tracking-wider text-muted uppercase hover:text-fg", i === 0 && "sticky left-0 z-10 bg-surface-strong", c.num && "justify-end")}
                    style={{ width: c.width }}
                  >
                    <span className="truncate">{c.label}</span>
                    {sort?.key === c.key ? sort.dir === 1 ? <ArrowUp className="h-3 w-3 text-accent" /> : <ArrowDown className="h-3 w-3 text-accent" /> : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                  </button>
                ))}
              </div>
              <div className="flex border-t border-line pb-1.5" data-no-capture="true">
                {cols.map((c, i) => (
                  <div key={c.key} className={cn("shrink-0 px-2 pt-1.5", i === 0 && "sticky left-0 z-10 bg-surface-strong")} style={{ width: c.width }}>
                    <input
                      value={colFilters[c.key] ?? ""}
                      onChange={(e) => {
                        setColFilters((f) => ({ ...f, [c.key]: e.target.value }));
                        setPage(0);
                      }}
                      placeholder="Filter…"
                      className="field h-7 rounded-md px-2 text-[11px]"
                      aria-label={`Filter ${c.label}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
              {items.map((vi) => {
                const e = paged[vi.index];
                return (
                  <div
                    key={e.id}
                    onClick={() => openEmployee(e.id)}
                    className="group absolute left-0 flex cursor-pointer border-b border-line text-[12.5px] transition-colors hover:bg-accent/6"
                    style={{ transform: `translateY(${vi.start}px)`, height: vi.size, width: totalWidth, minWidth: "100%" }}
                  >
                    {cols.map((c, i) => (
                      <div
                        key={c.key}
                        className={cn("flex shrink-0 items-center overflow-hidden px-3 text-fg", i === 0 && "sticky left-0 z-[5] bg-surface-solid group-hover:bg-surface-strong", c.num && "justify-end tabular-nums")}
                        style={{ width: c.width }}
                      >
                        {c.render ? c.render(e) : <span className="truncate">{String(c.get(e) || "—")}</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {!rows.length && <p className="py-16 text-center text-sm text-muted">No employees match your search.</p>}
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-line px-3 py-2.5 text-[12px] text-muted sm:flex-row" data-no-capture="true">
          <div className="flex items-center gap-2">
            Rows per page
            <select
              className="field h-8 w-24 text-xs"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
            >
              {PAGE_SIZES.map((p) => (
                <option key={p} value={p}>
                  {p === 0 ? "All" : p}
                </option>
              ))}
            </select>
            <span>
              {fmtNum(from)}–{fmtNum(to)} of {fmtNum(rows.length)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="ghost" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            {Array.from({ length: pages }, (_, i) => i)
              .filter((i) => i === 0 || i === pages - 1 || Math.abs(i - safePage) <= 1)
              .map((i, idx, arr) => (
                <span key={i} className="flex items-center">
                  {idx > 0 && arr[idx - 1] !== i - 1 && <span className="px-1">…</span>}
                  <button type="button" onClick={() => setPage(i)} className={cn("h-8 min-w-8 rounded-lg px-2 text-xs font-semibold", i === safePage ? "bg-accent text-white" : "hover:bg-surface-muted")}>
                    {i + 1}
                  </button>
                </span>
              ))}
            <Button size="icon-sm" variant="ghost" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function DirectoryView() {
  return (
    <DataGate allowEmptyFilter>
      <DirectoryInner />
    </DataGate>
  );
}
