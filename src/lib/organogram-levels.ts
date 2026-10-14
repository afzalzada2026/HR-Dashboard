import type { Employee } from "./types";

export type OrgLevelCode = "L1" | "L2" | "L3" | "L3H" | "L4" | "L5" | "L6";

/** ATOMA hierarchy, top to bottom, exactly as used in the approved HR organogram. */
export const LEVEL_ORDER: OrgLevelCode[] = ["L6", "L5", "L4", "L3H", "L3", "L2", "L1"];

/** Band copy for the level rail (labels follow the approved HR sheet). */
export function bandLabel(level: OrgLevelCode): string {
  return level === "L3H" ? "Head band" : level === "L6" ? "Executive" : level === "L1" ? "Representative" : `Level ${level[1]}`;
}

/** Normalizes forms such as L3H, L-3-H, Level 3H and "L4 - Senior". */
export function canonicalOrgLevel(value: string): OrgLevelCode | null {
  const normalized = (value || "").toUpperCase().replace(/LEVEL/g, "L").replace(/[^A-Z0-9]/g, "");
  const match = normalized.match(/^L?(\d{1,2})(H)?/);
  if (!match) return null;
  const number = Number(match[1]);
  if (number < 1 || number > 6) return null;
  if (number === 3 && match[2]) return "L3H";
  return `L${number}` as OrgLevelCode;
}

export function fallbackLevel(e: Employee): OrgLevelCode {
  const rank = e.levelRank;
  if (rank >= 10) return "L6";
  if (rank >= 9) return "L5";
  if (rank >= 8) return "L4";
  if (rank >= 7) return "L3H";
  if (rank >= 6) return "L3";
  if (rank >= 4) return "L2";
  return "L1";
}

export function levelOf(e: Employee): OrgLevelCode {
  return canonicalOrgLevel(e.level) ?? fallbackLevel(e);
}

