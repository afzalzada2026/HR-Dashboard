export type PositionMap = Record<string, { x: number; y: number }>; 

const KEY_PREFIX = "atoma:org-layout-overrides";

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
