"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="glass-strong w-full max-w-lg rounded-3xl p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warning/12 text-warning">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-fg">This page ran into a problem</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Your workforce data is safe in this browser. Reload the page to try again, or return to the overview and continue with another view.
        </p>
        {error?.message && <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-left text-[11.5px] break-words text-subtle">{error.message}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-xl bg-linear-to-r from-brand-700 to-brand-400 px-4 text-sm font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> Reload this page
          </button>
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-semibold text-fg">
            <Home className="h-4 w-4" /> Back to overview
          </Link>
        </div>
      </div>
    </div>
  );
}
