import type { Metadata } from "next";
import MapView from "@/components/views/MapView";

export const metadata: Metadata = { title: "Afghanistan Map · ATOMA Workforce Intelligence" };

export default function Page() {
  return <MapView />;
}
