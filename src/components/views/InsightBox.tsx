"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import type { InsightBoxItem } from "@/lib/insights";
import { cn } from "@/lib/format";

/** Premium executive insight panel (always brand-gradient for visual emphasis). */
export function InsightBox({ items, narrative, className }: { items: InsightBoxItem[]; narrative?: string; className?: string }) {
  return (
    <section
      className={cn("animate-fade-up relative flex flex-col overflow-hidden rounded-2xl border border-white/15 p-5 text-white shadow-[0_24px_50px_-20px_rgba(6,43,91,0.6)]", className)}
      style={{ background: "linear-gradient(145deg,#062B5B 0%,#0D47A1 58%,#0B6FD0 100%)" }}
    >
      <div className="animate-float pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-[#00A8FF]/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Sparkles className="h-[18px] w-[18px] text-[#7FD4FF]" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold">Executive Insight Box</h3>
            <p className="text-[11px] text-white/65">Auto-generated from the current selection</p>
          </div>
        </div>
      </div>
      <dl className="relative mt-4 grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10 transition-colors hover:bg-white/12">
            <dt className="text-[10px] font-semibold tracking-[0.1em] text-white/60 uppercase">{it.label}</dt>
            <dd className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="truncate text-[14px] font-bold">{it.value}</span>
              {it.hint && <span className="shrink-0 text-[10.5px] text-[#7FD4FF]">{it.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
      {narrative && <p className="relative mt-3 text-[12px] leading-relaxed text-white/80">{narrative}</p>}
      <Link href="/insights" className="relative mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7FD4FF] hover:text-white" data-no-capture="true">
        Open AI Insights Engine <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
