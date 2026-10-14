"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface BoundaryProps {
  children: ReactNode;
  /** Called when the user resets — typically clears overrides / expansion state. */
  onReset?: () => void;
}

/**
 * Error boundary for the organogram (ported from the reference `OrgChartBoundary`):
 * a bad scope can never take down the rest of the dashboard.
 */
export class OrgChartBoundary extends Component<BoundaryProps, { error: string | null }> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("ATOMA organogram rendering error", error, info.componentStack);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="glass rounded-2xl border border-amber-500/40 p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
          <AlertTriangle size={22} />
        </span>
        <h2 className="mt-3 text-base font-extrabold text-fg">This organogram scope could not be laid out</h2>
        <p className="mx-auto mt-1 max-w-2xl text-xs text-muted">
          The rest of the dashboard is safe. This usually means the selected HRIS rows contain an unusually deep or
          malformed reporting chain. Reset the chart and try the division again; the Reporting-line quality panel will
          identify unmatched managers.
        </p>
        <div className="mx-auto mt-2 max-w-2xl rounded-lg bg-surface-muted px-3 py-2 font-mono text-[10px] text-red-600">{this.state.error}</div>
        <div className="mt-3 flex justify-center gap-2">
          <button onClick={this.reset} className="flex items-center gap-1.5 rounded-xl bg-[#0D47A1] px-4 py-2 text-xs font-bold text-white hover:bg-[#00A8FF]">
            <RotateCcw size={13} /> Reset chart
          </button>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-xs font-bold text-fg hover:border-[#00A8FF]">
            <RefreshCw size={13} /> Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default OrgChartBoundary;
