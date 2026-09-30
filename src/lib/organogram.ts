import { canonicalOrgLevel, pickLeader, reportingChildren, type OrgLevelCode } from "./analytics";
import type { Employee } from "./types";

/** ATOMA hierarchy, top to bottom, exactly as used in the approved HR organogram. */
export const LEVEL_ORDER: OrgLevelCode[] = ["L6", "L5", "L4", "L3H", "L3", "L2", "L1"];

export const CARD_W = 238;
export const CARD_H = 62;
export const GAP_X = 30;
export const BAND_PAD = 26;
export const RAIL_W = 66;
export const DEFAULT_CHILD_CAP = 8;
export const DEFAULT_NODE_BUDGET = 1_200;

const MANAGER_RE = /manager|head|supervisor|lead|chief|director/i;
const TEMP_RE = /\b(temp|temporary|interim|probation|contractor|on contract)\b/i;
const VACANT_RE = /\bvacan/i;
const CEO_RE = /chief executive|\bceo\b|managing director|country director|president/i;

export interface OrganogramNode {
  id: string;
  name: string;
  title: string;
  level: OrgLevelCode;
  vacant: boolean;
  temporary: boolean;
  employeeId?: string;
  /** Set on "+N more" placeholder cards, pointing at the parent to expand. */
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
}

export interface OrganogramBand {
  level: OrgLevelCode;
  label: string;
  y: number;
  height: number;
  count: number;
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
    vacant: VACANT_RE.test(`${employee.title} ${employee.remarks}`),
    temporary: TEMP_RE.test(`${employee.title} ${employee.remarks}`),
    employeeId: employee.id,
    children: [],
    reports,
  };
}

function bandLabel(level: OrgLevelCode): string {
  return level === "L3H" ? "Head band" : level === "L6" ? "Executive" : level === "L1" ? "Representative" : `Level ${level[1]}`;
}

const rank = (node: OrganogramNode) => LEVEL_ORDER.indexOf(node.level);

/**
 * Builds a divisional organogram from real supervisor links under the approved
 * L6 → L1 bands. Leadership posts without a filled card become dotted placeholders.
 */
export function buildDivisionOrganogram(employees: Employee[]): OrganogramNode | null {
  if (!employees.length) return null;
  const kids = reportingChildren(employees);
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const reportCounts = new Map<string, number>();
  kids.forEach((list, id) => reportCounts.set(id, list.length));

  const childIds = new Set<string>();
  kids.forEach((list) => list.forEach((child) => childIds.add(child.id)));
  const roots = employees.filter((employee) => !childIds.has(employee.id));
  const head =
    pickLeader(roots.length ? roots : employees, {
      kids,
      seniority: (employee) => LEVEL_ORDER.indexOf(levelOf(employee)),
      titleRe: CEO_RE,
    }) ?? employees[0];

  const nodeById = new Map(employees.map((employee) => [employee.id, makeNode(employee, reportCounts.get(employee.id) ?? 0)]));
  const visited = new Set<string>();
  const build = (employee: Employee): OrganogramNode => {
    visited.add(employee.id);
    const node = nodeById.get(employee.id)!;
    node.children = (kids.get(employee.id) ?? [])
      .slice()
      .sort((a, b) => rank(nodeById.get(a.id)!) - rank(nodeById.get(b.id)!) || (reportCounts.get(b.id) ?? 0) - (reportCounts.get(a.id) ?? 0) || a.title.localeCompare(b.title) || a.fullName.localeCompare(b.fullName))
      .map(build);
    return node;
  };
  const headNode = build(head);

  // Staff whose supervisor is outside this scope join the nearest in-scope department leader.
  const orphans = employees
    .filter((employee) => !visited.has(employee.id))
    .sort((a, b) => rank(nodeById.get(a.id)!) - rank(nodeById.get(b.id)!) || (reportCounts.get(b.id) ?? 0) - (reportCounts.get(a.id) ?? 0));
  for (const employee of orphans) {
    let best: Employee | null = null;
    for (const candidate of employees) {
      if (candidate.id === employee.id || !visited.has(candidate.id)) continue;
      if (rank(nodeById.get(candidate.id)!) >= rank(nodeById.get(employee.id)!)) continue;
      if (candidate.department !== employee.department) continue;
      if (!best || rank(nodeById.get(candidate.id)!) < rank(nodeById.get(best.id)!) || (rank(nodeById.get(candidate.id)!) === rank(nodeById.get(best.id)!) && (reportCounts.get(candidate.id) ?? 0) > (reportCounts.get(best.id) ?? 0))) best = candidate;
    }
    const parent = nodeById.get(best?.id ?? head.id)!;
    parent.children.push(nodeById.get(employee.id)!);
    parent.reports = parent.children.length;
    visited.add(employee.id);
  }

  // Departments with staff but no L3H/L3/manager leader get a dotted vacant leadership card.
  const departments = new Map<string, Employee[]>();
  for (const employee of employees) departments.set(employee.department, [...(departments.get(employee.department) ?? []), employee]);
  for (const [department, members] of departments) {
    const hasLeader = members.some((member) => {
      const level = levelOf(member);
      return level === "L3H" || level === "L3" || MANAGER_RE.test(member.title);
    });
    if (hasLeader || members.length < 2) continue;
    const departmentNodes = members.map((member) => nodeById.get(member.id)!);
    const topNodes = departmentNodes.filter((node) => !members.some((other) => other.id !== node.id && (kids.get(other.id) ?? []).some((child) => child.id === node.id)));
    const vacant: OrganogramNode = {
      id: `vacant:${department}`,
      name: "(Vacant)",
      title: `Manager – ${department}`,
      level: "L3",
      vacant: true,
      temporary: false,
      children: topNodes,
      reports: topNodes.length,
    };
    headNode.children.push(vacant);
    headNode.children.sort((a, b) => rank(a) - rank(b) || b.reports - a.reports);
  }

  return headNode;
}

