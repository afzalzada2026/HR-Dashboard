import type { Employee } from "./types";
import { canonicalOrgLevel, LEVEL_ORDER, type OrgLevelCode } from "./organogram-levels";

/**
 * Reporting-line engine (ported from the approved ATOMA organogram design):
 *  1. Manual reporting override (authoritative)
 *  2. Supervisor e-mail → employee e-mail
 *  3. Supervisor field → employee / HRIS number
 *  4. Supervisor name → exact, then a genuinely more-senior namesake
 *  5. Fuzzy name match (spelling variants such as Mamoozai / Mamozai)
 *  6. Fallback → department head → division head → organisation top
 *
 * Exactly one division head is resolved per division and every cross-boundary root is
 * connected beneath it. Manual head overrides are authoritative.
 */
export type LinkSource =
  | "override" | "email" | "employee-no" | "name" | "fuzzy-name"
  | "inferred-department" | "inferred-division" | "inferred-top" | "division-head" | "root";

export interface OrgNode {
  id: string;
  emp: Employee;
  parentId: string | null;
  children: OrgNode[];
  depth: number;
  total: number;
  sen: number;
  link: LinkSource;
  level: OrgLevelCode;
  /** Lateral staff officer (Secretary / Assistant) shown beside the manager. */
  staff?: boolean;
}

export interface OrgQuality {
  total: number;
  linked: number;
  byEmail: number;
  byNo: number;
  byName: number;
  inferred: number;
  roots: number;
  cycles: number;
  unmatched: { name: string; count: number }[];
}

export interface DivisionHeadCandidate {
  key: string;
  employee: Employee;
  score: number;
  reasons: string[];
  selected: boolean;
  manual: boolean;
}

export interface OrgBuild {
  nodes: OrgNode[];
  byId: Map<string, OrgNode>;
  roots: OrgNode[];
  top: OrgNode | null;
  quality: OrgQuality;
  divisionHeads: Map<string, OrgNode>;
  headCandidates: Map<string, DivisionHeadCandidate[]>;
}

const normName = (s: string) => (s || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const normEmail = (s: string) => (s || "").toLowerCase().trim();
const EXEC_TOP = /\b(ceo|chief executive|president|managing director|country manager)\b/i;
const C_SUITE = /\b(chief|cio|cmo|cco|cto|cfo|coo|chro|cso|cpo|cro|vice president|vp)\b/i;
const HEAD = /\b(head|director|general manager|gm|managing|vice president|vp)\b/i;
const SR_MANAGER = /\b(sr\.?|senior)\s+manager\b/i;
const MANAGER = /\bmanager\b/i;
export const STAFF_OFFICER = /\b(secretary|personal assistant|executive assistant|admin assistant|office manager|pa to|admin officer)\b/i;
const STOP = new Set(["and", "the", "of", "for", "division", "department", "directorate", "unit", "services", "service"]);

export function employeeOrgKey(e: Employee): string {
  return (e.employeeNo || e.email || e.hrisNo || e.fullName).trim().toLowerCase();
}

const divTokens = (s: string) => normName(s).split(" ").filter((x) => x.length > 2 && !STOP.has(x));

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      const left = prev[j - 1];
      prev[j] = a[i - 1] === b[j - 1] ? diag : 1 + Math.min(diag, up, left);
      diag = up;
    }
  }
  return prev[b.length];
}

