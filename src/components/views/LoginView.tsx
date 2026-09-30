"use client";

import { BarChart3, Eye, EyeOff, HardDrive, LockKeyhole, MapPinned, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { authenticateLocal, getLocalSession, localAuthStatus, setupLocalAdmin } from "@/lib/local-auth";
import { logAudit } from "@/lib/storage";
import { hydrateUI, useUIStore } from "@/store/ui";
import { Logo, LogoMark } from "../shell/Logo";
import { Button, Spinner } from "../ui/primitives";

interface SetupForm {
  name: string;
  username: string;
  email: string;
  password: string;
  confirm: string;
}

export default function LoginView() {
  const router = useRouter();
  const hydrated = useUIStore((state) => state.hydrated);
  const theme = useUIStore((state) => state.theme);
  const [mode, setMode] = useState<"loading" | "setup" | "login">("loading");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<SetupForm>({ name: "", username: "", email: "", password: "", confirm: "" });

  useEffect(() => hydrateUI(), []);
  useEffect(() => {
    if (hydrated) document.documentElement.setAttribute("data-theme", theme);
  }, [hydrated, theme]);
  useEffect(() => {
    Promise.all([localAuthStatus(), getLocalSession()]).then(([status, session]) => {
      if (session) {
        useUIStore.getState().setSession(session);
        router.replace("/");
        return;
      }
      setMode(status.initialized ? "login" : "setup");
    });
  }, [router]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await authenticateLocal(username, password);
      useUIStore.getState().setSession(session);
      useUIStore.getState().setStorageMode("local");
      logAudit("auth.signed_in", "security", `${session.name} signed in to the local workspace`);
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  const createAdmin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (setup.password !== setup.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const session = await setupLocalAdmin({ name: setup.name, username: setup.username, email: setup.email, password: setup.password });
      useUIStore.getState().setSession(session);
      useUIStore.getState().setStorageMode("local");
      logAudit("auth.workspace_initialized", "security", `${session.name} created the first local HR Admin account`);
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to initialize the workspace.");
    } finally {
      setBusy(false);
    }
  };

  const passwordType = showPassword ? "text" : "password";
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex" style={{ background: "linear-gradient(150deg,#041E42 0%,#062B5B 45%,#0D47A1 100%)" }}>
        <div className="animate-orbit pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full border border-dashed border-white/10" />
        <div className="pointer-events-none absolute top-1/3 -right-20 h-80 w-80 rounded-full bg-[#00A8FF]/25 blur-3xl" />
        <Logo />
        <div className="relative max-w-xl">
          <p className="text-[12px] font-semibold tracking-[0.2em] text-[#7FD4FF] uppercase">Private browser workspace</p>
          <h1 className="mt-3 text-4xl leading-tight font-bold">Your workforce file stays on this device.</h1>
          <p className="mt-4 text-[15px] text-white/75">Excel/CSV parsing, dashboards, Afghanistan mapping, users, permissions and exports run locally in the browser. No employee row is uploaded.</p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {[
              [<HardDrive key="a" />, "IndexedDB local storage"],
              [<LockKeyhole key="b" />, "Password-protected profiles"],
              [<MapPinned key="c" />, "34-province workforce map"],
              [<BarChart3 key="d" />, "Executive analytics & exports"],
            ].map(([icon, label]) => (
              <div key={String(label)} className="flex items-center gap-2.5 rounded-xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-[#7FD4FF]">
                {icon}<span className="text-[13px] font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[11px] text-white/45">ATOMA · Local HR Workforce Intelligence · Protect this device and browser profile</p>
      </div>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <div className="glass-strong animate-pop w-full max-w-md rounded-3xl p-7 sm:p-9">
          <div className="mb-6 flex items-center gap-3 lg:hidden"><LogoMark /><span className="text-lg font-extrabold tracking-[0.2em] text-fg">ATOMA</span></div>
          {mode === "loading" && <div className="flex min-h-72 flex-col items-center justify-center gap-3"><Spinner className="h-8 w-8 text-accent" /><p className="text-sm text-muted">Opening local workspace…</p></div>}

          {mode === "setup" && (
            <>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br from-brand-700 to-brand-400 text-white"><UserPlus className="h-6 w-6" /></div>
              <h2 className="mt-4 text-2xl font-bold text-fg">Create the first HR Admin</h2>
              <p className="mt-1 text-sm text-muted">This one-time setup creates the administrator who can add other local users and assign their rights.</p>
              <form onSubmit={createAdmin} className="mt-6 space-y-3">
                <div><label className="text-[11px] font-semibold text-muted uppercase">Full name</label><input className="field mt-1" value={setup.name} onChange={(event) => setSetup({ ...setup, name: event.target.value })} autoComplete="name" required /></div>
                <div><label className="text-[11px] font-semibold text-muted uppercase">Username</label><input className="field mt-1" value={setup.username} onChange={(event) => setSetup({ ...setup, username: event.target.value })} autoComplete="username" required /></div>
                <div><label className="text-[11px] font-semibold text-muted uppercase">Email (optional)</label><input type="email" className="field mt-1" value={setup.email} onChange={(event) => setSetup({ ...setup, email: event.target.value })} autoComplete="email" /></div>
                <div className="relative"><label className="text-[11px] font-semibold text-muted uppercase">Password</label><input type={passwordType} className="field mt-1 pr-10" value={setup.password} onChange={(event) => setSetup({ ...setup, password: event.target.value })} autoComplete="new-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 bottom-2.5 text-muted" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                <div><label className="text-[11px] font-semibold text-muted uppercase">Confirm password</label><input type={passwordType} className="field mt-1" value={setup.confirm} onChange={(event) => setSetup({ ...setup, confirm: event.target.value })} autoComplete="new-password" required /></div>
                <p className="text-[11px] text-subtle">At least 10 characters, including uppercase, lowercase and a number.</p>
                {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{error}</p>}
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>{busy ? <Spinner /> : <ShieldCheck />} Initialize secure workspace</Button>
              </form>
            </>
          )}

          {mode === "login" && (
            <>
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-linear-to-br from-brand-700 to-brand-400 text-white"><LockKeyhole className="h-6 w-6" /></div>
              <h2 className="mt-4 text-2xl font-bold text-fg">Sign in to ATOMA</h2>
              <p className="mt-1 text-sm text-muted">Use the local username and password assigned by your HR Admin.</p>
              <form onSubmit={login} className="mt-6 space-y-4">
                <div><label className="text-[11px] font-semibold text-muted uppercase">Username</label><input className="field mt-1 h-11" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoFocus required /></div>
                <div className="relative"><label className="text-[11px] font-semibold text-muted uppercase">Password</label><input type={passwordType} className="field mt-1 h-11 pr-10" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 bottom-3 text-muted" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{error}</p>}
                <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>{busy ? <Spinner /> : <LockKeyhole />} Sign in</Button>
              </form>
              <div className="mt-5 rounded-xl bg-surface-muted p-3 text-[11.5px] text-muted"><Sparkles className="mr-1 inline h-3.5 w-3.5 text-accent" />Credentials are salted and hashed with PBKDF2-SHA256. The active login lasts for this browser tab/session.</div>
            </>
          )}
          <p className="mt-6 inline-flex items-center gap-1.5 text-[11px] text-subtle">
            Made with
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-label="love"><path fill="#E11D48" d="M12 21s-7.2-4.5-9.4-8.6C.7 8.9 2.4 4.8 6.2 4.1c2.2-.4 4.3.6 5.8 2.4 1.5-1.8 3.6-2.8 5.8-2.4 3.8.7 5.5 4.8 3.6 8.3C19.2 16.5 12 21 12 21z" /></svg>
            by <span className="font-semibold text-fg">Mohibullah Afzalzada</span>
          </p>
        </div>
      </div>
    </div>
  );
}
