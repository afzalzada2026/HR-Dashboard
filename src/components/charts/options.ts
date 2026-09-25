import type { EChartsOption } from "echarts";
import type { NameValue, SunNode } from "@/lib/analytics";
import type { ChartTokens } from "./tokens";

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 }));

const axisBase = (t: ChartTokens) => ({
  axisLine: { lineStyle: { color: t.axis } },
  axisTick: { show: false },
  axisLabel: { color: t.muted, fontSize: 11 },
  splitLine: { lineStyle: { color: t.grid, type: "dashed" } },
});

export const grad = (a: string, b: string, horizontal = false) => ({
  type: "linear", x: 0, y: 0, x2: horizontal ? 1 : 0, y2: horizontal ? 0 : 1,
  colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }],
});

const dim = (sel: Set<string>, name: string) => (sel.size && !sel.has(name) ? 0.28 : 1);

export function barOption(data: NameValue[], t: ChartTokens, o: { horizontal?: boolean; selected?: string[]; colors?: [string, string]; rotate?: number; label?: boolean; unit?: string } = {}): EChartsOption {
  const sel = new Set(o.selected ?? []);
  const [c1, c2] = o.colors ?? [t.accent, t.primary];
  const cat = { type: "category", data: data.map((d) => d.name), ...axisBase(t), axisLabel: { color: t.muted, fontSize: 11, interval: 0, rotate: o.rotate ?? 0, width: o.horizontal ? 130 : 96, overflow: "truncate" } };
  const val = { type: "value", ...axisBase(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 10.5 } };
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => `${fmt(Number(v))}${o.unit ?? ""}` },
    grid: { left: 6, right: o.horizontal ? 44 : 10, top: 26, bottom: 6, containLabel: true },
    xAxis: (o.horizontal ? val : cat) as any,
    yAxis: (o.horizontal ? { ...cat, inverse: true } : val) as any,
    series: [
      {
        type: "bar",
        name: "Employees",
        data: data.map((d) => ({ value: d.value, name: d.name, itemStyle: { opacity: dim(sel, d.name) } })),
        barMaxWidth: o.horizontal ? 18 : 40,
        itemStyle: { borderRadius: o.horizontal ? [0, 6, 6, 0] : [7, 7, 0, 0], color: o.horizontal ? grad(c2, c1, true) : grad(c1, c2) },
        label: { show: o.label !== false, position: o.horizontal ? "right" : "top", color: t.muted, fontSize: 10.5, formatter: (p: any) => fmt(p.value) },
        emphasis: { itemStyle: { shadowBlur: 14, shadowColor: "rgba(0,168,255,.45)" } },
      },
    ],
  } as EChartsOption;
}

export function donutOption(data: NameValue[], t: ChartTokens, o: { selected?: string[]; colors?: string[]; centerLabel?: string; legend?: "bottom" | "right" | "none" } = {}): EChartsOption {
  const sel = new Set(o.selected ?? []);
  const total = data.reduce((s, d) => s + d.value, 0);
  const legendPos = o.legend ?? "bottom";
  return {
    tooltip: { trigger: "item", formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${fmt(p.value)}</b> · ${p.percent}%` },
    legend: legendPos === "none" ? { show: false } : legendPos === "right" ? { type: "scroll", orient: "vertical", right: 0, top: "middle" } : { type: "scroll", bottom: 0 },
    title: { text: fmt(total), subtext: o.centerLabel ?? "Employees", left: legendPos === "right" ? "34%" : "center", top: legendPos === "bottom" ? "33%" : "38%", textAlign: legendPos === "right" ? "center" : undefined, textStyle: { color: t.text, fontSize: 20, fontWeight: 700 }, subtextStyle: { color: t.muted, fontSize: 11 }, itemGap: 4 },
    series: [
      {
        type: "pie",
        radius: ["54%", "78%"],
        center: [legendPos === "right" ? "35%" : "50%", legendPos === "bottom" ? "42%" : "50%"],
        avoidLabelOverlap: true,
        padAngle: 1.5,
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 6 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 7 },
        color: o.colors,
        data: data.map((d) => ({ ...d, itemStyle: { opacity: dim(sel, d.name) } })),
      },
    ],
  } as EChartsOption;
}

export function pieOption(data: NameValue[], t: ChartTokens, o: { selected?: string[]; rose?: boolean; colors?: string[] } = {}): EChartsOption {
  const sel = new Set(o.selected ?? []);
  return {
    tooltip: { trigger: "item", formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${fmt(p.value)}</b> · ${p.percent}%` },
    legend: { type: "scroll", bottom: 0 },
    series: [
      {
        type: "pie",
        radius: o.rose ? ["16%", "72%"] : "68%",
        center: ["50%", "45%"],
        roseType: o.rose ? "area" : undefined,
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: o.rose ? 6 : 4 },
        label: { color: t.muted, fontSize: 11, formatter: "{b}\n{d}%" },
        labelLine: { lineStyle: { color: t.axis } },
        color: o.colors,
        data: data.map((d) => ({ ...d, itemStyle: { opacity: dim(sel, d.name) } })),
      },
    ],
  } as EChartsOption;
}

