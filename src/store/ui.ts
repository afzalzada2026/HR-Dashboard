"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_SESSION, encodeSession, SESSION_COOKIE } from "@/lib/rbac";
import type { Session, StorageMode, Theme } from "@/lib/types";

export type ToastKind = "success" | "info" | "warning" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

export interface Notice extends Toast {
  at: number;
  read: boolean;
}

interface UIState {
  hydrated: boolean;
  theme: Theme;
  storageMode: StorageMode;
  session: Session;
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  filterPaneOpen: boolean;
  selectedEmployeeId: string | null;
  exporting: boolean;
  toasts: Toast[];
  notifications: Notice[];
  hiddenWidgets: Record<string, string[]>;
  setTheme: (t: Theme) => void;
  setStorageMode: (m: StorageMode) => void;
  setSession: (s: Session) => void;
  toggleSidebar: () => void;
  setMobileNav: (v: boolean) => void;
  setFilterPane: (v: boolean) => void;
  openEmployee: (id: string | null) => void;
  setExporting: (v: boolean) => void;
  notify: (kind: ToastKind, title: string, message?: string) => void;
  dismissToast: (id: number) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  setWidgetVisible: (page: string, widgetId: string, visible: boolean) => void;
  setPageWidgets: (page: string, visibleIds: string[], allIds: string[]) => void;
  resetPageWidgets: (page: string) => void;
}

let seq = 0;
const nextId = () => Date.now() * 100 + (seq++ % 100);

export function writeSessionCookie(s: Session): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE}=${encodeSession(s)}; path=/; max-age=31536000; samesite=lax`;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      theme: "light",
      storageMode: "server",
      session: DEFAULT_SESSION,
      sidebarCollapsed: false,
      mobileNavOpen: false,
      filterPaneOpen: false,
      selectedEmployeeId: null,
      exporting: false,
      toasts: [],
      notifications: [],
      hiddenWidgets: {},
      setTheme: (theme) => set({ theme }),
      setStorageMode: (storageMode) => set({ storageMode }),
      setSession: (session) => {
        writeSessionCookie(session);
        set({ session });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
      setFilterPane: (filterPaneOpen) => set({ filterPaneOpen }),
      openEmployee: (selectedEmployeeId) => set({ selectedEmployeeId }),
      setExporting: (exporting) => set({ exporting }),
      notify: (kind, title, message) => {
        const id = nextId();
        set((s) => ({
          toasts: [...s.toasts, { id, kind, title, message }].slice(-5),
          notifications: [{ id, kind, title, message, at: Date.now(), read: false }, ...s.notifications].slice(0, 40),
        }));
        setTimeout(() => get().dismissToast(id), kind === "error" ? 7000 : 4500);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      clearNotifications: () => set({ notifications: [] }),
      setWidgetVisible: (page, widgetId, visible) =>
        set((s) => {
          const key = `${s.session.userId}:${page}`;
          const hidden = new Set(s.hiddenWidgets[key] ?? []);
          if (visible) hidden.delete(widgetId);
          else hidden.add(widgetId);
          return { hiddenWidgets: { ...s.hiddenWidgets, [key]: [...hidden] } };
        }),
      setPageWidgets: (page, visibleIds, allIds) =>
        set((s) => {
          const key = `${s.session.userId}:${page}`;
          const visible = new Set(visibleIds);
          return { hiddenWidgets: { ...s.hiddenWidgets, [key]: allIds.filter((id) => !visible.has(id)) } };
        }),
      resetPageWidgets: (page) =>
        set((s) => {
          const key = `${s.session.userId}:${page}`;
          const next = { ...s.hiddenWidgets };
          delete next[key];
          return { hiddenWidgets: next };
        }),
    }),
    {
      name: "atoma-ui",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        theme: s.theme,
        storageMode: s.storageMode,
        session: s.session,
        sidebarCollapsed: s.sidebarCollapsed,
        notifications: s.notifications.slice(0, 20),
        hiddenWidgets: s.hiddenWidgets,
      }),
      onRehydrateStorage: () => () => {
        useUIStore.setState({ hydrated: true });
      },
    }
  )
);

/** Rehydrates persisted UI state once on the client (safe to call multiple times). */
export function hydrateUI(): void {
  if (useUIStore.getState().hydrated) return;
  void useUIStore.persist.rehydrate();
}
