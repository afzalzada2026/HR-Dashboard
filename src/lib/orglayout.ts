import { bandLabel, LEVEL_ORDER, type OrgLevelCode } from "./organogram-levels";
import type { OrgNode } from "./orgtree";

/**
 * Landscape organogram layout with print-aware row packing.
 *
 *   L6  ─────────────────────── [CEO]
 *   L5  ───────── [Chief A] ─ [Chief B] ─ [Chief C]
 *   L3  ─ [Lead] ─ [Lead] ─ [Lead] … (row wraps to a “cont.” row when too wide)
 *
 * • the first row is the top level present in the scope
 * • every report sits at least one row below its supervisor
 * • leaf reports of one level under one manager collapse into a roster card when numerous
 * • an even set of 4+ branches reserves a centre aisle (two left, two right)
 * • rows never overlap: cards are packed with enforced gaps and rows occupy disjoint bands
 * • `maxRowWidth` wraps a level into continuation rows so every sheet fits paper at readable size
 * • orthogonal bus connectors run between rows; blocked paths route through the left spine
 */
export interface CardSize {
  w: number;
  h: number;
}

export interface LayoutOpts {
  layerOf: (n: OrgNode) => number;
  card: CardSize;
  groupThreshold?: number;
  groupMax?: number;
  gapCross?: number;
  gapMain?: number;
  padding?: number;
  gutter?: number;
  /** Wrap a level row when it would exceed this width (print optimisation). */
  maxRowWidth?: number;
}

export interface LNode {
  id: string;
  kind: "node" | "group" | "staff";
  node?: OrgNode;
  members?: OrgNode[];
  /** Row index in `layers` (a level may span several continuation rows). */
  layer: number;
  parent: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  inferred: boolean;
  groupKey: string;
}

export interface LEdge {
  id: string;
  from: string;
  to: string;
  inferred: boolean;
  d: string;
  points: [number, number][];
  kind: "bus" | "staff" | "spine";
}

export interface LayerInfo {
  index: number;
  actualPosition: number;
  level: string;
  band: string;
  offset: number;
  size: number;
  count: number;
  continuation: boolean;
}

export interface OrgLayout {
  nodes: LNode[];
  edges: LEdge[];
  width: number;
  height: number;
  layers: LayerInfo[];
  levelOffset: number;
  padding: number;
  gutter: number;
  gapMain: number;
  byId: Map<string, LNode>;
  wrapped: boolean;
}

export const GAP_MAIN = 54;
export const GROUP_CARD = { colW: 138, header: 32, row: 26, more: 18, pad: 10 };

export function groupCardGrid(members: number, groupMax = 24) {
  const visible = Math.min(members, groupMax);
  const cols = visible <= 8 ? 2 : visible <= 24 ? 3 : 4;
  const rows = Math.ceil(visible / cols);
  return {
    cols,
    rows,
    visible,
    w: cols * GROUP_CARD.colW + 12,
    h: GROUP_CARD.header + rows * GROUP_CARD.row + (members > groupMax ? GROUP_CARD.more : 0) + GROUP_CARD.pad,
  };
}

export function groupCardSize(members: number, groupMax = 24): CardSize {
  const grid = groupCardGrid(members, groupMax);
  return { w: grid.w, h: grid.h };
}

/** Compact card: bold position title on top, employee name below — keeps printed type legible. */
export const ATOMA_CARD: CardSize = { w: 152, h: 58 };
export const RAIL_W = 62;

export function safeName(value: unknown): string {
  return String(value ?? "").trim();
}

export function cardTexts(emp: { title?: string; fullName?: string; remarks?: string }): { title: string; name: string; vacant: boolean; temporary: boolean } {
  const title = safeName(emp.title) || "Position not specified";
  const name = safeName(emp.fullName);
  const all = `${name} ${title} ${safeName(emp.remarks)}`.toLowerCase();
  const vacant = !name || /\b(vacant|vacancy|unfilled|tbd|to be hired)\b/.test(all) || /^(unknown|vacant)$/i.test(name);
  return { title, name: vacant ? "VACANT" : name, vacant, temporary: !vacant && /\b(temp|temporary|contract|contractor|acting|interim)\b/.test(all) };
}

