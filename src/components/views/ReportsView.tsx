"use client";

import { CalendarClock, Camera, Clock, FileDown, FileSpreadsheet, FileText, History, Image as ImageIcon, Lock, Mail, Play, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { computeKpis, countBy, hiringTrend, strategicMetrics } from "@/lib/analytics";
import { EMPLOYEE_COLUMNS, exportCSV, exportExecutivePDF, exportWorkbook } from "@/lib/exporters";
import { describeFilters } from "@/lib/filters";
import { cn, fmtDate, fmtDateTime, fmtNum, fmtPct, timestampSlug } from "@/lib/format";
import { executiveSummary } from "@/lib/insights";
import { can, ROLES } from "@/lib/rbac";
import { computeNextRun, describeSchedule, type Frequency, WEEKDAYS } from "@/lib/schedule";
import type { AuditLog, ScheduledReport } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import EChart from "../charts/EChart";
import { barOption, donutOption, trendOption } from "../charts/options";
import { useChartTokens } from "../charts/tokens";
import { LogoMark } from "../shell/Logo";
import { DataGate } from "../shell/Chrome";
import { runExport } from "../shell/Topbar";
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, Segmented, Spinner, Switch } from "../ui/primitives";

const SECTIONS = ["Executive KPIs", "Strategic metrics", "AI insights", "Division scorecard", "Employee list", "Afghanistan map"];

