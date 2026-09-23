import type { Metadata } from "next";
import VisualsView from "@/components/views/VisualsView";

export const metadata: Metadata = { title: "Interactive Visuals · ATOMA Workforce Intelligence" };

export default function Page() {
  return <VisualsView />;
}
