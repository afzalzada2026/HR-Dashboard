import type { Metadata } from "next";
import AnalyticsView from "@/components/views/AnalyticsView";

export const metadata: Metadata = { title: "Strategic Analytics · ATOMA Workforce Intelligence" };

export default function Page() {
  return <AnalyticsView />;
}
