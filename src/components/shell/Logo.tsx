import { cn } from "@/lib/format";
import { AtomaLogo, AtomaMark } from "../ui/AtomaLogo";

export function LogoMark({ className }: { className?: string }) {
  return <AtomaMark className={className} />;
}

export function Logo({ collapsed, className, dark = false }: { collapsed?: boolean; className?: string; dark?: boolean }) {
  return <AtomaLogo collapsed={collapsed} dark={dark} className={cn(className)} />;
}
