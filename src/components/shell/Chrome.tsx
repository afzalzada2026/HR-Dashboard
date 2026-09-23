"use client";

import { AlertTriangle, CheckCircle2, Database, FilterX, Info, RefreshCw, X, XCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FILTER_LABELS, MULTI_KEYS } from "@/lib/filters";
import { cn, fmtNum } from "@/lib/format";
import type { Filters } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Button, Card, EmptyState, Skeleton, Spinner } from "../ui/primitives";

export function ActiveFilters() {
  const filters = useDataStore((s) => s.filters);
  const total = useDataStore((s) => s.employees.length);
  const shown = useDataStore((s) => s.filtered.length);
  const setFilter = useDataStore((s) => s.setFilter);
  const patch = useDataStore((s) => s.patchFilters);
  const clearAll = useDataStore((s) => s.clearFilters);
  const chips: { key: string; label: string; onClear: () => void }[] = [];
  for (const k of MULTI_KEYS) {
    const v = filters[k];
    if (v.length) chips.push({ key: k, label: `${FILTER_LABELS[k]}: ${v.length > 2 ? `${v.slice(0, 2).join(", ")} +${v.length - 2}` : v.join(", ")}`, onClear: () => setFilter(k, []) });
  }
  const range = (label: string, a: keyof Filters, b: keyof Filters, suffix = "") => {
    const x = filters[a];
    const y = filters[b];
    if (x || y || x === 0 || y === 0) chips.push({ key: label, label: `${label}: ${x ?? x === 0 ? x : "…"} – ${y ?? "…"}${suffix}`, onClear: () => patch({ [a]: a.endsWith("Min") || a.endsWith("Max") ? null : "", [b]: b.endsWith("Min") || b.endsWith("Max") ? null : "" } as Partial<Filters>) });
  };
  range("Joined", "joinFrom", "joinTo");
  range("Born", "dobFrom", "dobTo");
  range("Age", "ageMin", "ageMax");
  range("Tenure", "tenureMin", "tenureMax", " yrs");
  if (!chips.length) return null;
  return (
    <div className="animate-fade-in border-b border-line bg-accent/5 px-3 py-2 sm:px-5" data-no-capture="true">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11.5px] font-medium text-muted">
          Showing <b className="text-fg">{fmtNum(shown)}</b> of {fmtNum(total)}
        </span>
        {chips.map((c) => (
          <span key={c.key} className="inline-flex max-w-[280px] items-center gap-1 rounded-full border border-accent/30 bg-surface-strong py-0.5 pr-1 pl-2.5 text-[11.5px] font-medium text-fg">
            <span className="truncate">{c.label}</span>
            <button type="button" onClick={c.onClear} className="grid h-4 w-4 place-items-center rounded-full text-muted hover:bg-danger/15 hover:text-danger" aria-label={`Remove ${c.label}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button type="button" onClick={clearAll} className="ml-1 text-[11.5px] font-semibold text-primary hover:underline dark:text-accent">
          Clear all
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  const ICON = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: XCircle };
  const COLOR = { success: "text-success", info: "text-accent", warning: "text-warning", error: "text-danger" };
  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-[100] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2 sm:right-5 sm:bottom-5" data-no-capture="true">
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div key={t.id} className="glass-strong animate-slide-right pointer-events-auto flex items-start gap-3 rounded-xl p-3.5" role="status">
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", COLOR[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-fg">{t.title}</p>
              {t.message && <p className="mt-0.5 text-[12px] text-muted">{t.message}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-subtle hover:text-fg" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardSkeleton({ message }: { message?: string }) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3.5 w-80 max-w-[60vw]" />
        </div>
      </div>
      <div className="mb-5 flex items-center gap-2 text-sm text-muted">
        <Spinner className="text-accent" /> {message || "Loading workforce intelligence…"}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

/** Guards dashboard views: skeleton while loading, friendly empty / error / no-match states. */
export function DataGate({ children, allowEmptyFilter }: { children: ReactNode; allowEmptyFilter?: boolean }) {
  const status = useDataStore((s) => s.status);
  const message = useDataStore((s) => s.message);
  const count = useDataStore((s) => s.filtered.length);
  const reload = useDataStore((s) => s.reload);
  const clearFilters = useDataStore((s) => s.clearFilters);
  if (status === "idle" || status === "loading") return <DashboardSkeleton message={message} />;
  if (status === "error")
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle />}
          title="Unable to load workforce data"
          description={message}
          action={
            <Button variant="primary" onClick={() => reload()}>
              <RefreshCw /> Retry
            </Button>
          }
        />
      </Card>
    );
  if (status === "empty")
    return (
      <Card>
        <EmptyState
          icon={<Database />}
          title="No employee records in scope"
          description="The active dataset has no records visible to your role. Upload an Excel/CSV file or generate a demo workforce."
          action={
            <Link href="/data">
              <Button variant="primary">
                <Database /> Open Data Sources
              </Button>
            </Link>
          }
        />
      </Card>
    );
  if (!count && !allowEmptyFilter)
    return (
      <Card>
        <EmptyState
          icon={<FilterX />}
          title="No employees match the current filters"
          description="Adjust or clear the slicers to bring employees back into view."
          action={
            <Button variant="primary" onClick={clearFilters}>
              <FilterX /> Clear all filters
            </Button>
          }
        />
      </Card>
    );
  return <>{children}</>;
}
