import { canonicalOrgLevel, pickLeader, reportingChildren, type OrgLevelCode } from "./analytics";
import type { Employee } from "./types";

/** ATOMA hierarchy, top to bottom, exactly as used in the approved HR organogram. */
export const LEVEL_ORDER: OrgLevelCode[] = ["L6", "L5", "L4", "L3H", "L3", "L2", "L1"];

export const CARD_W = 212;
export const CARD_H = 56;
export const GAP_X = 26;
export const GRID_GAP_X = 58;
export const ROW_GAP = 22;
export const V_GAP = 74;
export const BAND_PAD = 22;
export const RAIL_W = 62;
export const SPINE_X = RAIL_W + 10;
export const GRID_COLUMN_CAP = 3;
export const GRID_MIN_CHILDREN = 5;
export const STAFF_GAP = 34;
export const DEFAULT_CHILD_CAP = 20;
export const DEFAULT_NODE_BUDGET = 1_200;

const TEMP_RE = /\b(temp|temporary|interim|probation|contractor|on contract)\b/i;
const STAFF_RE = /\b(secretary|personal assistant|executive assistant|office manager|admin assistant|pa to|admin officer)\b/i;
const CEO_RE = /chief executive|\bceo\b|managing director|country director|president/i;

export interface OrganogramNode {
  id: string;
  name: string;
  title: string;
  level: OrgLevelCode;
  /** Displayed badge; staff officers keep their own level while sitting beside the manager. */
  levelLabel?: string;
  vacant: boolean;
  temporary: boolean;
  /** Lateral staff officer (e.g. Secretary) drawn beside the manager, as in the approved chart. */
  staff?: boolean;
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
  /** Column index inside a stacked team cluster; -1 when the node is not in a cluster. */
  clusterColumn: number;
  clusterSpineX: number | null;
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
  kind: "report" | "more" | "staff" | "cluster";
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
  staffCount: number;
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
    levelLabel: canonicalOrgLevel(employee.level) ?? undefined,
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
    // Lateral staff officers (secretary/PA) sit beside their manager in the manager's band.
    for (const child of node.children) {
      const employeeChild = byId.get(child.employeeId ?? "");
      if (employeeChild && STAFF_RE.test(employeeChild.title) && nodeRank(child) - nodeRank(node) >= 1) {
        child.staff = true;
        child.levelLabel = child.levelLabel ?? child.level;
        child.level = node.level;
      }
    }
    return node;
  };
  const tree = build(head);

  const wanted = new Set(population.map((employee) => employee.id));
  wanted.add(head.id);
  const prune = (node: OrganogramNode, isRoot: boolean): boolean => {
    node.children = node.children.filter((child) => prune(child, false));
    return isRoot || wanted.has(node.id) || node.children.length > 0;
  };
  prune(tree, true);

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
export function buildDepartmentOrganogram(context: Employee[], department: string): OrganogramNode | null {
  const population = context.filter((employee) => employee.department === department);
  // Keep the chart anchored on the division head/director of the population's own division.
  const divisionName = population[0]?.division;
  const scope = divisionName ? context.filter((employee) => employee.division === divisionName) : context;
  return buildDivisionOrganogram(scope, population.length ? population : scope);
}

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

interface Slot {
  node: OrganogramNode;
  x: number;
  y: number;
  row: number;
  clusterColumn: number;
  clusterSpineX: number | null;
}

/**
 * Balanced executive organogram geometry, following the approved Visio chart:
 *  • the head sits on the vertical centre line with subordinates distributed equally
 *    left and right, and their own teams balanced beneath them;
 *  • managers with their own teams are drawn side by side;
 *  • larger teams stack into balanced left/right columns (spine + stub connectors);
 *  • staff officers (e.g. Secretary) sit laterally beside their manager;
 *  • level bands grow in height where a level is dense, keeping the sheet print-friendly.
 */