export function stackedOption(categories: string[], series: { name: string; data: number[]; color: string }[], t: ChartTokens, o: { horizontal?: boolean; percent?: boolean; rotate?: number } = {}): EChartsOption {
  const totals = categories.map((_, i) => series.reduce((s, x) => s + (x.data[i] || 0), 0));
  const cat = { type: "category", data: categories, ...axisBase(t), axisLabel: { color: t.muted, fontSize: 11, interval: 0, rotate: o.rotate ?? 0, width: 110, overflow: "truncate" } };
  const val = { type: "value", max: o.percent ? 100 : undefined, ...axisBase(t), axisLine: { show: false }, axisLabel: { color: t.muted, fontSize: 10.5, formatter: o.percent ? "{value}%" : "{value}" } };
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: any) => (o.percent ? `${Number(v).toFixed(1)}%` : fmt(Number(v))) },
    legend: { top: 0, right: 0 },
    grid: { left: 6, right: 12, top: 34, bottom: 6, containLabel: true },
    xAxis: (o.horizontal ? val : cat) as any,
    yAxis: (o.horizontal ? { ...cat, inverse: true } : val) as any,
    series: series.map((s, si) => ({
      type: "bar",
      name: s.name,
      stack: "total",
      barMaxWidth: 42,
      data: s.data.map((v, i) => (o.percent ? (totals[i] ? (v / totals[i]) * 100 : 0) : v)),
      itemStyle: { color: s.color, borderRadius: si === series.length - 1 ? (o.horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]) : 0 },
      label: { show: true, color: "#fff", fontSize: 10, formatter: (p: any) => (o.percent ? (p.value >= 8 ? `${p.value.toFixed(0)}%` : "") : p.value >= Math.max(...totals) * 0.08 ? fmt(p.value) : "") },
      emphasis: { focus: "series" },
    })),
  } as EChartsOption;
}

export function histogramOption(labels: string[], values: number[], t: ChartTokens, o: { selectedIndex?: number | null; colors?: [string, string]; name?: string } = {}): EChartsOption {
  const [c1, c2] = o.colors ?? [t.accent, t.primary];
  const total = values.reduce((a, b) => a + b, 0) || 1;
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: any) => `${ps[0].name}<br/><b>${fmt(ps[0].value)}</b> employees · ${((ps[0].value / total) * 100).toFixed(1)}%` },
    grid: { left: 6, right: 10, top: 26, bottom: 6, containLabel: true },
    xAxis: { type: "category", data: labels, ...axisBase(t) } as any,
    yAxis: { type: "value", ...axisBase(t), axisLine: { show: false } } as any,
    series: [
      {
        type: "bar",
        name: o.name ?? "Employees",
        barCategoryGap: "10%",
        data: values.map((v, i) => ({ value: v, itemStyle: { opacity: o.selectedIndex !== null && o.selectedIndex !== undefined && o.selectedIndex !== i ? 0.3 : 1 } })),
        itemStyle: { borderRadius: [8, 8, 0, 0], color: grad(c1, c2) },
        label: { show: true, position: "top", color: t.muted, fontSize: 10.5, formatter: (p: any) => `${((p.value / total) * 100).toFixed(0)}%` },
        emphasis: { itemStyle: { shadowBlur: 14, shadowColor: "rgba(0,168,255,.45)" } },
      },
    ],
  } as EChartsOption;
}

