import { canonicalOrgLevel, pickLeader, reportingChildren, type OrgLevelCode } from "./analytics";
import type { Employee } from "./types";

/** ATOMA hierarchy, top to bottom, exactly as used in the approved HR organogram. */
export const LEVEL_ORDER: OrgLevelCode[] = ["L6", "L5", "L4", "L3H", "L3", "L2", "L1"];

export const CARD_W = 224;
export const CARD_H = 58;
export const GAP_X = 26;
export const ROW_GAP = 30;
export const BAND_PAD = 22;
export const RAIL_W = 62;
export const SPINE_X = RAIL_W + 12;
export const MAX_COLS_PER_ROW = 8;
export const DEFAULT_CHILD_CAP = 20;
export const DEFAULT_NODE_BUDGET = 1_200;

const TEMP_RE = /\b(temp|temporary|interim|probation|contractor|on contract)\b/i;
const CEO_RE = /chief executive|\bceo\b|managing director|country director|president/i;

export interface OrganogramNode {
  id: string;
  name: string;
  title: string;
  level: OrgLevelCode;
  vacant: boolean;
  temporary: boolean;
  employeeId?: string;
  moreOf?: string;
  moreCount?: number;
  children: OrganogramNode[];
  reports: number;
}

export interface PlacedNode {
  node: OrganogramNode;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
}

export interface OrganogramBand {
  level: OrgLevelCode;
  label: string;
  y: number;
  height: number;
  count: number;
  rows: number;
}

export interface OrganogramEdge {
  d: string;
  points: [number, number][];
  kind: "report" | "more";
}

export interface OrganogramLayout {
  width: number;
  height: number;
  bands: OrganogramBand[];
  nodes: PlacedNode[];
  edges: OrganogramEdge[];
  root: OrganogramNode | null;
  vacantCount: number;
  temporaryCount: number;
  hiddenCount: number;
}

function fallbackLevel(employee: Employee): OrgLevelCode {
  const rank = employee.levelRank;
  if (rank >= 10) return "L6";
  if (rank >= 9) return "L5";
  if (rank >= 8) return "L4";
  if (rank >= 7) return "L3H";
  if (rank >= 6) return "L3";
  if (rank >= 4) return "L2";
  return "L1";
}

function levelOf(employee: Employee): OrgLevelCode {
  return canonicalOrgLevel(employee.level) ?? fallbackLevel(employee);
}

function makeNode(employee: Employee, reports: number): OrganogramNode {
  return {
    id: employee.id,
    name: employee.fullName,
    title: employee.title,
    level: levelOf(employee),
    vacant: /\bvacan/i.test(`${employee.title} ${employee.remarks}`),
    temporary: TEMP_RE.test(`${employee.title} ${employee.remarks}`),
    employeeId: employee.id,
    children: [],
    reports,
  };
}

function bandLabel(level: OrgLevelCode): string {
  return level === "L3H" ? "Head band" : level === "L6" ? "Executive" : level === "L1" ? "Representative" : `Level ${level[1]}`;
}

const nodeRank = (node: OrganogramNode) => LEVEL_ORDER.indexOf(node.level);

/**
 * Builds an organogram from real line-manager links (levels are labels only — an L2
 * employee reporting to an L5 manager is drawn exactly that way). `population` selects
 * who is shown while `context` keeps their leadership chain, so a department chart can
 * keep the division head/director on top.
 */
