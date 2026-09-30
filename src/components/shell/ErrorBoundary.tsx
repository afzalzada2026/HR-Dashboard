"use client";

import { AlertTriangle, Home, RefreshCw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useDataStore } from "@/store/data";
import { Button } from "../ui/primitives";

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

function RecoveryPanel({ error, label, onRetry }: { error: Error; label: string; onRetry: () => void }) {
  const clearFilters = useDataStore((state) => state.clearFilters);
  return (
    <div className="glass mx-auto my-10 max-w-2xl rounded-2xl p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warning/12 text-warning">
        <AlertTriangle className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-fg">This section hit a problem</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {label} could not be displayed with the current data and filters. Your imported data is safe — this is a display issue only.
      </p>
      <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-left text-[11.5px] break-words text-subtle">{error.message}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
        <Button
          onClick={() => {
            clearFilters();
            onRetry();
          }}
        >
          <SlidersHorizontal /> Clear filters & retry
        </Button>
        <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-fg [&_svg]:h-4 [&_svg]:w-4">
          <Home /> Back to overview
        </Link>
      </div>
    </div>
  );
}

/** Keeps any single widget/page failure from taking down the whole portal. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[atoma] view error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <RecoveryPanel error={this.state.error} label={this.props.label ?? "This dashboard"} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