export function trendOption(labels: string[], hires: number[], cumulative: number[], t: ChartTokens, o: { zoom?: boolean } = {}): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "cross", label: { backgroundColor: t.primary } } },
    legend: { top: 0, right: 0 },
    grid: { left: 6, right: 6, top: 34, bottom: o.zoom ? 46 : 6, containLabel: true },
    xAxis: { type: "category", data: labels, boundaryGap: true, ...axisBase(t) } as any,
    yAxis: [
      { type: "value", name: "Hires", nameTextStyle: { color: t.muted, fontSize: 10 }, ...axisBase(t), axisLine: { show: false } },
      { type: "value", name: "Headcount", nameTextStyle: { color: t.muted, fontSize: 10 }, ...axisBase(t), axisLine: { show: false }, splitLine: { show: false }, scale: true },
    ] as any,
    dataZoom: o.zoom
      ? [
          { type: "inside", start: 40, end: 100 },
          { type: "slider", start: 40, end: 100, height: 18, bottom: 8, borderColor: "transparent", backgroundColor: t.grid, fillerColor: "rgba(0,168,255,0.18)", handleStyle: { color: t.accent }, textStyle: { color: t.muted, fontSize: 10 }, dataBackground: { lineStyle: { color: t.accent }, areaStyle: { color: "rgba(0,168,255,0.12)" } } },
        ]
      : undefined,
    series: [
      { type: "bar", name: "Monthly hires", data: hires, barMaxWidth: 16, itemStyle: { color: grad(t.accent, t.primary), borderRadius: [4, 4, 0, 0] } },
      {
        type: "line", name: "Cumulative headcount", yAxisIndex: 1, data: cumulative, smooth: true, symbol: "circle", symbolSize: 5, showSymbol: false,
        lineStyle: { width: 2.5, color: t.isDark ? "#7FD4FF" : t.primary }, itemStyle: { color: t.isDark ? "#7FD4FF" : t.primary },
        areaStyle: { color: grad(t.isDark ? "rgba(127,212,255,0.25)" : "rgba(13,71,161,0.18)", "rgba(0,168,255,0)") },
      },
    ],
  } as EChartsOption;
}

export function treemapOption(data: NameValue[], t: ChartTokens, o: { selected?: string[]; colors?: string[] } = {}): EChartsOption {
  const sel = new Set(o.selected ?? []);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colors = o.colors ?? t.palette;
  return {
    tooltip: { formatter: (p: any) => `${p.marker} ${p.name}<br/><b>${fmt(p.value)}</b> · ${((p.value / total) * 100).toFixed(1)}%` },
    series: [
      {
        type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false }, left: 0, right: 0, top: 0, bottom: 0,
        label: { show: true, formatter: (p: any) => `{n|${p.name}}\n{v|${fmt(p.value)} · ${((p.value / total) * 100).toFixed(1)}%}`, rich: { n: { fontSize: 12.5, fontWeight: 700, color: "#fff" }, v: { fontSize: 10.5, color: "rgba(255,255,255,0.85)", padding: [3, 0, 0, 0] } } },
        itemStyle: { borderColor: t.surface, borderWidth: 2, gapWidth: 2, borderRadius: 8 },
        data: data.map((d, i) => ({ name: d.name, value: d.value, itemStyle: { color: colors[i % colors.length] === "#FFFFFF" ? "#4FC3F7" : colors[i % colors.length], opacity: dim(sel, d.name) } })),
      },
    ],
  } as EChartsOption;
}