export function buildDivisionOrganogram(context: Employee[], population: Employee[] = context): OrganogramNode | null {
  if (!context.length || !population.length) return null;
  const kids = reportingChildren(context);
  const byId = new Map(context.map((employee) => [employee.id, employee]));
  const reportCounts = new Map<string, number>();
  kids.forEach((list, id) => reportCounts.set(id, list.length));

  const childIds = new Set<string>();
  kids.forEach((list) => list.forEach((child) => childIds.add(child.id)));
  const roots = context.filter((employee) => !childIds.has(employee.id));
  const head =
    pickLeader(roots.length ? roots : context, {
      kids,
      seniority: (employee) => LEVEL_ORDER.indexOf(levelOf(employee)),
      titleRe: CEO_RE,
    }) ?? context[0];

  const nodeById = new Map(context.map((employee) => [employee.id, makeNode(employee, reportCounts.get(employee.id) ?? 0)]));
  const build = (employee: Employee): OrganogramNode => {
    const node = nodeById.get(employee.id)!;
    node.children = (kids.get(employee.id) ?? [])
      .slice()
      .sort((a, b) => nodeRank(nodeById.get(a.id)!) - nodeRank(nodeById.get(b.id)!) || (reportCounts.get(b.id) ?? 0) - (reportCounts.get(a.id) ?? 0) || a.title.localeCompare(b.title) || a.fullName.localeCompare(b.fullName))
      .map(build);
    return node;
  };
  const tree = build(head);

  // Prune branches without anyone from the requested population (keeps leadership chain).
  const wanted = new Set(population.map((employee) => employee.id));
  wanted.add(head.id);
  const prune = (node: OrganogramNode, isRoot: boolean): boolean => {
    node.children = node.children.filter((child) => prune(child, false));
    return isRoot || wanted.has(node.id) || node.children.length > 0;
  };
  prune(tree, true);

  // Staff whose supervisor is outside this context join the nearest higher-ranked colleague
  // in the same department, so nobody is silently dropped from the chart.
  const attached = new Set<string>();
  const mark = (node: OrganogramNode) => {
    attached.add(node.id);
    node.children.forEach(mark);
  };
  mark(tree);
  const orphans = population
    .filter((employee) => !attached.has(employee.id))
    .sort((a, b) => nodeRank(nodeById.get(a.id)!) - nodeRank(nodeById.get(b.id)!) || (reportCounts.get(b.id) ?? 0) - (reportCounts.get(a.id) ?? 0));
  const nodeFor = (employee: Employee) => nodeById.get(employee.id)!;
  for (const employee of orphans) {
    const target = nodeFor(employee);
    let bestNode: OrganogramNode | null = null;
    const search = (node: OrganogramNode) => {
      if (node.employeeId && node.employeeId !== employee.id) {
        const candidate = byId.get(node.employeeId);
        if (candidate && candidate.department === employee.department && nodeRank(node) < nodeRank(target)) {
          if (!bestNode || nodeRank(node) < nodeRank(bestNode) || (nodeRank(node) === nodeRank(bestNode) && node.reports > bestNode.reports)) bestNode = node;
        }
      }
      node.children.forEach(search);
    };
    search(tree);
    const host: OrganogramNode = (bestNode as OrganogramNode | null) ?? tree;
    host.children.push(target);
    host.reports = host.children.length;
    attached.add(employee.id);
  }

  return tree;
}

/** Convenience wrapper: one department chart topped by the division head/director. */
export function buildDepartmentOrganogram(divisionEmployees: Employee[], department: string): OrganogramNode | null {
  const population = divisionEmployees.filter((employee) => employee.department === department);
  return buildDivisionOrganogram(divisionEmployees, population.length ? population : divisionEmployees);
}

/**
 * Bounds what is drawn: each card keeps a manageable number of direct reports and the
 * chart keeps a node budget, so pathological data still renders. Hidden branches become
 * “+N more” cards that expand on click.
 */
export function toDisplayTree(root: OrganogramNode, caps: Record<string, number>, budget = DEFAULT_NODE_BUDGET): { tree: OrganogramNode; hiddenCount: number } {
  let used = 1;
  let hidden = 0;
  const clone = (node: OrganogramNode, depth: number): OrganogramNode => {
    const cap = caps[node.id] ?? DEFAULT_CHILD_CAP;
    const remaining = budget - used;
    const allowed = Math.max(0, Math.min(cap, remaining - (depth + 2)));
    const visible = node.children.slice(0, allowed);
    const rest = node.children.length - visible.length;
    hidden += rest;
    used += visible.length + (rest > 0 ? 1 : 0);
    const children = visible.map((child) => clone(child, depth + 1));
    if (rest > 0) {
      children.push({
        id: `more:${node.id}`,
        name: `+${rest} more`,
        title: "Click to show more",
        level: node.children[allowed]?.level ?? node.level,
        vacant: false,
        temporary: false,
        moreOf: node.id,
        moreCount: rest,
        children: [],
        reports: rest,
      });
    }
    return { ...node, children };
  };
  return { tree: clone(root, 0), hiddenCount: hidden };
}

interface BandWork {
  index: number;
  level: OrgLevelCode;
  groups: { parent: OrganogramNode | null; members: OrganogramNode[] }[];
  rows: OrganogramNode[][];
  top: number;
  height: number;
}

