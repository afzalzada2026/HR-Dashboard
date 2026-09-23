"use client";

import {
  CheckCircle2, Cloud, Database, Download, FileSpreadsheet, FileText, FileUp, FolderOpen, HardDrive, Lock, RefreshCw, Sparkles, Table2, Trash2, UploadCloud, Wand2, X, Zap,
} from "lucide-react";
import Link from "next/link";
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadTemplate, EMPLOYEE_COLUMNS, exportEmployeesXLSX } from "@/lib/exporters";
import { FIELD_DEFS, FIELD_LABEL } from "@/lib/fields";
import { cn, fmtBytes, fmtDateTime, fmtNum, fmtPct, slugify } from "@/lib/format";
import { autoMap, tableFromMatrix } from "@/lib/mapping";
import { normalizeRows } from "@/lib/normalize";
import { can, ROLES } from "@/lib/rbac";
import { getAdapter } from "@/lib/storage";
import type { DatasetMeta, FieldKey, StorageMode } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, ProgressBar, Segmented, Spinner } from "../ui/primitives";

interface Parsed {
  file: File;
  sheets: { name: string; matrix: unknown[][] }[];
  sheet: number;
  headers: string[];
  rows: Record<string, unknown>[];
  headerRow: number;
  mapping: Partial<Record<FieldKey, string>>;
  confidence: Partial<Record<FieldKey, number>>;
}

async function parseFile(file: File): Promise<{ name: string; matrix: unknown[][] }[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "txt") {
    const Papa = (await import("papaparse")).default;
    const text = await file.text();
    const res = Papa.parse<unknown[]>(text, { skipEmptyLines: "greedy" });
    return [{ name: "CSV", matrix: res.data }];
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb.SheetNames.map((name) => ({ name, matrix: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: "", blankrows: false }) }));
}

function build(file: File, sheets: Parsed["sheets"], sheet: number): Parsed {
  const table = tableFromMatrix(sheets[sheet]?.matrix ?? []);
  const { mapping, confidence } = autoMap(table.headers);
  return { file, sheets, sheet, ...table, mapping, confidence };
}

function confBadge(c: number | undefined, mapped: boolean) {
  if (!mapped) return <Badge tone="neutral">Unmapped</Badge>;
  if (c === undefined) return <Badge tone="accent">Manual</Badge>;
  if (c >= 0.99) return <Badge tone="success">Exact</Badge>;
  if (c >= 0.8) return <Badge tone="primary">High {Math.round(c * 100)}%</Badge>;
  return <Badge tone="warning">Review {Math.round(c * 100)}%</Badge>;
}