export function nameSimilarity(aRaw: string, bRaw: string): number {
  const a = normName(aRaw);
  const b = normName(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const lev = 1 - editDistance(a, b) / Math.max(a.length, b.length);
  const A = new Set(a.split(" "));
  const B = new Set(b.split(" "));
  const shared = [...A].filter((x) => B.has(x)).length;
  return Math.max(lev, (shared / Math.max(A.size, B.size)) * 0.75 + lev * 0.25);
}

export function seniorityValue(e: Employee): number {
  const level = canonicalOrgLevel(e.level) ?? fallbackLevel(e);
  return 12 - LEVEL_ORDER.indexOf(level);
}

function fallbackLevel(e: Employee): OrgLevelCode {
  const rank = e.levelRank;
  if (rank >= 10) return "L6";
  if (rank >= 9) return "L5";
  if (rank >= 8) return "L4";
  if (rank >= 7) return "L3H";
  if (rank >= 6) return "L3";
  if (rank >= 4) return "L2";
  return "L1";
}

function better(a: OrgNode, b: OrgNode): boolean {
  if (a.sen !== b.sen) return a.sen > b.sen;
  const aC = C_SUITE.test(a.emp.title) ? 1 : 0;
  const bC = C_SUITE.test(b.emp.title) ? 1 : 0;
  if (aC !== bC) return aC > bC;
  return (a.emp.tenure || 0) > (b.emp.tenure || 0);
}

function candidateScores(nodes: OrgNode[], top: OrgNode | null, division: string, overrideKey?: string): DivisionHeadCandidate[] {
  const inDiv = nodes.filter((n) => n.emp.division === division);
  const idMap = new Map(nodes.map((n) => [n.id, n]));
  const refCounts = new Map<string, { total: number; departments: Set<string> }>();
  for (const n of inDiv) {
    for (const ref of [normEmail(n.emp.supervisorEmail), normName(n.emp.supervisor)].filter(Boolean)) {
      const slot = refCounts.get(ref) ?? { total: 0, departments: new Set<string>() };
      slot.total++;
      slot.departments.add(n.emp.department);
      refCounts.set(ref, slot);
    }
  }
  const tokens = divTokens(division);
  const maxSen = Math.max(1, ...inDiv.map((n) => n.sen));
  return inDiv
    .map((n): DivisionHeadCandidate => {
      const title = n.emp.title || "";
      const key = employeeOrgKey(n.emp);
      const refs = [refCounts.get(normEmail(n.emp.email)), refCounts.get(normName(n.emp.fullName))].filter(Boolean) as { total: number; departments: Set<string> }[];
      const reports = refs.reduce((a, r) => a + r.total, 0);
      const depts = new Set(refs.flatMap((r) => [...r.departments])).size;
      const reasons: string[] = [];
      let score = (n.sen / maxSen) * 300;
      if (C_SUITE.test(title)) {
        score += 1600;
        reasons.push("C-suite / Chief title");
      } else if (HEAD.test(title)) {
        score += 850;
        reasons.push("Head / Director title");
      } else if (SR_MANAGER.test(title)) {
        score += 180;
        reasons.push("Senior Manager title");
      } else if (MANAGER.test(title)) {
        score += 80;
        reasons.push("Manager title");
      }
      // ATOMA reference anchors supplied by HR — still superseded by a manual override.
      const dn = normName(division);
      if (dn.includes("sales") && dn.includes("distribution") && nameSimilarity(n.emp.fullName, "Baryalay Wassim") >= 0.82) {
        score += 5000;
        reasons.push("ATOMA Sales & Distribution head reference");
      }
      if ((dn.includes("information system") || dn === "it" || dn.includes("technology")) && /\b(cio|chief information|chief technology)\b/i.test(title)) {
        score += 4500;
        reasons.push("CIO / technology chief matches division");
      }
      if (dn.includes("marketing") && /\b(cmo|chief marketing)\b/i.test(title)) {
        score += 4500;
        reasons.push("CMO matches Marketing division");
      }
      const parent = n.parentId ? idMap.get(n.parentId) : undefined;
      const reportsOutside = !parent || parent.emp.division !== division;
      if (reportsOutside) {
        score += 500;
        reasons.push("reports outside the division (CEO / corporate)");
      }
      if (n.parentId === top?.id && top && top.emp.division !== division) {
        score += 650;
        reasons.push("reports to CEO / top position");
      }
      const titleNorm = normName(title);
      const hits = tokens.filter((token) => titleNorm.includes(token)).length;
      if (hits) {
        score += hits * 180;
        reasons.push(`title matches ${hits} division keyword${hits > 1 ? "s" : ""}`);
      }
      if (depts >= 2) {
        score += Math.min(400, depts * 70);
        reasons.push(`span across ${depts} departments`);
      }
      if (reports) {
        score += Math.min(240, reports * 8);
        reasons.push(`${reports} named report${reports > 1 ? "s" : ""}`);
      }
      if (/assistant|deputy/i.test(title)) score -= 120;
      if (SR_MANAGER.test(title) && inDiv.some((x) => C_SUITE.test(x.emp.title) || HEAD.test(x.emp.title))) score -= 250;
      const manual = !!overrideKey && (key === overrideKey || normName(n.emp.fullName) === normName(overrideKey));
      if (manual) {
        score += 1_000_000;
        reasons.unshift("manual administrator override");
      }
      return { key, employee: n.emp, score, reasons, selected: false, manual };
    })
    .sort((a, b) => b.score - a.score || a.employee.fullName.localeCompare(b.employee.fullName))
    .map((candidate, index) => ({ ...candidate, selected: index === 0 }));
}

export function rankDivisionHeadCandidates(data: Employee[], division: string, overrideKey?: string): DivisionHeadCandidate[] {
  const nodes: OrgNode[] = data.map((emp, i) => ({ id: `r${i}`, emp, parentId: null, children: [], depth: 0, total: 1, sen: seniorityValue(emp), link: "root", level: canonicalOrgLevel(emp.level) ?? fallbackLevel(emp) }));
  let top: OrgNode | null = null;
  for (const n of nodes) if (!top || better(n, top)) top = n;
  return candidateScores(nodes, top, division, overrideKey);
}

export interface OrgOverrides {
  heads: Record<string, string>;
  reporting: Record<string, string>;
}

export function loadOrgOverrides(): OrgOverrides {
  try {
    const raw = localStorage.getItem("atoma:org-overrides");
    if (!raw) return { heads: {}, reporting: {} };
    const parsed = JSON.parse(raw) as Partial<OrgOverrides> | null;
    return {
      heads: parsed?.heads ?? {},
      reporting: parsed?.reporting ?? {},
    };
  } catch {
    return { heads: {}, reporting: {} };
  }
}

export function saveOrgOverrides(next: OrgOverrides): void {
  try {
    localStorage.setItem("atoma:org-overrides", JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

export function buildOrgTree(data: Employee[], overrides: OrgOverrides = { heads: {}, reporting: {} }): OrgBuild {
  const nodes: OrgNode[] = data.map((emp, i) => ({ id: `n${i}`, emp, parentId: null, children: [], depth: 0, total: 1, sen: seniorityValue(emp), link: "root", level: canonicalOrgLevel(emp.level) ?? fallbackLevel(emp) }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const byEmail = new Map<string, OrgNode>();
  const byNo = new Map<string, OrgNode>();
  const byName = new Map<string, OrgNode[]>();
  const byOrgKey = new Map<string, OrgNode>();
  for (const n of nodes) {
    byOrgKey.set(employeeOrgKey(n.emp), n);
    const em = normEmail(n.emp.email);
    if (em && !byEmail.has(em)) byEmail.set(em, n);
    const no = (n.emp.employeeNo || "").trim().toLowerCase();
    if (no && !byNo.has(no)) byNo.set(no, n);
    const hris = (n.emp.hrisNo || "").trim().toLowerCase();
    if (hris && !byNo.has(hris)) byNo.set(hris, n);
    const nm = normName(n.emp.fullName);
    if (nm) {
      if (!byName.has(nm)) byName.set(nm, []);
      byName.get(nm)!.push(n);
    }
  }

  const deptHead = new Map<string, OrgNode>();
  let top: OrgNode | null = null;
  for (const n of nodes) {
    const dk = `${n.emp.division}||${n.emp.department}`;
    const current = deptHead.get(dk);
    if (!current || better(n, current)) deptHead.set(dk, n);
    if (!top || better(n, top)) top = n;
  }

  const unmatched = new Map<string, number>();
  const quality: OrgQuality = { total: nodes.length, linked: 0, byEmail: 0, byNo: 0, byName: 0, inferred: 0, roots: 0, cycles: 0, unmatched: [] };
  for (const n of nodes) {
    let parent: OrgNode | undefined;
    let link: LinkSource = "root";
    const overrideKey = overrides.reporting[employeeOrgKey(n.emp)];
    const overrideNode = overrideKey ? (byOrgKey.get(overrideKey) ?? byName.get(normName(overrideKey))?.[0]) : undefined;
    if (overrideNode && overrideNode !== n) {
      parent = overrideNode;
      link = "override";
    }
    const supervisorEmail = normEmail(n.emp.supervisorEmail);
    if (!parent && supervisorEmail && byEmail.has(supervisorEmail) && byEmail.get(supervisorEmail) !== n) {
      parent = byEmail.get(supervisorEmail);
      link = "email";
    }
    const supervisorRef = (n.emp.supervisor || "").trim();
    if (!parent && supervisorRef) {
      const key = supervisorRef.toLowerCase();
      if (byNo.has(key) && byNo.get(key) !== n) {
        parent = byNo.get(key);
        link = "employee-no";
      }
    }
    if (!parent && supervisorRef) {
      const exact = (byName.get(normName(supervisorRef)) ?? []).filter((c) => c !== n);
      if (exact.length === 1) parent = exact[0];
      else if (exact.length > 1) {
        parent = [...exact].sort(
          (a, b) =>
            Number(b.emp.division === n.emp.division) - Number(a.emp.division === n.emp.division) ||
            Number(b.emp.department === n.emp.department) - Number(a.emp.department === n.emp.department) ||
            b.sen - a.sen
        )[0];
      }
      if (parent) link = "name";
    }
    if (!parent && supervisorRef) {
      const fuzzy = nodes
        .filter((c) => c !== n && (!n.emp.division || c.emp.division === n.emp.division))
        .map((c) => ({ c, sim: nameSimilarity(supervisorRef, c.emp.fullName) }))
        .filter((x) => x.sim >= 0.82)
        .sort((a, b) => b.sim - a.sim || Number(b.c.emp.department === n.emp.department) - Number(a.c.emp.department === n.emp.department) || b.c.sen - a.c.sen);
      if (fuzzy[0] && (!fuzzy[1] || fuzzy[0].sim - fuzzy[1].sim >= 0.025)) {
        parent = fuzzy[0].c;
        link = "fuzzy-name";
      }
    }
    if (parent && parent !== n) {
      n.parentId = parent.id;
      n.link = link;
      quality.linked++;
      if (link === "email") quality.byEmail++;
      else if (link === "employee-no" || link === "override") quality.byNo++;
      else quality.byName++;
      continue;
    }
    if (supervisorRef || supervisorEmail) unmatched.set(supervisorRef || supervisorEmail, (unmatched.get(supervisorRef || supervisorEmail) ?? 0) + 1);
    const deptLead = deptHead.get(`${n.emp.division}||${n.emp.department}`);
    const usable = (c?: OrgNode | null) => !!c && c !== n && (c.sen > n.sen || (c.sen === n.sen && c === top));
    if (usable(deptLead)) {
      n.parentId = deptLead!.id;
      n.link = "inferred-department";
      quality.inferred++;
    } else if (usable(top)) {
      n.parentId = top!.id;
      n.link = "inferred-top";
      quality.inferred++;
    }
  }

  // One division head per division; every cross-boundary root joins beneath it.
  const divisionHeads = new Map<string, OrgNode>();
  const headCandidates = new Map<string, DivisionHeadCandidate[]>();
  const divisions = [...new Set(nodes.map((n) => n.emp.division).filter(Boolean))].sort();
  for (const division of divisions) {
    const ranked = candidateScores(nodes, top, division, overrides.heads[division]);
    headCandidates.set(division, ranked.slice(0, 12));
    const selected = ranked[0];
    if (!selected) continue;
    const head = nodes.find((n) => employeeOrgKey(n.emp) === selected.key && n.emp.division === division);
    if (!head) continue;
    divisionHeads.set(division, head);
    if (head !== top && top) {
      head.parentId = top.id;
      if (head.link === "root" || head.link === "inferred-top" || head.link === "inferred-department") head.link = "division-head";
    }
    for (const n of nodes) {
      if (n === head || n === top || n.emp.division !== division) continue;
      const parent = n.parentId ? byId.get(n.parentId) : null;
      if (!parent || parent.emp.division !== division || parent === top) {
        n.parentId = head.id;
        n.link = "inferred-division";
      }
    }
  }

  // Mark lateral staff officers beside their manager.
  for (const n of nodes) {
    const parent = n.parentId ? byId.get(n.parentId) : null;
    if (parent && STAFF_OFFICER.test(n.emp.title) && n.sen <= parent.sen - 2) n.staff = true;
  }

  // Break cycles defensively at the most senior member.
  for (const n of nodes) {
    const seen = new Set<string>();
    let cursor: OrgNode | undefined = n;
    while (cursor?.parentId) {
      if (seen.has(cursor.id)) {
        const chain: OrgNode[] = [];
        let c: OrgNode | undefined = cursor;
        while (c && !chain.includes(c)) {
          chain.push(c);
          c = c.parentId ? byId.get(c.parentId) : undefined;
        }
        const head = chain.reduce((a, b) => (better(b, a) ? b : a));
        head.parentId = top && !chain.includes(top) ? top.id : null;
        head.link = head.parentId ? "inferred-top" : "root";
        quality.cycles++;
        break;
      }
      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
      if (seen.size > 200) {
        n.parentId = top && n !== top ? top.id : null;
        n.link = n.parentId ? "inferred-top" : "root";
        quality.cycles++;
        break;
      }
    }
  }

  for (const n of nodes) {
    n.children = [];
    n.depth = 0;
    n.total = 1;
  }
  for (const n of nodes) {
    if (n.parentId && byId.has(n.parentId)) byId.get(n.parentId)!.children.push(n);
    else n.parentId = null;
  }
  const roots = nodes.filter((n) => !n.parentId);
  const sortKids = (arr: OrgNode[]) => arr.sort((a, b) => b.sen - a.sen || b.total - a.total || a.emp.fullName.localeCompare(b.emp.fullName));
  const stack: [OrgNode, boolean][] = roots.map((r) => [r, false]);
  const processed = new Set<string>();
  while (stack.length) {
    const [n, done] = stack.pop()!;
    if (!done) {
      if (processed.has(n.id)) continue;
      processed.add(n.id);
      stack.push([n, true]);
      for (const c of n.children) {
        c.depth = n.depth + 1;
        stack.push([c, false]);
      }
    } else {
      n.total = 1 + n.children.reduce((a, c) => a + c.total, 0);
      sortKids(n.children);
    }
  }
  sortKids(roots);
  quality.roots = roots.length;
  quality.unmatched = [...unmatched.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { nodes, byId, roots, top, quality, divisionHeads, headCandidates };
}

function cloneScoped(node: OrgNode, include: (n: OrgNode) => boolean): OrgNode | null {
  if (!include(node)) return null;
  const children = node.children.map((c) => cloneScoped(c, include)).filter((c): c is OrgNode => !!c);
  return { ...node, children, total: 1 + children.reduce((a, c) => a + c.total, 0) };
}

/** Scope roots for the landscape chart; department charts always keep the division head on top. */
export function scopeRoots(build: OrgBuild, division?: string, department?: string): OrgNode[] {
  if (!division && !department) return build.roots;
  const inScope = (n: OrgNode) => (!division || n.emp.division === division) && (!department || n.emp.department === department);
  const scoped = build.nodes
    .filter((n) => inScope(n) && (!n.parentId || !inScope(build.byId.get(n.parentId)!)))
    .map((n) => cloneScoped(n, inScope))
    .filter((n): n is OrgNode => !!n)
    .sort((a, b) => b.sen - a.sen || b.total - a.total);
  if (division && department) {
    const head = build.divisionHeads.get(division);
    const headInScope = scoped.find((n) => n.emp.employeeNo === head?.emp.employeeNo);
    if (head && !headInScope) {
      return [{ ...head, parentId: null, children: scoped, depth: 0, total: 1 + scoped.reduce((a, c) => a + c.total, 0), link: "division-head" }];
    }
  }
  return scoped;
}

export function averageDepth(build: OrgBuild): number {
  return build.nodes.length ? build.nodes.reduce((a, n) => a + n.depth, 0) / build.nodes.length + 1 : 0;
}

export function employeeStatus(e: Employee): { vacant: boolean; temporary: boolean } {
  const all = `${e.fullName} ${e.title} ${e.remarks}`.toLowerCase();
  const vacant = !e.fullName || /\b(vacant|vacancy|unfilled|tbd|to be hired)\b/.test(all) || /^(unknown|vacant)$/i.test(e.fullName.trim());
  const temporary = !vacant && /\b(temp|temporary|contract|contractor|acting|interim)\b/.test(all);
  return { vacant, temporary };
}
