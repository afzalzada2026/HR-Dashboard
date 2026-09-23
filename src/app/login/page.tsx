import type { Metadata } from "next";
import LoginView from "@/components/views/LoginView";

export const metadata: Metadata = { title: "Sign in · ATOMA Workforce Intelligence" };

export default function Page() {
  return <LoginView />;
}
