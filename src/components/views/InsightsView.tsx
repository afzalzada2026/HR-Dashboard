"use client";

import {
  Bot, Brain, Building2, Cake, GraduationCap, Globe, Hourglass, Layers, Lightbulb, MapPin, MessageSquareText, Network, RefreshCw, Scale, Send, ShieldCheck, Sparkles, TrendingUp, UserMinus, UserPlus,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { groupStats, memo } from "@/lib/analytics";
import { cn } from "@/lib/format";
import { answerQuestion, executiveSummary, generateInsights, type InsightIcon, type QueryAnswer, type Severity } from "@/lib/insights";
import { useDataStore } from "@/store/data";
import { ChartCard } from "../charts/ChartCard";
import { barOption, stackedOption } from "../charts/options";
import { useChartTokens } from "../charts/tokens";
import { DataGate } from "../shell/Chrome";
import { Badge, Button, Card, CardTitle, PageHeader, Spinner } from "../ui/primitives";

const ICONS: Record<InsightIcon, ReactNode> = {
  division: <Building2 />, growth: <TrendingUp />, age: <Cake />, gender: <Scale />, education: <GraduationCap />, location: <MapPin />, span: <Network />,
  retirement: <Hourglass />, layers: <Layers />, newhire: <UserPlus />, expat: <Globe />, turnover: <UserMinus />, quality: <ShieldCheck />,
};
const SEV: Record<Severity, { tone: "success" | "accent" | "warning" | "danger"; label: string; bar: string }> = {
  positive: { tone: "success", label: "Positive", bar: "bg-success" },
  info: { tone: "accent", label: "Insight", bar: "bg-accent" },
  warning: { tone: "warning", label: "Watch", bar: "bg-warning" },
  critical: { tone: "danger", label: "Critical", bar: "bg-danger" },
};
const SUGGESTIONS = ["How many female employees in Operations?", "Average age in Kabul", "Largest department in Technology", "How many expats?", "Retirement risk in Finance", "Average tenure of Software Engineering"];

function useTypewriter(text: string, run: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 4;
      });
    }, 14);
    return () => clearInterval(id);
  }, [text, run]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

