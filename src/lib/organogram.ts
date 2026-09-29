import { buildIndex, canonicalOrgLevel, findSupervisor, type OrgLevelCode } from "./analytics";
import type { Employee } from "./types";

/** ATOMA hierarchy, top to bottom, exactly as used in the approved HR organogram. */
export const LEVEL_ORDER: OrgLevelCode[] = ["L6", "L5", "L4", "L3H", "L3", "L2", "L1"];

export const CARD_W = 238;
export const CARD_H = 62;
export const GAP_X = 30;
export const STACK_GAP = 12;
export const BAND_PAD = 26;
export const RAIL_W = 66;

const MANAGER_RE = /manager|head|supervisor|lead|chief|director/i;
const TEMP_RE = /\b(temp|temporary|interim|probation|contractor|on contract)\b/i;
const VACANT_RE = /\bvacan/i;

export interface OrganogramNode {
  id: string;
  name: string;
  title: string;
  level: OrgLevelCode;
  vacant: boolean;
  temporary: boolean;
  employeeId?: string;
  children: OrganogramNode[];
  stacked: boolean;
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
  kind: "report" | "stack";
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

function makeNode(employee: Employee): OrganogramNode {
  return {
    id: employee.id,
    name: employee.fullName,
    title: employee.title,
    level: canonicalOrgLevel(employee.level) ?? fallbackLevel(employee),
    vacant: VACANT_RE.test(`${employee.title} ${employee.remarks}`),
    temporary: TEMP_RE.test(`${employee.title} ${employee.remarks}`),
    employeeId: employee.id,
    children: [],
    stacked: false,
    reports: employee.directReports,
  };
}

function bandLabel(level: OrgLevelCode): string {
  return level === "L3H" ? "Head band" : level === "L6" ? "Executive" : level === "L1" ? "Representative" : `Level ${level[1]}`;
}

/**
 * Builds a divisional organogram from real supervisor links, keeping the approved
 * top-to-bottom level bands. Vacant leadership posts become dotted placeholder cards.
 */
export function buildDivisionOrganogram(employees: Employee[]): OrganogramNode | null {
  if (!employees.length) return null;
  const index = buildIndex(employees);
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const nodeById = new Map(employees.map((employee) => [employee.id, makeNode(employee)]));
  const parent = new Map<string, string | null>();
  const children = new Map<string, string[]>();

  for (const employee of employees) {
    const supervisor = findSupervisor(employee, index);
    const parentId = supervisor && supervisor.id !== employee.id && byId.has(supervisor.id) ? supervisor.id : null;
    parent.set(employee.id, parentId);
    if (parentId) children.set(parentId, [...(children.get(parentId) ?? []), employee.id]);
  }

  // Remove reporting cycles so the tree always lays out.
  for (const employee of employees) {
    const seen = new Set([employee.id]);
    let cursor = parent.get(employee.id) ?? null;
    while (cursor) {
      if (seen.has(cursor)) {
        parent.set(employee.id, null);
        const siblings = children.get(cursor) ?? [];
        children.set(cursor, siblings.filter((id) => id !== employee.id));
        break;
      }
      seen.add(cursor);
      cursor = parent.get(cursor) ?? null;
    }
  }

  const roots = employees.filter((employee) => !parent.get(employee.id));
  const head =
    roots.find((employee) => /chief executive|\bceo\b|country director|managing director|division head/i.test(employee.title)) ??
    [...roots].sort((a, b) => {
      const la = LEVEL_ORDER.indexOf(nodeById.get(a.id)!.level);
      const lb = LEVEL_ORDER.indexOf(nodeById.get(b.id)!.level);
      return la - lb || b.directReports - a.directReports || a.fullName.localeCompare(b.fullName);
    })[0] ??
    employees[0];
  const headNode = nodeById.get(head.id)!;

  const attached = new Set<string>([head.id]);
  const build = (node: OrganogramNode, employee: Employee): OrganogramNode => {
    const kids = (children.get(employee.id) ?? [])
      .map((id) => byId.get(id))
      .filter((child): child is Employee => Boolean(child))
      .sort((a, b) => {
        const la = LEVEL_ORDER.indexOf(nodeById.get(a.id)!.level);
        const lb = LEVEL_ORDER.indexOf(nodeById.get(b.id)!.level);
        return la - lb || b.directReports - a.directReports || a.title.localeCompare(b.title) || a.fullName.localeCompare(b.fullName);
      });
    node.children = kids.map((child) => {
      attached.add(child.id);
      return build(nodeById.get(child.id)!, child);
    });
    return node;
  };
  build(headNode, head);

  // Staff whose supervisor sits outside this scope attach to the nearest in-scope
  // department leader (same department, strictly higher band), never directly to the top card.
  const rank = (id: string) => LEVEL_ORDER.indexOf(nodeById.get(id)!.level);
  const orphans = employees
    .filter((employee) => !attached.has(employee.id))
    .sort((a, b) => rank(a.id) - rank(b.id) || b.directReports - a.directReports);
  for (const employee of orphans) {
    let best: Employee | null = null;
    for (const candidate of employees) {
      if (candidate.id === employee.id || !attached.has(candidate.id)) continue;
      if (rank(candidate.id) >= rank(employee.id)) continue;
      if (candidate.department !== employee.department) continue;
      if (!best || rank(candidate.id) < rank(best.id) || (rank(candidate.id) === rank(best.id) && candidate.directReports > best.directReports)) best = candidate;
    }
    const parentId = best?.id ?? head.id;
    nodeById.get(parentId)!.children.push(nodeById.get(employee.id)!);
    attached.add(employee.id);
  }

  // A department with staff but no L3H/L3 leader gets a dotted vacant leadership card.
  const departments = new Map<string, Employee[]>();
  for (const employee of employees) departments.set(employee.department, [...(departments.get(employee.department) ?? []), employee]);
  for (const [department, members] of departments) {
    const hasLeader = members.some((member) => {
      const node = nodeById.get(member.id)!;
      return node.level === "L3H" || node.level === "L3" || MANAGER_RE.test(member.title);
    });
    if (hasLeader || members.length < 2) continue;
    const unattachedTop = members.filter((member) => {
      const parentId = parent.get(member.id);
      return !parentId || !members.some((other) => other.id === parentId);
    });
    const vacant: OrganogramNode = {
      id: `vacant:${department}`,
      name: "(Vacant)",
      title: `Manager – ${department}`,
      level: "L3",
      vacant: true,
      temporary: false,
      children: unattachedTop.map((member) => nodeById.get(member.id)!),
      stacked: false,
      reports: unattachedTop.length,
    };
    headNode.children.push(vacant);
    headNode.children.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || b.reports - a.reports);
  }

