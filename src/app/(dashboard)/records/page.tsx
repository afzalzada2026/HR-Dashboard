import type { Metadata } from "next";
import RecordsView from "@/components/views/RecordsView";

export const metadata: Metadata = { title: "Employee Records · ATOMA Workforce Intelligence" };

export default function Page() {
  return <RecordsView />;
}
