"use client";

import { type ReactNode, useEffect } from "react";
import { cn } from "@/lib/format";
import { useDataStore } from "@/store/data";
import { hydrateUI, useUIStore, writeSessionCookie } from "@/store/ui";
import { ProfileDrawer } from "../employee/ProfileDrawer";
import { ActiveFilters, Toaster } from "./Chrome";
import { FilterPane } from "./FilterPane";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export default function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useUIStore((s) => s.hydrated);
  const theme = useUIStore((s) => s.theme);
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const storage = useDataStore((s) => s.dataset?.storage);

  useEffect(() => {
    hydrateUI();
  }, []);

  useEffect(() => {
    if (hydrated) document.documentElement.setAttribute("data-theme", theme);
  }, [theme, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeSessionCookie(useUIStore.getState().session);
    void useDataStore.getState().bootstrap();
  }, [hydrated]);

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
          ATOMA · HR Workforce Intelligence Platform · Data stored in {storage === "server" ? "PostgreSQL (enterprise mode)" : storage === "local" ? "this browser (local mode — no server)" : "memory"} · Confidential
        </footer>
      </div>
      <FilterPane />
      <ProfileDrawer />
      <Toaster />
    </div>
  );
}
