import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { LOCAL_ONLY } from "./mode";
import { computeNextRun, type Frequency } from "./schedule";
import type { AuditLog, DatasetMeta, DatasetPayload, Employee, ScheduledReport, Session, StorageMode } from "./types";
import { safeText } from "./validation";

export interface LoadedDataset {
  dataset: DatasetMeta;
  employees: Employee[];
}

export interface StorageAdapter {
  mode: StorageMode;
  list(): Promise<DatasetMeta[]>;
  getActive(): Promise<LoadedDataset | null>;
  get(id: string): Promise<LoadedDataset | null>;
  save(p: DatasetPayload, user: { name: string; role: string }): Promise<DatasetMeta>;
  activate(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

export const serverAdapter: StorageAdapter = {
  mode: "server",
  async list() {
    return (await api<{ datasets: DatasetMeta[] }>("/api/datasets")).datasets;
  },
  async getActive() {
    const r = await api<{ dataset: DatasetMeta | null; employees: Employee[] }>("/api/datasets/active");
    return r.dataset ? { dataset: r.dataset, employees: r.employees } : null;
  },
  async get(id) {
    return api<LoadedDataset>(`/api/datasets/${id}`);
  },
  async save(p) {
    return (await api<{ dataset: DatasetMeta }>("/api/datasets", { method: "POST", body: JSON.stringify(p) })).dataset;
  },
  async activate(id) {
    await api(`/api/datasets/${id}`, { method: "PATCH", body: JSON.stringify({ active: true }) });
  },
  async remove(id) {
    await api(`/api/datasets/${id}`, { method: "DELETE" });
  },
};

const INDEX_KEY = "atoma:datasets";
const dataKey = (id: string) => `atoma:data:${id}`;
const byDate = (a: DatasetMeta, b: DatasetMeta) => b.createdAt.localeCompare(a.createdAt);

async function readIndex(): Promise<DatasetMeta[]> {
  return ((await idbGet<DatasetMeta[]>(INDEX_KEY)) ?? []).sort(byDate);
}

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Client-only storage (IndexedDB) — no server required, data never leaves the browser. */
export const localAdapter: StorageAdapter = {
  mode: "local",
  async list() {
    return readIndex();
  },
  async getActive() {
    const idx = await readIndex();
    const meta = idx.find((d) => d.isActive) ?? idx[0];
    if (!meta) return null;
    const employees = (await idbGet<Employee[]>(dataKey(meta.id))) ?? [];
    return { dataset: { ...meta, isActive: true }, employees };
  },
  async get(id) {
    const meta = (await readIndex()).find((d) => d.id === id);
    if (!meta) return null;
    return { dataset: meta, employees: (await idbGet<Employee[]>(dataKey(id))) ?? [] };
  },
  async save(p, user) {
    const id = uid();
    const meta: DatasetMeta = {
      id,
      name: p.name,
      fileName: p.fileName,
      fileType: p.fileType,
      fileSize: p.fileSize,
      rowCount: p.employees.length,
      columnCount: p.columnCount,
      mapping: p.mapping,
      quality: p.quality,
      source: p.source,
      uploadedBy: user.name,
      uploadedRole: user.role,
      isActive: true,
      createdAt: new Date().toISOString(),
      storage: "local",
    };
    await idbSet(dataKey(id), p.employees);
    const idx = (await readIndex()).map((d) => ({ ...d, isActive: false }));
    const next = [meta, ...idx];
    for (const old of next.slice(15)) await idbDel(dataKey(old.id));
    await idbSet(INDEX_KEY, next.slice(0, 15));
    return meta;
  },
  async activate(id) {
    const idx = await readIndex();
    await idbSet(INDEX_KEY, idx.map((d) => ({ ...d, isActive: d.id === id })));
  },
  async remove(id) {
    const next = (await readIndex()).filter((d) => d.id !== id);
    if (next.length && !next.some((d) => d.isActive)) next[0] = { ...next[0], isActive: true };
    await idbSet(INDEX_KEY, next);
    await idbDel(dataKey(id));
  },
};

export const getAdapter = (mode: StorageMode): StorageAdapter => (LOCAL_ONLY || mode === "local" ? localAdapter : serverAdapter);

const AUDIT_KEY = "atoma:audit:v1";
const REPORTS_KEY = "atoma:reports:v1";

function localSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const stored = JSON.parse(localStorage.getItem("atoma-ui") || "{}") as { state?: { session?: Session } };
    return stored.state?.session ?? null;
  } catch {
    return null;
  }
}