/**
 * Organogram geometry with flexible level bands: a band with many people (typically L2/L1)
 * wraps into several rows and simply becomes taller, keeping the chart print-friendly
 * instead of stretching into one endless line.
 */
export function layoutOrganogram(root: OrganogramNode | null): OrganogramLayout {
  const empty: OrganogramLayout = { width: RAIL_W + CARD_W + 80, height: 200, bands: [], nodes: [], edges: [], root: null, vacantCount: 0, temporaryCount: 0, hiddenCount: 0 };
  if (!root) return empty;

  const step = CARD_W + GAP_X;
  const flat: OrganogramNode[] = [];
  const walk = (node: OrganogramNode) => {
    flat.push(node);
    node.children.forEach(walk);
  };
  walk(root);

  // Ideal column packing: leaves take columns, parents centre over their children.
  const idealCol = new Map<string, number>();
  let nextColumn = 0;
  const place = (node: OrganogramNode): number => {
    const kids = node.children;
    if (!kids.length) {
      const column = nextColumn++;
      idealCol.set(node.id, column);
      return column;
    }
    const centres = kids.map(place);
    const centre = (centres[0] + centres[centres.length - 1]) / 2;
    idealCol.set(node.id, centre);
    return centre;
  };
  place(root);

  // Group band members by parent so siblings stay together when rows wrap.
  const parentOf = new Map<string, OrganogramNode>();
  const visit = (node: OrganogramNode) => {
    node.children.forEach((child) => {
      parentOf.set(child.id, node);
      visit(child);
    });
  };
  visit(root);

  const bandIndex = (level: OrgLevelCode) => LEVEL_ORDER.indexOf(level);
  const present = [...new Set(flat.map((node) => bandIndex(node.level)))].sort((a, b) => a - b);
  const work = new Map<number, BandWork>();
  for (const index of present) {
    const members = flat.filter((node) => bandIndex(node.level) === index);
    const groups = new Map<string, OrganogramNode[]>();
    for (const member of members) {
      const parent = parentOf.get(member.id);
      const key = parent ? parent.id : `root:${member.id}`;
      groups.set(key, [...(groups.get(key) ?? []), member]);
    }
    const groupList = [...groups.values()]
      .map((list) => ({ parent: parentOf.get(list[0].id) ?? null, members: list.sort((a, b) => (idealCol.get(a.id) ?? 0) - (idealCol.get(b.id) ?? 0)) }))
      .sort((a, b) => (idealCol.get(a.members[0].id) ?? 0) - (idealCol.get(b.members[0].id) ?? 0));
    work.set(index, { index, level: LEVEL_ORDER[index], groups: groupList, rows: [], top: 0, height: 0 });
  }

  // Wrap band members into rows of at most MAX_COLS_PER_ROW columns: small sibling
  // groups stay together, oversized teams split across rows so a busy level band
  // grows taller instead of stretching into one endless line.
  for (const band of work.values()) {
    let row: OrganogramNode[] = [];
    const flush = () => {
      if (row.length) {
        band.rows.push(row);
        row = [];
      }
    };
    for (const group of band.groups) {
      let index = 0;
      while (index < group.members.length) {
        const remaining = MAX_COLS_PER_ROW - row.length;
        if (remaining <= 0) {
          flush();
          continue;
        }
        const fitsWholeGroup = group.members.length <= MAX_COLS_PER_ROW;
        const take = Math.min(remaining, group.members.length - index);
        if (fitsWholeGroup && take < group.members.length && row.length > 0) {
          flush();
          continue;
        }
        row.push(...group.members.slice(index, index + take));
        index += take;
        if (row.length >= MAX_COLS_PER_ROW) flush();
      }
    }
    flush();
    if (!band.rows.length) band.rows.push([]);
    band.height = BAND_PAD * 2 + band.rows.length * CARD_H + (band.rows.length - 1) * ROW_GAP;
  }

  let cursorY = 0;
  for (const index of present) {
    const band = work.get(index)!;
    band.top = cursorY;
    cursorY += band.height;
  }

  const placed = new Map<string, PlacedNode>();
  for (const band of work.values()) {
    band.rows.forEach((row, rowIndex) => {
      const y = band.top + BAND_PAD + rowIndex * (CARD_H + ROW_GAP);
      row.forEach((node, columnIndex) => {
        const x = RAIL_W + 40 + columnIndex * step + CARD_W / 2;
        const entry: PlacedNode = { node, x, y, width: CARD_W, height: CARD_H, row: rowIndex };
        placed.set(node.id, entry);
      });
    });
  }

  // Re-centre parents over their children (bottom-up), then resolve same-row collisions.
  for (let index = present.length - 1; index >= 0; index--) {
    const band = work.get(present[index])!;
    for (const group of band.groups) {
      if (!group.parent) continue;
      const parentBox = placed.get(group.parent.id);
      const childBoxes = group.members.map((member) => placed.get(member.id)).filter(Boolean) as PlacedNode[];
      if (!parentBox || !childBoxes.length) continue;
      parentBox.x = (Math.min(...childBoxes.map((box) => box.x)) + Math.max(...childBoxes.map((box) => box.x))) / 2;
    }
  }

  const rowsByKey = new Map<number, PlacedNode[]>();
  for (const entry of placed.values()) {
    const key = Math.round(entry.y / 4);
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), entry]);
  }
  for (const row of rowsByKey.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index++) {
      const required = row[index - 1].x + CARD_W + 12;
      if (row[index].x < required) row[index].x = required;
    }
  }

  const nodes = [...placed.values()];
  const bandOfNode = (id: string) => {
    const node = placed.get(id)!.node;
    return work.get(bandIndex(node.level))!;
  };

  // Clearance-checked connectors: direct elbow when nothing is in the way, otherwise a
  // routed path through the left spine and the row channel (never crosses a card).
  const blocks = (x: number, y1: number, y2: number, except: Set<string>) => {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    for (const entry of placed.values()) {
      if (except.has(entry.node.id)) continue;
      if (Math.abs(entry.x - x) > CARD_W / 2 - 4) continue;
      if (entry.y < hi && entry.y + CARD_H > lo) return true;
    }
    return false;
  };

  const edges: OrganogramEdge[] = [];
  const pushEdge = (kind: OrganogramEdge["kind"], points: [number, number][]) => {
    edges.push({ kind, points, d: points.map((point, index) => `${index ? "L" : "M"} ${point[0]} ${point[1]}`).join(" ") });
  };

  const connect = (parent: OrganogramNode) => {
    const parentBox = placed.get(parent.id)!;
    for (const child of parent.children) {
      const childBox = placed.get(child.id)!;
      const kind: OrganogramEdge["kind"] = child.moreOf ? "more" : "report";
      const except = new Set([parent.id, child.id]);
      const gap = Math.max(0, childBox.y - (parentBox.y + CARD_H));
      const elbow = parentBox.y + CARD_H + Math.max(12, gap / 2);
      const clearDirect = !blocks(parentBox.x, parentBox.y + CARD_H, elbow, except) && !blocks(childBox.x, elbow, childBox.y, except);
      if (clearDirect) {
        pushEdge(kind, [
          [parentBox.x, parentBox.y + CARD_H],
          [parentBox.x, elbow],
          [childBox.x, elbow],
          [childBox.x, childBox.y],
        ]);
      } else {
        const band = bandOfNode(child.id);
        const channelAboveBand = band.top - 12;
        const rowChannel = childBox.y - ROW_GAP / 2;
        const startChannel = parentBox.y + CARD_H + 12;
        pushEdge(kind, [
          [parentBox.x, parentBox.y + CARD_H],
          [parentBox.x, startChannel],
          [SPINE_X, startChannel],
          [SPINE_X, channelAboveBand],
          [SPINE_X, rowChannel],
          [childBox.x, rowChannel],
          [childBox.x, childBox.y],
        ]);
      }
      connect(child);
    }
  };
  connect(root);

  let width = 0;
  for (const entry of nodes) width = Math.max(width, entry.x + CARD_W / 2);
  return {
    width: Math.max(RAIL_W + CARD_W + 80, width + 48),
    height: Math.max(200, cursorY + 28),
    bands: present.map((index) => {
      const band = work.get(index)!;
      return { level: band.level, label: bandLabel(band.level), y: band.top, height: band.height, count: flat.filter((node) => bandIndex(node.level) === index).length, rows: band.rows.length };
    }),
    nodes,
    edges,
    root,
    vacantCount: flat.filter((node) => node.vacant).length,
    temporaryCount: flat.filter((node) => node.temporary).length,
    hiddenCount: flat.filter((node) => node.moreOf).reduce((sum, node) => sum + (node.moreCount ?? 0), 0),
  };
}