function InsightsInner() {
  const filtered = useDataStore((s) => s.filtered);
  const now = useDataStore((s) => s.now);
  const t = useChartTokens();
  const [run, setRun] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [answers, setAnswers] = useState<QueryAnswer[]>([]);
  const [asking, setAsking] = useState(false);

  const insights = useMemo(() => memo(filtered, "insights", () => generateInsights(filtered, now)), [filtered, now]);
  const summary = useMemo(() => executiveSummary(filtered, now).join("\n\n"), [filtered, now]);
  const { shown, done } = useTypewriter(summary, run);
  const divs = useMemo(() => groupStats(filtered, (e) => e.division, now), [filtered, now]);
  const cats = ["All", ...Array.from(new Set(insights.map((i) => i.category)))];
  const visible = cat === "All" ? insights : insights.filter((i) => i.category === cat);
  const counts = (["critical", "warning", "positive", "info"] as Severity[]).map((s) => [s, insights.filter((i) => i.severity === s).length] as const);

  const regenerate = () => {
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setRun((r) => r + 1);
    }, 700);
  };
  const ask = (question: string) => {
    if (!question.trim()) return;
    setAsking(true);
    setQ("");
    setTimeout(() => {
      setAnswers((a) => [answerQuestion(question, filtered, now), ...a].slice(0, 6));
      setAsking(false);
    }, 450);
  };

  const retireOpt = useMemo(() => barOption(divs.map((d) => ({ name: d.name, value: d.retirementRisk })), t, { colors: ["#FBBF24", "#F97316"], rotate: divs.length > 6 ? 20 : 0 }), [divs, t]);
  const mixOpt = useMemo(
    () => stackedOption(divs.map((d) => d.name), [{ name: "Hired < 12m", data: divs.map((d) => d.hires12m), color: t.accent }, { name: "Established", data: divs.map((d) => d.headcount - d.hires12m), color: t.primary }], t, { horizontal: true, percent: true }),
    [divs, t]
  );

  return (
    <>
      <PageHeader
        eyebrow="AI Insights Engine"
        title="Automated workforce intelligence"
        icon={<Sparkles />}
        subtitle="Narratives, risk signals and answers generated on-device from the current selection"
        actions={
          <Button variant="primary" onClick={regenerate} disabled={thinking}>
            {thinking ? <Spinner /> : <RefreshCw />} Regenerate insights
          </Button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <section className="animate-fade-up relative overflow-hidden rounded-2xl border border-white/15 p-5 text-white shadow-[0_24px_50px_-20px_rgba(6,43,91,0.6)] xl:col-span-2" style={{ background: "linear-gradient(145deg,#041E42 0%,#062B5B 40%,#0D47A1 100%)" }}>
          <div className="animate-orbit pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full border border-dashed border-white/15" />
          <div className="pointer-events-none absolute -top-10 -right-10 h-52 w-52 rounded-full bg-[#00A8FF]/25 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Brain className="h-5 w-5 text-[#7FD4FF]" />
            </span>
            <div>
              <h3 className="text-[15px] font-semibold">Executive narrative summary</h3>
              <p className="text-[11px] text-white/60">ATOMA Workforce Intelligence · rules-based analytics engine · {filtered.length.toLocaleString()} records analysed</p>
            </div>
          </div>
          <div className="relative mt-4 min-h-[180px] text-[13.5px] leading-relaxed whitespace-pre-line text-white/90">
            {thinking ? (
              <span className="inline-flex items-center gap-2 text-white/70">
                <Spinner /> Analysing workforce patterns…
              </span>
            ) : (
              <span className={cn(!done && "caret")}>{shown}</span>
            )}
          </div>
        </section>
        <Card className="animate-fade-up">
          <CardTitle icon={<Lightbulb />} title="Signal overview" subtitle={`${insights.length} insights generated`} />
          <div className="space-y-2">
            {counts.map(([s, n]) => (
              <div key={s} className="flex items-center gap-3">
                <Badge tone={SEV[s].tone} className="w-20 justify-center">
                  {SEV[s].label}
                </Badge>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className={cn("h-full rounded-full transition-[width] duration-700", SEV[s].bar)} style={{ width: `${insights.length ? (n / insights.length) * 100 : 0}%` }} />
                </div>
                <span className="w-6 text-right text-[13px] font-bold text-fg tabular-nums">{n}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-line bg-surface-muted/60 p-3 text-[12px] text-muted">
            Insights recompute instantly when filters change — slice by division, location or demographics to generate targeted narratives.
          </div>
        </Card>
      </div>

      <Card className="animate-fade-up mt-4">
        <CardTitle icon={<MessageSquareText />} title="Ask ATOMA AI" subtitle="Natural-language questions about headcount, age, tenure, hiring, diversity and structure" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Bot className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-accent" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. How many female employees work in Kabul?" className="field h-11 pl-9 text-[13.5px]" />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={asking || !q.trim()}>
            {asking ? <Spinner /> : <Send />} Ask
          </Button>
        </form>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line bg-surface-strong px-3 py-1 text-[11.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg">
              {s}
            </button>
          ))}
        </div>
        {answers.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {answers.map((a, i) => (
              <div key={`${a.question}-${i}`} className="animate-pop rounded-xl border border-line bg-surface-muted/50 p-3.5">
                <p className="text-[11.5px] font-semibold text-muted">“{a.question}”</p>
                <p className="mt-1.5 flex gap-2 text-[13.5px] font-medium text-fg">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {a.answer}
                </p>
                {a.bullets.length > 0 && (
                  <ul className="mt-2 ml-6 list-disc space-y-0.5 text-[12px] text-muted">
                    {a.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {a.matched.length > 0 && (
                  <div className="mt-2 ml-6 flex flex-wrap gap-1">
                    {a.matched.map((m) => (
                      <Badge key={m} tone="primary">
                        {m}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-5 mb-3 flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={cn("rounded-full border px-3 py-1 text-[12px] font-medium transition-colors", cat === c ? "border-accent bg-accent text-white" : "border-line bg-surface-strong text-muted hover:text-fg")}>
            {c}
          </button>
        ))}
      </div>
      <div key={run} className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {visible.map((i, idx) => (
          <article key={i.id} className="glass hover-lift animate-fade-up relative overflow-hidden rounded-2xl p-4" style={{ animationDelay: `${idx * 45}ms` }}>
            <span className={cn("absolute inset-y-0 left-0 w-1", SEV[i.severity].bar)} />
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent [&_svg]:h-[18px] [&_svg]:w-[18px]">{ICONS[i.icon]}</span>
                <div>
                  <p className="text-[10.5px] font-semibold tracking-wider text-subtle uppercase">{i.category}</p>
                  <h4 className="text-[13.5px] font-semibold text-fg">{i.title}</h4>
                </div>
              </div>
              <Badge tone={SEV[i.severity].tone}>{SEV[i.severity].label}</Badge>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-2">
              <p className="truncate text-[17px] font-bold text-fg">{i.headline}</p>
              <span className="text-[12px] font-semibold text-accent">{i.metric}</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{i.narrative}</p>
            {i.action && (
              <p className="mt-3 flex gap-1.5 rounded-lg bg-surface-muted px-2.5 py-2 text-[11.5px] text-fg">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {i.action}
              </p>
            )}
          </article>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Retirement Risk by Division" subtitle="Employees aged 55+" option={retireOpt} height={290} />
        <ChartCard title="Workforce Renewal Mix" subtitle="Share hired in the last 12 months vs established staff" option={mixOpt} height={290} />
      </div>
    </>
  );
}

export default function InsightsView() {
  return (
    <DataGate>
      <InsightsInner />
    </DataGate>
  );
}
