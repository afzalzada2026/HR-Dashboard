"use client";

import { Briefcase, Building2, CalendarRange, ChevronDown, Droplet, Flag, Globe2, GraduationCap, Heart, Layers, MapPin, Map as MapIcon, RotateCcw, SlidersHorizontal, UserCog, Users, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { activeFilterCount, availableOptions, FILTER_LABELS, type Option } from "@/lib/filters";
import { cn, fmtNum } from "@/lib/format";
import type { MultiKey } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { MultiSelect } from "../ui/MultiSelect";
import { Button, Drawer } from "../ui/primitives";

const ICONS: Record<MultiKey, ReactNode> = {
  division: <Building2 />, department: <Layers />, title: <Briefcase />, level: <SlidersHorizontal />, supervisor: <UserCog />,
  gender: <Users />, nationality: <Flag />, maritalStatus: <Heart />, qualification: <GraduationCap />, expatLocal: <Globe2 />, bloodGroup: <Droplet />,
  region: <MapIcon />, province: <MapPin />, dutyStation: <MapPin />,
};

const GROUPS: { title: string; keys: MultiKey[] }[] = [
  { title: "Organization", keys: ["division", "department", "title", "level", "supervisor"] },
  { title: "Employee", keys: ["gender", "nationality", "maritalStatus", "qualification", "expatLocal", "bloodGroup"] },
  { title: "Location", keys: ["region", "province", "dutyStation"] },
];

const AGE_PRESETS: [string, number | null, number | null][] = [["< 30", null, 29], ["30–44", 30, 44], ["45–54", 45, 54], ["55+", 55, null]];
const TENURE_PRESETS: [string, number | null, number | null][] = [["< 1 yr", null, 0.999], ["1–3", 1, 2.999], ["3–5", 3, 4.999], ["5–10", 5, 9.999], ["10+", 10, null]];

function Section({ title, count, children, defaultOpen = true }: { title: string; count: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-3 last:border-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-1 py-1">
        <span className="flex items-center gap-2 text-[12px] font-semibold tracking-wider text-muted uppercase">
          {title}
          {count > 0 && <span className="rounded-full bg-accent px-1.5 text-[10px] text-white">{count}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

export function FilterPane() {
  const open = useUIStore((s) => s.filterPaneOpen);
  const setOpen = useUIStore((s) => s.setFilterPane);
  const employees = useDataStore((s) => s.employees);
  const filters = useDataStore((s) => s.filters);
  const filtered = useDataStore((s) => s.filtered.length);
  const setFilter = useDataStore((s) => s.setFilter);
  const patch = useDataStore((s) => s.patchFilters);
  const clear = useDataStore((s) => s.clearFilters);

  const options = useMemo(() => {
    if (!open) return null;
    const res = {} as Record<MultiKey, Option[]>;
    for (const g of GROUPS) for (const k of g.keys) res[k] = availableOptions(employees, filters, k);
    return res;
  }, [open, employees, filters]);

  const total = activeFilterCount(filters);
  const cnt = (keys: MultiKey[]) => keys.filter((k) => filters[k].length).length;
  const timelineCount = [filters.joinFrom || filters.joinTo, filters.dobFrom || filters.dobTo, filters.ageMin !== null || filters.ageMax !== null, filters.tenureMin !== null || filters.tenureMax !== null].filter(Boolean).length;

  return (
    <Drawer open={open} onClose={() => setOpen(false)} width="max-w-[430px]" label="Filters">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
            <SlidersHorizontal className="h-4 w-4 text-accent" /> Advanced Filters
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Cascading slicers · <span className="font-semibold text-fg">{fmtNum(filtered)}</span> of {fmtNum(employees.length)} employees
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close filters">
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5">
        {options &&
          GROUPS.map((g) => (
            <Section key={g.title} title={g.title} count={cnt(g.keys)}>
              {g.keys.map((k) => (
                <MultiSelect key={k} inline label={FILTER_LABELS[k]} icon={ICONS[k]} options={options[k]} selected={filters[k]} onChange={(v) => setFilter(k, v)} />
              ))}
            </Section>
          ))}
        <Section title="Timeline" count={timelineCount}>
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase">
              <CalendarRange className="h-3.5 w-3.5" /> Joining date
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field h-9 text-xs" value={filters.joinFrom} onChange={(e) => patch({ joinFrom: e.target.value })} aria-label="Joined from" />
              <input type="date" className="field h-9 text-xs" value={filters.joinTo} onChange={(e) => patch({ joinTo: e.target.value })} aria-label="Joined to" />
            </div>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase">
              <CalendarRange className="h-3.5 w-3.5" /> Birth date
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" className="field h-9 text-xs" value={filters.dobFrom} onChange={(e) => patch({ dobFrom: e.target.value })} aria-label="Born from" />
              <input type="date" className="field h-9 text-xs" value={filters.dobTo} onChange={(e) => patch({ dobTo: e.target.value })} aria-label="Born to" />
            </div>
          </div>
          {(
            [
              ["Age range (years)", "ageMin", "ageMax", AGE_PRESETS],
              ["Tenure range (years)", "tenureMin", "tenureMax", TENURE_PRESETS],
            ] as const
          ).map(([label, minK, maxK, presets]) => (
            <div key={label} className="rounded-xl border border-line p-3">
              <p className="mb-2 text-[11px] font-semibold text-muted uppercase">{label}</p>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min={0} placeholder="Min" className="field h-9 text-xs" value={filters[minK] ?? ""} onChange={(e) => patch({ [minK]: numOrNull(e.target.value) })} />
                <input type="number" min={0} placeholder="Max" className="field h-9 text-xs" value={filters[maxK] ?? ""} onChange={(e) => patch({ [maxK]: numOrNull(e.target.value) })} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {presets.map(([pl, a, b]) => {
                  const on = filters[minK] === a && filters[maxK] === b;
                  return (
                    <button
                      key={pl}
                      type="button"
                      onClick={() => patch(on ? { [minK]: null, [maxK]: null } : { [minK]: a, [maxK]: b })}
                      className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", on ? "border-accent bg-accent text-white" : "border-line text-muted hover:border-accent/50 hover:text-fg")}
                    >
                      {pl}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </Section>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        <Button variant="outline" onClick={clear} disabled={!total} className="flex-1">
          <RotateCcw /> Reset all
        </Button>
        <Button variant="primary" onClick={() => setOpen(false)} className="flex-1">
          Show {fmtNum(filtered)} results
        </Button>
      </div>
    </Drawer>
  );
}
