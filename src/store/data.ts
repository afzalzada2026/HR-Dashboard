"use client";

import { create } from "zustand";
import { generateDemoRows } from "@/lib/demo";
import { applyFilters, availableOptions, EMPTY_FILTERS, HIERARCHY } from "@/lib/filters";
import { autoMap } from "@/lib/mapping";
import { enrichEmployees, normalizeRows } from "@/lib/normalize";
import { applyRowLevelSecurity, can } from "@/lib/rbac";
import { ApiError, getAdapter } from "@/lib/storage";
import type { DatasetMeta, DatasetPayload, Employee, Filters, MultiKey } from "@/lib/types";
import { useUIStore } from "./ui";

export type DataStatus = "idle" | "loading" | "ready" | "empty" | "error";

interface DataState {
  status: DataStatus;
  message: string;
  dataset: DatasetMeta | null;
  employees: Employee[];
  filtered: Employee[];
  filters: Filters;
  now: number;
  version: number;
  divisions: string[];
  bootstrap: () => Promise<void>;
  reload: () => Promise<void>;
  loadDataset: (id: string) => Promise<void>;
  loadDemo: (size?: number) => Promise<void>;
  importDataset: (payload: DatasetPayload) => Promise<DatasetMeta>;
  setDataset: (meta: DatasetMeta, raw: Employee[]) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  toggleValue: (key: MultiKey, value: string) => void;
  patchFilters: (patch: Partial<Filters>) => void;
  clearFilter: (key: keyof Filters) => void;
  clearFilters: () => void;
}

let booting: Promise<void> | null = null;

function buildDemoPayload(size: number): DatasetPayload {
  const now = Date.now();
  const { headers, rows } = generateDemoRows(size, 7, new Date(now));
  const { mapping } = autoMap(headers);
  const { employees, quality } = normalizeRows(rows, mapping, now);
  return {
    name: `ATOMA Workforce — Demo (${size.toLocaleString()} employees)`,
    fileName: `atoma-demo-workforce-${size}.xlsx`,
    fileType: "demo",
    fileSize: 0,
    columnCount: headers.length,
    mapping,
    quality,
    source: "demo",
    employees,
  };
}

/** Prunes dependent hierarchy selections (Division → Department → Title) that are no longer valid. */
function prune(emps: Employee[], filters: Filters, changed: keyof Filters): Filters {
  const idx = HIERARCHY.indexOf(changed as MultiKey);
  if (idx < 0) return filters;
  let next = filters;
  for (let i = idx + 1; i < HIERARCHY.length; i++) {
    const k = HIERARCHY[i];
    if (!next[k].length) continue;
    const avail = new Set(availableOptions(emps, next, k).filter((o) => o.count > 0).map((o) => o.value));
    next = { ...next, [k]: next[k].filter((v) => avail.has(v)) };
  }
  return next;
}