export function sunburstOption(data: SunNode[], t: ChartTokens): EChartsOption {
  return {
    tooltip: { trigger: "item", formatter: (p: any) => `${(p.treePathInfo ?? []).map((x: any) => x.name).filter(Boolean).join(" › ")}<br/><b>${fmt(p.value)}</b> employees` },
    series: [
      {
        type: "sunburst", data, radius: ["10%", "96%"], nodeClick: "rootToNode", sort: "desc",
        emphasis: { focus: "ancestor" },
        itemStyle: { borderColor: t.surface, borderWidth: 1.5, borderRadius: 3 },
        label: { color: "#fff", fontSize: 10, minAngle: 9 },
        levels: [
          {},
          { r0: "10%", r: "38%", label: { rotate: "tangential", fontSize: 11, fontWeight: 600 } },
          { r0: "38%", r: "68%", label: { align: "right", fontSize: 9.5 } },
          { r0: "68%", r: "96%", label: { position: "outside", show: false }, itemStyle: { opacity: 0.85 } },
        ],
      },
    ],
  } as EChartsOption;
}

export function scatterOption(groups: { name: string; color: string; points: [number, number, string, string][] }[], t: ChartTokens): EChartsOption {
  const large = groups.reduce((s, g) => s + g.points.length, 0) > 3000;
  return {
    tooltip: { trigger: "item", formatter: (p: any) => `<b>${p.value[2]}</b><br/>Age ${p.value[0].toFixed(0)} · Tenure ${p.value[1].toFixed(1)} yrs<br/><span style="opacity:.7">Click to open profile</span>` },
    legend: { top: 0, right: 0 },
    grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
    xAxis: { type: "value", name: "Age", nameLocation: "middle", nameGap: 26, nameTextStyle: { color: t.muted }, min: 18, ...axisBase(t) } as any,
    yAxis: { type: "value", name: "Tenure (yrs)", nameTextStyle: { color: t.muted }, ...axisBase(t) } as any,
    series: groups.map((g) => ({
      type: "scatter", name: g.name, data: g.points, symbolSize: large ? 4 : 7, large, largeThreshold: 3000,
      itemStyle: { color: g.color, opacity: 0.72, borderColor: "rgba(255,255,255,0.4)", borderWidth: large ? 0 : 0.5 },
      emphasis: { itemStyle: { opacity: 1, borderColor: "#fff", borderWidth: 1.5 }, scale: 1.8 },
    })),
  } as EChartsOption;
}

export interface MapPoint {
  name: string;
  value: number;
}

export function mapOption(regions: MapPoint[], t: ChartTokens, o: { metricLabel?: string; unit?: string; selected?: string | null; stations?: { name: string; coord: [number, number]; count: number }[]; showLabels?: boolean; compact?: boolean } = {}): EChartsOption {
  const max = Math.max(1, ...regions.map((r) => r.value));
  const series: any[] = [{ type: "map", geoIndex: 0, name: o.metricLabel ?? "Headcount", data: regions }];
  if (o.stations?.length) {
    const smax = Math.max(1, ...o.stations.map((s) => s.count));
    series.push({
      type: "effectScatter", coordinateSystem: "geo", name: "Duty stations", zlevel: 2,
      data: o.stations.map((s) => ({ name: s.name, value: [s.coord[0], s.coord[1], s.count] })),
      symbolSize: (v: number[]) => 6 + Math.sqrt(v[2] / smax) * 20,
      rippleEffect: { scale: 2.4, brushType: "stroke", period: 5 },
      itemStyle: { color: "#FFB300", shadowBlur: 10, shadowColor: "rgba(255,179,0,0.6)" },
      label: { show: !o.compact, formatter: "{b}", position: "right", color: t.text, fontSize: 10, textBorderColor: t.surface, textBorderWidth: 2 },
    });
  }
  return {
    tooltip: {
      trigger: "item",
      formatter: (p: any) =>
        p.seriesType === "effectScatter"
          ? `<b>${p.name}</b> duty station<br/>${fmt(p.value[2])} employees`
          : `<b>${p.name}</b><br/>${o.metricLabel ?? "Headcount"}: <b>${Number.isFinite(p.value) ? fmt(p.value) : "0"}${o.unit ?? ""}</b>`,
    },
    visualMap: {
      min: 0, max, left: o.compact ? 4 : 12, bottom: o.compact ? 4 : 16, calculable: !o.compact, orient: "vertical", itemHeight: o.compact ? 70 : 120, itemWidth: 12,
      text: ["High", "Low"], textStyle: { color: t.muted, fontSize: 10 }, inRange: { color: t.seq }, seriesIndex: 0,
    },
    geo: {
      map: "AFG", roam: true, zoom: 1.12, scaleLimit: { min: 0.8, max: 8 }, selectedMode: false,
      label: { show: !!o.showLabels, color: t.isDark ? "rgba(255,255,255,0.8)" : "rgba(11,27,51,0.75)", fontSize: 9 },
      itemStyle: { areaColor: t.mapEmpty, borderColor: t.mapBorder, borderWidth: 1 },
      emphasis: { itemStyle: { areaColor: "#FFB300" }, label: { show: true, color: "#0B1B33", fontWeight: 700 } },
      regions: o.selected ? [{ name: o.selected, itemStyle: { borderColor: "#FFB300", borderWidth: 3, shadowBlur: 16, shadowColor: "rgba(255,179,0,0.8)" }, label: { show: true, color: "#fff", fontWeight: 700, textBorderColor: "#062B5B", textBorderWidth: 2 } }] : [],
    } as any,
    series,
  } as EChartsOption;
}

