"use client";

import { Cloud, HardDrive, PanelLeftClose, PanelLeftOpen, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, fmtNum } from "@/lib/format";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Logo } from "./Logo";
import { NAV_SECTIONS } from "./nav";

function SidebarContent({ mobile }: { mobile: boolean }) {
  const pathname = usePathname();
  const collapsedPref = useUIStore((s) => s.sidebarCollapsed);
  const collapsed = collapsedPref && !mobile;
  const setMobile = useUIStore((s) => s.setMobileNav);
  const toggle = useUIStore((s) => s.toggleSidebar);
  const dataset = useDataStore((s) => s.dataset);
  const count = useDataStore((s) => s.employees.length);
  const status = useDataStore((s) => s.status);
  const StorageIcon = dataset?.storage === "server" ? Cloud : dataset?.storage === "local" ? HardDrive : Zap;

  return (
    <div className="flex h-full flex-col text-white" style={{ background: "var(--sidebar)" }}>
      <div className={cn("flex h-16 shrink-0 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/" onClick={() => setMobile(false)}>
          <Logo collapsed={collapsed} />
        </Link>
      </div>
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-2">
            {!collapsed ? <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold tracking-[0.18em] text-white/40 uppercase">{section.title}</p> : <div className="mx-3 my-3 border-t border-white/10" />}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobile(false)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl py-2.5 text-[13.5px] font-medium transition-all duration-200",
                      collapsed ? "justify-center px-0" : "px-3",
                      active ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" : "text-white/70 hover:bg-white/8 hover:text-white"
                    )}
                  >
                    {active && <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-400 shadow-[0_0_12px_#00A8FF]" />}
                    <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-110", active ? "text-brand-400" : "text-white/70 group-hover:text-white")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {!collapsed && item.badge && <span className="ml-auto rounded-full bg-brand-400/20 px-1.5 py-0.5 text-[9.5px] font-bold text-brand-400">{item.badge}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/6 p-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">
            <span className={cn("h-1.5 w-1.5 rounded-full", status === "ready" ? "animate-pulse-ring bg-emerald-400" : status === "loading" ? "bg-amber-400" : "bg-white/40")} />
            Active dataset
          </div>
          <p className="mt-1.5 truncate text-[12.5px] font-semibold text-white" title={dataset?.name}>
            {dataset?.name ?? (status === "loading" ? "Loading…" : "No dataset")}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/60">
            <StorageIcon className="h-3 w-3" />
            {fmtNum(count)} records · {dataset?.storage === "server" ? "PostgreSQL" : dataset?.storage === "local" ? "Browser (local)" : "In-memory"}
          </div>
        </div>
      )}
      {!mobile && (
        <button
          type="button"
          onClick={toggle}
          className="mx-3 mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs text-white/65 transition-colors hover:bg-white/8 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4" /> Collapse
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUIStore((s) => s.mobileNavOpen);
  const setMobile = useUIStore((s) => s.setMobileNav);
  return (
    <>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-300 lg:block", collapsed ? "w-[76px]" : "w-[264px]")} data-no-capture="true">
        <SidebarContent mobile={false} />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/50" onClick={() => setMobile(false)} />
          <aside className="animate-slide-left absolute inset-y-0 left-0 w-[280px] shadow-2xl">
            <SidebarContent mobile />
          </aside>
        </div>
      )}
    </>
  );
}
