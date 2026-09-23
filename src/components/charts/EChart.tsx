"use client";

import type { ECharts, EChartsOption } from "echarts";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";
import { useUIStore } from "@/store/ui";
import { useChartTokens, withBase } from "./tokens";

type EChartsModule = typeof import("echarts");

let ecPromise: Promise<EChartsModule> | null = null;
let mapPromise: Promise<void> | null = null;

/** Lazy-loads ECharts (code-split) and, when needed, registers the Afghanistan provinces GeoJSON. */
export function loadEcharts(withMap = false): Promise<EChartsModule> {
  if (!ecPromise) ecPromise = import("echarts");
  const base = ecPromise;
  if (!withMap) return base;
  if (!mapPromise) {
    mapPromise = base
      .then(async (ec) => {
        const res = await fetch("/geo/afghanistan.json");
        if (!res.ok) throw new Error("Map data unavailable");
        ec.registerMap("AFG", (await res.json()) as Parameters<EChartsModule["registerMap"]>[1]);
      })
      .catch((err) => {
        mapPromise = null;
        throw err;
      });
  }
  return mapPromise.then(() => base);
}

export interface ChartClick {
  name: string;
  seriesName?: string;
  seriesIndex?: number;
  seriesType?: string;
  dataIndex: number;
  value?: unknown;
  data?: unknown;
  componentType?: string;
}

export interface EChartProps {
  option: EChartsOption;
  height?: number | string;
  onClick?: (p: ChartClick) => void;
  needsMap?: boolean;
  onInstance?: (c: ECharts | null) => void;
  className?: string;
}

export default function EChart({ option, height = 300, onClick, needsMap = false, onInstance, className }: EChartProps) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  const instRef = useRef(onInstance);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const tokens = useChartTokens();
  const exporting = useUIStore((s) => s.exporting);

  useEffect(() => {
    clickRef.current = onClick;
    instRef.current = onInstance;
  });

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    loadEcharts(needsMap)
      .then((ec) => {
        if (disposed || !el.current) return;
        const c = ec.init(el.current, undefined, { renderer: "canvas" });
        chart.current = c;
        c.on("click", (p) => clickRef.current?.(p as unknown as ChartClick));
        ro = new ResizeObserver(() => c.resize());
        ro.observe(el.current);
        instRef.current?.(c);
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      disposed = true;
      ro?.disconnect();
      chart.current?.dispose();
      chart.current = null;
      instRef.current?.(null);
    };
  }, [needsMap]);

  useEffect(() => {
    if (ready && chart.current) chart.current.setOption(withBase(option, tokens, !exporting), { notMerge: true, lazyUpdate: true });
  }, [ready, option, tokens, exporting]);

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <div ref={el} className="absolute inset-0" />
      {!ready && !failed && <div className="skeleton absolute inset-0" />}
      {failed && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Visual failed to load</div>}
    </div>
  );
}
