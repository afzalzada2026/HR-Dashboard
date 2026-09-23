import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import type { DatasetMeta, DatasetPayload, Employee, StorageMode } from "./types";

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

export const getAdapter = (mode: StorageMode): StorageAdapter => (mode === "local" ? localAdapter : serverAdapter);

/** Fire-and-forget audit event (server records user, role and IP from the session cookie). */
export function logAudit(action: string, category: string, details = "", meta?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  fetch("/api/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, category, details, meta }),
  }).catch(() => undefined);
}