export async function appendLocalAudit(action: string, category: string, details = ""): Promise<void> {
  const session = localSession();
  const current = (await idbGet<AuditLog[]>(AUDIT_KEY)) ?? [];
  const nextId = (current[0]?.id ?? 0) + 1;
  const event: AuditLog = {
    id: nextId,
    action: safeText(action, 120),
    category: safeText(category, 40) || "general",
    details: safeText(details, 1_000),
    userName: session?.name ?? "Local user",
    userEmail: session?.email ?? "",
    role: session?.role ?? "hr_admin",
    ip: "browser-local",
    createdAt: new Date().toISOString(),
  };
  await idbSet(AUDIT_KEY, [event, ...current].slice(0, 500));
}

export async function queryLocalAudit(options: { q?: string; category?: string; limit?: number; offset?: number } = {}) {
  const all = (await idbGet<AuditLog[]>(AUDIT_KEY)) ?? [];
  const query = (options.q ?? "").trim().toLowerCase();
  const filtered = all.filter((event) => {
    if (options.category && event.category !== options.category) return false;
    return !query || `${event.action} ${event.details} ${event.userName} ${event.role}`.toLowerCase().includes(query);
  });
  const offset = Math.max(0, options.offset ?? 0);
  const limit = Math.max(1, Math.min(500, options.limit ?? 50));
  return {
    logs: filtered.slice(offset, offset + limit),
    total: filtered.length,
    categories: [...new Set(all.map((event) => event.category))].sort(),
  };
}

export interface LocalReportInput {
  name: string;
  frequency: Frequency;
  format: ScheduledReport["format"];
  recipients: string;
  sections: string[];
  timeOfDay: string;
  dayOfWeek: number;
  dayOfMonth: number;
  createdBy: string;
}

export async function listLocalReports(): Promise<ScheduledReport[]> {
  return ((await idbGet<ScheduledReport[]>(REPORTS_KEY)) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createLocalReport(input: LocalReportInput): Promise<ScheduledReport> {
  const current = await listLocalReports();
  const report: ScheduledReport = {
    id: Math.max(0, ...current.map((item) => item.id)) + 1,
    name: safeText(input.name, 150),
    frequency: input.frequency,
    format: input.format,
    recipients: safeText(input.recipients, 1_000),
    sections: input.sections.map((item) => safeText(item, 80)).slice(0, 20),
    timeOfDay: input.timeOfDay,
    dayOfWeek: Math.max(0, Math.min(6, input.dayOfWeek)),
    dayOfMonth: Math.max(1, Math.min(28, input.dayOfMonth)),
    isActive: true,
    lastRunAt: null,
    nextRunAt: computeNextRun(input.frequency, input.timeOfDay, input.dayOfWeek, input.dayOfMonth).toISOString(),
    runCount: 0,
    createdBy: safeText(input.createdBy, 180),
    createdAt: new Date().toISOString(),
  };
  await idbSet(REPORTS_KEY, [report, ...current]);
  await appendLocalAudit("report.scheduled", "reports", `${report.name} · ${report.frequency} · ${report.format.toUpperCase()}`);
  return report;
}

export async function updateLocalReport(id: number, patch: { isActive?: boolean; run?: boolean }): Promise<ScheduledReport> {
  const current = await listLocalReports();
  const existing = current.find((report) => report.id === id);
  if (!existing) throw new Error("Report schedule not found.");
  const updated: ScheduledReport = {
    ...existing,
    ...(typeof patch.isActive === "boolean" ? { isActive: patch.isActive } : {}),
    ...(patch.run ? { lastRunAt: new Date().toISOString(), runCount: existing.runCount + 1 } : {}),
    nextRunAt: computeNextRun(existing.frequency, existing.timeOfDay, existing.dayOfWeek, existing.dayOfMonth).toISOString(),
  };
  await idbSet(REPORTS_KEY, current.map((report) => (report.id === id ? updated : report)));
  await appendLocalAudit(patch.run ? "report.executed" : updated.isActive ? "report.enabled" : "report.paused", "reports", updated.name);
  return updated;
}

export async function deleteLocalReport(id: number): Promise<void> {
  const current = await listLocalReports();
  const existing = current.find((report) => report.id === id);
  await idbSet(REPORTS_KEY, current.filter((report) => report.id !== id));
  if (existing) await appendLocalAudit("report.deleted", "reports", existing.name);
}

/** Audit locally in browser-only mode; enterprise mode sends only event metadata to the API. */
export function logAudit(action: string, category: string, details = "", meta?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (LOCAL_ONLY) {
    void appendLocalAudit(action, category, details);
    return;
  }
  fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, category, details, meta }),
  }).catch(() => undefined);
}
