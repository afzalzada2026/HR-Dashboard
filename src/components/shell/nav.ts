import { ChartColumn, Database, FileText, LayoutDashboard, type LucideIcon, MapPinned, Network, ShieldCheck, Sparkles, Target, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  description: string;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Executive Overview", icon: LayoutDashboard, section: "Analytics", description: "20 executive KPIs, trends & highlights" },
  { href: "/analytics", label: "Strategic Analytics", icon: Target, section: "Analytics", description: "Growth, diversity, retention & structure" },
  { href: "/visuals", label: "Interactive Visuals", icon: ChartColumn, section: "Analytics", description: "18 cross-filtering visuals" },
  { href: "/map", label: "Afghanistan Map", icon: MapPinned, section: "Analytics", description: "Province heat map & drill-down" },
  { href: "/insights", label: "AI Insights", icon: Sparkles, section: "Analytics", description: "Automated narratives & Q&A", badge: "AI" },
  { href: "/directory", label: "Employee Directory", icon: Users, section: "Workforce", description: "Search, sort, filter & export" },
  { href: "/org-chart", label: "Org Chart", icon: Network, section: "Workforce", description: "Interactive organization structure" },
  { href: "/reports", label: "Executive Reports", icon: FileText, section: "Workforce", description: "Exports & scheduled reports" },
  { href: "/data", label: "Data Sources", icon: Database, section: "Administration", description: "Upload Excel / CSV & mapping" },
  { href: "/security", label: "Security & Audit", icon: ShieldCheck, section: "Administration", description: "Roles, permissions & audit logs" },
];

export const NAV_SECTIONS = ["Analytics", "Workforce", "Administration"].map((title) => ({ title, items: NAV_ITEMS.filter((n) => n.section === title) }));

export function findNav(pathname: string): NavItem {
  if (pathname === "/") return NAV_ITEMS[0];
  return NAV_ITEMS.find((n) => n.href !== "/" && pathname.startsWith(n.href)) ?? NAV_ITEMS[0];
}

export const CAPTURE_BG: Record<string, string> = { light: "#F4F8FC", dark: "#060E1A", atoma: "#062B5B" };
