import type { Metadata } from "next";
import InsightsView from "@/components/views/InsightsView";

export const metadata: Metadata = { title: "AI Insights · ATOMA Workforce Intelligence" };

export default function Page() {
  return <InsightsView />;
}
