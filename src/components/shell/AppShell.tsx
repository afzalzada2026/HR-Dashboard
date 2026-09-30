"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/format";
import { getLocalSession } from "@/lib/local-auth";
import { LOCAL_ONLY } from "@/lib/mode";
import { useDataStore } from "@/store/data";
import { hydrateUI, useUIStore, writeSessionCookie } from "@/store/ui";
import { ProfileDrawer } from "../employee/ProfileDrawer";
import { ActiveFilters, Toaster } from "./Chrome";
import { ErrorBoundary } from "./ErrorBoundary";
import { FilterPane } from "./FilterPane";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const hydrated = useUIStore((s) => s.hydrated);
  const theme = useUIStore((s) => s.theme);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const storage = useDataStore((s) => s.dataset?.storage);
  const [accessReady, setAccessReady] = useState(!LOCAL_ONLY);

  useEffect(() => {
    hydrateUI();
  }, []);

  useEffect(() => {
    if (hydrated) document.documentElement.setAttribute("data-theme", theme);
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (LOCAL_ONLY) {
      useUIStore.getState().setStorageMode("local");
      getLocalSession().then((session) => {
        if (!session) {
          router.replace("/login");
          return;
        }
        useUIStore.getState().setSession(session);
        setAccessReady(true);
        void useDataStore.getState().bootstrap();
      });
      return;
    }
    writeSessionCookie(useUIStore.getState().session);
    void useDataStore.getState().bootstrap();
  }, [hydrated, router]);

  if (!accessReady) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-sm text-muted"><span className="inline-flex items-center gap-2"><span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" /> Securing local workspace…</span></div>;
  }

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={cn("min-w-0 transition-[padding] duration-300", collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]")}>
        <Topbar />
        <ActiveFilters />
        <main id="atoma-capture" className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6">
          <ErrorBoundary label="This dashboard">{children}</ErrorBoundary>
        </main>
        <footer className="px-5 pb-6 text-center text-[11px] text-subtle" data-no-capture="true">
          <p className="inline-flex items-center gap-1.5">
            Made with
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-pulse" aria-label="love">
              <defs>
                <linearGradient id="atomaHeart" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#FB7185" />
                  <stop offset="1" stopColor="#E11D48" />
                </linearGradient>
              </defs>
              <path fill="url(#atomaHeart)" d="M12 21s-7.2-4.5-9.4-8.6C.7 8.9 2.4 4.8 6.2 4.1c2.2-.4 4.3.6 5.8 2.4 1.5-1.8 3.6-2.8 5.8-2.4 3.8.7 5.5 4.8 3.6 8.3C19.2 16.5 12 21 12 21z" />
            </svg>
            by <span className="font-semibold text-fg">Mohibullah Afzalzada</span>
          </p>
          <p className="mt-1">
            ATOMA · HR Workforce Intelligence Platform · {LOCAL_ONLY ? "Browser-only mode: employee data stays on this device and is never uploaded" : `Data stored in ${storage === "server" ? "PostgreSQL (enterprise mode)" : storage === "local" ? "this browser" : "memory"}`} · Confidential
          </p>
        </footer>
      </div>
      <FilterPane />
      <ProfileDrawer />
      <Toaster />
    </div>
  );
}
