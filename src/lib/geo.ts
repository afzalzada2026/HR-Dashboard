export interface ProvinceInfo {
  name: string;
  region: string;
  capital: string;
  coord: [number, number];
}

/** 34 provinces of Afghanistan. Names match /public/geo/afghanistan.json feature names. */
export const PROVINCES: ProvinceInfo[] = [
  { name: "Badakhshan", region: "North-Eastern", capital: "Faizabad", coord: [70.58, 37.117] },
  { name: "Badghis", region: "Western", capital: "Qala-i-Naw", coord: [63.129, 34.985] },
  { name: "Baghlan", region: "North-Eastern", capital: "Pul-e-Khumri", coord: [68.715, 35.945] },
  { name: "Balkh", region: "Northern", capital: "Mazar-i-Sharif", coord: [67.111, 36.709] },
  { name: "Bamyan", region: "Central Highlands", capital: "Bamyan", coord: [67.827, 34.821] },
  { name: "Daykundi", region: "Central Highlands", capital: "Nili", coord: [66.13, 33.722] },
  { name: "Farah", region: "Western", capital: "Farah", coord: [62.116, 32.374] },
  { name: "Faryab", region: "Northern", capital: "Maymana", coord: [64.784, 35.921] },
  { name: "Ghazni", region: "South-Eastern", capital: "Ghazni", coord: [68.427, 33.554] },
  { name: "Ghor", region: "Western", capital: "Chaghcharan", coord: [65.252, 34.523] },
  { name: "Helmand", region: "Southern", capital: "Lashkar Gah", coord: [64.37, 31.593] },
  { name: "Herat", region: "Western", capital: "Herat", coord: [62.2, 34.348] },
  { name: "Jowzjan", region: "Northern", capital: "Sheberghan", coord: [65.752, 36.665] },
  { name: "Kabul", region: "Central", capital: "Kabul", coord: [69.208, 34.555] },
  { name: "Kandahar", region: "Southern", capital: "Kandahar", coord: [65.737, 31.629] },
  { name: "Kapisa", region: "Central", capital: "Mahmud-i-Raqi", coord: [69.333, 35.017] },
  { name: "Khost", region: "South-Eastern", capital: "Khost", coord: [69.92, 33.34] },
  { name: "Kunar", region: "Eastern", capital: "Asadabad", coord: [71.153, 34.874] },
  { name: "Kunduz", region: "North-Eastern", capital: "Kunduz", coord: [68.868, 36.728] },
  { name: "Laghman", region: "Eastern", capital: "Mehtarlam", coord: [70.209, 34.671] },
  { name: "Logar", region: "Central", capital: "Pul-e-Alam", coord: [69.023, 33.995] },
  { name: "Nangarhar", region: "Eastern", capital: "Jalalabad", coord: [70.452, 34.427] },
  { name: "Nimroz", region: "Southern", capital: "Zaranj", coord: [61.861, 30.96] },
  { name: "Nuristan", region: "Eastern", capital: "Parun", coord: [70.923, 35.421] },
  { name: "Paktia", region: "South-Eastern", capital: "Gardez", coord: [69.226, 33.597] },
  { name: "Paktika", region: "South-Eastern", capital: "Sharana", coord: [68.73, 33.176] },
  { name: "Panjshir", region: "Central", capital: "Bazarak", coord: [69.515, 35.313] },
  { name: "Parwan", region: "Central", capital: "Charikar", coord: [69.171, 35.014] },
  { name: "Samangan", region: "Northern", capital: "Aybak", coord: [68.015, 36.265] },
  { name: "Sar-e-Pul", region: "Northern", capital: "Sar-e-Pul", coord: [65.936, 36.216] },
  { name: "Takhar", region: "North-Eastern", capital: "Taloqan", coord: [69.535, 36.736] },
  { name: "Uruzgan", region: "Southern", capital: "Tarinkot", coord: [65.873, 32.627] },
  { name: "Wardak", region: "Central", capital: "Maidan Shar", coord: [68.866, 34.396] },
  { name: "Zabul", region: "Southern", capital: "Qalat", coord: [66.908, 32.106] },
];

export const REGIONS = ["Central", "Eastern", "Northern", "North-Eastern", "Western", "Southern", "South-Eastern", "Central Highlands"];

