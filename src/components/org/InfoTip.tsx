import { Info } from "lucide-react";

/**
 * Small hover tip used by the organogram panels (ported from the reference
 * `InfoTip` component). Pure CSS — no portal, safe inside the chart canvas.
 */
export function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex align-middle">
      <Info size={12} className="text-muted cursor-help" aria-label={text} />
      <span className="glass-strong pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg p-2 text-[10.5px] leading-snug font-medium text-fg opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100">
        {text}
      </span>
    </span>
  );
}

export default InfoTip;
