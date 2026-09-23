import type { Metadata } from "next";
import SecurityView from "@/components/views/SecurityView";

export const metadata: Metadata = { title: "Security & Audit · ATOMA Workforce Intelligence" };

export default function Page() {
  return <SecurityView />;
}