export const useDataStore = create<DataState>()((set, get) => ({
  status: "idle",
  message: "",
  dataset: null,
  employees: [],
  filtered: [],
  filters: EMPTY_FILTERS,
  now: 0,
  version: 0,
  divisions: [],

  bootstrap: async () => {
    if (booting) return booting;
    booting = (async () => {
      set({ status: "loading", message: "Loading workforce dataset…" });
      const ui = useUIStore.getState();
      try {
        const res = await getAdapter(ui.storageMode).getActive();
        if (res && res.employees.length) {
          get().setDataset(res.dataset, res.employees);
          return;
        }
        if (res && !res.employees.length) {
          get().setDataset(res.dataset, []);
          return;
        }
        await get().loadDemo(1250);
      } catch (err) {
        if (ui.storageMode === "server") {
          ui.notify("warning", "Server storage unavailable", "Switched to local browser storage (no server mode).");
          ui.setStorageMode("local");
          booting = null;
          return get().bootstrap();
        }
        set({ status: "error", message: err instanceof Error ? err.message : "Failed to load dataset" });
      }
    })();
    try {
      await booting;
    } finally {
      booting = null;
    }
  },

  reload: async () => {
    const ui = useUIStore.getState();
    set({ status: "loading", message: "Refreshing dataset…" });
    try {
      const res = await getAdapter(ui.storageMode).getActive();
      if (res) get().setDataset(res.dataset, res.employees);
      else await get().loadDemo(1250);
    } catch (err) {
      set({ status: "error", message: err instanceof Error ? err.message : "Failed to load dataset" });
    }
  },

  loadDataset: async (id) => {
    const ui = useUIStore.getState();
    const adapter = getAdapter(ui.storageMode);
    set({ status: "loading", message: "Loading dataset…" });
    try {
      await adapter.activate(id);
      const res = await adapter.get(id);
      if (!res) throw new Error("Dataset not found");
      get().setDataset({ ...res.dataset, isActive: true }, res.employees);
      ui.notify("success", "Dataset loaded", `${res.dataset.name} · ${res.employees.length.toLocaleString()} records`);
    } catch (err) {
      set({ status: get().employees.length ? "ready" : "error", message: "" });
      ui.notify("error", "Could not load dataset", err instanceof Error ? err.message : undefined);
    }
  },

  loadDemo: async (size = 1250) => {
    const ui = useUIStore.getState();
    set({ status: "loading", message: `Generating ${size.toLocaleString()} demo employees…` });
    await new Promise((r) => setTimeout(r, 30));
    const payload = buildDemoPayload(size);
    try {
      if (!can(ui.session.role, "upload_data")) throw new ApiError("not permitted", 403);
      const meta = await getAdapter(ui.storageMode).save(payload, { name: ui.session.name, role: ui.session.role });
      get().setDataset(meta, payload.employees);
      ui.notify("success", "Demo workforce ready", `${size.toLocaleString()} employees generated & stored (${meta.storage}).`);
    } catch {
      const meta: DatasetMeta = {
        id: "memory-demo",
        name: payload.name,
        fileName: payload.fileName,
        fileType: "demo",
        fileSize: 0,
        rowCount: payload.employees.length,
        columnCount: payload.columnCount,
        mapping: payload.mapping,
        quality: payload.quality,
        source: "demo",
        uploadedBy: ui.session.name,
        uploadedRole: ui.session.role,
        isActive: true,
        createdAt: new Date().toISOString(),
        storage: "memory",
      };
      get().setDataset(meta, payload.employees);
      ui.notify("info", "Demo workforce loaded in memory", "Your role cannot persist datasets; data is session-only.");
    }
  },

  importDataset: async (payload) => {
    const ui = useUIStore.getState();
    if (!can(ui.session.role, "upload_data")) throw new ApiError("Your role cannot upload datasets.", 403);
    const meta = await getAdapter(ui.storageMode).save(payload, { name: ui.session.name, role: ui.session.role });
    get().setDataset(meta, payload.employees);
    return meta;
  },

  setDataset: (meta, raw) => {
    const now = Date.now();
    const session = useUIStore.getState().session;
    const employees = enrichEmployees(applyRowLevelSecurity(raw, session), now);
    const all = [...new Set(raw.map((e) => e.division))].filter(Boolean).sort();
    const divisions = session.role === "division_manager" && get().divisions.length ? get().divisions : all;
    set((s) => ({
      divisions,
      dataset: meta,
      employees,
      filtered: employees,
      filters: EMPTY_FILTERS,
      now,
      status: employees.length ? "ready" : "empty",
      message: "",
      version: s.version + 1,
    }));
  },

  setFilter: (key, value) => {
    const { employees } = get();
    const filters = prune(employees, { ...get().filters, [key]: value }, key);
    set({ filters, filtered: applyFilters(employees, filters) });
  },

  toggleValue: (key, value) => {
    const cur = get().filters[key];
    const next = cur.length === 1 && cur[0] === value ? [] : [value];
    get().setFilter(key, next);
  },

  patchFilters: (patch) => {
    const { employees } = get();
    const filters = { ...get().filters, ...patch };
    set({ filters, filtered: applyFilters(employees, filters) });
  },

  clearFilter: (key) => {
    get().setFilter(key, EMPTY_FILTERS[key]);
  },

  clearFilters: () => {
    set({ filters: EMPTY_FILTERS, filtered: get().employees });
  },
}));