/** Standard ATOMA card geometry and options for screen rendering. */
export function buildOrgLayout(roots: OrgNode[], opts?: Partial<LayoutOpts>): OrgLayout {
  return layoutOrg(roots, {
    layerOf: (n: OrgNode) => LEVEL_ORDER.indexOf(n.level),
    card: ATOMA_CARD,
    groupThreshold: 4,
    gapCross: 14,
    gapMain: GAP_MAIN,
    padding: 22,
    gutter: 84,
    ...opts,
  });
}

interface V {
  ln: LNode;
  children: V[];
  extent: number;
  center: number;
}

export function layoutOrg(roots: OrgNode[], opts: LayoutOpts): OrgLayout {
  const o = { groupThreshold: 4, groupMax: 24, gapCross: 14, gapMain: GAP_MAIN, padding: 22, gutter: 84, maxRowWidth: Infinity, ...opts };
  const finiteRootLevels = roots.map(o.layerOf).filter(Number.isFinite);
  const levelOffset = finiteRootLevels.length ? Math.min(...finiteRootLevels) : 0;
  const nodes: LNode[] = [];
  const sizeOf = (ln: LNode): CardSize => (ln.kind === "group" ? groupCardSize(ln.members!.length, o.groupMax) : o.card);
  // Bands are ABSOLUTE: every person sits in their own level band (an L4 is never drawn in L6).
  const normalizedLevel = (n: OrgNode) => Math.max(0, o.layerOf(n));

  // ── 1. build the placed tree, assigning every node a level band ─────────────
  const build = (n: OrgNode, parent: LNode | null, groupKey: string): V => {
    const layer = normalizedLevel(n);
    const ln: LNode = {
      id: n.id,
      kind: n.staff ? "staff" : "node",
      node: n,
      layer,
      parent: parent?.id ?? null,
      x: 0,
      y: 0,
      w: o.card.w,
      h: o.card.h,
      inferred: n.link.startsWith("inferred"),
      groupKey,
    };
    nodes.push(ln);
    const v: V = { ln, children: [], extent: o.card.w, center: 0 };
    const kids: { layer: number; order: number; v: V }[] = [];
    let order = 0;

    for (const staffNode of n.children.filter((c) => c.staff)) {
      const sl: LNode = { id: staffNode.id, kind: "staff", node: staffNode, layer: normalizedLevel(staffNode), parent: ln.id, x: 0, y: 0, w: o.card.w, h: o.card.h, inferred: staffNode.link.startsWith("inferred"), groupKey };
      nodes.push(sl);
      kids.push({ layer, order: order++, v: { ln: sl, children: [], extent: 0, center: 0 } });
    }

    const reports = n.children.filter((c) => !c.staff);
    const hasNested = (c: OrgNode) => c.children.some((g) => !g.staff);
    for (const child of reports.filter(hasNested)) kids.push({ layer: normalizedLevel(child), order: order++, v: build(child, ln, `${groupKey}/${child.id}`) });

    const byLayer = new Map<number, OrgNode[]>();
    for (const child of reports.filter((c) => !hasNested(c))) {
      const L = normalizedLevel(child);
      byLayer.set(L, [...(byLayer.get(L) ?? []), child]);
    }
    for (const [L, list] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
      if (list.length > o.groupThreshold) {
        // Lower bands (L2/L1) carry most of the headcount: give their roster cards
        // more capacity so the level band can accommodate staff and stay printable.
        const levelName = LEVEL_ORDER[L];
        const capacity = levelName === "L1" || levelName === "L2" ? Math.max(o.groupMax, 48) : o.groupMax;
        for (let start = 0; start < list.length; start += capacity) {
          const chunkMembers = list.slice(start, start + capacity);
          const gs = groupCardSize(chunkMembers.length, capacity);
          const gl: LNode = { id: `g:${n.id}:${L}:${start}`, kind: "group", members: chunkMembers, layer: L, parent: ln.id, x: 0, y: 0, w: gs.w, h: gs.h, inferred: false, groupKey: `${groupKey}/g:${L}` };
          nodes.push(gl);
          kids.push({ layer: L, order: order++, v: { ln: gl, children: [], extent: gs.w, center: 0 } });
        }
      } else {
        for (const child of list) kids.push({ layer: L, order: order++, v: build(child, ln, `${groupKey}/${child.id}`) });
      }
    }
    kids.sort((a, b) => a.layer - b.layer || a.order - b.order);
    v.children = kids.map((k) => k.v);

    const centreAisle = v.children.length >= 4 && v.children.length % 2 === 0 ? Math.max(44, o.gapCross * 2.5) : 0;
    v.extent = Math.max(o.card.w, v.children.reduce((a, c) => a + c.extent, 0) + Math.max(0, v.children.length - 1) * o.gapCross + centreAisle);
    return v;
  };

  const forest = roots.map((r) => build(r, null, r.id));

  // ── 2. tidy placement (parents centred over their team span) ────────────────
  const place = (v: V, start: number) => {
    const centreAisle = v.children.length >= 4 && v.children.length % 2 === 0 ? Math.max(44, o.gapCross * 2.5) : 0;
    const kidsTotal = v.children.reduce((a, c) => a + c.extent, 0) + Math.max(0, v.children.length - 1) * o.gapCross + centreAisle;
    let x = start + (v.extent - kidsTotal) / 2;
    v.children.forEach((k, i) => {
      if (centreAisle && i === v.children.length / 2) x += centreAisle;
      place(k, x);
      x += k.extent + o.gapCross;
    });
    v.center = v.children.length ? (v.children[0].center + v.children[v.children.length - 1].center) / 2 : start + v.extent / 2;
    const s = sizeOf(v.ln);
    v.ln.x = v.center - s.w / 2;
    if (v.ln.kind === "staff") {
      const parent = v.ln.parent ? nodes.find((n) => n.id === v.ln.parent) : undefined;
      if (parent) v.ln.x = parent.x + parent.w + 26;
    }
  };
  let cursorX = o.padding + o.gutter;
  for (const v of forest) {
    place(v, cursorX);
    cursorX += v.extent + o.gapCross * 2;
  }
  const tidyWidth = Math.max(720, cursorX - o.gapCross * 2 + o.padding);

  // ── 3. rows: absolute level bands; keep the balanced tidy x unless a row is too wide ──
  const levelNodes = new Map<number, LNode[]>();
  for (const n of nodes) levelNodes.set(n.layer, [...(levelNodes.get(n.layer) ?? []), n]);
  const rowOf = new Map<string, number>();
  const rows: { nodes: LNode[]; level: number; continuation: boolean; repack: boolean }[] = [];

  for (const level of [...levelNodes.keys()].sort((a, b) => a - b)) {
    const inLevel = (levelNodes.get(level) ?? []).sort((a, b) => a.x - b.x);
    const minX = inLevel.reduce((m, n) => Math.min(m, n.x - sizeOf(n).w / 2), Infinity);
    const maxX = inLevel.reduce((m, n) => Math.max(m, n.x + sizeOf(n).w / 2), -Infinity);
    const tooWide = Number.isFinite(o.maxRowWidth) && maxX - minX > o.maxRowWidth - (o.padding + o.gutter) * 2;
    if (!tooWide) {
      rows.push({ nodes: inLevel, level, continuation: false, repack: false });
      continue;
    }
    // Wrap only when needed: split at parent-group boundaries into continuation rows.
    const groups = new Map<string, LNode[]>();
    for (const n of inLevel) groups.set(n.groupKey, [...(groups.get(n.groupKey) ?? []), n]);
    const ordered = [...groups.values()].sort((a, b) => a.reduce((m, n) => Math.min(m, n.x), Infinity) - b.reduce((m, n) => Math.min(m, n.x), Infinity));
    let current: LNode[] = [];
    let currentWidth = o.padding + o.gutter;
    let chunk = 0;
    const flush = () => {
      if (!current.length) return;
      rows.push({ nodes: current, level, continuation: chunk > 0, repack: true });
      chunk++;
      current = [];
      currentWidth = o.padding + o.gutter;
    };
    for (const group of ordered) {
      const groupWidth = group.reduce((a, n) => a + sizeOf(n).w, 0) + Math.max(0, group.length - 1) * o.gapCross;
      const gap = current.length ? o.gapCross * 1.5 : 0;
      if (current.length && currentWidth + gap + groupWidth > o.maxRowWidth) flush();
      current.push(...group);
      currentWidth += gap + groupWidth;
    }
    flush();
  }

  // ── 4. y offsets per row; re-pack only the rows that had to wrap ─────────────
  let cursorY = o.padding;
  const layers: LayerInfo[] = [];
  rows.forEach((row, index) => {
    const size = row.nodes.reduce((m, n) => Math.max(m, sizeOf(n).h), o.card.h);
    layers.push({
      index,
      actualPosition: row.level,
      level: (LEVEL_ORDER[row.level] ?? "L2") as OrgLevelCode,
      band: bandLabel((LEVEL_ORDER[row.level] ?? "L2") as OrgLevelCode),
      offset: cursorY,
      size,
      count: row.nodes.reduce((a, n) => a + (n.kind === "group" ? n.members!.length : 1), 0),
      continuation: row.continuation,
    });
    if (row.repack) {
      const groups = new Map<string, LNode[]>();
      for (const n of row.nodes) groups.set(n.groupKey, [...(groups.get(n.groupKey) ?? []), n]);
      const ordered = [...groups.values()].sort((a, b) => a.reduce((m, n) => Math.min(m, n.x), Infinity) - b.reduce((m, n) => Math.min(m, n.x), Infinity));
      let x = o.padding + o.gutter;
      for (const group of ordered) {
        let cursor = x;
        for (const n of group) {
          n.x = cursor + sizeOf(n).w / 2;
          cursor += sizeOf(n).w + o.gapCross;
        }
        x = cursor + o.gapCross * 0.5;
      }
    }
    for (const n of row.nodes) {
      rowOf.set(n.id, index);
      n.layer = index;
      n.y = cursorY;
    }
    cursorY += size + o.gapMain;
  });

  // Staff officers sit laterally beside their manager on the manager's row.
  for (const n of nodes) {
    if (n.kind !== "staff" || !n.parent) continue;
    const parent = nodes.find((p) => p.id === n.parent);
    if (parent) {
      n.x = parent.x + parent.w + 30;
      n.y = parent.y;
      n.layer = parent.layer;
    }
  }

  // ── 5. guarantee no two boxes overlap anywhere on the sheet ─────────────────
  const rowBuckets = new Map<number, LNode[]>();
  for (const n of nodes) rowBuckets.set(n.layer, [...(rowBuckets.get(n.layer) ?? []), n]);
  for (const bucket of rowBuckets.values()) {
    const sorted = [...bucket].sort((a, b) => a.x - b.x);
    let rightEdge = -Infinity;
    for (const n of sorted) {
      const w = sizeOf(n).w;
      if (n.x - w / 2 < rightEdge + 10) n.x = rightEdge + 10 + w / 2;
      rightEdge = n.x + w / 2;
    }
  }

  // ── 6. centre the top of the chart on the sheet; branches spread both ways ──
  const rootNode = nodes.find((n) => n.id === (roots[0]?.id ?? ""));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const n of nodes) {
    const w = sizeOf(n).w;
    minX = Math.min(minX, n.x - w / 2);
    maxX = Math.max(maxX, n.x + w / 2);
  }
  const margin = o.padding + o.gutter;
  const halfSpan = rootNode ? Math.max(rootNode.x - minX, maxX - rootNode.x) : (maxX - minX) / 2;
  const naturalWidth = halfSpan * 2 + margin * 2;
  const contentWidth = maxX - minX + margin * 2;
  const sheetWidth = Number.isFinite(o.maxRowWidth) ? Math.max(720, Math.min(naturalWidth, Math.max(contentWidth, o.maxRowWidth))) : Math.max(720, naturalWidth);
  const shift = rootNode ? sheetWidth / 2 - rootNode.x : 0;
  for (const n of nodes) n.x += shift;

  // ── 7. orthogonal connectors: bus under the parent row, arrows at each child ──
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const blocks = (x: number, y1: number, y2: number, except: Set<string>) => {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    for (const n of nodes) {
      if (except.has(n.id)) continue;
      const s = sizeOf(n);
      if (Math.abs(n.x - x) > s.w / 2 - 3) continue;
      if (n.y < hi && n.y + s.h > lo) return true;
    }
    return false;
  };
  const edges: LEdge[] = [];
  const pushEdge = (kind: LEdge["kind"], from: string, to: string, inferred: boolean, points: [number, number][]) =>
    edges.push({ id: `${from}->${to}`, from, to, inferred, kind, points, d: points.map((pt, i) => `${i ? "L" : "M"} ${pt[0]} ${pt[1]}`).join(" ") });

  for (const n of nodes) {
    if (!n.parent) continue;
    const p = byId.get(n.parent);
    if (!p) continue;
    const ps = sizeOf(p);
    const ns = sizeOf(n);
    const inferred = n.inferred;
    if (n.kind === "staff") {
      const yMid = p.y + ps.h / 2;
      pushEdge("staff", p.id, n.id, inferred, [
        [p.x + ps.w / 2, yMid],
        [n.x - ns.w / 2, yMid],
      ]);
      continue;
    }
    const x1 = p.x;
    const x2 = n.x;
    const y1 = p.y + ps.h;
    const y2 = n.y;
    const parentRow = layers[rowOf.get(p.id) ?? 0];
    const childRowIndex = rowOf.get(n.id) ?? 0;
    // The distribution bar sits in the gap just below the manager's row, so each
    // manager's fan is visually separate from every other manager's.
    const busY = Math.min(parentRow.offset + parentRow.size + o.gapMain * 0.4, y2 - 16);
    const except = new Set([p.id, n.id]);
    const horizontalClear = (y: number, from: number, to: number) => {
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      for (const other of nodes) {
        if (except.has(other.id)) continue;
        const sz = sizeOf(other);
        if (other.y < y && other.y + sz.h > y && other.x - sz.w / 2 < hi && other.x + sz.w / 2 > lo) return false;
      }
      return true;
    };
    const direct = childRowIndex === layers[rowOf.get(p.id) ?? 0].index + 1;
    const clear = direct && !blocks(x1, y1, busY, except) && !blocks(x2, busY, y2, except) && horizontalClear(busY, x1, x2);
    if (clear) {
      pushEdge("bus", p.id, n.id, inferred, [
        [x1, y1],
        [x1, busY],
        [x2, busY],
        [x2, y2],
      ]);
    } else {
      // All horizontal legs travel in the gaps BETWEEN rows and all vertical travel
      // happens in the left gutter, so a line can never cross a card.
      const spine = o.padding + o.gutter - 26;
      const parentChannel = parentRow.offset + parentRow.size + o.gapMain * 0.22;
      const childChannel = (layers[childRowIndex]?.offset ?? y2) - o.gapMain * 0.22;
      pushEdge("spine", p.id, n.id, inferred, [
        [x1, y1],
        [x1, parentChannel],
        [spine, parentChannel],
        [spine, childChannel],
        [x2, childChannel],
        [x2, y2],
      ]);
    }
  }

  let width = sheetWidth;
  let height = 0;
  for (const n of nodes) {
    const s = sizeOf(n);
    width = Math.max(width, n.x + s.w / 2 + margin);
    height = Math.max(height, n.y + s.h);
  }
  const wrapped = layers.some((l) => l.continuation);
  return {
    nodes,
    edges,
    width: Math.max(720, width),
    height: Math.max(220, height + o.padding),
    layers,
    levelOffset,
    padding: o.padding,
    gutter: o.gutter,
    gapMain: o.gapMain,
    byId,
    wrapped,
  };
}
