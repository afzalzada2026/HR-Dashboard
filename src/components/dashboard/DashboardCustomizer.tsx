"use client";

import { Check, Eye, EyeOff, LayoutGrid, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/format";
import { useUIStore } from "@/store/ui";
import { Badge, Button, EmptyState, Modal, Switch } from "../ui/primitives";

export interface DashboardWidget {
  id: string;
  label: string;
  group: string;
  description?: string;
  essential?: boolean;
}

interface Props {
  page: string;
  title: string;
  widgets: DashboardWidget[];
}

export function useDashboardLayout(page: string) {
  const userId = useUIStore((s) => s.session.userId);
  const hiddenWidgets = useUIStore((s) => s.hiddenWidgets);
  const key = `${userId}:${page}`;
  const hidden = useMemo(() => new Set(hiddenWidgets[key] ?? []), [hiddenWidgets, key]);
  return {
    hidden,
    visible: (id: string) => !hidden.has(id),
    visibleCount: (ids: string[]) => ids.reduce((n, id) => n + (hidden.has(id) ? 0 : 1), 0),
  };
}

/**
 * User-level dashboard personalization. Preferences are persisted in localStorage and scoped
 * by user + page. Hidden widgets are removed from the DOM; CSS grid dense placement closes gaps.
 */
export function DashboardCustomizer({ page, title, widgets }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const userId = useUIStore((s) => s.session.userId);
  const hiddenWidgets = useUIStore((s) => s.hiddenWidgets);
  const setWidgetVisible = useUIStore((s) => s.setWidgetVisible);
  const setPageWidgets = useUIStore((s) => s.setPageWidgets);
  const resetPageWidgets = useUIStore((s) => s.resetPageWidgets);
  const key = `${userId}:${page}`;
  const hidden = useMemo(() => new Set(hiddenWidgets[key] ?? []), [hiddenWidgets, key]);
  const groups = useMemo(() => [...new Set(widgets.map((w) => w.group))], [widgets]);
  const hiddenCount = widgets.reduce((count, widget) => count + (hidden.has(widget.id) ? 1 : 0), 0);
  const visible = widgets.length - hiddenCount;
  const filtered = query.trim()
    ? widgets.filter((w) => `${w.label} ${w.group} ${w.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    : widgets;

  const showEssential = () => setPageWidgets(page, widgets.filter((w) => w.essential).map((w) => w.id), widgets.map((w) => w.id));
  const hideAll = () => setPageWidgets(page, [], widgets.map((w) => w.id));
  const showAll = () => setPageWidgets(page, widgets.map((w) => w.id), widgets.map((w) => w.id));

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <SlidersHorizontal /> Customize
        {hidden.size > 0 && <Badge tone="accent">{visible}/{widgets.length}</Badge>}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Customize ${title}`}
        subtitle="Choose what appears on this dashboard. Your selection is remembered for this account."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => resetPageWidgets(page)}>
              <RotateCcw /> Reset default
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              <Check /> Done · {visible} shown
            </Button>
          </>
        }
      >
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button size="sm" variant="soft" onClick={showAll}>
            <Eye /> Show all
          </Button>
          <Button size="sm" onClick={showEssential}>
            <LayoutGrid /> Essentials
          </Button>
          <Button size="sm" onClick={hideAll}>
            <EyeOff /> Hide all
          </Button>
          <div className="flex items-center justify-center rounded-xl border border-line bg-surface-muted px-3 text-xs font-semibold text-fg">
            {visible} shown · {hiddenCount} hidden
          </div>
        </div>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-subtle" />
          <input className="field h-10 pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a card or visual…" />
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={<Search />} title="No matching widgets" description="Try another card, visual or category name." />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => {
              const items = filtered.filter((w) => w.group === group);
              if (!items.length) return null;
              const allOn = items.every((w) => !hidden.has(w.id));
              return (
                <section key={group}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">{group}</h3>
                    <button
                      type="button"
                      onClick={() => items.forEach((w) => setWidgetVisible(page, w.id, !allOn))}
                      className="text-[11px] font-semibold text-primary hover:underline dark:text-accent"
                    >
                      {allOn ? "Hide group" : "Show group"}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((w) => {
                      const on = !hidden.has(w.id);
                      return (
                        <div
                          key={w.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setWidgetVisible(page, w.id, !on)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setWidgetVisible(page, w.id, !on);
                            }
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all",
                            on ? "border-accent/35 bg-accent/6" : "border-line bg-surface-muted/35 opacity-65 hover:opacity-100"
                          )}
                        >
                          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", on ? "bg-accent text-white" : "bg-surface-muted text-subtle")}>
                            {on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                              <span className="truncate">{w.label}</span>
                              {w.essential && <Badge tone="primary">Essential</Badge>}
                            </span>
                            {w.description && <span className="mt-0.5 block truncate text-[11px] text-muted">{w.description}</span>}
                          </span>
                          <span onClick={(event) => event.stopPropagation()}>
                            <Switch checked={on} onChange={(value) => setWidgetVisible(page, w.id, value)} label={`Show ${w.label}`} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}

export function HiddenDashboardState({ page, widgets, title }: Props) {
  const reset = useUIStore((s) => s.resetPageWidgets);
  return (
    <div className="glass rounded-2xl">
      <EmptyState
        icon={<EyeOff />}
        title="All dashboard items are hidden"
        description="Open Customize to choose the cards and visuals you want to see. The grid will rearrange automatically."
        action={
          <div className="flex gap-2">
            <DashboardCustomizer page={page} widgets={widgets} title={title} />
            <Button variant="primary" onClick={() => reset(page)}>
              <RotateCcw /> Restore defaults
            </Button>
          </div>
        }
      />
    </div>
  );
}