/** Row index for the landscape layout: 0 = L6 (most senior) … 6 = L1. */
export function layerOf(e: Employee): number {
  return LEVEL_ORDER.indexOf(levelOf(e));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Level model (ported from the reference organogram `levels` module):
 * seniority direction, band statistics, pyramid/legend data.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Preference for which end of L1…L6 is the top of the organisation. */
export type SeniorityDirection = "auto" | "high-top" | "low-top";
export type Direction = Exclude<SeniorityDirection, "auto">;

export interface DirectionDetection {
  direction: Direction;
  confidence: number;
  reason: string;
  auto: boolean;
}

export interface LevelInfo {
  /** Normalised label, e.g. "L3H". */
  label: OrgLevelCode;
  /** Numeric rank (L3H → 3.5). */
  rank: number;
  /** Seniority value — larger = more senior (direction applied). */
  sen: number;
  /** 0 = most senior rendered row. */
  position: number;
  /** HR sheet band copy (Executive, Head band, Level n, Representative…). */
  band: string;
  color: string;
  count: number;
  female: number;
  avgAge: number;
  avgTenure: number;
  topTitles: string[];
}

/** Level accent colours shared by the screen, SVG, PDF, Visio and print renderers. */
export const LEVEL_COLORS: Record<OrgLevelCode, string> = {
  L6: "#062B5B",
  L5: "#0D47A1",
  L4: "#1E6FE0",
  L3H: "#F59E0B",
  L3: "#00A8FF",
  L2: "#64748B",
  L1: "#94A3B8",
};

const EXEC_TITLES = /\b(chief|ceo|cfo|coo|cto|cio|chro|cmo|cso|president|executive|director|head|vp|vice\s?president|general manager|managing)\b/i;

/** Numeric rank of a level label: L6 → 6, L3H → 3.5 (half step above L3). */
export function levelRankValue(label: string): number {
  const canonical = canonicalOrgLevel(label);
  if (!canonical) return NaN;
  if (canonical === "L3H") return 3.5;
  return Number(canonical.slice(1));
}

/** Row index for a level under a given seniority direction: 0 = most senior. */
export function layerOfLevel(level: OrgLevelCode, direction: Direction = "high-top"): number {
  const index = LEVEL_ORDER.indexOf(level);
  return direction === "high-top" ? index : LEVEL_ORDER.length - 1 - index;
}

/** Maps a layout layer index back to its level code for a seniority direction. */
export function levelAtLayer(direction: Direction = "high-top"): (layer: number) => OrgLevelCode {
  const order = direction === "high-top" ? LEVEL_ORDER : [...LEVEL_ORDER].reverse();
  return (layer: number) => order[layer] ?? "L2";
}

/** Larger = more senior. Unspecified levels sink to the bottom. */
export function seniorityValueForLevel(level: OrgLevelCode, direction: Direction = "high-top"): number {
  const index = LEVEL_ORDER.indexOf(level);
  // high-top: L6 = 12 … L1 = 6 (mirrors the original `12 - index` scale).
  return direction === "high-top" ? LEVEL_ORDER.length + 5 - index : index + 6;
}

/** Exec-title share at each end of the ladder decides which end is the top. */
export function detectSeniorityDirection(data: Employee[]): DirectionDetection {
  const groups = new Map<OrgLevelCode, { count: number; exec: number }>();
  for (const e of data) {
    const level = levelOf(e);
    const group = groups.get(level) ?? { count: 0, exec: 0 };
    group.count++;
    if (EXEC_TITLES.test(e.title || "")) group.exec++;
    groups.set(level, group);
  }
  const known = LEVEL_ORDER.filter((level) => groups.has(level));
  if (known.length < 2) {
    return {
      direction: "high-top",
      confidence: 0,
      reason: "Fewer than two levels found — assuming the highest number is the most senior.",
      auto: true,
    };
  }
  const lo = groups.get(known[known.length - 1])!; // L1 end
  const hi = groups.get(known[0])!; // L6 end
  const hiShare = hi.exec / Math.max(1, hi.count);
  const loShare = lo.exec / Math.max(1, lo.count);
  const delta = hiShare - loShare;
  if (Math.abs(delta) >= 0.05) {
    const top = delta > 0 ? hi : lo;
    const topLabel = delta > 0 ? known[0] : known[known.length - 1];
    return {
      direction: delta > 0 ? "high-top" : "low-top",
      confidence: Math.min(1, Math.abs(delta) * 2 + 0.3),
      reason: `${topLabel} holds ${Math.round(Math.max(hiShare, loShare) * 100)}% executive titles (Chief / Director / Head).`,
      auto: true,
    };
  }
  const direction: Direction = hi.count <= lo.count ? "high-top" : "low-top";
  return {
    direction,
    confidence: 0.4,
    reason: `Headcount pyramid — ${known[0]}: ${hi.count} vs ${known[known.length - 1]}: ${lo.count} employees.`,
    auto: true,
  };
}

export function resolveSeniorityDirection(pref: SeniorityDirection, data: Employee[]): DirectionDetection {
  if (pref === "auto") return detectSeniorityDirection(data);
  return {
    direction: pref,
    confidence: 1,
    reason:
      pref === "high-top"
        ? "Company level order: L6 is the top of the organisation and L1 the bottom (L3H sits between L4 and L3)."
        : "Reversed order: L1 is the top of the organisation.",
    auto: false,
  };
}

/** Per-level statistics for the pyramid, legend, swim-lanes and chips. */
export function analyzeLevels(data: Employee[], direction: Direction = "high-top"): LevelInfo[] {
  const byLevel = new Map<OrgLevelCode, Employee[]>();
  for (const e of data) {
    const level = levelOf(e);
    byLevel.set(level, [...(byLevel.get(level) ?? []), e]);
  }
  const ordered = LEVEL_ORDER.filter((level) => byLevel.has(level)).sort(
    (a, b) => layerOfLevel(a, direction) - layerOfLevel(b, direction)
  );
  return ordered.map((label, position) => {
    const rows = byLevel.get(label)!;
    const titles = new Map<string, number>();
    rows.forEach((e) => {
      const title = (e.title || "").split(",")[0].trim();
      if (title) titles.set(title, (titles.get(title) ?? 0) + 1);
    });
    const rank = levelRankValue(label);
    return {
      label,
      rank,
      sen: seniorityValueForLevel(label, direction),
      position,
      band: bandLabel(label),
      color: LEVEL_COLORS[label],
      count: rows.length,
      female: rows.filter((e) => (e.gender || "").toLowerCase().startsWith("f")).length,
      avgAge: rows.reduce((a, e) => a + (e.age || 0), 0) / Math.max(1, rows.length),
      avgTenure: rows.reduce((a, e) => a + (e.tenure || 0), 0) / Math.max(1, rows.length),
      topTitles: Array.from(titles.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([title]) => title),
    };
  });
}

export function levelIndex(levels: LevelInfo[]): Map<OrgLevelCode, LevelInfo> {
  return new Map(levels.map((l) => [l.label, l]));
}

/** "L6 › L5 › … › L1" chain of the known levels, for the chips and subtitles. */
export function levelOrderLabel(levels: LevelInfo[]): string {
  const known = levels.filter((l) => l.band !== "Unspecified");
  if (known.length < 2) return known[0]?.label ?? "—";
  return known.map((l) => l.label).join(" › ");
}
