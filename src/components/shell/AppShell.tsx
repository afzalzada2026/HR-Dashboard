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
          {children}
        </main>
        <footer className="px-5 pb-6 text-center text-[11px] text-subtle" data-no-capture="true">
          ATOMA · HR Workforce Intelligence Platform · {LOCAL_ONLY ? "Browser-only mode: employee data stays on this device and is never uploaded" : `Data stored in ${storage === "server" ? "PostgreSQL (enterprise mode)" : storage === "local" ? "this browser" : "memory"}`} · Confidential
        </footer>
      </div>
      <FilterPane />
      <ProfileDrawer />
      <Toaster />
    </div>
  );
}