/**
 * Bounds what is drawn: each card keeps a manageable number of direct reports and the
 * whole chart keeps a node budget, so a 20,000-person division still renders instantly.
 * Hidden branches collapse into “+N more” cards that expand on click.
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

/** Classic top-down organogram geometry: level bands, centred subtrees, right-angle connectors. */
export function layoutOrganogram(root: OrganogramNode | null): OrganogramLayout {
  const empty: OrganogramLayout = { width: RAIL_W + CARD_W + 60, height: 180, bands: [], nodes: [], edges: [], root: null, vacantCount: 0, temporaryCount: 0, hiddenCount: 0 };
  if (!root) return empty;

  const step = CARD_W + GAP_X;
  const columns = new Map<string, number>();
  let nextColumn = 0;

  // Leaf packing: each leaf takes the next column; a parent centres over its children,
  // so four reports naturally sit two left and two right of the reporting line.
  const place = (node: OrganogramNode): number => {
    const kids = node.children;
    if (!kids.length) {
      const column = nextColumn++;
      columns.set(node.id, column);
      return column;
    }
    const centres = kids.map(place);
    const centre = (centres[0] + centres[centres.length - 1]) / 2;
    columns.set(node.id, centre);
    return centre;
  };
  place(root);

  const flat: OrganogramNode[] = [];
  const walk = (node: OrganogramNode) => {
    flat.push(node);
    node.children.forEach(walk);
  };
  walk(root);

  const bandIndex = (level: OrgLevelCode) => LEVEL_ORDER.indexOf(level);
  const present = [...new Set(flat.map((node) => bandIndex(node.level)))].sort((a, b) => a - b);

  const bandHeights = new Map<number, number>();
  for (const node of flat) {
    const band = bandIndex(node.level);
    bandHeights.set(band, Math.max(bandHeights.get(band) ?? 0, CARD_H));
  }

  const bands: OrganogramBand[] = [];
  const bandTop = new Map<number, number>();
  let cursorY = 0;
  for (const band of present) {
    const height = (bandHeights.get(band) ?? CARD_H) + BAND_PAD * 2;
    bandTop.set(band, cursorY);
    bands.push({
      level: LEVEL_ORDER[band],
      label: bandLabel(LEVEL_ORDER[band]),
      y: cursorY,
      height,
      count: flat.filter((node) => bandIndex(node.level) === band).length,
    });
    cursorY += height;
  }

  const nodes: PlacedNode[] = [];
  const placed = new Map<string, PlacedNode>();
  for (const node of flat) {
    const x = RAIL_W + (columns.get(node.id) ?? 0) * step + CARD_W / 2;
    const y = (bandTop.get(bandIndex(node.level)) ?? 0) + BAND_PAD;
    const entry: PlacedNode = { node, x, y, width: CARD_W, height: CARD_H };
    nodes.push(entry);
    placed.set(node.id, entry);
  }

  // Resolve accidental horizontal collisions within the same visual row.
  const rows = new Map<number, PlacedNode[]>();
  for (const entry of nodes) {
    const key = Math.round(entry.y / 4);
    rows.set(key, [...(rows.get(key) ?? []), entry]);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index++) {
      const required = row[index - 1].x + CARD_W + 14;
      if (row[index].x < required) row[index].x = required;
    }
  }

  const edges: OrganogramEdge[] = [];
  const connect = (parent: OrganogramNode) => {
    const parentBox = placed.get(parent.id)!;
    for (const child of parent.children) {
      const childBox = placed.get(child.id)!;
      const gap = Math.max(0, childBox.y - (parentBox.y + CARD_H));
      const elbow = parentBox.y + CARD_H + Math.max(10, gap / 2);
      const points: [number, number][] = [
        [parentBox.x, parentBox.y + CARD_H],
        [parentBox.x, elbow],
        [childBox.x, elbow],
        [childBox.x, childBox.y],
      ];
      edges.push({ kind: child.moreOf ? "more" : "report", points, d: points.map((point, index) => `${index ? "L" : "M"} ${point[0]} ${point[1]}`).join(" ") });
      connect(child);
    }
  };
  connect(root);

  let width = 0;
  for (const entry of nodes) width = Math.max(width, entry.x + CARD_W / 2);
  return {
    width: Math.max(RAIL_W + CARD_W + 60, width + 40),
    height: Math.max(180, cursorY + 24),
    bands,
    nodes,
    edges,
    root,
    vacantCount: flat.filter((node) => node.vacant).length,
    temporaryCount: flat.filter((node) => node.temporary).length,
    hiddenCount: flat.filter((node) => node.moreOf).reduce((sum, node) => sum + (node.moreCount ?? 0), 0),
  };
}