export function heatmapOption(rows: string[], cols: string[], data: [number, number, number][], t: ChartTokens, o: { percent?: boolean } = {}): EChartsOption {
  const max = Math.max(1, ...data.map((d) => d[2]));
  return {
    tooltip: { position: "top", formatter: (p: any) => `${rows[p.value[1]]} · ${cols[p.value[0]]}<br/><b>${o.percent ? `${p.value[2].toFixed(1)}%` : fmt(p.value[2])}</b>` },
    grid: { left: 6, right: 10, top: 8, bottom: 52, containLabel: true },
    xAxis: { type: "category", data: cols, ...axisBase(t), splitArea: { show: false } } as any,
    yAxis: { type: "category", data: rows, ...axisBase(t), axisLabel: { color: t.muted, fontSize: 11, width: 130, overflow: "truncate" } } as any,
    visualMap: { min: 0, max, calculable: true, orient: "horizontal", left: "center", bottom: 0, itemWidth: 12, itemHeight: 140, inRange: { color: t.seq }, textStyle: { color: t.muted, fontSize: 10 } },
    series: [
      {
        type: "heatmap", data,
        label: { show: true, fontSize: 11, fontWeight: 700, color: "#FFFFFF", textBorderColor: "rgba(6,20,45,0.55)", textBorderWidth: 2, formatter: (p: any) => (o.percent ? `${p.value[2].toFixed(0)}%` : fmt(p.value[2])) },
        itemStyle: { borderColor: t.surface, borderWidth: 3, borderRadius: 6 },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,0.35)" } },
      },
    ],
  } as EChartsOption;
}

export function pyramidOption(labels: string[], male: number[], female: number[], t: ChartTokens): EChartsOption {
  const max = Math.max(1, ...male, ...female);
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (ps: any) => `${ps[0].name}<br/>${ps.map((p: any) => `${p.marker} ${p.seriesName}: <b>${fmt(Math.abs(p.value))}</b>`).join("<br/>")}` },
    legend: { top: 0, right: 0 },
    grid: { left: 6, right: 10, top: 32, bottom: 6, containLabel: true },
    xAxis: { type: "value", min: -max, max, ...axisBase(t), axisLabel: { color: t.muted, fontSize: 10, formatter: (v: number) => fmt(Math.abs(v)) } } as any,
    yAxis: { type: "category", data: labels, ...axisBase(t), axisLine: { show: false } } as any,
    series: [
      { type: "bar", name: "Male", stack: "p", data: male.map((v) => -v), barCategoryGap: "18%", itemStyle: { color: grad(t.male, t.isDark ? "#7CC4FF" : "#42A5F5", true), borderRadius: [6, 0, 0, 6] }, label: { show: true, position: "left", color: t.muted, fontSize: 10, formatter: (p: any) => fmt(Math.abs(p.value)) } },
      { type: "bar", name: "Female", stack: "p", data: female, itemStyle: { color: grad("#F9A8D4", t.female, true), borderRadius: [0, 6, 6, 0] }, label: { show: true, position: "right", color: t.muted, fontSize: 10, formatter: (p: any) => fmt(p.value) } },
    ],
  } as EChartsOption;
}

