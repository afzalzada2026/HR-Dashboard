import { computeKpis, countBy, groupStats, spanDistribution, strategicMetrics } from "./analytics";
import { ACCESSOR } from "./filters";
import { fmtNum, fmtPct } from "./format";
import type { Employee, MultiKey } from "./types";

export type Severity = "positive" | "info" | "warning" | "critical";
export type InsightIcon = "division" | "growth" | "age" | "gender" | "education" | "location" | "span" | "retirement" | "layers" | "newhire" | "expat" | "turnover" | "quality";

export interface Insight {
  id: string;
  category: string;
  title: string;
  headline: string;
  metric: string;
  narrative: string;
  severity: Severity;
  icon: InsightIcon;
  action?: string;
}

const pct = (n: number, d = 1) => fmtPct(n, d);

export function generateInsights(emps: Employee[], now: number): Insight[] {
  if (!emps.length) return [];
  const total = emps.length;
  const divs = groupStats(emps, (e) => e.division, now).filter((d) => d.name !== "Unassigned");
  const s = strategicMetrics(emps, now);
  const k = computeKpis(emps, now, now);
  const out: Insight[] = [];

  if (divs.length) {
    const L = divs[0];
    const longest = [...divs].sort((a, b) => b.avgTenure - a.avgTenure)[0];
    out.push({
      id: "largest-division", category: "Structure", title: "Largest Division", headline: L.name, metric: pct(L.share),
      severity: L.share > 45 ? "warning" : "info", icon: "division",
      narrative: `${L.name} division represents ${pct(L.share)} of the total workforce (${fmtNum(L.headcount)} employees)${
        longest.name === L.name
          ? ` and has the highest average tenure of ${L.avgTenure.toFixed(1)} years`
          : ` with an average tenure of ${L.avgTenure.toFixed(1)} years, while ${longest.name} has the longest-serving staff at ${longest.avgTenure.toFixed(1)} years`
      }.`,
      action: L.share > 45 ? "Assess concentration risk and succession depth in the largest division." : undefined,
    });
  }

  const growing = divs.filter((d) => d.headcount >= 5).sort((a, b) => b.growth - a.growth)[0];
  if (growing && growing.hires12m > 0) {
    out.push({
      id: "fastest-growing", category: "Growth", title: "Fastest Growing Division", headline: growing.name, metric: `+${pct(growing.growth)}`,
      severity: "positive", icon: "growth",
      narrative: `${growing.name} hired ${fmtNum(growing.hires12m)} employees in the last 12 months — equal to ${pct(growing.growth)} of its current headcount, the fastest expansion rate across divisions.`,
      action: "Ensure onboarding capacity and manager coverage keep pace with hiring.",
    });
  }

  const oldest = [...divs].filter((d) => d.avgAge > 0).sort((a, b) => b.avgAge - a.avgAge)[0];
  if (oldest) {
    out.push({
      id: "highest-age", category: "Demographics", title: "Highest Average Age", headline: oldest.name, metric: `${oldest.avgAge.toFixed(1)} yrs`,
      severity: "info", icon: "age",
      narrative: `${oldest.name} has the most experienced workforce with an average age of ${oldest.avgAge.toFixed(1)} years, compared with the company average of ${k.avgAge.toFixed(1)} years.`,
    });
  }

  const genders = countBy(emps, (e) => e.gender).filter((g) => g.name !== "Unspecified");
  if (genders.length) {
    const lowG = genders[genders.length - 1];
    const lowPct = (lowG.value / total) * 100;
    const lowestFemaleDiv = [...divs].filter((d) => d.headcount >= 5).sort((a, b) => a.femalePct - b.femalePct)[0];
    const sev: Severity = lowPct < 20 ? "critical" : lowPct < 35 ? "warning" : "positive";
    out.push({
      id: "gender-representation", category: "Diversity", title: "Lowest Representation Gender", headline: `${lowG.name} · ${pct(lowPct)}`, metric: pct(lowPct),
      severity: sev, icon: "gender",
      narrative: `${lowG.name} employees represent ${pct(lowPct)} of the workforce (${fmtNum(lowG.value)} people), a ${Math.abs(50 - lowPct).toFixed(1)}-point gap to gender parity.${
        lowestFemaleDiv ? ` ${lowestFemaleDiv.name} has the lowest female representation at ${pct(lowestFemaleDiv.femalePct)}.` : ""
      }`,
      action: sev !== "positive" ? "Set diversity hiring targets and review sourcing channels for under-represented groups." : undefined,
    });
  }

  const quals = countBy(emps, (e) => e.qualificationGroup);
  if (quals.length) {
    const q = quals[0];
    const degreePct = (k.bachelorPlus / total) * 100;
    out.push({
      id: "qualification", category: "Capability", title: "Most Common Qualification", headline: q.name, metric: pct((q.value / total) * 100),
      severity: degreePct >= 60 ? "positive" : "info", icon: "education",
      narrative: `${q.name} is the most common qualification (${pct((q.value / total) * 100)} of staff). ${pct(degreePct)} of employees hold a Bachelor degree or higher, including ${fmtNum(k.masterPlus)} Master+ and ${fmtNum(k.phd)} PhD holders.`,
    });
  }

  const provs = countBy(emps, (e) => e.province).filter((p) => p.name !== "Unknown");
  if (provs.length) {
    const p = provs[0];
    const share = (p.value / total) * 100;
    out.push({
      id: "province", category: "Geography", title: "Most Populated Province", headline: p.name, metric: pct(share),
      severity: share > 60 ? "warning" : "info", icon: "location",
      narrative: `${p.name} hosts ${fmtNum(p.value)} employees (${pct(share)} of the workforce). Staff are distributed across ${provs.length} of Afghanistan's 34 provinces${
        provs.length < 34 ? `, with no presence in ${34 - provs.length}` : ""
      }.`,
      action: share > 60 ? "Evaluate business-continuity exposure from geographic concentration." : undefined,
    });
  }

  const span = spanDistribution(emps);
  if (s.supervisors) {
    out.push({
      id: "span", category: "Structure", title: "Average Span of Control", headline: `${s.avgSpan.toFixed(1)} direct reports`, metric: s.avgSpan.toFixed(1),
      severity: s.avgSpan < 4 || s.avgSpan > 12 ? "warning" : "positive", icon: "span",
      narrative: `${fmtNum(s.supervisors)} supervisors manage an average of ${s.avgSpan.toFixed(1)} direct reports each. ${span.overloaded} ${span.overloaded === 1 ? "supervisor is" : "supervisors are"} over-extended (more than 12 reports) and ${span.narrow} ${span.narrow === 1 ? "has" : "have"} fewer than 3.`,
      action: span.overloaded > 0 ? "Rebalance over-extended teams or introduce team-lead roles." : undefined,
    });
  }

  if (emps.some((e) => e.age !== null)) {
    const retire = emps.filter((e) => e.age !== null && e.age >= 55).length;
    const near = emps.filter((e) => e.age !== null && e.age >= 50 && e.age < 55).length;
    const rp = (retire / total) * 100;
    const rDiv = [...divs].filter((d) => d.headcount >= 5).sort((a, b) => b.retirementRisk / b.headcount - a.retirementRisk / a.headcount)[0];
    out.push({
      id: "retirement", category: "Risk", title: "Potential Retirement Risk Group", headline: `${fmtNum(retire)} employees aged 55+`, metric: pct(rp),
      severity: rp > 10 ? "critical" : rp > 4 ? "warning" : "info", icon: "retirement",
      narrative: `${fmtNum(retire)} employees (${pct(rp)}) are aged 55 or above and a further ${fmtNum(near)} are aged 50–54.${
        rDiv && rDiv.retirementRisk ? ` ${rDiv.name} carries the highest proportional exposure (${pct((rDiv.retirementRisk / rDiv.headcount) * 100)}).` : ""
      }`,
      action: "Build succession plans and knowledge-transfer programs for critical senior roles.",
    });
  }

  out.push({
    id: "layers", category: "Structure", title: "Management Layer Analysis", headline: `${s.maxLayers} reporting layers`, metric: s.avgReportingLine.toFixed(1),
    severity: s.maxLayers > 7 ? "warning" : "positive", icon: "layers",
    narrative: `The organization operates with ${s.maxLayers} reporting layers and an average reporting line of ${s.avgReportingLine.toFixed(1)} levels from the top. Managers make up ${pct(s.managerPct)} of the workforce (1 manager : ${s.managementRatio.toFixed(1)} staff).`,
    action: s.maxLayers > 7 ? "Consider delayering to accelerate decision-making." : undefined,
  });

  const newHires = emps.filter((e) => e.tenure !== null && e.tenure < 1).length;
  const nhp = (newHires / total) * 100;
  out.push({
    id: "new-hires", category: "Growth", title: "New Hire Concentration", headline: `${pct(nhp)} under 1 year`, metric: pct(nhp),
    severity: nhp > 30 ? "warning" : "info", icon: "newhire",
    narrative: `${fmtNum(newHires)} employees (${pct(nhp)}) joined within the last 12 months; the average tenure across the organization is ${k.avgTenure.toFixed(1)} years.`,
    action: nhp > 30 ? "Strengthen onboarding, buddy programs and 90-day retention check-ins." : undefined,
  });

  if (k.expat > 0) {
    const ed = [...divs].filter((d) => d.headcount >= 5).sort((a, b) => b.expatPct - a.expatPct)[0];
    out.push({
      id: "expat", category: "Workforce Mix", title: "Expat Dependency", headline: ed ? ed.name : "—", metric: pct((k.expat / total) * 100),
      severity: k.expat / total > 0.15 ? "warning" : "info", icon: "expat",
      narrative: `Expatriates make up ${pct((k.expat / total) * 100)} of the workforce (${fmtNum(k.expat)} people from ${Math.max(0, k.nationalities - 1)} foreign nationalities).${
        ed ? ` ${ed.name} has the highest expat share at ${pct(ed.expatPct)}.` : ""
      }`,
      action: "Pair expatriate specialists with local successors to build national capability.",
    });
  }

  if (s.separations > 0) {
    const td = [...divs].filter((d) => d.headcount >= 5).sort((a, b) => b.separations / b.headcount - a.separations / a.headcount)[0];
    out.push({
      id: "turnover", category: "Risk", title: "Attrition Signal", headline: `${pct(s.turnoverRate)} turnover`, metric: pct(s.turnoverRate),
      severity: s.turnoverRate > 10 ? "critical" : s.turnoverRate > 5 ? "warning" : "info", icon: "turnover",
      narrative: `${fmtNum(s.separations)} employees are flagged as resigned, terminated or exiting (${pct(s.turnoverRate)}), implying a retention rate of ${pct(s.retentionRate)}.${
        td ? ` ${td.name} shows the highest attrition at ${pct((td.separations / td.headcount) * 100)}.` : ""
      }`,
      action: "Run stay interviews and exit-reason analysis in the most affected division.",
    });
  }

  const noDob = emps.filter((e) => e.dobTs === null && e.age === null).length;
  const noJoin = emps.filter((e) => e.joinTs === null).length;
  const unknownProv = emps.filter((e) => e.province === "Unknown").length;
  const dq = noDob + noJoin + unknownProv;
  out.push({
    id: "data-quality", category: "Data Quality", title: "Data Quality Check", headline: dq ? `${fmtNum(dq)} gaps found` : "Excellent", metric: dq ? fmtNum(dq) : "100%",
    severity: dq > total * 0.1 ? "warning" : "positive", icon: "quality",
    narrative: dq
      ? `${fmtNum(noDob)} records lack a date of birth or age, ${fmtNum(noJoin)} lack a joining date and ${fmtNum(unknownProv)} could not be matched to a province.`
      : "All records contain the demographic, tenure and location information required for analytics.",
  });

  return out;
}