  return headNode;
}

/** Classic top-down organogram geometry: level bands, centred subtrees and right-angle connectors. */
export function layoutOrganogram(root: OrganogramNode | null): OrganogramLayout {
  if (!root) return { width: RAIL_W + CARD_W + 48, height: 160, bands: [], nodes: [], edges: [], root: null, vacantCount: 0, temporaryCount: 0 };

  const step = CARD_W + GAP_X;
  const columns = new Map<string, number>();
  let nextColumn = 0;

  const place = (node: OrganogramNode): number => {
    const kids = node.children;
    if (!kids.length) {
      const column = nextColumn++;
      columns.set(node.id, column);
      return column;
    }
    const stackable = kids.length >= 3 && kids.every((child) => child.children.length === 0);
    if (stackable) {
      node.stacked = true;
      const column = nextColumn++;
      columns.set(node.id, column);
      for (const child of kids) columns.set(child.id, column);
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

  // Stacked leaf groups hang vertically inside their own level band, aligned to the parent column.
  const stackSlot = new Map<string, number>();
  const stackCount = new Map<string, number>();
  for (const node of flat) {
    if (!node.stacked) continue;
    const column = columns.get(node.id) ?? 0;
    for (const child of node.children) {
      const key = `${bandIndex(child.level)}|${column}`;
      const slot = stackCount.get(key) ?? 0;
      stackSlot.set(child.id, slot);
      stackCount.set(key, slot + 1);
    }
  }

  const bandHeights = new Map<number, number>();
  for (const node of flat) {
    const band = bandIndex(node.level);
    bandHeights.set(band, Math.max(bandHeights.get(band) ?? 0, CARD_H));
  }
  stackCount.forEach((count, key) => {
    const band = Number(key.split("|")[0]);
    bandHeights.set(band, Math.max(bandHeights.get(band) ?? 0, count * (CARD_H + STACK_GAP)));
  });

  const bands: OrganogramBand[] = [];
  const bandTop = new Map<number, number>();
  let cursorY = 0;
  for (const band of present) {
    const height = (bandHeights.get(band) ?? CARD_H) + BAND_PAD * 2;
    bandTop.set(band, cursorY);
    bands.push({ level: LEVEL_ORDER[band], label: bandLabel(LEVEL_ORDER[band]), y: cursorY, height, count: flat.filter((node) => bandIndex(node.level) === band).length });
    cursorY += height;
  }

  const nodes: PlacedNode[] = [];
  const placed = new Map<string, PlacedNode>();
  for (const node of flat) {
    const band = bandIndex(node.level);
    const slot = stackSlot.get(node.id) ?? 0;
    const x = RAIL_W + (columns.get(node.id) ?? 0) * step + CARD_W / 2;
    const y = (bandTop.get(band) ?? 0) + BAND_PAD + slot * (CARD_H + STACK_GAP);
    const entry: PlacedNode = { node, x, y, width: CARD_W, height: CARD_H };
    nodes.push(entry);
    placed.set(node.id, entry);
  }

  // Resolve accidental horizontal collisions within the same visual row, moving whole
  // stacked groups so a vertical stack always stays aligned under its manager.
  const stackGroupOf = new Map<string, string>();
  for (const node of flat) if (node.stacked) for (const child of node.children) stackGroupOf.set(child.id, node.id);
  const rows = new Map<number, PlacedNode[]>();
  for (const entry of nodes) {
    const key = Math.round(entry.y / 4);
    rows.set(key, [...(rows.get(key) ?? []), entry]);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    for (let index = 1; index < row.length; index++) {
      const required = row[index - 1].x + CARD_W + 14;
      if (row[index].x >= required) continue;
      const delta = required - row[index].x;
      const groupId = stackGroupOf.get(row[index].node.id);
      if (groupId) {
        for (const entry of nodes) if (stackGroupOf.get(entry.node.id) === groupId) entry.x += delta;
      } else {
        row[index].x += delta;
      }
    }
  }

  const edges: OrganogramEdge[] = [];
  const connect = (parent: OrganogramNode) => {
    const parentBox = placed.get(parent.id)!;
    if (parent.stacked) {
      const kids = parent.children.map((child) => placed.get(child.id)!);
      const railX = parentBox.x + CARD_W / 2 + 16;
      const last = kids[kids.length - 1];
      const startY = parentBox.y + CARD_H + 14;
      edges.push({ kind: "stack", d: `M ${parentBox.x} ${parentBox.y + CARD_H} V ${startY} H ${railX} V ${last.y + CARD_H / 2}` });
      for (const kid of kids) edges.push({ kind: "stack", d: `M ${railX} ${kid.y + CARD_H / 2} H ${kid.x + CARD_W / 2}` });
    } else {
      for (const child of parent.children) {
        const childBox = placed.get(child.id)!;
        const gap = childBox.y - (parentBox.y + CARD_H);
        const elbow = parentBox.y + CARD_H + Math.max(12, gap / 2);
        edges.push({ kind: "report", d: `M ${parentBox.x} ${parentBox.y + CARD_H} V ${elbow} H ${childBox.x} V ${childBox.y}` });
      }
    }
    parent.children.forEach(connect);
  };
  connect(root);

  const width = Math.max(...nodes.map((node) => node.x + CARD_W / 2)) + 40;
  return {
    width,
    height: cursorY + 24,
    bands,
    nodes,
    edges,
    root,
    vacantCount: flat.filter((node) => node.vacant).length,
    temporaryCount: flat.filter((node) => node.temporary).length,
  };
}
