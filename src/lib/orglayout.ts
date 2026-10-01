import { bandLabel, LEVEL_ORDER } from "./organogram-levels";
import type { OrgNode } from "./orgtree";

/**
 * Landscape organogram layout (levels are ALWAYS horizontal rows, branches spread
 * left-to-right) — ported from the approved ATOMA design:
 *
 *   L6  ─────────────────────── [CEO]
 *   L5  ───────── [Chief A] ─ [Chief B] ─ [Chief C]
 *   L4  ───── [Head] ─ [Head] ─ [Head] ─ [Head]
 *   L1  ───────────────────────── staff / roster cards
 *
 * • the first row is the top level present in the scope (a division led at L5 starts at L5)
 * • every report is placed at least one row below its supervisor
 * • numerous leaf reports of one level under one manager collapse into a roster card
 * • an even set of 4+ branches reserves a centre aisle (two left, two right)
 * • orthogonal bus connectors run between level bands and never cross cards
 * • rows are labelled by the dominant ACTUAL level, with “cont.” continuation rows
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
}

export interface LNode {
  id: string;
  kind: "node" | "group" | "staff";
  node?: OrgNode;
  members?: OrgNode[];
  layer: number;
  parent: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  inferred: boolean;
}

export interface LEdge {
  id: string;
  from: string;
  to: string;
  inferred: boolean;
  /** Orthogonal path: down to the bus, across, then down into the card. */
  d: string;
  points: [number, number][];
  kind: "bus" | "staff";
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
}

export const GAP_MAIN = 62;
export const GROUP_CARD = { colW: 152, header: 34, row: 28, more: 18, pad: 10 };

