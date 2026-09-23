"use client";

import { ArrowLeft, BarChart3, Globe2, HardDrive, Lock, MapPinned, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_USERS, ROLES } from "@/lib/rbac";
import { logAudit } from "@/lib/storage";
import type { Session } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { hydrateUI, useUIStore } from "@/store/ui";
import { Logo, LogoMark } from "../shell/Logo";
import { Avatar, Button, Spinner } from "../ui/primitives";

const DEFAULT_DIVISIONS = ["Operations", "Commercial", "Technology", "Corporate Services", "Finance", "Human Resources", "Executive Office"];

function MicrosoftLogo() {
  return (
    <svg viewBox="0 0 23 23" className="h-5 w-5" aria-hidden>
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

export default function LoginView() {
  const router = useRouter();
  const hydrated = useUIStore((s) => s.hydrated);
  const theme = useUIStore((s) => s.theme);
  const known = useDataStore((s) => s.divisions);
  const [step, setStep] = useState<"start" | "pick" | "signing">("start");
  const divisions = known.length ? known : DEFAULT_DIVISIONS;
  const [division, setDivision] = useState(divisions[0]);

  useEffect(() => {
    hydrateUI();
  }, []);
  useEffect(() => {
    if (hydrated) document.documentElement.setAttribute("data-theme", theme);
  }, [hydrated, theme]);

  const signIn = (u: Session, local = false) => {
    setStep("signing");
    const ui = useUIStore.getState();
    const session: Session = u.role === "division_manager" ? { ...u, division } : u;
    ui.setSession(session);
    if (local) ui.setStorageMode("local");
    logAudit("auth.signed_in", "security", `${session.name} signed in via ${local ? "local mode" : "Azure AD SSO (demo tenant)"} as ${ROLES[session.role].label}`);
    // The dashboard shell re-bootstraps on mount, applying the new role's row-level security.
    setTimeout(() => router.push("/"), 600);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex" style={{ background: "linear-gradient(150deg,#041E42 0%,#062B5B 45%,#0D47A1 100%)" }}>
        <div className="animate-orbit pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full border border-dashed border-white/10" />
        <div className="pointer-events-none absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-[#00A8FF]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <Logo />
        <div className="relative max-w-xl">
          <p className="text-[12px] font-semibold tracking-[0.2em] text-[#7FD4FF] uppercase">HR Workforce Analytics & Intelligence</p>
          <h1 className="mt-3 text-4xl leading-tight font-bold">Every employee, every province, every insight — in one executive portal.</h1>
          <p className="mt-4 text-[15px] text-white/75">Power BI-grade dashboards, an interactive Afghanistan workforce map, AI-generated narratives and board-ready exports for ATOMA leadership.</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              [<BarChart3 key="a" />, "20 KPIs & 18+ visuals"],
              [<MapPinned key="b" />, "34-province heat map"],
              [<Sparkles key="c" />, "AI insights engine"],
              [<ShieldCheck key="d" />, "RBAC & audit logs"],
            ].map(([icon, label]) => (
              <div key={String(label)} className="flex items-center gap-2.5 rounded-xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-[#7FD4FF]">
                {icon}
                <span className="text-[13px] font-medium">{label}</span>
              </div>
            ))}
          </div>
          <div className="animate-float mt-8 flex gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[10px] tracking-wider text-white/60 uppercase">Total employees</p>
              <p className="text-2xl font-bold">1,250</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[10px] tracking-wider text-white/60 uppercase">Provinces</p>
              <p className="text-2xl font-bold">34</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[10px] tracking-wider text-white/60 uppercase">Female share</p>
              <p className="text-2xl font-bold text-pink-200">22.7%</p>
            </div>
          </div>
        </div>
        <p className="relative text-[11px] text-white/45">© ATOMA · Confidential · Enterprise HR Analytics Platform</p>
      </div>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="glass-strong animate-pop w-full max-w-md rounded-3xl p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <span className="text-lg font-extrabold tracking-[0.2em] text-fg">ATOMA</span>
          </div>
          <h2 className="text-2xl font-bold text-fg">Sign in</h2>
          <p className="mt-1 text-sm text-muted">Use your ATOMA Microsoft work account to continue.</p>

          {step === "start" && (
            <div className="mt-7 space-y-3">
              <button type="button" onClick={() => setStep("pick")} className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface-solid text-[14px] font-semibold text-fg shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <MicrosoftLogo /> Sign in with Microsoft
              </button>
              <div className="flex items-center gap-3 py-1 text-[11px] text-subtle">
                <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
              </div>
              <Button size="lg" className="w-full" onClick={() => signIn(DEMO_USERS[0], true)}>
                <HardDrive /> Continue in local mode (no server)
              </Button>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10.5px] text-muted">
                <div className="rounded-lg bg-surface-muted p-2">
                  <Lock className="mx-auto mb-1 h-4 w-4 text-accent" />
                  SSO & MFA
                </div>
                <div className="rounded-lg bg-surface-muted p-2">
                  <Users className="mx-auto mb-1 h-4 w-4 text-accent" />5 roles
                </div>
                <div className="rounded-lg bg-surface-muted p-2">
                  <Globe2 className="mx-auto mb-1 h-4 w-4 text-accent" />
                  Audit trail
                </div>
              </div>
            </div>
          )}

          {step === "pick" && (
            <div className="mt-6">
              <button type="button" onClick={() => setStep("start")} className="mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-muted hover:text-fg">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
              <p className="mb-2 text-[12px] font-semibold text-muted">Pick an account · atoma.af demo tenant</p>
              <div className="space-y-2">
                {DEMO_USERS.map((u) => (
                  <div key={u.userId} className="rounded-xl border border-line transition-colors hover:border-accent/50">
                    <button type="button" onClick={() => signIn(u)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
                      <Avatar name={u.name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-fg">{u.name}</span>
                        <span className="block truncate text-[11.5px] text-muted">{u.email}</span>
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: ROLES[u.role].color }}>
                        {ROLES[u.role].label}
                      </span>
                    </button>
                    {u.role === "division_manager" && (
                      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                        <span className="text-[11px] text-muted">Division scope</span>
                        <select className="field h-8 flex-1 text-xs" value={division} onChange={(e) => setDivision(e.target.value)}>
                          {divisions.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "signing" && (
            <div className="mt-10 flex flex-col items-center gap-3 py-8">
              <Spinner className="h-8 w-8 text-accent" />
              <p className="text-sm font-medium text-fg">Signing you in…</p>
              <p className="text-xs text-muted">Applying role permissions and data scope</p>
            </div>
          )}

          <p className="mt-8 text-[11px] leading-relaxed text-subtle">Azure AD / Microsoft Entra ID sign-in runs against a demo tenant in this environment. Configure AZURE_AD_TENANT_ID and AZURE_AD_CLIENT_ID for production SSO.</p>
        </div>
      </div>
    </div>
  );
}
