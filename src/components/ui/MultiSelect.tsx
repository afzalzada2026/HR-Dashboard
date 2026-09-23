"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import type { Option } from "@/lib/filters";
import { cn, fmtNum } from "@/lib/format";
import { Popover } from "./primitives";

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  icon?: ReactNode;
  inline?: boolean;
  className?: string;
}

function OptionList({ options, selected, onChange }: { options: Option[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const set = useMemo(() => new Set(selected), [selected]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.value.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const shown = visible.slice(0, 400);
  const toggle = (v: string) => onChange(set.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <div className="relative mb-1.5">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="field h-8 pl-8 text-xs" />
      </div>
      <div className="mb-1 flex items-center justify-between px-1 text-[11px]">
        <button type="button" className="font-medium text-primary hover:underline dark:text-accent" onClick={() => onChange([...new Set([...selected, ...visible.filter((o) => o.count > 0).map((o) => o.value)])])}>
          Select all{q ? " visible" : ""}
        </button>
        <button type="button" className="text-muted hover:text-fg" onClick={() => onChange([])}>
          Clear
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto pr-0.5">
        {shown.map((o) => {
          const on = set.has(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-muted", o.count === 0 && !on && "opacity-45")}
            >
              <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded border", on ? "border-accent bg-accent text-white" : "border-line-strong")}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1 truncate text-fg">{o.value}</span>
              <span className="text-[10.5px] text-subtle tabular-nums">{fmtNum(o.count)}</span>
            </button>
          );
        })}
        {!shown.length && <p className="px-2 py-4 text-center text-xs text-muted">No matches</p>}
        {visible.length > shown.length && <p className="px-2 py-2 text-center text-[11px] text-subtle">Showing first 400 of {fmtNum(visible.length)} — refine search</p>}
      </div>
    </div>
  );
}

/** Power BI-style slicer: searchable multi-select with live counts (cascading options supplied by caller). */
export function MultiSelect({ label, options, selected, onChange, icon, inline, className }: Props) {
  const [open, setOpen] = useState(false);
  const summary = selected.length === 0 ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-left transition-all",
        selected.length ? "border-accent/50 bg-accent/8 shadow-[0_0_0_3px_var(--ring)]" : "border-line-strong bg-input hover:border-accent/40"
      )}
    >
      {icon && <span className="text-muted [&_svg]:h-4 [&_svg]:w-4">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] leading-tight font-semibold tracking-wide text-subtle uppercase">{label}</span>
        <span className={cn("block truncate text-[12.5px] leading-tight", selected.length ? "font-semibold text-fg" : "text-muted")}>{summary}</span>
      </span>
      {selected.length > 0 && (
        <span
          role="button"
          tabIndex={-1}
          aria-label={`Clear ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            onChange([]);
          }}
          className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-surface-muted hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      )}
      <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
    </button>
  );

  if (inline) {
    return (
      <div className={className}>
        {trigger}
        {open && (
          <div className="animate-pop mt-1.5 rounded-xl border border-line bg-surface-strong p-2">
            <OptionList options={options} selected={selected} onChange={onChange} />
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen} trigger={trigger} width={300}>
        <div className="p-1">
          <OptionList options={options} selected={selected} onChange={onChange} />
        </div>
      </Popover>
    </div>
  );
}