function ReportPreview() {
  const filtered = useDataStore((s) => s.filtered);
  const now = useDataStore((s) => s.now);
  const dataset = useDataStore((s) => s.dataset);
  const filters = useDataStore((s) => s.filters);
  const session = useUIStore((s) => s.session);
  const t = useChartTokens();
  const k = useMemo(() => computeKpis(filtered, now, now), [filtered, now]);
  const s = useMemo(() => strategicMetrics(filtered, now), [filtered, now]);
  const summary = useMemo(() => executiveSummary(filtered, now), [filtered, now]);
  const divs = useMemo(() => countBy(filtered, (e) => e.division), [filtered]);
  const genders = useMemo(() => countBy(filtered, (e) => e.gender), [filtered]);
  const trend = useMemo(() => hiringTrend(filtered, now, 18), [filtered, now]);
  const scope = describeFilters(filters);
  const tiles: [string, string][] = [
    ["Total employees", fmtNum(k.total)], ["Female share", fmtPct(k.femalePct)], ["Average age", k.avgAge.toFixed(1)], ["Average tenure", `${k.avgTenure.toFixed(1)} yrs`],
    ["Hires (12m)", fmtNum(s.hires12m)], ["Headcount growth", s.headcountGrowth === null ? "—" : fmtPct(s.headcountGrowth)], ["Turnover", fmtPct(s.turnoverRate)], ["Span of control", s.avgSpan.toFixed(1)],
  ];
  return (
    <div id="report-preview" className="glass overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-3 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between" style={{ background: "linear-gradient(135deg,#062B5B,#0D47A1 60%,#00A8FF)" }}>
        <div className="flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">ATOMA · Executive Workforce Report</p>
            <h3 className="text-lg font-bold">Workforce Intelligence Briefing</h3>
          </div>
        </div>
        <div className="text-[11.5px] text-white/80 sm:text-right">
          <p>{fmtDate(new Date(now).toISOString())} · {dataset?.name}</p>
          <p>Prepared by {session.name} ({ROLES[session.role].label})</p>
          <p className="max-w-md truncate">Scope: {scope.length ? scope.join(" • ") : "Full workforce"}</p>
        </div>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {tiles.map(([l, v]) => (
            <div key={l} className="rounded-xl border border-line bg-surface-muted/60 p-3">
              <p className="text-[10px] font-semibold tracking-wider text-subtle uppercase">{l}</p>
              <p className="mt-1 text-xl font-bold text-fg tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-line p-3 lg:col-span-2">
            <p className="mb-1 text-[12px] font-semibold text-fg">Headcount by division</p>
            <EChart option={barOption(divs, t, { rotate: divs.length > 6 ? 20 : 0 })} height={230} />
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="mb-1 text-[12px] font-semibold text-fg">Gender distribution</p>
            <EChart option={donutOption(genders, t, { colors: genders.map((g) => (g.name === "Female" ? t.female : g.name === "Male" ? t.male : t.muted)) })} height={230} />
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-line p-3 lg:col-span-3">
            <p className="mb-1 text-[12px] font-semibold text-fg">Hiring momentum (18 months)</p>
            <EChart option={trendOption(trend.labels, trend.hires, trend.cumulative, t)} height={220} />
          </div>
          <div className="rounded-xl border border-line p-4 lg:col-span-2">
            <p className="text-[12px] font-semibold text-fg">Executive summary</p>
            <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-muted">
              {summary.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[10.5px] text-subtle">Confidential — contains personal data. Generated by ATOMA HR Workforce Analytics.</p>
      </div>
    </div>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function Scheduler() {
  const role = useUIStore((s) => s.session.role);
  const notify = useUIStore((s) => s.notify);
  const allowed = can(role, "manage_reports");
  const [reports, setReports] = useState<ScheduledReport[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "Weekly Executive Workforce Pack", frequency: "weekly" as Frequency, timeOfDay: "08:00", dayOfWeek: 0, dayOfMonth: 1, format: "pdf", recipients: "leadership@atoma.af", sections: ["Executive KPIs", "Strategic metrics", "AI insights"] });

  const load = useCallback(async () => {
    try {
      setReports((await api<{ reports: ScheduledReport[] }>("/api/reports")).reports);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unavailable");
      setReports([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/reports", { method: "POST", body: JSON.stringify(form) });
      notify("success", "Report scheduled", `${form.name} · ${describeSchedule(form.frequency, form.timeOfDay, form.dayOfWeek, form.dayOfMonth)}`);
      await load();
    } catch (err) {
      notify("error", "Could not schedule report", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (r: ScheduledReport) => {
    const data = useDataStore.getState();
    const ui = useUIStore.getState();
    const ctx = { title: r.name, datasetName: data.dataset?.name ?? "—", user: ui.session.name, role: ROLES[ui.session.role].label, filters: describeFilters(data.filters), employees: data.filtered, now: data.now || Date.now() };
    try {
      if (r.format === "pdf") await exportExecutivePDF(ctx);
      else if (r.format === "xlsx") await exportWorkbook(ctx);
      else if (r.format === "csv") await exportCSV(data.filtered, EMPLOYEE_COLUMNS, `atoma-${timestampSlug()}.csv`);
      else await runExport("png", r.name, "report-preview");
      await api(`/api/reports/${r.id}`, { method: "PATCH", body: JSON.stringify({ run: true }) });
      notify("success", "Report generated", `${r.name} delivered to ${r.recipients || "your downloads"} (simulated email delivery).`);
      await load();
    } catch (err) {
      notify("error", "Run failed", err instanceof Error ? err.message : undefined);
    }
  };
  const setActive = async (r: ScheduledReport, v: boolean) => {
    try {
      await api(`/api/reports/${r.id}`, { method: "PATCH", body: JSON.stringify({ isActive: v }) });
      await load();
    } catch (err) {
      notify("error", "Update failed", err instanceof Error ? err.message : undefined);
    }
  };
  const remove = async (r: ScheduledReport) => {
    try {
      await api(`/api/reports/${r.id}`, { method: "DELETE" });
      notify("info", "Schedule removed", r.name);
      await load();
    } catch (err) {
      notify("error", "Delete failed", err instanceof Error ? err.message : undefined);
    }
  };
  const next = computeNextRun(form.frequency, form.timeOfDay, form.dayOfWeek, form.dayOfMonth);

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="animate-fade-up xl:col-span-2">
        <CardTitle icon={<CalendarClock />} title="Schedule a report" subtitle="Automated daily, weekly or monthly delivery" />
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">Report name</label>
            <input className="field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required disabled={!allowed} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">Frequency</label>
            <div className="mt-1">
              <Segmented value={form.frequency} onChange={(v) => setForm({ ...form, frequency: v })} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-muted uppercase">Time</label>
              <input type="time" className="field mt-1" value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} disabled={!allowed} />
            </div>
            {form.frequency === "weekly" && (
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase">Day</label>
                <select className="field mt-1" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })} disabled={!allowed}>
                  {WEEKDAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {form.frequency === "monthly" && (
              <div>
                <label className="text-[11px] font-semibold text-muted uppercase">Day of month</label>
                <input type="number" min={1} max={28} className="field mt-1" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })} disabled={!allowed} />
              </div>
            )}
            <div>
              <label className="text-[11px] font-semibold text-muted uppercase">Format</label>
              <select className="field mt-1" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} disabled={!allowed}>
                <option value="pdf">PDF report</option>
                <option value="xlsx">Excel workbook</option>
                <option value="csv">CSV extract</option>
                <option value="png">PNG snapshot</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">Recipients</label>
            <input className="field mt-1" value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="name@atoma.af, …" disabled={!allowed} />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted uppercase">Sections</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SECTIONS.map((s) => {
                const on = form.sections.includes(s);
                return (
                  <button key={s} type="button" disabled={!allowed} onClick={() => setForm({ ...form, sections: on ? form.sections.filter((x) => x !== s) : [...form.sections, s] })} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", on ? "border-accent bg-accent text-white" : "border-line text-muted hover:text-fg")}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <Clock className="h-3.5 w-3.5" /> Next run: <b className="text-fg">{fmtDateTime(next.toISOString())}</b>
          </p>
          <Button type="submit" variant="primary" className="w-full" disabled={!allowed || saving}>
            {saving ? <Spinner /> : allowed ? <Plus /> : <Lock />} {allowed ? "Create schedule" : "Requires HR Admin / Officer / Executive"}
          </Button>
        </form>
      </Card>
      <Card className="animate-fade-up xl:col-span-3">
        <CardTitle icon={<Mail />} title="Scheduled reports" subtitle={error ? `Server scheduling unavailable: ${error}` : "Stored in PostgreSQL · delivery simulated in this environment"} />
        {reports === null ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading schedules…
          </div>
        ) : reports.length === 0 ? (
          <EmptyState icon={<CalendarClock />} title="No scheduled reports yet" description="Create a daily, weekly or monthly schedule to automate executive reporting." />
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className={cn("rounded-xl border border-line p-3 transition-opacity", !r.isActive && "opacity-60")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-fg">{r.name}</p>
                    <p className="text-[11.5px] text-muted">
                      {describeSchedule(r.frequency, r.timeOfDay, r.dayOfWeek, r.dayOfMonth)} · {r.recipients || "no recipients"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="primary">{r.format.toUpperCase()}</Badge>
                    <Switch checked={r.isActive} onChange={(v) => setActive(r, v)} label="Active" disabled={!allowed} />
                    <Button size="xs" onClick={() => runNow(r)} disabled={!allowed}>
                      <Play /> Run now
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => remove(r)} disabled={!allowed} aria-label="Delete schedule">
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-subtle">
                  <span>Next: {r.isActive && r.nextRunAt ? fmtDateTime(r.nextRunAt) : "paused"}</span>
                  <span>Last: {r.lastRunAt ? fmtDateTime(r.lastRunAt) : "never"}</span>
                  <span>Runs: {r.runCount}</span>
                  <span>By {r.createdBy}</span>
                  {r.sections.length > 0 && <span>Sections: {r.sections.join(", ")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ExportHistory() {
  const role = useUIStore((s) => s.session.role);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  useEffect(() => {
    if (!can(role, "view_audit")) return;
    api<{ logs: AuditLog[] }>("/api/audit?category=export&limit=8")
      .then((r) => setLogs(r.logs))
      .catch(() => setLogs([]));
  }, [role]);
  if (!can(role, "view_audit")) return null;
  return (
    <Card className="animate-fade-up mt-4">
      <CardTitle icon={<History />} title="Recent exports" subtitle="From the platform audit trail" />
      {!logs ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted">No exports recorded yet.</p>
      ) : (
        <div className="divide-y divide-line">
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
              <span className="font-medium text-fg">{l.action}</span>
              <span className="text-muted">{l.details}</span>
              <span className="text-subtle">
                {l.userName} · {fmtDateTime(l.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReportsInner() {
  const role = useUIStore((s) => s.session.role);
  const allowed = can(role, "export_data");
  const [busy, setBusy] = useState<string | null>(null);
  const go = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    await fn();
    setBusy(null);
  };
  const exportsList = [
    { id: "pdf", icon: <FileDown />, title: "Export PDF", desc: "Multi-page landscape PDF of the executive report below", run: () => runExport("pdf", "Executive Report", "report-preview") },
    { id: "xlsx", icon: <FileSpreadsheet />, title: "Export Excel", desc: "7-sheet workbook: KPIs, strategic metrics, insights, breakdowns, employees", run: () => runExport("xlsx", "Executive Report") },
    { id: "csv", icon: <FileText />, title: "Export CSV", desc: "All 29 HR fields for the filtered employees", run: () => runExport("csv", "Executive Report") },
    { id: "png", icon: <ImageIcon />, title: "Export PNG", desc: "High-resolution image of the report preview", run: () => runExport("png", "Executive Report", "report-preview") },
    { id: "snapshot", icon: <Camera />, title: "Dashboard Snapshot", desc: "Branded snapshot with scope, author and timestamp", run: () => runExport("snapshot", "Executive Report", "report-preview") },
    { id: "exec", icon: <FileText />, title: "Executive PDF Report", desc: "Vector PDF with KPIs, scorecard and AI insights tables", run: () => runExport("exec", "Executive Report") },
  ];
  return (
    <>
      <PageHeader eyebrow="Executive Reporting" title="Reports & exports" icon={<FileText />} subtitle="Board-ready outputs in PDF, Excel, CSV and PNG — plus automated scheduled delivery" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-no-capture="true">
        {exportsList.map((x, i) => (
          <button
            key={x.id}
            type="button"
            disabled={!allowed || !!busy}
            onClick={() => go(x.id, x.run)}
            className="glass hover-lift animate-fade-up group flex items-start gap-3 rounded-2xl p-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-700 to-brand-400 text-white shadow-md transition-transform group-hover:scale-110 [&_svg]:h-5 [&_svg]:w-5">{busy === x.id ? <Spinner /> : allowed ? x.icon : <Lock />}</span>
            <span>
              <span className="block text-[14px] font-semibold text-fg">{x.title}</span>
              <span className="mt-0.5 block text-[12px] text-muted">{x.desc}</span>
            </span>
          </button>
        ))}
      </div>
      {!allowed && <p className="mt-2 text-[12px] text-warning">Your role ({ROLES[role].label}) is not permitted to export data.</p>}
      <h2 className="mt-6 mb-3 text-[13px] font-semibold tracking-wider text-muted uppercase">Live report preview</h2>
      <ReportPreview />
      <h2 className="mt-6 mb-3 text-[13px] font-semibold tracking-wider text-muted uppercase">Scheduled reports</h2>
      <Scheduler />
      <ExportHistory />
    </>
  );
}

export default function ReportsView() {
  return (
    <DataGate>
      <ReportsInner />
    </DataGate>
  );
}
