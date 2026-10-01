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