export function executiveSummary(emps: Employee[], now: number): string[] {
  if (!emps.length) return ["No employees match the current selection."];
  const k = computeKpis(emps, now, now);
  const s = strategicMetrics(emps, now);
  const divs = groupStats(emps, (e) => e.division, now);
  const provs = countBy(emps, (e) => e.province).filter((p) => p.name !== "Unknown");
  const growing = divs.filter((d) => d.headcount >= 5).sort((a, b) => b.growth - a.growth)[0];
  const retire = emps.filter((e) => e.age !== null && e.age >= 55).length;
  const span = spanDistribution(emps);
  const p1 = `ATOMA employs ${fmtNum(k.total)} people across ${k.divisions} divisions, ${k.departments} departments and ${k.dutyStations} duty stations in ${provs.length} provinces. The workforce is ${pct((k.male / k.total) * 100)} male and ${pct(k.femalePct)} female, with an average age of ${k.avgAge.toFixed(1)} years and an average tenure of ${k.avgTenure.toFixed(1)} years.`;
  const p2 = `${divs[0]?.name ?? "—"} is the largest division at ${pct(divs[0]?.share ?? 0)} of headcount. Over the past 12 months the organization hired ${fmtNum(s.hires12m)} employees (hiring rate ${pct(s.hiringRate)})${
    growing ? `, led by ${growing.name}` : ""
  }, and headcount grew ${s.headcountGrowth === null ? "—" : pct(s.headcountGrowth)} year-on-year.`;
  const p3 = `Watch-points: ${fmtNum(retire)} employees are aged 55+, the attrition signal stands at ${pct(s.turnoverRate)}, and ${span.overloaded} supervisors manage more than 12 direct reports. Strengths: ${pct((k.bachelorPlus / k.total) * 100)} of staff hold a Bachelor degree or higher and the gender diversity index is ${s.genderDiversityIndex.toFixed(0)}/100.`;
  return [p1, p2, p3];
}

