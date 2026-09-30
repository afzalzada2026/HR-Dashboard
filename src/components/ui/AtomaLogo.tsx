import { ATOMA_MARK_PATHS } from "@/lib/brand";
import { cn } from "@/lib/format";

/**
 * ATOMA brand mark — three rounded chevrons (navy, indigo, cyan) forming the
 * company arrow motif. Drawn as real vector paths so it scales, prints and
 * recolours cleanly at every size (sidebar, login, exports, favicon).
 */
export function AtomaMark({ className, mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9 shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id="atomaC1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mono ? "#FFFFFF" : "#1B2E9E"} />
          <stop offset="1" stopColor={mono ? "#FFFFFF" : "#2B3FD9"} />
        </linearGradient>
        <linearGradient id="atomaC2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mono ? "#FFFFFF" : "#3D55F0"} />
          <stop offset="1" stopColor={mono ? "#FFFFFF" : "#4E6BFF"} />
        </linearGradient>
        <linearGradient id="atomaC3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mono ? "#FFFFFF" : "#18B8F5"} />
          <stop offset="1" stopColor={mono ? "#FFFFFF" : "#2ED2FF"} />
        </linearGradient>
      </defs>
      <g fill="none" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12 L30 32 L8 52" stroke="url(#atomaC1)" opacity={mono ? 0.55 : 0.92} />
        <path d="M20 6 L46 32 L20 58" stroke="url(#atomaC2)" opacity={mono ? 0.75 : 0.88} />
        <path d="M34 10 L58 32 L34 54" stroke="url(#atomaC3)" opacity={mono ? 1 : 0.95} />
      </g>
    </svg>
  );
}

/** Logo lock-up: mark + ATOMA wordmark, usable on light and dark surfaces. */
export function AtomaLogo({ collapsed, dark = false, className }: { collapsed?: boolean; dark?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <AtomaMark />
      {!collapsed && (
        <div className="leading-none">
          <div className={cn("text-[17px] font-extrabold tracking-[0.22em]", dark ? "text-brand-900" : "text-white")}>ATOMA</div>
          <div className={cn("mt-1 text-[9px] font-semibold tracking-[0.2em] uppercase", dark ? "text-brand-700/70" : "text-white/55")}>Workforce Intelligence</div>
        </div>
      )}
    </div>
  );
}

/** Path data reused by the SVG/PDF organogram exporters so exports carry the real mark. */
export { ATOMA_MARK_PATHS };
