import { FIELD_DEFS } from "./fields";
import type { FieldKey } from "./types";

type Rng = () => number;
function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const YEAR = 365.2425 * DAY;

const MALE = ["Ahmad", "Mohammad", "Farid", "Hamid", "Jawad", "Karim", "Mustafa", "Naveed", "Omid", "Rahim", "Sami", "Tariq", "Wahid", "Zabihullah", "Habib", "Nasir", "Bilal", "Idris", "Khalid", "Mansoor", "Qasim", "Rashid", "Sohail", "Yama", "Ajmal", "Faisal", "Hekmat", "Javed", "Masood", "Najib", "Rafi", "Shafiq", "Sultan", "Waheed", "Zaki", "Asad", "Dawood", "Ehsan", "Fawad", "Haroon", "Imran", "Jamshid", "Latif", "Mirwais", "Obaid", "Parwiz", "Tamim", "Aziz", "Baryalai", "Hashmat", "Nabil", "Sharif", "Yousuf", "Samiullah"];
const FEMALE = ["Aisha", "Fatima", "Farzana", "Habiba", "Laila", "Mariam", "Nargis", "Parwana", "Roya", "Sahar", "Shabnam", "Soraya", "Tahmina", "Zahra", "Zainab", "Freshta", "Hasina", "Khadija", "Mursal", "Nilofar", "Pashtana", "Rahima", "Sadia", "Shukria", "Wajiha", "Yalda", "Zarghona", "Arzo", "Diba", "Frozan", "Gulalai", "Homa", "Lina", "Madina", "Nazanin", "Palwasha", "Sana", "Tamana", "Maryam", "Shirin"];
const LAST = ["Ahmadzai", "Popal", "Karimi", "Rahimi", "Hakimi", "Noori", "Sultani", "Stanikzai", "Barakzai", "Mohammadi", "Hashimi", "Sadat", "Amiri", "Rezaei", "Haidari", "Azizi", "Wardak", "Safi", "Mohmand", "Durrani", "Jalali", "Nazari", "Rasuli", "Yousufzai", "Kakar", "Zazai", "Shinwari", "Mangal", "Samadi", "Qaderi", "Faizi", "Habibi", "Naseri", "Osmani", "Sharifi", "Tokhi", "Hotak", "Alokozai", "Achakzai", "Baheer", "Kohistani", "Panjshiri", "Andarabi", "Badakhshi", "Herawi", "Kabuli", "Balkhi", "Mirzad", "Omari", "Zaheer"];
const FATHERS = ["Abdul Rahim", "Mohammad Nabi", "Gul Ahmad", "Abdul Qadir", "Noor Mohammad", "Haji Karim", "Ghulam Sakhi", "Mohammad Akbar", "Sher Ali", "Abdul Wahid", "Mir Ahmad", "Faqir Mohammad", "Juma Khan", "Abdul Ghafoor", "Mohammad Ismail", "Sayed Jalal", "Khan Mohammad", "Abdul Hakim", "Gul Mohammad", "Dost Mohammad", "Abdul Samad", "Mohammad Yousuf", "Nazar Mohammad", "Abdul Latif", "Wali Mohammad"];
const MALE_PREFIX = ["Mohammad", "Ahmad", "Abdul", "Sayed", "Mir", "Gul", "Noor", "Shah", "Khan", "Ali"];
const FEMALE_MIDDLE = ["Gul", "Jan", "Bibi", "Zahra", "Nazo", "Maryam"];
const EXPATS: [string, number][] = [["Indian", 22], ["Pakistani", 14], ["Turkish", 12], ["British", 8], ["American", 7], ["Filipino", 9], ["Egyptian", 6], ["Jordanian", 5], ["Kenyan", 4], ["German", 4], ["Tajik", 5], ["Uzbek", 4]];
const BLOOD: [string, number][] = [["O+", 35], ["A+", 28], ["B+", 22], ["AB+", 6], ["O-", 4], ["A-", 2.5], ["B-", 1.8], ["AB-", 0.7]];
const LEVELS = ["L1 - Entry", "L2 - Junior", "L3 - Associate", "L4 - Senior", "L5 - Specialist", "L6 - Team Lead", "L7 - Manager", "L8 - Senior Manager", "L9 - Director", "L10 - Executive"];
const AGE_RANGE: [number, number][] = [[21, 28], [22, 33], [24, 40], [27, 47], [29, 52], [30, 54], [32, 56], [35, 58], [40, 60], [46, 62]];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Station = [string, string];
const HUBS: [Station, number][] = [[["Herat", "Herat"], 30], [["Mazar-i-Sharif", "Balkh"], 28], [["Kandahar", "Kandahar"], 22], [["Jalalabad", "Nangarhar"], 20], [["Kunduz", "Kunduz"], 10]];
const FIELD_STATIONS: [Station, number][] = [
  [["Kabul", "Kabul"], 16], [["Herat", "Herat"], 14], [["Mazar-i-Sharif", "Balkh"], 13], [["Kandahar", "Kandahar"], 11], [["Jalalabad", "Nangarhar"], 10],
  [["Kunduz", "Kunduz"], 6], [["Ghazni", "Ghazni"], 5], [["Pul-e-Khumri", "Baghlan"], 4.5], [["Khost", "Khost"], 4], [["Bamyan", "Bamyan"], 3.5],
  [["Lashkar Gah", "Helmand"], 4], [["Faizabad", "Badakhshan"], 3.5], [["Taloqan", "Takhar"], 3.5], [["Sheberghan", "Jowzjan"], 3], [["Charikar", "Parwan"], 3.5],
  [["Gardez", "Paktia"], 3], [["Farah", "Farah"], 2.5], [["Maymana", "Faryab"], 2.8], [["Asadabad", "Kunar"], 2], [["Mehtarlam", "Laghman"], 2.2],
  [["Pul-e-Alam", "Logar"], 2.2], [["Chaghcharan", "Ghor"], 1.6], [["Qala-i-Naw", "Badghis"], 1.5], [["Zaranj", "Nimroz"], 1.6], [["Tarinkot", "Uruzgan"], 1.3],
  [["Qalat", "Zabul"], 1.2], [["Maidan Shar", "Wardak"], 1.8], [["Aybak", "Samangan"], 1.6], [["Sar-e-Pul", "Sar-e-Pul"], 1.5], [["Nili", "Daykundi"], 1],
  [["Mahmud-i-Raqi", "Kapisa"], 1.4], [["Bazarak", "Panjshir"], 1.1], [["Parun", "Nuristan"], 0.7], [["Sharana", "Paktika"], 1.2],
];