export interface InsightBoxItem {
  label: string;
  value: string;
  hint?: string;
}

export function insightBox(emps: Employee[], now: number): InsightBoxItem[] {
  if (!emps.length) return [];
  const k = computeKpis(emps, now, now);
  const total = emps.length;
  const div = countBy(emps, (e) => e.division)[0];
  const dept = countBy(emps, (e) => e.department)[0];
  const qual = countBy(emps, (e) => e.qualificationGroup)[0];
  const station = countBy(emps, (e) => e.dutyStation)[0];
  const expatNat = countBy(emps.filter((e) => e.expatLocal === "Expat"), (e) => e.nationality)[0];
  return [
    { label: "Largest Division", value: div?.name ?? "—", hint: div ? pct((div.value / total) * 100) : undefined },
    { label: "Female Representation", value: pct(k.femalePct), hint: `${fmtNum(k.female)} employees` },
    { label: "Average Age", value: k.avgAge.toFixed(1), hint: "years" },
    { label: "Highest Qualification Group", value: qual?.name ?? "—", hint: qual ? pct((qual.value / total) * 100) : undefined },
    { label: "Largest Duty Station", value: station?.name ?? "—", hint: station ? `${fmtNum(station.value)} staff` : undefined },
    { label: "Largest Department", value: dept?.name ?? "—", hint: dept ? `${fmtNum(dept.value)} staff` : undefined },
    { label: "Average Tenure", value: `${k.avgTenure.toFixed(1)} yrs` },
    { label: "Top Expat Nationality", value: expatNat?.name ?? "None", hint: expatNat ? `${fmtNum(expatNat.value)} staff` : undefined },
  ];
}

