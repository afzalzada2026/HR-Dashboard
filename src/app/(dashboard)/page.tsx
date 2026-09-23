import type { Metadata } from "next";
import OverviewView from "@/components/views/OverviewView";

export const metadata: Metadata = { title: "Executive Overview · ATOMA Workforce Intelligence" };

export default function Page() {
  return <OverviewView />;
}