export function funnelOption(data: NameValue[], t: ChartTokens, o: { selected?: string[] } = {}): EChartsOption {
  const sel = new Set(o.selected ?? []);
  const max = Math.max(1, ...data.map((d) => d.value));
  return {
    tooltip: { trigger: "item", formatter: (p: any) => `${p.name}<br/><b>${fmt(p.value)}</b> employees` },
    series: [
      {
        type: "funnel", sort: "none", left: "8%", right: "8%", top: 6, bottom: 6, minSize: "6%", maxSize: "100%", gap: 3, min: 0, max,
        label: { show: true, position: "inside", color: "#fff", fontSize: 10.5, formatter: (p: any) => `${p.name} · ${fmt(p.value)}` },
        itemStyle: { borderColor: t.surface, borderWidth: 1 },
        data: data.map((d, i) => ({ ...d, itemStyle: { color: t.seq[Math.min(t.seq.length - 1, 1 + Math.floor((i / Math.max(1, data.length - 1)) * (t.seq.length - 2)))], opacity: dim(sel, d.name) } })).map((d) => ({ ...d, itemStyle: { ...d.itemStyle, color: d.itemStyle.color === t.seq[0] ? t.seq[1] : d.itemStyle.color } })),
      },
    ],
  } as EChartsOption;
}

export function gaugesOption(items: { name: string; value: number; color: string }[], t: ChartTokens): EChartsOption {
  const n = items.length;
  return {
    series: items.map((it, i) => ({
      type: "gauge", center: [`${((i + 0.5) / n) * 100}%`, "58%"], radius: n > 2 ? "72%" : "80%", startAngle: 210, endAngle: -30, min: 0, max: 100,
      progress: { show: true, width: 12, roundCap: true, itemStyle: { color: grad(it.color, t.accent, true) } },
      axisLine: { lineStyle: { width: 12, color: [[1, t.grid]] }, roundCap: true },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false }, anchor: { show: false },
      title: { show: true, offsetCenter: [0, "72%"], color: t.muted, fontSize: 11 },
      detail: { valueAnimation: true, offsetCenter: [0, "4%"], fontSize: 22, fontWeight: 700, color: t.text, formatter: (v: number) => `${v.toFixed(0)}` },
      data: [{ value: Math.round(it.value * 10) / 10, name: it.name }],
    })),
  } as EChartsOption;
}

export function radarOption(indicators: { name: string; max: number }[], series: { name: string; values: number[]; color: string }[], t: ChartTokens): EChartsOption {
  return {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, type: "scroll" },
    radar: {
      indicator: indicators, radius: "64%", center: ["50%", "46%"], splitNumber: 4,
      axisName: { color: t.muted, fontSize: 10.5 },
      splitLine: { lineStyle: { color: t.grid } }, splitArea: { areaStyle: { color: ["transparent"] } }, axisLine: { lineStyle: { color: t.axis } },
    },
    series: [
      {
        type: "radar", symbol: "circle", symbolSize: 4,
        data: series.map((s) => ({ name: s.name, value: s.values, lineStyle: { color: s.color, width: 2 }, itemStyle: { color: s.color }, areaStyle: { color: s.color, opacity: 0.12 } })),
      },
    ],
  } as EChartsOption;
}

export function comboYearOption(labels: string[], hires: number[], headcount: number[], t: ChartTokens): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    legend: { top: 0, right: 0 },
    grid: { left: 6, right: 6, top: 34, bottom: 6, containLabel: true },
    xAxis: { type: "category", data: labels, ...axisBase(t) } as any,
    yAxis: [
      { type: "value", ...axisBase(t), axisLine: { show: false } },
      { type: "value", ...axisBase(t), axisLine: { show: false }, splitLine: { show: false } },
    ] as any,
    series: [
      { type: "bar", name: "Hires", data: hires, barMaxWidth: 26, itemStyle: { color: grad(t.accent, t.primary), borderRadius: [6, 6, 0, 0] } },
      { type: "line", name: "Headcount (year-end)", yAxisIndex: 1, data: headcount, smooth: true, symbolSize: 7, lineStyle: { width: 3, color: "#FFB300" }, itemStyle: { color: "#FFB300" } },
    ],
  } as EChartsOption;
}
