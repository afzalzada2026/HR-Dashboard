import type { Metadata } from "next";
import DataView from "@/components/views/DataView";

export const metadata: Metadata = { title: "Data Sources · ATOMA Workforce Intelligence" };

export default function Page() {
  return <DataView />;
}
