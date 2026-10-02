"use client";

import { KeyRound, Plus, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { appendLocalAudit } from "@/lib/storage";
import { createLocalUser, deleteLocalUser, listLocalUsers, resetLocalPassword, updateLocalUser, type PublicLocalUser } from "@/lib/local-auth";
import { ROLE_ORDER, ROLES } from "@/lib/rbac";
import type { Role } from "@/lib/types";
import { useDataStore } from "@/store/data";
import { useUIStore } from "@/store/ui";
import { Avatar, Badge, Button, Card, CardTitle, EmptyState, Modal, Spinner, Switch } from "../ui/primitives";

type Dialog = { type: "create" } | { type: "edit"; user: PublicLocalUser } | { type: "password"; user: PublicLocalUser } | null;

interface UserForm {
  username: string;
  name: string;
  email: string;
  role: Role;
  division: string;
  password: string;
  confirm: string;
}

const EMPTY: UserForm = { username: "", name: "", email: "", role: "viewer", division: "", password: "", confirm: "" };

export function UserManagement() {
  const session = useUIStore((state) => state.session);
  const notify = useUIStore((state) => state.notify);
  const divisions = useDataStore((state) => state.divisions);
  const [users, setUsers] = useState<PublicLocalUser[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState<UserForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allowed = session.role === "hr_admin";
  const visibleUsers = allowed ? users : users?.filter((user) => user.id === session.userId) ?? null;

  const load = useCallback(() => listLocalUsers().then(setUsers).catch(() => setUsers([])), []);
  useEffect(() => void load(), [load]);

  const openCreate = () => {
    setForm({ ...EMPTY, division: divisions[0] ?? "" });
    setError("");
    setDialog({ type: "create" });
  };
  const openEdit = (user: PublicLocalUser) => {
    setForm({ username: user.username, name: user.name, email: user.email, role: user.role, division: user.division ?? divisions[0] ?? "", password: "", confirm: "" });
    setError("");
    setDialog({ type: "edit", user });
  };
  const openPassword = (user: PublicLocalUser) => {
    setForm({ ...EMPTY, password: "", confirm: "" });
    setError("");
    setDialog({ type: "password", user });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!dialog) return;
    if ((dialog.type === "create" || dialog.type === "password") && form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (dialog.type === "create") {
        const created = await createLocalUser(form, session);
        await appendLocalAudit("user.created", "security", `${created.username} · ${ROLES[created.role].label}`);
        notify("success", "User created", `${created.name} can now sign in locally.`);
      } else if (dialog.type === "edit") {
        const updated = await updateLocalUser(dialog.user.id, { name: form.name, email: form.email, role: form.role, division: form.division }, session);
        await appendLocalAudit("user.updated", "security", `${updated.username} · ${ROLES[updated.role].label}`);
        notify("success", "Access updated", updated.name);
      } else {
        await resetLocalPassword(dialog.user.id, form.password, session);
        await appendLocalAudit("user.password_reset", "security", dialog.user.username);
        notify("success", "Password reset", `A new local password was set for ${dialog.user.name}.`);
      }
      setDialog(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save user.");
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (user: PublicLocalUser, active: boolean) => {
    try {
      await updateLocalUser(user.id, { active }, session);
      await appendLocalAudit(active ? "user.activated" : "user.deactivated", "security", user.username);
      await load();
    } catch (cause) {
      notify("error", "Access update failed", cause instanceof Error ? cause.message : undefined);
    }
  };

  const remove = async (user: PublicLocalUser) => {
    if (!window.confirm(`Delete local user “${user.name}”?`)) return;
    try {
      await deleteLocalUser(user.id, session);
      await appendLocalAudit("user.deleted", "security", user.username);
      notify("info", "User deleted", user.name);
      await load();
    } catch (cause) {
      notify("error", "Delete failed", cause instanceof Error ? cause.message : undefined);
    }
  };

  return (
    <Card className="animate-fade-up">
      <CardTitle
        icon={<Users />}
        title={allowed ? "Local users & access" : "My local account"}
        subtitle={allowed ? "Credentials and role assignments are stored only in this browser" : "You can review your assigned rights and change your password"}
        actions={allowed ? <Button size="sm" variant="primary" onClick={openCreate}><Plus /> Add user</Button> : undefined}
      />
      {!visibleUsers ? <Spinner /> : visibleUsers.length === 0 ? <EmptyState icon={<Users />} title="No local user account found" /> : (
        <div className="space-y-2">
          {visibleUsers.map((user) => (
            <div key={user.id} className="flex flex-col gap-2 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
              <Avatar name={user.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-fg">{user.name}{user.id === session.userId && <Badge tone="success">You</Badge>}{!user.active && <Badge tone="danger">Inactive</Badge>}</p>
                <p className="truncate text-[11.5px] text-muted">@{user.username}{user.email ? ` · ${user.email}` : ""}{user.division ? ` · ${user.division}` : ""}</p>
              </div>
              <Badge tone="primary"><ShieldCheck className="h-3 w-3" /> {ROLES[user.role].label}</Badge>
              {allowed ? (
                <div className="flex items-center gap-1.5">
                  <Switch checked={user.active} onChange={(value) => setActive(user, value)} label={`Activate ${user.name}`} disabled={user.id === session.userId} />
                  <Button size="xs" onClick={() => openEdit(user)}><UserCog /> Rights</Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => openPassword(user)} aria-label={`Reset password for ${user.name}`}><KeyRound /></Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => remove(user)} disabled={user.id === session.userId} aria-label={`Delete ${user.name}`} className="hover:text-danger"><Trash2 /></Button>
                </div>
              ) : user.id === session.userId ? (
                <Button size="sm" onClick={() => openPassword(user)}><KeyRound /> Change password</Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!dialog}
        onClose={() => !busy && setDialog(null)}
        title={dialog?.type === "create" ? "Create local user" : dialog?.type === "edit" ? `Assign rights · ${dialog.user.name}` : dialog?.type === "password" ? `Reset password · ${dialog.user.name}` : "User"}
        subtitle="Local credentials never leave this browser"
        size="sm"
        footer={<><Button onClick={() => setDialog(null)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={() => (document.getElementById("local-user-form") as HTMLFormElement | null)?.requestSubmit()} disabled={busy}>{busy ? <Spinner /> : <ShieldCheck />} Save</Button></>}
      >
        <form id="local-user-form" onSubmit={save} className="space-y-3">
          {dialog?.type === "create" && <div><label className="text-[11px] font-semibold text-muted uppercase">Username</label><input className="field mt-1" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} autoComplete="off" required /></div>}
          {dialog?.type !== "password" && (
            <>
              <div><label className="text-[11px] font-semibold text-muted uppercase">Full name</label><input className="field mt-1" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
              <div><label className="text-[11px] font-semibold text-muted uppercase">Email (optional)</label><input type="email" className="field mt-1" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
              <div><label className="text-[11px] font-semibold text-muted uppercase">Role</label><select className="field mt-1" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })} disabled={dialog?.type === "edit" && dialog.user.id === session.userId}>{ROLE_ORDER.map((role) => <option key={role} value={role}>{ROLES[role].label}</option>)}</select></div>
              {form.role === "division_manager" && <div><label className="text-[11px] font-semibold text-muted uppercase">Division scope</label>{divisions.length ? <select className="field mt-1" value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} required><option value="">Select division</option>{divisions.map((division) => <option key={division} value={division}>{division}</option>)}</select> : <input className="field mt-1" value={form.division} onChange={(event) => setForm({ ...form, division: event.target.value })} placeholder="Enter exact division name" required />}</div>}
            </>
          )}
          {(dialog?.type === "create" || dialog?.type === "password") && <><div><label className="text-[11px] font-semibold text-muted uppercase">New password</label><input type="password" className="field mt-1" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" required /></div><div><label className="text-[11px] font-semibold text-muted uppercase">Confirm password</label><input type="password" className="field mt-1" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} autoComplete="new-password" required /></div><p className="text-[11px] text-subtle">At least 10 characters with uppercase, lowercase and a number.</p></>}
          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/8 px-3 py-2 text-[12px] text-danger">{error}</p>}
        </form>
      </Modal>
    </Card>
  );
}
