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
  // The node's own dimensions are authoritative (roster capacity differs by level band).
  const sizeOf = (ln: LNode): CardSize => ({ w: ln.w, h: ln.h });
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
    v.ln.x = v.center; // n.x is a card CENTRE everywhere in the pipeline
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

  // ── 3. rows: one row per level, wrapped into continuation rows when too wide ─
  const rowOf = new Map<string, number>();
  const rowNodes: LNode[][] = [];
  const rowMeta: { level: string; actualPosition: number; continuation: boolean }[] = [];
  const rowsByLevel = new Map<number, LNode[][]>();
  const levelNodes = new Map<number, LNode[]>();
  for (const n of nodes) levelNodes.set(n.layer, [...(levelNodes.get(n.layer) ?? []), n]);

  for (const level of [...levelNodes.keys()].sort((a, b) => a - b)) {
    const inLevel = (levelNodes.get(level) ?? []).sort((a, b) => a.x - b.x);
    const groups = new Map<string, LNode[]>();
    for (const n of inLevel) groups.set(n.groupKey, [...(groups.get(n.groupKey) ?? []), n]);
    const orderedGroups = [...groups.values()].sort((a, b) => Math.min(...a.map((n) => n.x)) - Math.min(...b.map((n) => n.x)));
    const chunks: LNode[][] = [];
    let current: LNode[] = [];
    let currentWidth = o.padding + o.gutter;
    for (const group of orderedGroups) {
      const groupWidth = group.reduce((a, n) => a + n.w, 0) + Math.max(0, group.length - 1) * o.gapCross;
      const groupGap = current.length ? o.gapCross * 1.5 : 0;
      if (current.length && currentWidth + groupGap + groupWidth > o.maxRowWidth) {
        chunks.push(current);
        current = [];
        currentWidth = o.padding + o.gutter;
      }
      current.push(...group);
      currentWidth += groupGap + groupWidth;
    }
    if (current.length) chunks.push(current);
    if (!chunks.length) chunks.push([]);
    rowsByLevel.set(level, chunks);
  }

  let rowCursor = 0;
  for (const level of [...rowsByLevel.keys()].sort((a, b) => a - b)) {
    const chunks = rowsByLevel.get(level)!;
    chunks.forEach((chunk, chunkIndex) => {
      const levelCode = (LEVEL_ORDER[level] ?? "L2") as typeof LEVEL_ORDER[number];
      const size = Math.max(o.card.h, ...chunk.map((n) => sizeOf(n).h));
      const rowIndex = rowNodes.length;
      rowNodes.push(chunk);
      rowMeta.push({ level: levelCode, actualPosition: level, continuation: chunkIndex > 0 });
      for (const n of chunk) {
        rowOf.set(n.id, rowIndex);
        n.layer = rowIndex;
        n.y = rowCursor + o.padding;
      }
      // Rows that fit keep their tidy x positions: every manager stays centred over
      // the span of its team (top at the centre, reports balanced to both sides).
      // Only rows that genuinely wrap into a "cont." row are re-packed left-to-right.
      if (chunks.length > 1) {
        const rowGroups = new Map<string, LNode[]>();
        for (const n of chunk) rowGroups.set(n.groupKey, [...(rowGroups.get(n.groupKey) ?? []), n]);
        const ordered = [...rowGroups.values()].sort((a, b) => Math.min(...a.map((n) => n.x)) - Math.min(...b.map((n) => n.x)));
        let x = o.padding + o.gutter;
        for (const group of ordered) {
          const groupWidth = group.reduce((a, n) => a + n.w, 0) + Math.max(0, group.length - 1) * o.gapCross;
          let gx = x;
          for (const n of group) {
            n.x = gx + n.w / 2;
            gx += n.w + o.gapCross;
          }
          x += groupWidth + o.gapCross * 1.5;
        }
      }
      const sorted = [...chunk].sort((a, b) => a.x - b.x);
      let rightEdge = -Infinity;
      for (const n of sorted) {
        const half = sizeOf(n).w / 2;
        if (n.x - half < rightEdge + 10) n.x = rightEdge + 10 + half;
        rightEdge = n.x + half;
      }
      rowCursor += size + o.gapMain;
    });
  }

  const layers: LayerInfo[] = rowNodes.map((chunk, index) => {
    const level = rowMeta[index];
    const size = Math.max(o.card.h, ...chunk.map((n) => sizeOf(n).h));
    const offset = rowNodes.slice(0, index).reduce((total, _row, i) => total + Math.max(o.card.h, ...rowNodes[i].map((n) => sizeOf(n).h)) + o.gapMain, 0);
    return {
      index,
      actualPosition: level.actualPosition,
      level: level.level,
      band: bandLabel(level.level as OrgLevelCode),
      offset,
      size,
      count: chunk.reduce((a, n) => a + (n.kind === "group" ? n.members!.length : 1), 0),
      continuation: level.continuation,
    };
  });
  for (const n of nodes) {
    const row = layers[rowOf.get(n.id) ?? 0];
    if (row) n.y = row.offset + o.padding;
  }
  // Final per-row repair so nothing can overlap after staff placement.
  for (const row of rowNodes) {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    let edge = -Infinity;
    for (const n of sorted) {
      const half = sizeOf(n).w / 2;
      if (n.x - half < edge + 10) n.x = edge + 10 + half;
      edge = n.x + half;
    }
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const blocksPath = (x: number, y1: number, y2: number, except: Set<string>) => {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    for (const n of nodes) {
      if (except.has(n.id)) continue;
      const s = sizeOf(n);
      if (n.x - s.w / 2 <= x && x <= n.x + s.w / 2 && n.y < hi && n.y + s.h > lo) return true;
    }
    return false;
  };

  // Orthogonal connectors: horizontal runs travel in the clear channels between
  // rows and vertical runs in the gutters between columns, so reporting lines stay
  // readable and never cut through a card.
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
    const x1 = p.x + ps.w / 2;
    const x2 = n.x + ns.w / 2;
    const y1 = p.y + ps.h;
    const y2 = n.y;
    const childRow = layers[rowOf.get(n.id) ?? 0];
    const parentRow = layers[rowOf.get(p.id) ?? 0];
    const except = new Set([p.id, n.id]);
    const belowParent = parentRow ? parentRow.offset + parentRow.size + o.gapMain / 2 : y1 + 14;
    const startChannel = Math.max(y1 + 8, belowParent);
    // Channel beside the child row: above it when the child sits lower, below it when a
    // data anomaly reverses the bands. Both channels are guaranteed free of cards.
    const childChannel = childRow
      ? childRow.index >= (parentRow?.index ?? 0)
        ? Math.min(childRow.offset - 6, Math.max(startChannel + 6, childRow.offset - o.gapMain / 2))
        : childRow.offset + childRow.size + o.gapMain / 2
      : y2;
    const laneRight = n.x + ns.w / 2 + 14;
    const laneLeft = n.x - ns.w / 2 - 14;
    const clearSpine = o.padding + 10;
    const lane = [laneRight, laneLeft, clearSpine].find((candidate) => !blocksPath(candidate, startChannel, childChannel, except)) ?? clearSpine;
    pushEdge(parentRow && childRow && childRow.index === parentRow.index + 1 ? "bus" : "spine", p.id, n.id, inferred, [
      [x1, y1],
      [x1, startChannel],
      [lane, startChannel],
      [lane, childChannel],
      [x2, childChannel],
      [x2, y2],
    ]);
  }

  let width = 0;
  let height = 0;
  for (const n of nodes) {
    const s = sizeOf(n);
    width = Math.max(width, n.x + s.w / 2);
    height = Math.max(height, n.y + s.h);
  }
  const wrapped = layers.some((l) => l.continuation);
  return {
    nodes,
    edges,
    width: Math.max(720, width + o.padding),
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