function Uploader({ onImported }: { onImported: () => void }) {
  const session = useUIStore((s) => s.session);
  const notify = useUIStore((s) => s.notify);
  const importDataset = useDataStore((s) => s.importDataset);
  const allowed = can(session.role, "upload_data");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ meta: DatasetMeta; rows: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    if (!allowed) return notify("warning", "Upload not permitted", `${ROLES[session.role].label} role cannot upload datasets.`);
    if (!/\.(xlsx|xls|csv|txt)$/i.test(file.name)) return notify("error", "Unsupported file", "Please upload an Excel (.xlsx) or CSV (.csv) file.");
    setDone(null);
    setBusy(`Reading ${file.name}…`);
    try {
      const sheets = await parseFile(file);
      const best = sheets.reduce((bi, s, i) => (s.matrix.length > (sheets[bi]?.matrix.length ?? 0) ? i : bi), 0);
      const p = build(file, sheets, best);
      if (!p.rows.length) throw new Error("No data rows detected in the file.");
      setParsed(p);
      setName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
      notify("info", "File parsed", `${fmtNum(p.rows.length)} rows · ${Object.keys(p.mapping).length}/29 fields auto-mapped`);
    } catch (e) {
      notify("error", "Could not read file", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handle(f);
  };

  const mappedCount = parsed ? Object.values(parsed.mapping).filter(Boolean).length : 0;
  const missingImportant = parsed ? FIELD_DEFS.filter((d) => d.important && !parsed.mapping[d.key]) : [];

  const doImport = async () => {
    if (!parsed) return;
    setBusy(`Normalizing & importing ${fmtNum(parsed.rows.length)} rows…`);
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { employees, quality } = normalizeRows(parsed.rows, parsed.mapping, Date.now());
      if (!employees.length) throw new Error("No valid employee rows (each row needs a name or employee number).");
      const ext = parsed.file.name.split(".").pop()?.toLowerCase() ?? "file";
      const meta = await importDataset({ name: name.trim() || parsed.file.name, fileName: parsed.file.name, fileType: ext, fileSize: parsed.file.size, columnCount: parsed.headers.length, mapping: parsed.mapping, quality, source: "upload", employees });
      setDone({ meta, rows: employees.length });
      setParsed(null);
      notify("success", "Dataset imported", `${fmtNum(employees.length)} employees · ${fmtPct(quality.completeness * 100)} complete`);
      onImported();
    } catch (e) {
      notify("error", "Import failed", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  if (busy)
    return (
      <Card className="flex min-h-[300px] flex-col items-center justify-center gap-3">
        <Spinner className="h-8 w-8 text-accent" />
        <p className="text-sm font-medium text-fg">{busy}</p>
        <p className="text-xs text-muted">Large files are processed entirely in your browser.</p>
      </Card>
    );

  if (parsed) {
    const preview = parsed.rows.slice(0, 6);
    const previewKeys: FieldKey[] = ["employeeNo", "fullName", "title", "division", "department", "gender", "joinDate", "dutyStation", "region"];
    return (
      <Card className="animate-fade-up">
        <CardTitle
          icon={<Wand2 />}
          title="Review column mapping"
          subtitle={`${parsed.file.name} · ${fmtBytes(parsed.file.size)} · ${fmtNum(parsed.rows.length)} rows · header detected on row ${parsed.headerRow + 1}`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => setParsed(null)}>
              <X /> Cancel
            </Button>
          }
        />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {parsed.sheets.length > 1 && (
            <select className="field h-9 w-auto" value={parsed.sheet} onChange={(e) => setParsed(build(parsed.file, parsed.sheets, Number(e.target.value)))}>
              {parsed.sheets.map((s, i) => (
                <option key={s.name} value={i}>
                  Sheet: {s.name} ({s.matrix.length} rows)
                </option>
              ))}
            </select>
          )}
          <Badge tone={mappedCount >= 20 ? "success" : mappedCount >= 10 ? "warning" : "danger"}>{mappedCount}/29 fields mapped</Badge>
          {missingImportant.length > 0 && <Badge tone="warning">Missing key fields: {missingImportant.map((d) => d.label).join(", ")}</Badge>}
        </div>
        <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {FIELD_DEFS.map((d) => {
            const h = parsed.mapping[d.key];
            const sample = h ? String(parsed.rows[0]?.[h] ?? "") : "";
            return (
              <div key={d.key} className={cn("rounded-xl border p-2.5", h ? "border-line" : d.important ? "border-warning/40 bg-warning/5" : "border-line bg-surface-muted/40")}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-fg">
                    {d.label}
                    {d.important && <span className="text-warning"> *</span>}
                  </span>
                  {confBadge(parsed.confidence[d.key], !!h)}
                </div>
                <select
                  className="field mt-1.5 h-8 text-xs"
                  value={h ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const mapping = { ...parsed.mapping };
                    const confidence = { ...parsed.confidence };
                    if (v) mapping[d.key] = v;
                    else delete mapping[d.key];
                    delete confidence[d.key];
                    setParsed({ ...parsed, mapping, confidence });
                  }}
                >
                  <option value="">— Not mapped —</option>
                  {parsed.headers.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                {sample && <p className="mt-1 truncate text-[10.5px] text-subtle">e.g. {sample}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-4 mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
          <Table2 className="h-3.5 w-3.5" /> Preview (mapped)
        </p>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[760px] text-left text-[11.5px]">
            <thead className="bg-surface-muted">
              <tr>
                {previewKeys.map((k) => (
                  <th key={k} className="px-2.5 py-2 font-semibold whitespace-nowrap text-muted">
                    {FIELD_LABEL[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {previewKeys.map((k) => (
                    <td key={k} className="max-w-[160px] truncate px-2.5 py-1.5 text-fg">
                      {parsed.mapping[k] ? String(r[parsed.mapping[k] as string] ?? "") : <span className="text-subtle">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-muted uppercase">Dataset name</label>
            <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button variant="primary" size="lg" onClick={doImport} disabled={mappedCount === 0}>
            <FileUp /> Import {fmtNum(parsed.rows.length)} employees
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-up">
      <CardTitle icon={<UploadCloud />} title="Upload workforce data" subtitle="Excel (.xlsx) or CSV (.csv) · columns are auto-mapped to the 29-field ATOMA HR schema" />
      {done && (
        <div className="animate-pop mb-4 flex flex-col gap-3 rounded-xl border border-success/30 bg-success/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-success" />
            <div>
              <p className="text-[13px] font-semibold text-fg">{done.meta.name} is now the active dataset</p>
              <p className="text-[12px] text-muted">
                {fmtNum(done.rows)} employees · {done.meta.quality ? `${fmtPct(done.meta.quality.completeness * 100)} complete` : ""} · stored in {done.meta.storage}
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="primary" size="sm">
              <Sparkles /> Open dashboard
            </Button>
          </Link>
        </div>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => allowed && input.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all",
          drag ? "scale-[1.01] border-accent bg-accent/10" : "border-line-strong hover:border-accent/60 hover:bg-surface-muted",
          !allowed && "cursor-not-allowed opacity-60"
        )}
      >
        <div className={cn("grid h-16 w-16 place-items-center rounded-2xl bg-linear-to-br from-brand-700 to-brand-400 text-white shadow-[0_14px_30px_-12px_rgba(0,168,255,0.8)]", drag && "animate-bounce")}>
          {allowed ? <UploadCloud className="h-8 w-8" /> : <Lock className="h-7 w-7" />}
        </div>
        <p className="mt-4 text-[15px] font-semibold text-fg">{allowed ? "Drag & drop your HR file here" : "Your role cannot upload datasets"}</p>
        <p className="mt-1 text-[12.5px] text-muted">or click to browse · XLSX, XLS, CSV · multi-sheet workbooks supported · title rows auto-skipped</p>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {["HRIS No", "Employee Full Name", "Division", "Department", "Date of Joining", "Region / Province", "+23 more"].map((f) => (
            <Badge key={f}>{f}</Badge>
          ))}
        </div>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handle(f);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => allowed && input.current?.click()} disabled={!allowed}>
          <FolderOpen /> Browse file
        </Button>
        <Button size="sm" variant="ghost" onClick={() => downloadTemplate("xlsx")}>
          <FileSpreadsheet /> Excel template
        </Button>
        <Button size="sm" variant="ghost" onClick={() => downloadTemplate("csv")}>
          <FileText /> CSV template
        </Button>
      </div>
    </Card>
  );
}

function RecentFiles({ refreshKey }: { refreshKey: number }) {
  const mode = useUIStore((s) => s.storageMode);
  const session = useUIStore((s) => s.session);
  const notify = useUIStore((s) => s.notify);
  const active = useDataStore((s) => s.dataset);
  const loadDataset = useDataStore((s) => s.loadDataset);
  const reload = useDataStore((s) => s.reload);
  const [list, setList] = useState<DatasetMeta[] | null>(null);
  const [err, setErr] = useState("");
  const canDelete = mode === "local" ? can(session.role, "upload_data") : can(session.role, "delete_data");

  const load = useCallback(async () => {
    try {
      setList(await getAdapter(mode).list());
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unavailable");
      setList([]);
    }
  }, [mode]);
  useEffect(() => {
    void load();
  }, [load, refreshKey, active?.id]);

  const download = async (d: DatasetMeta) => {
    try {
      const res = await getAdapter(mode).get(d.id);
      if (!res) throw new Error("Dataset not found");
      await exportEmployeesXLSX(res.employees, EMPLOYEE_COLUMNS, `${slugify(d.name)}.xlsx`);
    } catch (e) {
      notify("error", "Download failed", e instanceof Error ? e.message : undefined);
    }
  };
  const remove = async (d: DatasetMeta) => {
    if (!window.confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    try {
      await getAdapter(mode).remove(d.id);
      notify("info", "Dataset deleted", d.name);
      if (active?.id === d.id) await reload();
      await load();
    } catch (e) {
      notify("error", "Delete failed", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <Card className="animate-fade-up">
      <CardTitle
        icon={<FolderOpen />}
        title="Recent files"
        subtitle={err ? `Storage unavailable: ${err}` : `${mode === "server" ? "PostgreSQL" : "Browser IndexedDB"} · ${list?.length ?? 0} datasets`}
        actions={
          <Button size="icon-sm" variant="ghost" onClick={() => load()} aria-label="Refresh list">
            <RefreshCw />
          </Button>
        }
      />
      {list === null ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon={<Database />} title="No stored datasets" description="Upload a file or generate a demo workforce to get started." />
      ) : (
        <div className="space-y-2">
          {list.map((d) => {
            const isActive = active?.id === d.id;
            const Icon = d.source === "demo" ? Zap : d.fileType === "csv" ? FileText : FileSpreadsheet;
            return (
              <div key={d.id} className={cn("flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center", isActive ? "border-accent/50 bg-accent/6" : "border-line")}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-[13px] font-semibold text-fg">
                    {d.name} {isActive && <Badge tone="success">Active</Badge>}
                  </p>
                  <p className="text-[11.5px] text-muted">
                    {fmtNum(d.rowCount)} rows · {d.fileType.toUpperCase()} {d.fileSize ? `· ${fmtBytes(d.fileSize)}` : ""} · {d.uploadedBy} ({ROLES[d.uploadedRole as keyof typeof ROLES]?.label ?? d.uploadedRole}) · {fmtDateTime(d.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {!isActive && (
                    <Button size="xs" variant="soft" onClick={() => loadDataset(d.id)}>
                      Load
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" onClick={() => download(d)} aria-label="Download dataset">
                    <Download />
                  </Button>
                  {canDelete && (
                    <Button size="icon-sm" variant="ghost" onClick={() => remove(d)} aria-label="Delete dataset" className="hover:text-danger">
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function QualityCard() {
  const dataset = useDataStore((s) => s.dataset);
  const q = dataset?.quality;
  const missing = useMemo(() => (q ? Object.entries(q.missing).filter(([, v]) => (v ?? 0) > 0).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 8) : []), [q]);
  if (!dataset) return null;
  return (
    <Card className="animate-fade-up">
      <CardTitle icon={<CheckCircle2 />} title="Data quality" subtitle={dataset.name} />
      {!q ? (
        <p className="text-sm text-muted">No quality report available.</p>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#00A8FF ${q.completeness * 360}deg, var(--surface-muted) 0deg)` }}>
              <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-surface-solid">
                <span className="text-lg font-bold text-fg">{fmtPct(q.completeness * 100, 0)}</span>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 text-[12px]">
              {[
                ["Valid rows", fmtNum(q.validRows)],
                ["Skipped", fmtNum(q.skippedRows)],
                ["Duplicate IDs", fmtNum(q.duplicateIds)],
                ["Invalid dates", fmtNum(q.invalidDates)],
                ["Unmatched provinces", fmtNum(q.unmatchedProvinces)],
                ["Mapped fields", `${Object.keys(dataset.mapping).length}/29`],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-surface-muted px-2 py-1.5">
                  <p className="text-[10px] text-subtle uppercase">{l}</p>
                  <p className="font-semibold text-fg">{v}</p>
                </div>
              ))}
            </div>
          </div>
          {missing.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Most incomplete fields</p>
              {missing.map(([k, v]) => (
                <div key={k}>
                  <div className="flex justify-between text-[11.5px]">
                    <span className="text-fg">{FIELD_LABEL[k as FieldKey]}</span>
                    <span className="text-muted">
                      {fmtNum(v ?? 0)} missing ({fmtPct(((v ?? 0) / Math.max(1, q.validRows)) * 100)})
                    </span>
                  </div>
                  <ProgressBar value={((v ?? 0) / Math.max(1, q.validRows)) * 100} color="linear-gradient(90deg,#F79009,#F04438)" className="mt-1" />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function DataView() {
  const mode = useUIStore((s) => s.storageMode);
  const setMode = useUIStore((s) => s.setStorageMode);
  const role = useUIStore((s) => s.session.role);
  const notify = useUIStore((s) => s.notify);
  const loadDemo = useDataStore((s) => s.loadDemo);
  const reload = useDataStore((s) => s.reload);
  const status = useDataStore((s) => s.status);
  const [size, setSize] = useState(1250);
  const [refresh, setRefresh] = useState(0);
  const allowed = can(role, "upload_data");

  const switchMode = async (m: StorageMode) => {
    setMode(m);
    notify("info", m === "local" ? "Local mode enabled" : "Enterprise mode enabled", m === "local" ? "Data stays in this browser (IndexedDB) — no server required." : "Datasets are stored centrally in PostgreSQL with audit logging.");
    await reload();
    setRefresh((r) => r + 1);
  };

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Data sources"
        icon={<Database />}
        subtitle="Import Excel / CSV, auto-map HR columns, validate quality and manage stored datasets"
        actions={<Segmented value={mode} onChange={switchMode} options={[{ value: "server", label: "Enterprise · PostgreSQL", icon: <Cloud /> }, { value: "local", label: "Local · No server", icon: <HardDrive /> }]} />}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Uploader onImported={() => setRefresh((r) => r + 1)} />
          <RecentFiles refreshKey={refresh} />
        </div>
        <div className="space-y-4">
          <Card className="animate-fade-up">
            <CardTitle icon={<Zap />} title="Demo workforce generator" subtitle="Realistic ATOMA data across all 34 provinces" />
            <p className="text-[12.5px] text-muted">Generates a coherent hierarchy (CEO → division heads → department heads → team leads → staff) with the exact 29-field schema, then runs it through the same auto-mapping pipeline as uploads.</p>
            <div className="mt-3 flex gap-2">
              <select className="field" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                {[500, 1250, 2500, 5000, 10000, 15000].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString()} employees{n >= 10000 ? " (stress test)" : ""}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                disabled={status === "loading"}
                onClick={async () => {
                  await loadDemo(size);
                  setRefresh((r) => r + 1);
                }}
              >
                {status === "loading" ? <Spinner /> : allowed ? <Sparkles /> : <Zap />} Generate
              </Button>
            </div>
            {!allowed && <p className="mt-2 text-[11.5px] text-warning">Your role will load the demo in memory only (not persisted).</p>}
          </Card>
          <QualityCard />
          <Card className="animate-fade-up">
            <CardTitle icon={<Table2 />} title="Field dictionary" subtitle="29 canonical HR fields & recognised synonyms" />
            <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-1">
              {FIELD_DEFS.map((d) => (
                <div key={d.key} className="rounded-lg border border-line px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-fg">{d.label}</span>
                    <span className="text-[10px] text-subtle uppercase">{d.group}</span>
                  </div>
                  <p className="truncate text-[10.5px] text-muted" title={d.synonyms.join(", ")}>
                    {d.synonyms.slice(0, 5).join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
