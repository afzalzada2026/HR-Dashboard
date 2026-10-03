import fs from "fs";
import { transformLegacyEmployees, buildOrgFromLegacy, exportSvgFromLegacy } from "../lib/legacy-to-mod";

async function run() {
  const demo = [
    { id: 1, fullName: "Marius van Wyk", title: "Chief Financial Officer", actualLevel: "L6", division: "Finance", department: "Executive", supervisor: "", email: "marius@atoma.af" },
    { id: 2, fullName: "Karimullah Qasmi", title: "GM Finance", actualLevel: "L5", division: "Finance", department: "Finance", supervisor: "Marius van Wyk", supervisorEmail: "marius@atoma.af" },
    { id: 3, fullName: "Saeedullah Saeed", title: "Sr. Manager Financial Operations", actualLevel: "L3H", division: "Finance", department: "Financial Operations", supervisor: "Karimullah Qasmi", supervisorEmail: "karim@atoma.af" },
  ];

  const transformed = transformLegacyEmployees(demo as any);
  console.log("Transformed employees:", transformed.map((e) => ({ id: e.id, fullName: e.fullName, level: e.level, levelRank: e.levelRank })));

  const build = buildOrgFromLegacy(demo as any);
  console.log("Roots:", build.roots.map((r) => r.emp.fullName));

  const svg = exportSvgFromLegacy(demo as any, { title: "Smoke Test Org", footer: "Smoke test export" });
  console.log("SVG length:", svg.length);
  fs.writeFileSync("./org-smoke.svg", svg, "utf8");
  console.log("Wrote ./org-smoke.svg");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
