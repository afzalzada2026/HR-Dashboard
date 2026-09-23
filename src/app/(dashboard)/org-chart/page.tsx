import type { Metadata } from "next";
import OrgChartView from "@/components/views/OrgChartView";

export const metadata: Metadata = { title: "Org Chart · ATOMA Workforce Intelligence" };

export default function Page() {
  return <OrgChartView />;
}