/* ------------------------------------------------ natural-language Q&A */

export interface QueryAnswer {
  question: string;
  answer: string;
  bullets: string[];
  matched: string[];
  count: number;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9&+\- ]/g, " ");

const GROUP_WORDS: [RegExp, MultiKey, string][] = [
  [/\bdepartments?\b/, "department", "department"],
  [/\bdivisions?\b/, "division", "division"],
  [/\b(duty stations?|stations?|locations?|offices?|cit(y|ies))\b/, "dutyStation", "duty station"],
  [/\bprovinces?\b/, "province", "province"],
  [/\bnationalit(y|ies)\b/, "nationality", "nationality"],
  [/\b(qualifications?|degrees?|education)\b/, "qualification", "qualification"],
  [/\b(titles?|positions?|roles?)\b/, "title", "title"],
  [/\bsupervisors?|managers?\b/, "supervisor", "supervisor"],
];

export function answerQuestion(question: string, emps: Employee[], now: number): QueryAnswer {
  let rest = ` ${clean(question)} `;
  const matched: { key: MultiKey; value: string }[] = [];
  if (/\b(female|females|women|woman|ladies|girls)\b/.test(rest)) {
    matched.push({ key: "gender", value: "Female" });
    rest = rest.replace(/\b(female|females|women|woman|ladies|girls)\b/g, " ");
  } else if (/\b(male|males|men|man)\b/.test(rest)) {
    matched.push({ key: "gender", value: "Male" });
    rest = rest.replace(/\b(male|males|men|man)\b/g, " ");
  }
  if (/\bexpat(s|riates?)?\b/.test(rest)) matched.push({ key: "expatLocal", value: "Expat" });
  else if (/\blocals?\b/.test(rest)) matched.push({ key: "expatLocal", value: "Local" });
  if (/\bmarried\b/.test(rest)) matched.push({ key: "maritalStatus", value: "Married" });
  else if (/\bsingle\b/.test(rest)) matched.push({ key: "maritalStatus", value: "Single" });

  const dims: MultiKey[] = ["department", "division", "dutyStation", "province", "nationality", "qualification", "title", "level"];
  for (const key of dims) {
    const values = [...new Set(emps.map(ACCESSOR[key]))]
      .filter((v) => v && v.length >= 3 && !["Unspecified", "Unknown", "Unassigned", "Other"].includes(v))
      .sort((a, b) => b.length - a.length);
    for (const v of values) {
      const re = new RegExp(`\\s${escapeRe(clean(v).trim())}(s|es)?\\s`);
      if (re.test(rest)) {
        matched.push({ key, value: v });
        rest = rest.replace(re, " ");
      }
    }
  }

  const byKey = new Map<MultiKey, Set<string>>();
  for (const m of matched) {
    const s = byKey.get(m.key) ?? new Set<string>();
    s.add(m.value);
    byKey.set(m.key, s);
  }
  const subset = emps.filter((e) => {
    for (const [key, set] of byKey) if (!set.has(ACCESSOR[key](e))) return false;
    return true;
  });
  const ADJ_KEYS: MultiKey[] = ["gender", "expatLocal", "maritalStatus"];
  const adjectives = matched.filter((m) => ADJ_KEYS.includes(m.key)).map((m) => m.value.toLowerCase());
  const places = matched.filter((m) => !ADJ_KEYS.includes(m.key)).map((m) => m.value);
  const label = matched.length
    ? `${adjectives.length ? `${adjectives.join(" ")} employees` : "employees"}${places.length ? ` in ${places.join(" · ")}` : ""}`
    : "the whole workforce";
  const n = subset.length;
  const total = emps.length;
  // Detect intent on the residual text (entity names removed) to avoid false hits like "Operations" → "ratio".
  const q = rest;
  const bullets: string[] = [];
  let answer: string;

  if (!n) {
    return { question, answer: `No employees match ${label}.`, bullets: ["Try a division, department, duty station, nationality or qualification name."], matched: matched.map((m) => m.value), count: 0 };
  }
  const k = computeKpis(subset, now, now);
  const groupAsk = /\b(largest|biggest|most|top|highest|main|which)\b/.test(q) ? GROUP_WORDS.find(([re]) => re.test(q)) : undefined;

  if (groupAsk) {
    const [, key, word] = groupAsk;
    const list = countBy(subset, ACCESSOR[key]).filter((x) => !["Unspecified", "Unknown", "—"].includes(x.name));
    const top = list[0];
    answer = top ? `The largest ${word} for ${label} is ${top.name} with ${fmtNum(top.value)} employees (${pct((top.value / n) * 100)}).` : `No ${word} data available.`;
    list.slice(1, 5).forEach((x) => bullets.push(`${x.name}: ${fmtNum(x.value)} (${pct((x.value / n) * 100)})`));
  } else if (/\b(average age|avg age|mean age|how old|age|ages)\b/.test(q)) {
    answer = `The average age of ${label} is ${k.avgAge.toFixed(1)} years across ${fmtNum(n)} employees.`;
    bullets.push(`Aged 55+: ${fmtNum(subset.filter((e) => (e.age ?? 0) >= 55).length)}`, `Under 30: ${fmtNum(subset.filter((e) => e.age !== null && e.age < 30).length)}`);
  } else if (/\b(tenure|service|experience|how long|years with)\b/.test(q)) {
    answer = `Average tenure for ${label} is ${k.avgTenure.toFixed(1)} years (${fmtNum(n)} employees).`;
    bullets.push(`Less than 1 year: ${fmtNum(subset.filter((e) => e.tenure !== null && e.tenure < 1).length)}`, `10+ years: ${fmtNum(subset.filter((e) => (e.tenure ?? 0) >= 10).length)}`);
  } else if (/\b(retire|retirement|retiring|oldest|older)\b|55\+/.test(q)) {
    const r = subset.filter((e) => (e.age ?? 0) >= 55).length;
    answer = `${fmtNum(r)} of ${fmtNum(n)} employees in ${label} are aged 55+ (${pct((r / n) * 100)}), representing the potential retirement risk group.`;
  } else if (/\b(hire|hires|hired|hiring|joined|joiners|recruit|recruited|recruitment|new)\b/.test(q)) {
    answer = `${fmtNum(k.joinedThisYear)} employees in ${label} joined this year, including ${fmtNum(k.joinedThisMonth)} this month.`;
    bullets.push(`Joined in last 12 months: ${fmtNum(subset.filter((e) => e.joinTs !== null && e.joinTs > now - 365.2425 * 86400000).length)}`);
  } else if (/\b(percent|percentage|ratio|share|proportion)\b/.test(q) || question.includes("%")) {
    answer = `${label} accounts for ${fmtNum(n)} of ${fmtNum(total)} employees — ${pct((n / total) * 100)} of the workforce.`;
    bullets.push(`Female share within selection: ${pct(k.femalePct)}`);
  } else if (/\b(span|supervisors?|managers?)\b/.test(q)) {
    const s = strategicMetrics(subset, now);
    answer = `${label} has ${fmtNum(s.managers)} managers and ${fmtNum(s.supervisors)} active supervisors with an average span of control of ${s.avgSpan.toFixed(1)}.`;
  } else {
    answer = `There ${n === 1 ? "is" : "are"} ${fmtNum(n)} employee${n === 1 ? "" : "s"} in ${label} (${pct((n / total) * 100)} of the workforce).`;
  }
  bullets.push(
    `Gender split: ${fmtNum(k.male)} male / ${fmtNum(k.female)} female (${pct(k.femalePct)} female)`,
    `Average age ${k.avgAge.toFixed(1)} · average tenure ${k.avgTenure.toFixed(1)} yrs`,
    `Top department: ${countBy(subset, (e) => e.department)[0]?.name ?? "—"} · top location: ${countBy(subset, (e) => e.dutyStation)[0]?.name ?? "—"}`
  );
  return { question, answer, bullets, matched: matched.map((m) => m.value), count: n };
}