/** Roster cards: 2 columns up to 8 people, 3 to 24, 4 thereafter. */
export function groupCardGrid(members: number, groupMax = 2000) {
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

export function groupCardSize(members: number, groupMax = 2000): CardSize {
  const grid = groupCardGrid(members, groupMax);
  return { w: grid.w, h: grid.h };
}

interface V {
  ln: LNode;
  children: V[];
  extent: number;
  center: number;
}

/** Standard ATOMA card geometry and options for screen + export rendering. */
export const ATOMA_CARD: CardSize = { w: 172, h: 66 };

export function buildOrgLayout(roots: OrgNode[], opts?: Partial<LayoutOpts>): OrgLayout {
  return layoutOrg(roots, {
    layerOf: (n: OrgNode) => LEVEL_ORDER.indexOf(n.level),
    card: ATOMA_CARD,
    groupThreshold: 4,
    gapCross: 18,
    gapMain: GAP_MAIN,
    padding: 22,
    gutter: 84,
    ...opts,
  });
}

export function layoutOrg(roots: OrgNode[], opts: LayoutOpts): OrgLayout {
  const o = { groupThreshold: 4, groupMax: 2000, gapCross: 18, gapMain: GAP_MAIN, padding: 22, gutter: 84, ...opts };
  const finiteRootLevels = roots.map(o.layerOf).filter(Number.isFinite);
  const levelOffset = finiteRootLevels.length ? Math.min(...finiteRootLevels) : 0;
  const nodes: LNode[] = [];
  const edges: LEdge[] = [];
  const sizeOf = (ln: LNode): CardSize => (ln.kind === "group" ? groupCardSize(ln.members!.length, o.groupMax) : o.card);
  const normalizedLevel = (n: OrgNode, parentLayer: number) => Math.max(0, o.layerOf(n) - levelOffset, parentLayer + 1);

  const build = (n: OrgNode, parent: LNode | null, parentLayer: number): V => {
    const layer = normalizedLevel(n, parentLayer);
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
    };
    nodes.push(ln);
    const v: V = { ln, children: [], extent: o.card.w, center: 0 };
    const kids: { layer: number; order: number; v: V }[] = [];
    let order = 0;

    // Lateral staff officers (Secretary / Assistant) sit beside their manager on its row.
    const staff = n.children.filter((c) => c.staff);
    for (const s of staff) {
      const sl: LNode = { id: s.id, kind: "staff", node: s, layer, parent: ln.id, x: 0, y: 0, w: o.card.w, h: o.card.h, inferred: s.link.startsWith("inferred") };
      nodes.push(sl);
      kids.push({ layer, order: order++, v: { ln: sl, children: [], extent: 0, center: 0 } });
    }

    const reports = n.children.filter((c) => !c.staff);
    if (reports.length) {
      for (const c of reports.filter((child) => child.children.some((g) => !g.staff))) {
        kids.push({ layer: normalizedLevel(c, layer), order: order++, v: build(c, ln, layer) });
      }
      const byLayer = new Map<number, OrgNode[]>();
      for (const c of reports.filter((child) => !child.children.some((g) => !g.staff))) {
        const L = normalizedLevel(c, layer);
        if (!byLayer.has(L)) byLayer.set(L, []);
        byLayer.get(L)!.push(c);
      }
      for (const [L, arr] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
        if (arr.length > o.groupThreshold) {
          const gs = groupCardSize(arr.length, o.groupMax);
          const gl: LNode = { id: `g:${n.id}:${L}`, kind: "group", members: arr, layer: L, parent: ln.id, x: 0, y: 0, w: gs.w, h: gs.h, inferred: false };
          nodes.push(gl);
          kids.push({ layer: L, order: order++, v: { ln: gl, children: [], extent: gs.w, center: 0 } });
        } else {
          for (const c of arr) kids.push({ layer: L, order: order++, v: build(c, ln, layer) });
        }
      }
      kids.sort((a, b) => a.layer - b.layer || a.order - b.order);
      v.children = kids.map((k) => k.v);
    }

    // Even sets of 4+ branches reserve a centre aisle: two reports left, two right.
    const centreAisle = v.children.length >= 4 && v.children.length % 2 === 0 ? Math.max(44, o.gapCross * 2.5) : 0;
    const childExtent = v.children.reduce((a, c) => a + c.extent, 0) + Math.max(0, v.children.length - 1) * o.gapCross + centreAisle;
    v.extent = Math.max(o.card.w, childExtent);
    return v;
  };

  const forest = roots.map((r) => build(r, null, -1));
  const maxLayer = nodes.length ? Math.max(...nodes.map((n) => n.layer)) : 0;
  const layers: LayerInfo[] = [];
  const seenLevelRows = new Set<number>();
  let y = o.padding;
  for (let i = 0; i <= maxLayer; i++) {
    const inLayer = nodes.filter((n) => n.layer === i);
    const size = Math.max(o.card.h, ...inLayer.map((n) => sizeOf(n).h));
    const count = inLayer.reduce((a, n) => a + (n.kind === "group" ? n.members!.length : 1), 0);
    const positions = new Map<number, number>();
    for (const n of inLayer) {
      const p = n.kind === "group" ? o.layerOf(n.members![0]) : n.node ? o.layerOf(n.node) : levelOffset + i;
      positions.set(p, (positions.get(p) ?? 0) + (n.kind === "group" ? n.members!.length : 1));
    }
    const actualPosition = [...positions.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? Math.min(levelOffset + i, levelOffset + maxLayer);
    const level = LEVEL_ORDER[actualPosition];
    const continuation = seenLevelRows.has(actualPosition);
    seenLevelRows.add(actualPosition);
    layers.push({ index: i, actualPosition, level, band: bandLabel(level), offset: y, size, count, continuation });
    y += size + o.gapMain;
  }
  const height = (layers.length ? y - o.gapMain : o.padding) + o.padding;

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
    v.ln.y = layers[v.ln.layer].offset;
    if (v.ln.kind === "staff") {
      // Lateral placement: immediately to the right of the manager, on the same row.
      const parent = v.ln.parent ? nodes.find((n) => n.id === v.ln.parent) : undefined;
      if (parent) {
        v.ln.x = parent.x + parent.w + 26;
        v.ln.y = parent.y;
      }
    }
  };
  let x = o.padding + o.gutter;
  for (const v of forest) {
    place(v, x);
    x += v.extent + o.gapCross * 2;
  }
  const width = Math.max(720, (forest.length ? x - o.gapCross * 2 : o.padding + o.gutter) + o.padding);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (!n.parent) continue;
    const p = byId.get(n.parent);
    if (!p) continue;
    const ps = sizeOf(p);
    const ns = sizeOf(n);
    if (n.kind === "staff") {
      const yMid = p.y + ps.h / 2;
      const points: [number, number][] = [[p.x + ps.w, yMid], [n.x, yMid]];
      edges.push({ id: `${p.id}->${n.id}`, from: p.id, to: n.id, inferred: n.inferred, kind: "staff", points, d: `M${points[0][0]} ${points[0][1]} L${points[1][0]} ${points[1][1]}` });
      continue;
    }
    const bus = p.y + ps.h + o.gapMain / 2;
    const x1 = p.x + ps.w / 2;
    const x2 = n.x + ns.w / 2;
    const y1 = p.y + ps.h;
    const y2 = n.y;
    const points: [number, number][] = [[x1, y1], [x1, bus], [x2, bus], [x2, y2]];
    edges.push({
      id: `${p.id}->${n.id}`,
      from: p.id,
      to: n.id,
      inferred: n.inferred,
      kind: "bus",
      points,
      d: `M${x1} ${y1} V${bus} H${x2} V${y2}`,
    });
  }
  return { nodes, edges, width, height, layers, levelOffset, padding: o.padding, gutter: o.gutter, gapMain: o.gapMain, byId };
}
