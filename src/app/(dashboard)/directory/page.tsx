import type { Metadata } from "next";
import DirectoryView from "@/components/views/DirectoryView";

export const metadata: Metadata = { title: "Employee Directory · ATOMA Workforce Intelligence" };

export default function Page() {
  return <DirectoryView />;
}