export const PROVINCE_REGION: Record<string, string> = Object.fromEntries(PROVINCES.map((p) => [p.name, p.region]));
export const PROVINCE_INFO: Record<string, ProvinceInfo> = Object.fromEntries(PROVINCES.map((p) => [p.name, p]));

const PROVINCE_ALIASES: Record<string, string[]> = {
  Badakhshan: ["badakhshan", "badakshan", "badakhshon"],
  Badghis: ["badghis", "badgis", "badghes"],
  Baghlan: ["baghlan", "baglan"],
  Balkh: ["balkh", "balk"],
  Bamyan: ["bamyan", "bamiyan", "bamian"],
  Daykundi: ["daykundi", "daikundi", "dai kundi", "day kundi", "daykondi"],
  Farah: ["farah", "farrah"],
  Faryab: ["faryab", "fariab", "faryaab"],
  Ghazni: ["ghazni", "ghanzi", "ghazny"],
  Ghor: ["ghor", "ghowr", "ghour"],
  Helmand: ["helmand", "hilmand", "helmend"],
  Herat: ["herat", "hirat"],
  Jowzjan: ["jowzjan", "jawzjan", "jouzjan", "jozjan", "juzjan"],
  Kabul: ["kabul", "kabol", "cabul"],
  Kandahar: ["kandahar", "qandahar", "kandhar", "qandehar"],
  Kapisa: ["kapisa", "kapissa"],
  Khost: ["khost", "khowst", "khwost"],
  Kunar: ["kunar", "konar", "kunarha"],
  Kunduz: ["kunduz", "kondoz", "qunduz", "kundoz"],
  Laghman: ["laghman", "lagman"],
  Logar: ["logar", "lowgar"],
  Nangarhar: ["nangarhar", "ningarhar", "nangrahar", "nengarhar"],
  Nimroz: ["nimroz", "nimruz", "nemroz"],
  Nuristan: ["nuristan", "nooristan", "nurestan"],
  Paktia: ["paktia", "paktya", "paktiya"],
  Paktika: ["paktika", "paktica"],
  Panjshir: ["panjshir", "panjsher", "panjsheer", "panjshayr"],
  Parwan: ["parwan", "parvan"],
  Samangan: ["samangan"],
  "Sar-e-Pul": ["sar e pul", "sar e pol", "sari pul", "sar i pul", "saripul", "sarepul", "sar pol", "sarepol", "sar i pol"],
  Takhar: ["takhar", "tahkar"],
  Uruzgan: ["uruzgan", "oruzgan", "urozgan", "orozgan", "uruzghan"],
  Wardak: ["wardak", "maidan wardak", "maydan wardak", "wardag", "vardak"],
  Zabul: ["zabul", "zabol"],
};

