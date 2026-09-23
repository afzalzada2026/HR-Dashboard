"use client";

import type { EChartsOption } from "echarts";
import { useMemo } from "react";
import type { Theme } from "@/lib/types";
import { useUIStore } from "@/store/ui";

export const CHART_FONT = '"Segoe UI Variable Text", "Segoe UI", Inter, system-ui, sans-serif';

export interface ChartTokens {
  theme: Theme;
  isDark: boolean;
  text: string;
  muted: string;
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  palette: string[];
  male: string;
  female: string;
  seq: string[];
  surface: string;
  bg: string;
  primary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  mapEmpty: string;
  mapBorder: string;
}

const LIGHT: ChartTokens = {
  theme: "light", isDark: false,
  text: "#0B1B33", muted: "#5B6B82", axis: "rgba(6,43,91,0.18)", grid: "rgba(6,43,91,0.07)",
  tooltipBg: "rgba(255,255,255,0.97)", tooltipBorder: "rgba(13,71,161,0.14)", tooltipText: "#0B1B33",
  palette: ["#0D47A1", "#00A8FF", "#062B5B", "#42A5F5", "#26C6DA", "#7E57C2", "#5C6BC0", "#90CAF9", "#FFB300", "#EC407A", "#66BB6A", "#8D6E63"],
  male: "#0D47A1", female: "#EC4899",
  seq: ["#E3F2FD", "#90CAF9", "#42A5F5", "#1E88E5", "#0D47A1", "#062B5B"],
  surface: "#FFFFFF", bg: "#F4F8FC", primary: "#0D47A1", accent: "#00A8FF",
  success: "#12B76A", warning: "#F79009", danger: "#F04438",
  mapEmpty: "#EEF3FA", mapBorder: "#FFFFFF",
};

const DARK: ChartTokens = {
  theme: "dark", isDark: true,
  text: "#E6EEF8", muted: "#93A5BF", axis: "rgba(255,255,255,0.16)", grid: "rgba(255,255,255,0.06)",
  tooltipBg: "rgba(12,24,44,0.97)", tooltipBorder: "rgba(255,255,255,0.12)", tooltipText: "#E6EEF8",
  palette: ["#3D8BFF", "#00A8FF", "#7CC4FF", "#26C6DA", "#9575CD", "#4DD0E1", "#5C6BC0", "#90CAF9", "#FFCA28", "#F06292", "#81C784", "#A1887F"],
  male: "#3D8BFF", female: "#F472B6",
  seq: ["#13294A", "#163A6B", "#1E5AA8", "#2F7FE0", "#00A8FF", "#7FD4FF"],
  surface: "#0E1B2E", bg: "#060E1A", primary: "#3D8BFF", accent: "#00A8FF",
  success: "#32D583", warning: "#FDB022", danger: "#F97066",
  mapEmpty: "#101F36", mapBorder: "#060E1A",
};

const ATOMA: ChartTokens = {
  theme: "atoma", isDark: true,
  text: "#FFFFFF", muted: "rgba(226,238,255,0.76)", axis: "rgba(255,255,255,0.25)", grid: "rgba(255,255,255,0.08)",
  tooltipBg: "rgba(6,43,91,0.97)", tooltipBorder: "rgba(0,168,255,0.45)", tooltipText: "#FFFFFF",
  palette: ["#00A8FF", "#FFFFFF", "#4FC3F7", "#81D4FA", "#29B6F6", "#B3E5FC", "#FFD54F", "#F48FB1", "#80CBC4", "#9FA8DA", "#CE93D8", "#A5D6A7"],
  male: "#00A8FF", female: "#F9A8D4",
  seq: ["#0E3B7A", "#1052A8", "#1565C0", "#1E88E5", "#00A8FF", "#B3E5FC"],
  surface: "#0A3670", bg: "#062B5B", primary: "#00A8FF", accent: "#00A8FF",
  success: "#4ADE80", warning: "#FBBF24", danger: "#FB7185",
  mapEmpty: "rgba(255,255,255,0.08)", mapBorder: "#062B5B",
};

export function getTokens(theme: Theme): ChartTokens {
  return theme === "dark" ? DARK : theme === "atoma" ? ATOMA : LIGHT;
}

export function useChartTokens(): ChartTokens {
  const theme = useUIStore((s) => s.theme);
  return useMemo(() => getTokens(theme), [theme]);
}

type Obj = Record<string, unknown>;

/** Applies ATOMA theme defaults (typography, palette, tooltip & legend styling) to any chart option. */
export function withBase(option: EChartsOption, t: ChartTokens, animate = true): EChartsOption {
  const o = option as Obj;
  const tooltip =
    o.tooltip === undefined
      ? undefined
      : {
          backgroundColor: t.tooltipBg,
          borderColor: t.tooltipBorder,
          borderWidth: 1,
          padding: [8, 12],
          textStyle: { color: t.tooltipText, fontSize: 12, fontFamily: CHART_FONT },
          extraCssText: "border-radius:12px;box-shadow:0 12px 32px rgba(2,12,34,.25);",
          ...(o.tooltip as Obj),
        };
  const legend =
    o.legend === undefined || Array.isArray(o.legend)
      ? o.legend
      : { textStyle: { color: t.muted, fontSize: 11, fontFamily: CHART_FONT }, icon: "circle", itemWidth: 8, itemHeight: 8, itemGap: 14, ...(o.legend as Obj) };
  return {
    backgroundColor: "transparent",
    color: t.palette,
    animation: animate,
    animationDuration: 850,
    animationEasing: "cubicOut",
    textStyle: { fontFamily: CHART_FONT, color: t.text },
    ...o,
    ...(tooltip ? { tooltip } : {}),
    ...(legend ? { legend } : {}),
  } as EChartsOption;
}
