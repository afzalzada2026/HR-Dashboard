import { cn } from "@/lib/format";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9 shrink-0 drop-shadow-[0_6px_16px_rgba(0,168,255,0.45)]", className)} aria-hidden>
      <defs>
        <linearGradient id="atomaLogoG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4FC3F7" />
          <stop offset="1" stopColor="#00A8FF" />
        </linearGradient>
        <linearGradient id="atomaLogoBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0D47A1" />
          <stop offset="1" stopColor="#062B5B" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#atomaLogoBg)" />
      <g fill="none" stroke="url(#atomaLogoG)" strokeWidth="3">
        <ellipse cx="32" cy="32" rx="22" ry="8.5" />
        <ellipse cx="32" cy="32" rx="22" ry="8.5" transform="rotate(60 32 32)" />
        <ellipse cx="32" cy="32" rx="22" ry="8.5" transform="rotate(120 32 32)" />
      </g>
      <circle cx="32" cy="32" r="5.5" fill="#FFFFFF" />
      <circle cx="32" cy="32" r="3" fill="#00A8FF" />
    </svg>
  );
}

export function Logo({ collapsed, className, dark = false }: { collapsed?: boolean; className?: string; dark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!collapsed && (
        <div className="leading-none">
          <div className={cn("text-[17px] font-extrabold tracking-[0.22em]", dark ? "text-brand-900" : "text-white")}>ATOMA</div>
          <div className={cn("mt-1 text-[9px] font-semibold tracking-[0.2em] uppercase", dark ? "text-brand-700/70" : "text-white/55")}>Workforce Intelligence</div>
        </div>
      )}
    </div>
  );
}
