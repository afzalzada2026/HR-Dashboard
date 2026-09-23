import { FIELD_DEFS, type FieldDef } from "./fields";
import type { FieldKey } from "./types";

export function normHeader(h: unknown): string {
  return String(h ?? "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/\s+/g, "");
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

/** Sørensen–Dice coefficient on character bigrams (0..1). */
export function dice(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  A.forEach((v) => (total += v));
  B.forEach((v) => (total += v));
  A.forEach((v, k) => {
    const w = B.get(k);
    if (w) inter += Math.min(v, w);
  });
  return total ? (2 * inter) / total : 0;
}

const SYN_CACHE = new Map<FieldKey, string[]>();
function synonyms(def: FieldDef): string[] {
  let s = SYN_CACHE.get(def.key);
  if (!s) {
    s = [...new Set([normHeader(def.label), ...def.synonyms.map(normHeader)])].filter(Boolean);
    SYN_CACHE.set(def.key, s);
  }
  return s;
}

export function scoreHeader(header: string, def: FieldDef): number {
  const h = normHeader(header);
  if (!h) return 0;
  let best = 0;
  for (const syn of synonyms(def)) {
    if (h === syn) return 1;
    const ph = ` ${h} `;
    const ps = ` ${syn} `;
    if (ph.includes(ps)) best = Math.max(best, 0.62 + 0.3 * (syn.length / h.length));
    else if (h.length >= 4 && ps.includes(ph)) best = Math.max(best, 0.5 + 0.3 * (h.length / syn.length));
    const d = dice(h, syn);
    if (d >= 0.6) best = Math.max(best, d * 0.88);
  }
  return Math.min(best, 0.99);
}

export interface AutoMapResult {
  mapping: Partial<Record<FieldKey, string>>;
  confidence: Partial<Record<FieldKey, number>>;
}

/** Greedy best-score assignment of source headers to canonical fields. */
export function autoMap(headers: string[]): AutoMapResult {
  const pairs: { key: FieldKey; header: string; score: number }[] = [];
  for (const def of FIELD_DEFS) {
    for (const h of headers) {
      const score = scoreHeader(h, def);
      if (score >= 0.55) pairs.push({ key: def.key, header: h, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const mapping: Partial<Record<FieldKey, string>> = {};
  const confidence: Partial<Record<FieldKey, number>> = {};
  const used = new Set<string>();
  for (const p of pairs) {
    if (mapping[p.key] || used.has(p.header)) continue;
    mapping[p.key] = p.header;
    confidence[p.key] = p.score;
    used.add(p.header);
  }
  return { mapping, confidence };
}

/** Finds the most likely header row in the first rows of a sheet (handles title rows above the header). */
export function detectHeaderRow(rows: unknown[][]): number {
  let bestIdx = 0;
  let bestScore = -1;
  const limit = Math.min(rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = rows[i] || [];
    let score = 0;
    for (const cell of row) {
      if (cell === null || cell === undefined || cell === "") continue;
      if (typeof cell === "number") continue;
      let best = 0;
      for (const def of FIELD_DEFS) best = Math.max(best, scoreHeader(String(cell), def));
      if (best >= 0.8) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : 0;
}

export interface ParsedTable {
  headers: string[];
  rows: Record<string, unknown>[];
  headerRow: number;
}

/** Converts a 2D array (from SheetJS / PapaParse) into header-keyed records. */
export function tableFromMatrix(matrix: unknown[][]): ParsedTable {
  const headerRow = detectHeaderRow(matrix);
  const rawHeaders = (matrix[headerRow] || []).map((h, i) => String(h ?? "").trim() || `Column ${i + 1}`);
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((h) => {
    const n = (seen.get(h) || 0) + 1;
    seen.set(h, n);
    return n > 1 ? `${h} (${n})` : h;
  });
  const rows: Record<string, unknown>[] = [];
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (!line || !line.some((c) => c !== null && c !== undefined && String(c).trim() !== "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => (obj[h] = line[i] ?? ""));
    rows.push(obj);
  }
  return { headers, rows, headerRow };
}