type QualProfile = "tech" | "field" | "business" | "it" | "law" | "finance" | "general";
interface Dept { name: string; w: number; titles: string[]; quals: QualProfile; female?: number }
interface Div { name: string; weight: number; female: number; headTitle: string; growth: number; hq: number; expat: number; departments: Dept[] }

const DIVISIONS: Div[] = [
  {
    name: "Operations", weight: 30, female: 0.08, headTitle: "Chief Operating Officer", growth: 1.0, hq: 0.18, expat: 0.04,
    departments: [
      { name: "Network Operations", w: 30, titles: ["Network Engineer", "NOC Technician", "Senior Network Engineer", "RF Engineer", "Transmission Engineer"], quals: "tech" },
      { name: "Field Operations", w: 35, titles: ["Field Technician", "Site Engineer", "Senior Field Technician", "Power Systems Technician", "Field Coordinator"], quals: "field", female: 0.03 },
      { name: "Facilities Management", w: 12, titles: ["Facilities Officer", "Maintenance Technician", "Facilities Coordinator"], quals: "field" },
      { name: "Logistics & Fleet", w: 13, titles: ["Logistics Officer", "Fleet Coordinator", "Warehouse Officer", "Driver"], quals: "field", female: 0.04 },
      { name: "Quality Assurance", w: 10, titles: ["QA Specialist", "QA Analyst", "Quality Inspector"], quals: "tech", female: 0.18 },
    ],
  },
  {
    name: "Commercial", weight: 18, female: 0.3, headTitle: "Chief Commercial Officer", growth: 1.15, hq: 0.38, expat: 0.04,
    departments: [
      { name: "Sales", w: 40, titles: ["Sales Executive", "Sales Officer", "Senior Sales Executive", "Key Account Manager", "Territory Sales Representative"], quals: "business", female: 0.22 },
      { name: "Marketing", w: 18, titles: ["Marketing Officer", "Brand Specialist", "Digital Marketing Specialist", "Market Research Analyst"], quals: "business", female: 0.38 },
      { name: "Customer Experience", w: 30, titles: ["Customer Service Agent", "Senior Customer Service Agent", "CX Analyst", "Complaints Officer"], quals: "general", female: 0.45 },
      { name: "Business Development", w: 12, titles: ["Business Development Officer", "Partnership Specialist", "Commercial Analyst"], quals: "business" },
    ],
  },
  {
    name: "Technology", weight: 15, female: 0.2, headTitle: "Chief Technology Officer", growth: 1.65, hq: 0.85, expat: 0.14,
    departments: [
      { name: "Software Engineering", w: 35, titles: ["Software Engineer", "Senior Software Engineer", "Frontend Developer", "Backend Developer", "QA Automation Engineer"], quals: "it" },
      { name: "IT Infrastructure", w: 28, titles: ["Systems Administrator", "IT Support Specialist", "Network Administrator", "Cloud Engineer"], quals: "it", female: 0.12 },
      { name: "Cybersecurity", w: 15, titles: ["Security Analyst", "SOC Analyst", "Information Security Officer"], quals: "it" },
      { name: "Data & Analytics", w: 22, titles: ["Data Analyst", "Data Engineer", "BI Developer", "Data Scientist"], quals: "it", female: 0.3 },
    ],
  },
  {
    name: "Corporate Services", weight: 12, female: 0.2, headTitle: "Director of Corporate Services", growth: 0.8, hq: 0.45, expat: 0.02,
    departments: [
      { name: "Legal & Compliance", w: 18, titles: ["Legal Officer", "Compliance Officer", "Legal Counsel"], quals: "law", female: 0.3 },
      { name: "Administration", w: 30, titles: ["Administrative Officer", "Admin Assistant", "Office Coordinator", "Receptionist"], quals: "general", female: 0.35 },
      { name: "Security Services", w: 37, titles: ["Security Officer", "Security Guard", "Security Supervisor"], quals: "field", female: 0.05 },
      { name: "Corporate Communications", w: 15, titles: ["Communications Officer", "Content Specialist", "Public Relations Officer"], quals: "business", female: 0.42 },
    ],
  },
  {
    name: "Finance", weight: 10, female: 0.28, headTitle: "Chief Financial Officer", growth: 0.9, hq: 0.7, expat: 0.08,
    departments: [
      { name: "Accounting", w: 35, titles: ["Accountant", "Senior Accountant", "Accounts Payable Officer", "Accounts Receivable Officer"], quals: "finance" },
      { name: "Treasury", w: 15, titles: ["Treasury Officer", "Cash Management Analyst"], quals: "finance" },
      { name: "Procurement", w: 30, titles: ["Procurement Officer", "Buyer", "Supply Chain Analyst", "Contracts Officer"], quals: "business", female: 0.2 },
      { name: "Internal Audit", w: 20, titles: ["Internal Auditor", "Senior Internal Auditor", "Risk Analyst"], quals: "finance" },
    ],
  },
  {
    name: "Human Resources", weight: 8, female: 0.48, headTitle: "Chief Human Resources Officer", growth: 1.0, hq: 0.62, expat: 0.03,
    departments: [
      { name: "Talent Acquisition", w: 25, titles: ["Recruitment Officer", "Talent Acquisition Specialist", "Sourcing Specialist"], quals: "business", female: 0.55 },
      { name: "HR Operations", w: 35, titles: ["HR Officer", "HR Assistant", "Payroll Officer", "HRIS Analyst"], quals: "business" },
      { name: "Learning & Development", w: 22, titles: ["Training Officer", "L&D Specialist", "Instructional Designer"], quals: "general" },
      { name: "Compensation & Benefits", w: 18, titles: ["Compensation Analyst", "Benefits Officer"], quals: "finance" },
    ],
  },
  {
    name: "Executive Office", weight: 4, female: 0.3, headTitle: "Chief Strategy Officer", growth: 1.2, hq: 1, expat: 0.18,
    departments: [
      { name: "Strategy & PMO", w: 60, titles: ["Project Manager", "Strategy Analyst", "PMO Officer", "Business Analyst"], quals: "business" },
      { name: "CEO Office", w: 40, titles: ["Executive Assistant", "Chief of Staff", "Board Secretary", "Protocol Officer"], quals: "general", female: 0.45 },
    ],
  },
];