export function layoutOrganogram(root: OrganogramNode | null): OrganogramLayout {
  const empty: OrganogramLayout = { width: RAIL_W + CARD_W + 120, height: 220, bands: [], nodes: [], edges: [], root: null, vacantCount: 0, temporaryCount: 0, hiddenCount: 0, staffCount: 0 };
  if (!root) return empty;

  const step = CARD_W + GAP_X;
  const slots: Slot[] = [];
  const slotOf = new Map<string, Slot>();

  // Siblings are split left / centre / right around their manager's axis so every
  // team is balanced on both sides, exactly like the approved Visio sheet.
  const split = (list: OrganogramNode[]) => {
    const count = list.length;
    const centreIndex = count % 2 === 1 ? Math.floor(count / 2) : -1;
    return {
      left: list.slice(0, centreIndex === -1 ? count / 2 : centreIndex),
      centre: centreIndex === -1 ? null : list[centreIndex],
      right: list.slice(centreIndex === -1 ? count / 2 : centreIndex + 1),
    };
  };
  const width = (list: OrganogramNode[]): number => list.reduce((sum, child) => sum + extent(child), 0) + Math.max(0, list.length - 1) * GAP_X;

  // Work out how much horizontal room each subtree needs (compact packing; the
  // left/right balance pass runs after placement and only widens where needed).
  const extent = (node: OrganogramNode): number => {
    const kids = node.children.filter((child) => !child.staff);
    if (!kids.length) return CARD_W;
    const nested = kids.some((child) => child.children.some((grand) => !grand.staff));
    if (!nested && kids.length >= GRID_MIN_CHILDREN) {
      const columns = Math.ceil(kids.length / GRID_COLUMN_CAP);
      return columns * CARD_W + (columns - 1) * GRID_GAP_X;
    }
    return width(kids);
  };

  const bandTopFor = new Map<OrgLevelCode, number>();
  const bandRowsFor = new Map<OrgLevelCode, number>();
  const placeNode = (node: OrganogramNode, x: number, y: number, row: number, column: number, spineX: number | null) => {
    const slot: Slot = { node, x, y, row, clusterColumn: column, clusterSpineX: spineX };
    slots.push(slot);
    slotOf.set(node.id, slot);
  };

  // First pass: depths and grid rows per band so band heights can grow where needed.
  const bandRowCount = (node: OrganogramNode, parentY: number): number => {
    const kids = node.children.filter((child) => !child.staff);
    const nested = kids.some((child) => child.children.some((grand) => !grand.staff));
    return !nested && kids.length >= GRID_MIN_CHILDREN ? Math.min(GRID_COLUMN_CAP, kids.length) : 1;
  };
  const scan = (node: OrganogramNode) => {
    const rows = bandRowCount(node, 0);
    bandRowsFor.set(node.level, Math.max(bandRowsFor.get(node.level) ?? 1, rows));
    node.children.forEach(scan);
  };
  scan(root);

  const present = LEVEL_ORDER.filter((level) => bandRowsFor.has(level));
  let cursorY = 0;
  const bandHeight = new Map<OrgLevelCode, number>();
  for (const level of present) {
    const rows = bandRowsFor.get(level) ?? 1;
    const height = BAND_PAD * 2 + rows * CARD_H + (rows - 1) * ROW_GAP;
    bandTopFor.set(level, cursorY);
    bandHeight.set(level, height);
    cursorY += height;
  }
  const bandIndexOf = (level: OrgLevelCode) => Math.max(0, present.indexOf(level));
  const yForLevel = (level: OrgLevelCode, row: number, parentY: number) => {
    const base = (bandTopFor.get(level) ?? parentY + V_GAP) + BAND_PAD + row * (CARD_H + ROW_GAP);
    return Math.max(base, parentY + CARD_H + 26);
  };

  // Recursive placement: managers side by side, larger leaf teams in balanced columns.
  const layoutChildren = (node: OrganogramNode, left: number, y: number, levelIndex: number) => {
    const kids = node.children.filter((child) => !child.staff);
    const nested = kids.some((child) => child.children.some((grand) => !grand.staff));
    const gridMode = !nested && kids.length >= GRID_MIN_CHILDREN;
    if (gridMode) {
      const columns = Math.ceil(kids.length / GRID_COLUMN_CAP);
      kids.forEach((child, index) => {
        const column = Math.floor(index / GRID_COLUMN_CAP);
        const rowIndex = index % GRID_COLUMN_CAP;
        const columnLeft = left + column * (CARD_W + GRID_GAP_X);
        placeNode(child, columnLeft + CARD_W / 2, yForLevel(child.level, rowIndex, y), rowIndex, column, columnLeft - 12);
        const grandKids = child.children.filter((grand) => !grand.staff);
        if (grandKids.length) {
          const grandLeft = columnLeft + CARD_W / 2 - extent(child) / 2;
          place(child, grandLeft, yForLevel(child.level, rowIndex, y), levelIndex);
        }
      });
    } else {
      // Compact row packing exactly as the approved Visio sheet: the manager sits on
      // the centre of its team's span, so a team of four lands two left / two right
      // and a team of three sits left · centre · right around the reporting line.
      let cursor = left;
      for (const child of kids) {
        place(child, cursor, y, levelIndex);
        cursor += extent(child) + GAP_X;
      }
    }
  };

  const place = (node: OrganogramNode, left: number, parentY: number, parentLevelIndex: number): number => {
    const own = extent(node);
    const x = left + own / 2;
    const levelIndex = bandIndexOf(node.level);
    const y = yForLevel(node.level, 0, parentY);
    placeNode(node, x, y, 0, -1, null);
    // Staff officers sit laterally beside their manager (approved chart convention),
    // and any of their own reports continue underneath them.
    node.children
      .filter((child) => child.staff)
      .forEach((staffNode, index) => {
        const staffX = x + CARD_W / 2 + STAFF_GAP + CARD_W / 2;
        const staffY = y + index * (CARD_H + 8);
        placeNode(staffNode, staffX, staffY, 0, -1, null);
        if (staffNode.children.some((grand) => !grand.staff)) {
          layoutChildren(staffNode, staffX - extent(staffNode) / 2, staffY, levelIndex);
        }
      });
    layoutChildren(node, left, y, levelIndex);
    return own;
  };
  place(root, 0, bandTopFor.get(root.level) ?? 0, 0);

  // Centre the head on the sheet, exactly like the approved Visio drawing.
  let minX = Infinity;
  let maxX = -Infinity;
  for (const slot of slots) {
    minX = Math.min(minX, slot.x - CARD_W / 2);
    maxX = Math.max(maxX, slot.x + CARD_W / 2);
  }
  const rootSlot = slotOf.get(root.id)!;
  // Keep the head exactly on the centre line and size the sheet around the larger
  // side, so both halves fit and the drawing is perfectly balanced.
  const margin = 60;
  const halfWidth = Math.max(rootSlot.x - minX, maxX - rootSlot.x, CARD_W);
  const canvasWidth = halfWidth * 2 + margin * 2;
  const shift = canvasWidth / 2 - rootSlot.x;
  for (const slot of slots) slot.x += shift;

  // Resolve accidental same-row collisions (very asymmetric trees).
  const rowsByKey = new Map<number, Slot[]>();
  for (const slot of slots) {
    const key = Math.round(slot.y / 4);
    rowsByKey.set(key, [...(rowsByKey.get(key) ?? []), slot]);
  }
  for (const row of rowsByKey.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index++) {
      const required = row[index - 1].x + CARD_W + 12;
      if (row[index].x < required) row[index].x = required;
    }
  }

  const placedNodes: PlacedNode[] = slots.map((slot) => ({
    node: slot.node,
    x: slot.x,
    y: slot.y,
    width: CARD_W,
    height: CARD_H,
    row: slot.row,
    clusterColumn: slot.clusterColumn,
    clusterSpineX: slot.clusterSpineX === null ? null : slot.clusterSpineX + shift,
  }));
  const placed = new Map(placedNodes.map((entry) => [entry.node.id, entry]));

  const blocks = (x: number, y1: number, y2: number, except: Set<string>) => {
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    for (const entry of placedNodes) {
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

  const connect = (node: OrganogramNode) => {
    const parentBox = placed.get(node.id);
    if (!parentBox) {
      node.children.forEach(connect);
      return;
    }
    const kids = node.children.filter((child) => !child.staff);
    const nested = kids.some((child) => child.children.some((grand) => !grand.staff));
    const gridMode = !nested && kids.length >= GRID_MIN_CHILDREN;

    for (const staffNode of node.children.filter((child) => child.staff)) {
      const staffBox = placed.get(staffNode.id);
      if (!staffBox) continue;
      pushEdge("staff", [
        [parentBox.x + CARD_W / 2, parentBox.y + CARD_H / 2],
        [staffBox.x - CARD_W / 2, parentBox.y + CARD_H / 2],
      ]);
    }

    if (gridMode) {
      const branchY = parentBox.y + CARD_H + 22;
      const byColumn = new Map<number, PlacedNode[]>();
      for (const child of kids) {
        const box = placed.get(child.id);
        if (!box) continue;
        byColumn.set(box.clusterColumn, [...(byColumn.get(box.clusterColumn) ?? []), box]);
      }
      byColumn.forEach((columnBoxes, columnIndex) => {
        const column = columnBoxes.sort((a, b) => a.y - b.y);
        const spineX = column[0].clusterSpineX ?? column[0].x - CARD_W / 2 - 12;
        pushEdge("cluster", [
          [parentBox.x, parentBox.y + CARD_H],
          [parentBox.x, branchY],
          [columnIndex === 0 ? spineX : spineX, branchY],
          [spineX, column[column.length - 1].y + CARD_H / 2],
        ]);
        for (const box of column) {
          pushEdge("cluster", [
            [spineX, box.y + CARD_H / 2],
            [box.x - CARD_W / 2, box.y + CARD_H / 2],
          ]);
        }
      });
    } else {
      for (const child of kids) {
        const childBox = placed.get(child.id);
        if (!childBox) continue;
        const kind: OrganogramEdge["kind"] = child.moreOf ? "more" : "report";
        const except = new Set([node.id, child.id]);
        const gap = Math.max(0, childBox.y - (parentBox.y + CARD_H));
        const elbow = parentBox.y + CARD_H + Math.max(18, gap / 2);
        const clearDirect = !blocks(parentBox.x, parentBox.y + CARD_H, elbow, except) && !blocks(childBox.x, elbow, childBox.y, except);
        if (clearDirect) {
          pushEdge(kind, [
            [parentBox.x, parentBox.y + CARD_H],
            [parentBox.x, elbow],
            [childBox.x, elbow],
            [childBox.x, childBox.y],
          ]);
        } else {
          const channelAbove = childBox.y - 14;
          pushEdge(kind, [
            [parentBox.x, parentBox.y + CARD_H],
            [parentBox.x, parentBox.y + CARD_H + 14],
            [SPINE_X, parentBox.y + CARD_H + 14],
            [SPINE_X, channelAbove],
            [childBox.x, channelAbove],
            [childBox.x, childBox.y],
          ]);
        }
      }
    }
    node.children.forEach(connect);
  };
  connect(root);

  let height = 0;
  for (const entry of placedNodes) height = Math.max(height, entry.y + CARD_H);
  return {
    width: canvasWidth,
    height: Math.max(220, height + 34),
    bands: present.map((level) => ({
      level,
      label: bandLabel(level),
      y: bandTopFor.get(level) ?? 0,
      height: bandHeight.get(level) ?? CARD_H + BAND_PAD * 2,
      count: placedNodes.filter((entry) => entry.node.level === level).length,
      rows: bandRowsFor.get(level) ?? 1,
    })),
    nodes: placedNodes,
    edges,
    root,
    vacantCount: placedNodes.filter((entry) => entry.node.vacant).length,
    temporaryCount: placedNodes.filter((entry) => entry.node.temporary).length,
    hiddenCount: placedNodes.filter((entry) => entry.node.moreOf).reduce((sum, entry) => sum + (entry.node.moreCount ?? 0), 0),
    staffCount: placedNodes.filter((entry) => entry.node.staff).length,
  };
}
