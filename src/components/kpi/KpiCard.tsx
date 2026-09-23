"use client";

import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon, Minus } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn, fmtNum } from "@/lib/format";
import { Tooltip } from "../ui/primitives";

export function useCountUp(target: number, duration = 1100): number {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!isFinite(target)) {
      setVal(target);
      return;
    }
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = origin + (target - origin) * eased;
      setVal(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function Sparkline({ values, color, width = 92, height = 34 }: { values: number[]; color: string; width?: number; height?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 4 - ((v - min) / range) * (height - 8)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#sg${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="spark-line" />
      <circle cx={last[0]} cy={last[1]} r="2.8" fill={color} stroke="white" strokeWidth="1" />
    </svg>
  );
}

export interface Trend {
  pct: number | null;
  polarity: "up-good" | "down-good" | "neutral";
  label?: string;
}

export function TrendBadge({ trend }: { trend: Trend }) {
  const { pct, polarity, label } = trend;
  if (pct === null || !isFinite(pct)) return <span className="text-[11px] text-subtle">{label ?? "no prior data"}</span>;
  const up = pct > 0.05;
  const down = pct < -0.05;
  const good = polarity === "neutral" ? null : polarity === "up-good" ? up : down;
  const tone = !up && !down ? "text-muted bg-surface-muted" : good === null ? "text-primary bg-primary/10 dark:text-accent dark:bg-accent/15" : good ? "text-success bg-success/12" : "text-danger bg-danger/12";
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums", tone)}>
        <Icon className="h-3 w-3" strokeWidth={2.6} />
        {Math.abs(pct).toFixed(1)}%
      </span>
      {label && <span className="text-[10.5px] text-subtle">{label}</span>}
    </span>
  );
}

export interface KpiCardProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  sub?: string;
  trend?: Trend;
  spark?: number[];
  icon: LucideIcon;
  accent: [string, string];
  tooltip?: string;
  index?: number;
  onClick?: () => void;
}

export function KpiCard({ label, value, format, sub, trend, spark, icon: Icon, accent, tooltip, index = 0, onClick }: KpiCardProps) {
  const animated = useCountUp(value);
  const display = format ? format(animated) : fmtNum(animated);
  return (
    <div
      onClick={onClick}
      className={cn("glass hover-lift animate-fade-up group relative overflow-hidden rounded-2xl p-4", onClick && "cursor-pointer")}
      style={{ animationDelay: `${Math.min(index, 20) * 35}ms` }}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-35" style={{ background: accent[1] }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-80" style={{ background: `linear-gradient(90deg, ${accent[0]}, ${accent[1]})` }} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="truncate text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
            {tooltip && (
              <Tooltip content={tooltip}>
                <Info className="h-3 w-3 text-subtle" />
              </Tooltip>
            )}
          </div>
          <p className="mt-1.5 truncate text-[26px] leading-none font-bold tracking-tight text-fg tabular-nums">{display}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3" style={{ background: `linear-gradient(135deg, ${accent[0]}, ${accent[1]})` }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="relative mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {trend && <TrendBadge trend={trend} />}
          {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
        </div>
        {spark && <Sparkline values={spark} color={accent[1]} />}
      </div>
    </div>
  );
}
