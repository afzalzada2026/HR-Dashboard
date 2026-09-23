"use client";

import type { ECharts, EChartsOption } from "echarts";
import { ChartColumn, Download, Info, Maximize2, MousePointerClick, Table2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cn, downloadDataUrl, slugify } from "@/lib/format";
import { useUIStore } from "@/store/ui";
import { Badge, IconButton, Modal, Tooltip } from "../ui/primitives";
import EChart, { type ChartClick } from "./EChart";
import { useChartTokens } from "./tokens";

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

/** Renders children only once scrolled near the viewport (or immediately while exporting). */
export function LazyMount({ height, children }: { height: number | string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const exporting = useUIStore((s) => s.exporting);
  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);
  return (
    <div ref={ref} style={{ minHeight: height }}>
      {visible || exporting ? children : <div className="skeleton" style={{ height }} />}
    </div>
  );
}

function MiniTable({ table, height }: { table: ChartTable; height: number | string }) {
  return (
    <div className="overflow-auto rounded-xl border border-line" style={{ height }}>
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-surface-strong">
          <tr>
            {table.columns.map((c) => (
              <th key={c} className="border-b border-line px-3 py-2 font-semibold text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="odd:bg-surface-muted/60">
              {r.map((v, j) => (
                <td key={j} className={cn("px-3 py-1.5 text-fg", typeof v === "number" && "text-right tabular-nums")}>
                  {typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 1 }) : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  title: string;
  subtitle?: string;
  info?: string;
  option: EChartsOption;
  height?: number;
  onClick?: (p: ChartClick) => void;
  needsMap?: boolean;
  table?: ChartTable;
  className?: string;
  actions?: ReactNode;
  badge?: string;
  interactive?: boolean;
  footer?: ReactNode;
  delay?: number;
}

export function ChartCard({ title, subtitle, info, option, height = 300, onClick, needsMap, table, className, actions, badge, interactive, footer, delay = 0 }: Props) {
  const [full, setFull] = useState(false);
  const [tableView, setTableView] = useState(false);
  const inst = useRef<ECharts | null>(null);
  const t = useChartTokens();
  const png = () => {
    const url = inst.current?.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: t.surface });
    if (url) downloadDataUrl(url, `${slugify(title)}.png`);
  };
  return (
    <section className={cn("glass animate-fade-up flex min-w-0 flex-col rounded-2xl p-4 transition-shadow hover:shadow-[var(--shadow-lg)] sm:p-5", className)} style={{ animationDelay: `${delay}ms` }}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14.5px] font-semibold text-fg">{title}</h3>
            {badge && <Badge tone="primary">{badge}</Badge>}
            {info && (
              <Tooltip content={info}>
                <Info className="h-3.5 w-3.5 text-subtle" />
              </Tooltip>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-muted">
              {interactive && <MousePointerClick className="h-3 w-3 text-accent" />}
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5" data-no-capture="true">
          {actions}
          {table && (
            <IconButton label={tableView ? "Show visual" : "Show as table"} onClick={() => setTableView((v) => !v)} active={tableView}>
              {tableView ? <ChartColumn /> : <Table2 />}
            </IconButton>
          )}
          <IconButton label="Download PNG" onClick={png} disabled={tableView}>
            <Download />
          </IconButton>
          <IconButton label="Focus mode" onClick={() => setFull(true)}>
            <Maximize2 />
          </IconButton>
        </div>
      </header>
      <div className="min-w-0 flex-1">
        <LazyMount height={height}>
          {tableView && table ? (
            <MiniTable table={table} height={height} />
          ) : (
            <EChart option={option} height={height} onClick={onClick} needsMap={needsMap} onInstance={(c) => (inst.current = c)} />
          )}
        </LazyMount>
      </div>
      {footer && <div className="mt-3">{footer}</div>}
      <Modal open={full} onClose={() => setFull(false)} title={title} subtitle={subtitle} size="xl">
        {table && tableView ? <MiniTable table={table} height="68vh" /> : <EChart option={option} height="68vh" onClick={onClick} needsMap={needsMap} />}
      </Modal>
    </section>
  );
}