const QUAL_PROFILE: Record<QualProfile, [string, number][]> = {
  tech: [["Bachelor", 60], ["Master", 20], ["Diploma", 15], ["High School", 3], ["PhD", 2]],
  field: [["Bachelor", 18], ["Master", 3], ["Diploma", 37], ["High School", 42]],
  business: [["Bachelor", 58], ["Master", 28], ["Diploma", 8], ["High School", 4], ["PhD", 2]],
  it: [["Bachelor", 62], ["Master", 27], ["Diploma", 7], ["High School", 1], ["PhD", 3]],
  law: [["Bachelor", 55], ["Master", 35], ["PhD", 6], ["Diploma", 4]],
  finance: [["Bachelor", 55], ["Master", 35], ["Diploma", 6], ["PhD", 2], ["High School", 2]],
  general: [["Bachelor", 45], ["Master", 12], ["Diploma", 18], ["High School", 24], ["PhD", 1]],
};
const SENIOR_QUALS: [string, number][] = [["Master", 55], ["Bachelor", 25], ["PhD", 15], ["Diploma", 5]];

const QUAL_TEXT: Record<string, Partial<Record<QualProfile, string[]>> & { any: string[] }> = {
  PhD: { any: ["PhD in Economics", "PhD in Engineering", "Doctorate in Business Administration", "PhD in Computer Science", "PhD in Public Policy"] },
  Master: {
    any: ["Master of Arts", "MA Public Policy"],
    tech: ["MSc Telecommunications", "Master of Engineering", "MSc Electrical Engineering"],
    it: ["MSc Computer Science", "Master of Information Systems", "MSc Data Science"],
    business: ["MBA", "Master of Business Administration", "MA Marketing", "Master of Public Administration"],
    finance: ["MBA Finance", "MSc Accounting", "Master of Economics"],
    law: ["LLM International Law", "Master of Law"],
    field: ["Master of Engineering"],
  },
  Bachelor: {
    any: ["Bachelor of Arts", "BA English Literature", "Bachelor of Education"],
    tech: ["Bachelor of Engineering", "BSc Electrical Engineering", "BSc Telecommunications"],
    it: ["Bachelor of Computer Science", "BSc Software Engineering", "BSc Information Technology"],
    business: ["BBA", "Bachelor of Business Administration", "Bachelor of Economics", "BA Marketing"],
    finance: ["Bachelor of Accounting", "BBA Finance", "Bachelor of Economics"],
    law: ["LLB", "Bachelor of Law & Political Science", "Bachelor of Sharia Law"],
    field: ["Bachelor of Engineering", "BSc Civil Engineering"],
  },
  Diploma: { any: ["Diploma in Information Technology", "Diploma in Electrical Technology", "14th Grade Diploma", "Diploma in Accounting", "Diploma in Business Management", "Technical Institute Diploma"] },
  "High School": { any: ["High School Graduate", "12th Grade", "Baccalaureate (Grade 12)"] },
};
const QUAL_NEW: Record<string, string> = { PhD: "PhD", Master: "Master Degree", Bachelor: "Bachelor Degree", Diploma: "Diploma", "High School": "High School" };

