import type { Metadata } from "next";
import ReportsView from "@/components/views/ReportsView";

export const metadata: Metadata = { title: "Executive Reports · ATOMA Workforce Intelligence" };

export default function Page() {
  return <ReportsView />;
}
