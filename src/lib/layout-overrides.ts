export type PositionMap = Record<string, { x: number; y: number }>;

/** Inline card text edits keyed by employee org key (employeeNo/email/name). */
export interface TextOverride {
  fullName?: string;
  title?: string;
  department?: string;
}
export type TextOverrideMap = Record<string, TextOverride>;

const KEY_PREFIX = "atoma:org-layout-overrides";
const TEXT_KEY = "atoma:org-text-overrides";

export function loadLayoutOverrides(scope = "all"): PositionMap {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:${scope}`);
    if (!raw) return {};
    return JSON.parse(raw) as PositionMap;
  } catch {
    return {};
  }
}

export function saveLayoutOverrides(scope = "all", map: PositionMap) {
  try {
    localStorage.setItem(`${KEY_PREFIX}:${scope}`, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function clearLayoutOverrides(scope = "all") {
  try {
    localStorage.removeItem(`${KEY_PREFIX}:${scope}`);
  } catch {
    // ignore
  }
}

export function loadTextOverrides(): TextOverrideMap {
  try {
    const raw = localStorage.getItem(TEXT_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TextOverrideMap;
  } catch {
    return {};
  }
}

export function saveTextOverrides(map: TextOverrideMap) {
  try {
    localStorage.setItem(TEXT_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function clearTextOverrides() {
  try {
    localStorage.removeItem(TEXT_KEY);
  } catch {
    // ignore
  }
}