interface Person {
  seq: number;
  first: string;
  last: string;
  full: string;
  gender: "Male" | "Female";
  father: string;
  title: string;
  division: string;
  department: string;
  supervisor: Person | null;
  level: number;
  station: Station;
  age: number;
  tenure: number;
  nationality: string;
  qual: string;
  qualNew: string;
  marital: string;
  blood: string;
  phone: string;
  email: string;
  tazkira: string;
  remarks: string;
}

function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const res = raw.map(Math.floor);
  let rem = total - res.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rem > 0 && k < order.length; k++, rem--) res[order[k][1]]++;
  return res;
}

export interface DemoOutput {
  headers: string[];
  rows: Record<string, string | number>[];
}

/** Deterministic, realistic ATOMA workforce with a coherent reporting hierarchy. */
export function generateDemoRows(count = 1250, seed = 7, now = new Date()): DemoOutput {
  const rnd = mulberry32(seed * 7919 + count);
  const nowTs = now.getTime();
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)];
  const wpick = <T,>(a: readonly (readonly [T, number])[]): T => {
    const tot = a.reduce((s, x) => s + x[1], 0);
    let r = rnd() * tot;
    for (const [v, w] of a) {
      r -= w;
      if (r <= 0) return v;
    }
    return a[a.length - 1][0];
  };
  const between = (a: number, b: number) => a + (b - a) * ((rnd() + rnd()) / 2);
  const names = new Set<string>();
  const emails = new Set<string>();
  const people: Person[] = [];
  let seq = 0;

  const uniqueName = (gender: "Male" | "Female") => {
    for (let i = 0; i < 60; i++) {
      let first = gender === "Female" ? pick(FEMALE) : pick(MALE);
      if (i >= 10) first = gender === "Female" ? `${first} ${pick(FEMALE_MIDDLE)}` : `${pick(MALE_PREFIX)} ${first}`;
      const last = pick(LAST);
      const full = `${first} ${last}`;
      if (!names.has(full)) {
        names.add(full);
        return { first, last, full };
      }
    }
    const first = gender === "Female" ? pick(FEMALE) : pick(MALE);
    const last = `${pick(LAST)}-${pick(LAST)}`;
    const full = `${first} ${last} ${seq}`;
    names.add(full);
    return { first, last, full };
  };

  const stationFor = (div: Div, parent?: Station): Station => {
    if (parent && rnd() < 0.65) return parent;
    if (rnd() < div.hq) return ["Kabul", "Kabul"];
    return div.name === "Operations" ? wpick(FIELD_STATIONS) : wpick(HUBS);
  };

  const make = (o: { div: Div; dept: Dept; title: string; level: number; supervisor: Person | null; station: Station; gender?: "Male" | "Female"; age?: number; tenure?: number }): Person => {
    seq++;
    const femaleProb = o.dept.female ?? o.div.female;
    const gender = o.gender ?? (rnd() < femaleProb ? "Female" : "Male");
    const nm = uniqueName(gender);
    const [amin, amax] = AGE_RANGE[o.level - 1];
    let age = o.age ?? between(amin, amax);
    if (o.age === undefined && o.level <= 6 && rnd() < 0.035) age = between(55, 63);
    const maxTen = Math.max(0.05, Math.min(age - 20, 18));
    let tenure = o.tenure ?? -Math.log(1 - rnd() * 0.999) * (4.3 / o.div.growth) + (o.level >= 7 ? rnd() * 5 : 0);
    tenure = Math.max(0.01, Math.min(maxTen, tenure));

    const expatProb = o.div.expat + (o.level >= 8 ? 0.15 : 0);
    const nationality = seq > 1 && rnd() < expatProb ? wpick(EXPATS) : "Afghan";
    const qualGroup = seq === 1 ? "PhD" : o.level >= 7 ? wpick(SENIOR_QUALS) : wpick(QUAL_PROFILE[o.dept.quals]);
    const texts = QUAL_TEXT[qualGroup];
    const qual = pick(texts[o.dept.quals] ?? texts.any);

    const marriedP = age < 25 ? 0.22 : age < 30 ? 0.5 : age < 40 ? 0.76 : 0.88;
    const mr = rnd();
    const marital = rnd() < 0.008 ? "" : mr < marriedP ? "Married" : mr < marriedP + 0.015 ? "Divorced" : mr < marriedP + (age > 45 ? 0.05 : 0.02) ? "Widowed" : "Single";

    let email = `${nm.first.split(" ").pop()}.${nm.last}`.toLowerCase().replace(/[^a-z.]/g, "");
    let n = 1;
    while (emails.has(email)) email = `${email.replace(/\d+$/, "")}${++n}`;
    emails.add(email);

    const month = new Date(nowTs).getUTCMonth();
    let remarks = "";
    const r = rnd();
    if (r < 0.055) remarks = pick(["Resigned - serving notice period", "Resigned - last working day pending", "Terminated - contract ended", "End of contract - not renewed", "Resigned - relocation abroad"]);
    else if (r < 0.125 && tenure > 1.5) remarks = `Promoted - ${new Date(nowTs - rnd() * Math.min(tenure, 3) * YEAR).getUTCFullYear()}`;
    else if (r < 0.15 && tenure < 0.3) remarks = "On probation";
    else if (r < 0.17) remarks = `Transferred from ${pick(["Herat", "Mazar-i-Sharif", "Kandahar", "Jalalabad", "Kunduz"])} office`;
    else if (r < 0.185 && gender === "Female") remarks = "On maternity leave";
    else if (r < 0.21) remarks = `Contract renewal due ${MONTH_NAMES[(month + 1 + Math.floor(rnd() * 3)) % 12]}`;
    else if (r < 0.55) remarks = "Active";

    const p: Person = {
      seq,
      first: nm.first,
      last: nm.last,
      full: nm.full,
      gender,
      father: pick(FATHERS),
      title: o.title,
      division: o.div.name,
      department: o.dept.name,
      supervisor: o.supervisor,
      level: o.level,
      station: o.station,
      age,
      tenure,
      nationality,
      qual,
      qualNew: QUAL_NEW[qualGroup],
      marital,
      blood: rnd() < 0.015 ? "" : wpick(BLOOD),
      phone: `+93 7${pick(["0", "2", "3", "6", "7", "8", "9"])}${Math.floor(rnd() * 10)} ${String(Math.floor(rnd() * 1000)).padStart(3, "0")} ${String(Math.floor(rnd() * 10000)).padStart(4, "0")}`,
      email: `${email}@atoma.af`,
      tazkira: nationality === "Afghan" ? `${1395 + Math.floor(rnd() * 9)}-${String(1 + Math.floor(rnd() * 34)).padStart(2, "0")}${String(1 + Math.floor(rnd() * 99)).padStart(2, "0")}-${String(Math.floor(rnd() * 100000)).padStart(5, "0")}` : "",
      remarks,
    };
    people.push(p);
    return p;
  };

  const kabul: Station = ["Kabul", "Kabul"];
  const execDiv = DIVISIONS[DIVISIONS.length - 1];
  const ceo = make({ div: execDiv, dept: execDiv.departments[1], title: "Chief Executive Officer", level: 10, supervisor: null, station: kabul, gender: "Male", age: 54.4, tenure: 11.6 });

  const leaders = 1 + DIVISIONS.length + DIVISIONS.reduce((s, d) => s + d.departments.length, 0);
  const remaining = Math.max(0, count - leaders);
  const divAlloc = allocate(remaining, DIVISIONS.map((d) => d.weight));

  DIVISIONS.forEach((div, di) => {
    const head = make({ div, dept: div.departments[0], title: div.headTitle, level: 9, supervisor: ceo, station: kabul, tenure: 3 + rnd() * 10 });
    const deptAlloc = allocate(divAlloc[di], div.departments.map((d) => d.w));
    div.departments.forEach((dept, dj) => {
      const size = deptAlloc[dj];
      const senior = size >= 30;
      const dHead = make({ div, dept, title: senior ? `Head of ${dept.name}` : `${dept.name} Manager`, level: senior ? 8 : 7, supervisor: head, station: rnd() < 0.85 ? kabul : stationFor(div) });
      const tlCount = size >= 8 ? Math.max(1, Math.round(size / 11)) : 0;
      const leads: Person[] = [];
      for (let t = 0; t < tlCount; t++) {
        leads.push(make({ div, dept, title: dept.name === "Security Services" ? "Security Supervisor" : `Team Lead - ${dept.name}`, level: 6, supervisor: dHead, station: stationFor(div) }));
      }
      const staff = size - tlCount;
      const titleWeights = dept.titles.map((t, i) => [t, Math.max(1, 5 - i * 1.2)] as const);
      for (let s = 0; s < staff; s++) {
        const sup = leads.length ? leads[s % leads.length] : dHead;
        const title = wpick(titleWeights);
        let level: number;
        if (/senior|key account|legal counsel|chief of staff|data scientist/i.test(title)) level = rnd() < 0.6 ? 4 : 5;
        else if (/driver|guard|receptionist|assistant|agent/i.test(title)) level = rnd() < 0.6 ? 1 : 2;
        else level = wpick([[1, 15], [2, 25], [3, 30], [4, 20], [5, 10]] as const);
        make({ div, dept, title, level, supervisor: sup, station: stationFor(div, sup.station) });
      }
    });
  });

  const L = Object.fromEntries(FIELD_DEFS.map((d) => [d.key, d.label])) as Record<FieldKey, string>;
  const iso = (ts: number) => new Date(Math.round(ts / DAY) * DAY).toISOString().slice(0, 10);
  const rows = people.map((p) => {
    const joinTs = nowTs - p.tenure * YEAR;
    const dobTs = nowTs - p.age * YEAR;
    const row: Record<string, string | number> = {};
    row[L.hrisNo] = `HRIS-${String(10000 + p.seq)}`;
    row[L.employeeNo] = `ATM-${String(p.seq).padStart(5, "0")}`;
    row[L.fullName] = p.full;
    row[L.firstName] = p.first;
    row[L.lastName] = p.last;
    row[L.fatherName] = p.father;
    row[L.title] = p.title;
    row[L.division] = p.division;
    row[L.department] = p.department;
    row[L.supervisor] = p.supervisor ? p.supervisor.full : "Board of Directors";
    row[L.supervisorEmail] = p.supervisor ? p.supervisor.email : "board@atoma.af";
    row[L.dutyStation] = p.station[0];
    row[L.contactNumber] = p.phone;
    row[L.level] = LEVELS[p.level - 1];
    row[L.joinDate] = iso(joinTs);
    row[L.tenure] = Math.round(p.tenure * 10) / 10;
    row[L.dob] = iso(dobTs);
    row[L.age] = Math.floor(p.age);
    row[L.qualification] = p.qual;
    row[L.qualificationNew] = p.qualNew;
    row[L.expatLocal] = p.nationality === "Afghan" ? "Local" : "Expat";
    row[L.nationality] = p.nationality;
    row[L.gender] = p.gender;
    row[L.region] = p.station[1];
    row[L.maritalStatus] = p.marital;
    row[L.email] = p.email;
    row[L.tazkira] = p.tazkira;
    row[L.bloodGroup] = p.blood;
    row[L.remarks] = p.remarks;
    return row;
  });

  return { headers: FIELD_DEFS.map((d) => d.label), rows };
}
