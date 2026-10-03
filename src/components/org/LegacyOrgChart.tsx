import React, { useMemo } from "react";
import type { Employee } from "@/lib/types";
import { buildOrgFromLegacy } from "@/lib/legacy-to-mod";

/**
 * Lightweight visual wrapper for testing/previewing the legacy single-file
 * organogram UI. This intentionally reuses the repo's shapes (OrgNode-like)
 * returned by the adapter and renders a simple stacked tree so it's safe and
 * easy to maintain as a visual fallback.
 */

function LegacyNode({
  node,
  depth = 0,
  onOpenEmployee,
}: {
  node: any;
  depth?: number;
  onOpenEmployee: (id: string | null) => void;
}) {
  const employee = node.emp as Employee;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;

  return (
    <div className="relative" style={{ marginLeft: depth * 18 }}>
      <div className="rounded-xl border border-sky-200 bg-white/90 p-2 shadow-sm">
        <button
          type="button"
          onClick={() => onOpenEmployee(employee.id)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <div className="truncate text-[12px] font-bold text-slate-900">
              {employee.title || "Position"}
            </div>
            <div className="truncate text-[11px] text-slate-700">
              {employee.fullName || "Unnamed employee"}
            </div>
          </div>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700">
            {employee.level || "Unspecified"}
          </span>
        </button>

        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-600">
          {employee.department && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5">{employee.department}</span>
          )}
          {employee.division && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5">{employee.division}</span>
          )}
          {employee.supervisor && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
              Supervisor: {employee.supervisor}
            </span>
          )}
        </div>
      </div>

      {hasChildren && (
        <div className="mt-2 border-l border-sky-200 pl-3">
          {node.children.map((child: any) => (
            <LegacyNode key={child.id} node={child} depth={depth + 1} onOpenEmployee={onOpenEmployee} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LegacyOrgChart({
  employees,
  division,
  department,
  title,
  subtitle,
  onOpenEmployee,
}: {
  employees: Employee[];
  division?: string;
  department?: string;
  title: string;
  subtitle: string;
  onOpenEmployee: (id: string | null) => void;
}) {
  // apply the same scoping logic as the normal view: filter employees by division/department
  const filtered = useMemo(
    () =>
      employees.filter(
        (employee) =>
          (!division || employee.division === division) && (!department || employee.department === department),
      ),
    [employees, division, department],
  );

  // Use the adapter to produce a build that matches the repo's OrgNode structure.
  const build = useMemo(() => buildOrgFromLegacy(filtered as any), [filtered]);
  const roots = build.roots ?? [];

  return (
    <div className="glass overflow-hidden rounded-2xl border border-sky-200" data-export-expand="true">
      <div className="border-b border-sky-200 bg-sky-50/70 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              Legacy org chart
            </div>
            <div className="text-sm font-bold text-slate-900">{title}</div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-800">
            Legacy org adapter enabled
          </span>
        </div>
        <div className="mt-1 text-[10px] text-slate-600">{subtitle}</div>
      </div>

      <div className="space-y-3 p-3">
        {!roots.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
            No employee records available for the selected scope.
          </div>
        ) : (
          roots.map((root: any) => <LegacyNode key={root.id} node={root} onOpenEmployee={onOpenEmployee} />)
        )}
      </div>
    </div>
  );
}
