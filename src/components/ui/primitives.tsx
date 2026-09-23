"use client";

import { X } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { cn, hashHue, initials } from "@/lib/format";

/* ---------------------------------------------------------------- Button */

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "soft";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-linear-to-r from-brand-700 to-brand-400 text-white shadow-[0_10px_24px_-10px_rgba(0,168,255,0.75)] hover:brightness-110 active:brightness-95",
  secondary: "bg-surface-strong border border-line text-fg hover:border-line-strong hover:bg-surface-muted",
  ghost: "text-muted hover:text-fg hover:bg-surface-muted",
  outline: "border border-line-strong text-fg hover:bg-surface-muted",
  danger: "bg-danger text-white hover:brightness-110",
  soft: "bg-primary/10 text-primary hover:bg-primary/15 dark:bg-accent/15 dark:text-accent",
};
const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[11px] gap-1 rounded-lg",
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

export function Button({ variant = "secondary", size = "md", className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150 disabled:pointer-events-none disabled:opacity-45 [&_svg]:h-4 [&_svg]:w-4",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, active, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        className={cn(
          "inline-grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-fg [&_svg]:h-4 [&_svg]:w-4",
          active && "bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent",
          className
        )}
        {...props}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/* ---------------------------------------------------------------- Card */

export function Card({ className, children, padded = true }: { className?: string; children: ReactNode; padded?: boolean }) {
  return <div className={cn("glass rounded-2xl", padded && "p-4 sm:p-5", className)}>{children}</div>;
}

export function CardTitle({ title, subtitle, icon, actions, className }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent [&_svg]:h-[18px] [&_svg]:w-[18px]">{icon}</div>}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- Badge */

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted border-line",
  primary: "bg-primary/10 text-primary border-primary/20 dark:bg-accent/15 dark:text-accent dark:border-accent/25",
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  danger: "bg-danger/12 text-danger border-danger/25",
  accent: "bg-accent/12 text-accent border-accent/25",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

/* ---------------------------------------------------------------- Tooltip */

export function Tooltip({ content, children, side = "top", className }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right"; className?: string }) {
  const pos = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-[90] w-max max-w-[260px] rounded-lg bg-[#0b1b33] px-2.5 py-1.5 text-[11px] leading-snug font-medium text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover/tt:opacity-100 dark:bg-[#e6eef8] dark:text-[#0b1b33]",
          pos
        )}
      >
        {content}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className, height }: { className?: string; height?: number | string }) {
  return <div className={cn("skeleton", className)} style={height !== undefined ? { height } : undefined} />;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent", className)} />;
}

/* ---------------------------------------------------------------- Overlay helpers */

function useEscape(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => {
    ref.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && ref.current();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open]);
}

const MODAL_SIZES = { sm: "max-w-md", md: "max-w-2xl", lg: "max-w-4xl", xl: "max-w-6xl" };

export function Modal({ open, onClose, title, subtitle, children, size = "md", footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; size?: keyof typeof MODAL_SIZES; footer?: ReactNode }) {
  useEscape(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <div className="animate-fade-in absolute inset-0 bg-[#020b1c]/55 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("glass-strong animate-pop relative flex max-h-[92vh] w-full flex-col rounded-2xl", MODAL_SIZES[size])} role="dialog" aria-modal="true">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-fg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, children, width = "max-w-md", side = "right", label }: { open: boolean; onClose: () => void; children: ReactNode; width?: string; side?: "right" | "left"; label: string }) {
  useEscape(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={label}>
      <div className="animate-fade-in absolute inset-0 bg-[#020b1c]/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className={cn("glass-strong absolute inset-y-0 flex w-full flex-col", width, side === "right" ? "animate-slide-right right-0 rounded-l-2xl" : "animate-slide-left left-0 rounded-r-2xl")}>{children}</aside>
    </div>,
    document.body
  );
}

/* ---------------------------------------------------------------- Popover */

export function Popover({ open, onOpenChange, trigger, children, align = "left", width = 280, className }: { open: boolean; onOpenChange: (v: boolean) => void; trigger: ReactNode; children: ReactNode; align?: "left" | "right"; width?: number | string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onOpenChange);
  useEffect(() => {
    cb.current = onOpenChange;
  });
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb.current(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cb.current(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className={cn("glass-strong animate-pop absolute z-50 mt-2 max-w-[calc(100vw-24px)] rounded-xl p-1.5", align === "right" ? "right-0" : "left-0", className)} style={{ width }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, onClick, disabled, hint, danger, active }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; disabled?: boolean; hint?: ReactNode; danger?: boolean; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
        danger ? "text-danger hover:bg-danger/10" : "text-fg hover:bg-surface-muted",
        active && "bg-primary/10 dark:bg-accent/15"
      )}
    >
      {icon && <span className={cn("text-muted", active && "text-primary dark:text-accent")}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-[11px] text-subtle">{hint}</span>}
    </button>
  );
}

/* ---------------------------------------------------------------- Misc */

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40", checked ? "bg-accent" : "bg-line-strong")}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "sm" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: ReactNode }[]; size?: "xs" | "sm" }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap transition-all [&_svg]:h-3.5 [&_svg]:w-3.5",
            size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
            value === o.value ? "bg-surface-strong text-fg shadow-sm" : "text-muted hover:text-fg"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const h = hashHue(name);
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white/20", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36), background: `linear-gradient(135deg, hsl(${h} 70% 42%), hsl(${(h + 40) % 360} 80% 56%))` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent [&_svg]:h-7 [&_svg]:w-7">{icon}</div>}
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, icon, actions, eyebrow }: { title: string; subtitle?: ReactNode; icon?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="animate-fade-up mb-5 flex flex-col gap-4 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-700 to-brand-400 text-white shadow-[0_12px_28px_-10px_rgba(0,168,255,0.7)] [&_svg]:h-6 [&_svg]:w-6">{icon}</div>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">{eyebrow}</p>}
          <h1 className="truncate text-xl font-bold tracking-tight text-fg sm:text-2xl">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-muted">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2" data-no-capture="true">{actions}</div>}
    </div>
  );
}

export function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-muted", className)}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color ?? "linear-gradient(90deg,#0D47A1,#00A8FF)" }} />
    </div>
  );
}