/** City / duty-station aliases → [province, lng, lat] */
const CITY_DATA: Record<string, [string, number, number]> = {
  kabul: ["Kabul", 69.208, 34.555],
  "mazar i sharif": ["Balkh", 67.111, 36.709],
  "mazar e sharif": ["Balkh", 67.111, 36.709],
  "mazari sharif": ["Balkh", 67.111, 36.709],
  "mazar sharif": ["Balkh", 67.111, 36.709],
  mazar: ["Balkh", 67.111, 36.709],
  hairatan: ["Balkh", 67.418, 37.217],
  jalalabad: ["Nangarhar", 70.452, 34.427],
  "jalal abad": ["Nangarhar", 70.452, 34.427],
  torkham: ["Nangarhar", 71.093, 34.1],
  herat: ["Herat", 62.2, 34.348],
  "islam qala": ["Herat", 61.069, 34.662],
  kandahar: ["Kandahar", 65.737, 31.629],
  "spin boldak": ["Kandahar", 66.395, 31.005],
  kunduz: ["Kunduz", 68.868, 36.728],
  "lashkar gah": ["Helmand", 64.37, 31.593],
  lashkargah: ["Helmand", 64.37, 31.593],
  "pul e khumri": ["Baghlan", 68.715, 35.945],
  "puli khumri": ["Baghlan", 68.715, 35.945],
  "pol e khomri": ["Baghlan", 68.715, 35.945],
  faizabad: ["Badakhshan", 70.58, 37.117],
  fayzabad: ["Badakhshan", 70.58, 37.117],
  taloqan: ["Takhar", 69.535, 36.736],
  taluqan: ["Takhar", 69.535, 36.736],
  sheberghan: ["Jowzjan", 65.752, 36.665],
  shibirghan: ["Jowzjan", 65.752, 36.665],
  shebergan: ["Jowzjan", 65.752, 36.665],
  charikar: ["Parwan", 69.171, 35.014],
  bagram: ["Parwan", 69.265, 34.946],
  gardez: ["Paktia", 69.226, 33.597],
  gardiz: ["Paktia", 69.226, 33.597],
  maymana: ["Faryab", 64.784, 35.921],
  maimana: ["Faryab", 64.784, 35.921],
  asadabad: ["Kunar", 71.153, 34.874],
  mehtarlam: ["Laghman", 70.209, 34.671],
  mihtarlam: ["Laghman", 70.209, 34.671],
  "pul e alam": ["Logar", 69.023, 33.995],
  "puli alam": ["Logar", 69.023, 33.995],
  chaghcharan: ["Ghor", 65.252, 34.523],
  firozkoh: ["Ghor", 65.252, 34.523],
  "qala i naw": ["Badghis", 63.129, 34.985],
  "qala e naw": ["Badghis", 63.129, 34.985],
  "qalai naw": ["Badghis", 63.129, 34.985],
  zaranj: ["Nimroz", 61.861, 30.96],
  tarinkot: ["Uruzgan", 65.873, 32.627],
  tirinkot: ["Uruzgan", 65.873, 32.627],
  "tarin kot": ["Uruzgan", 65.873, 32.627],
  qalat: ["Zabul", 66.908, 32.106],
  "maidan shar": ["Wardak", 68.866, 34.396],
  "maidan shahr": ["Wardak", 68.866, 34.396],
  aybak: ["Samangan", 68.015, 36.265],
  aibak: ["Samangan", 68.015, 36.265],
  nili: ["Daykundi", 66.13, 33.722],
  "mahmud i raqi": ["Kapisa", 69.333, 35.017],
  "mahmud raqi": ["Kapisa", 69.333, 35.017],
  bazarak: ["Panjshir", 69.515, 35.313],
  parun: ["Nuristan", 70.923, 35.421],
  sharana: ["Paktika", 68.73, 33.176],
  khost: ["Khost", 69.92, 33.34],
  ghazni: ["Ghazni", 68.427, 33.554],
  bamyan: ["Bamyan", 67.827, 34.821],
  bamiyan: ["Bamyan", 67.827, 34.821],
  farah: ["Farah", 62.116, 32.374],
  "sar e pul": ["Sar-e-Pul", 65.936, 36.216],
};

export function normPlace(v: string): string {
  return v
    .toLowerCase()
    .replace(/\b(province|wilayat|velayat|city|office|district|hq|headquarters|main|branch|regional)\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_INDEX = new Map<string, string>();
for (const [name, aliases] of Object.entries(PROVINCE_ALIASES)) {
  ALIAS_INDEX.set(normPlace(name), name);
  for (const a of aliases) ALIAS_INDEX.set(normPlace(a), name);
}
const ALIAS_LIST = [...ALIAS_INDEX.entries()].sort((a, b) => b[0].length - a[0].length);
const CITY_LIST = Object.entries(CITY_DATA).sort((a, b) => b[0].length - a[0].length);

/** Match any free-text value (province, region/province or duty station) to a canonical province. */
export function matchProvince(value: string | null | undefined): string | null {
  if (!value) return null;
  const n = normPlace(String(value));
  if (!n) return null;
  const direct = ALIAS_INDEX.get(n);
  if (direct) return direct;
  const city = CITY_DATA[n];
  if (city) return city[0];
  const padded = ` ${n} `;
  for (const [alias, name] of ALIAS_LIST) if (alias.length >= 4 && padded.includes(` ${alias} `)) return name;
  for (const [alias, data] of CITY_LIST) if (alias.length >= 4 && padded.includes(` ${alias} `)) return data[0];
  return null;
}

/** Coordinates for a duty station (falls back to province capital). */
export function stationCoord(station: string, province?: string): [number, number] | null {
  const n = normPlace(station || "");
  if (n && CITY_DATA[n]) return [CITY_DATA[n][1], CITY_DATA[n][2]];
  if (n) {
    const padded = ` ${n} `;
    for (const [alias, data] of CITY_LIST) if (alias.length >= 4 && padded.includes(` ${alias} `)) return [data[1], data[2]];
  }
  const p = province && PROVINCE_INFO[province];
  return p ? p.coord : null;
}
