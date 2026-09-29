import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import type { Role, Session } from "./types";
import { ROLE_ORDER } from "./rbac";
import { safeText } from "./validation";

const USERS_KEY = "atoma:local-users:v1";
const SESSION_KEY = "atoma:local-session:v1";
const ATTEMPTS_KEY = "atoma:login-attempts:v1";
const ITERATIONS = 210_000;
const MIN_PASSWORD = 10;

export interface LocalUserAccount {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  division?: string;
  active: boolean;
  salt: string;
  passwordHash: string;
  iterations: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type PublicLocalUser = Omit<LocalUserAccount, "salt" | "passwordHash" | "iterations">;

interface LocalSessionRecord {
  userId: string;
  issuedAt: number;
}

interface LoginAttempts {
  count: number;
  blockedUntil: number;
}

export interface LocalUserInput {
  username: string;
  name: string;
  email?: string;
  role: Role;
  division?: string;
  password: string;
}

function uid(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derivePassword(password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = base64ToBytes(left);
  const b = base64ToBytes(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

function cleanUsername(value: string): string {
  return safeText(value, 80).toLowerCase();
}

function publicUser(user: LocalUserAccount): PublicLocalUser {
  const { salt: _salt, passwordHash: _hash, iterations: _iterations, ...safe } = user;
  void _salt;
  void _hash;
  void _iterations;
  return safe;
}

function toSession(user: LocalUserAccount): Session {
  return { userId: user.id, name: user.name, email: user.email || `${user.username}@local.atoma`, role: user.role, ...(user.division ? { division: user.division } : {}) };
}

async function readUsers(): Promise<LocalUserAccount[]> {
  return (await idbGet<LocalUserAccount[]>(USERS_KEY)) ?? [];
}

async function writeUsers(users: LocalUserAccount[]): Promise<void> {
  await idbSet(USERS_KEY, users);
}

function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) throw new Error("Password must include uppercase, lowercase and a number.");
}

function validateIdentity(input: LocalUserInput): { username: string; name: string; email: string; division?: string } {
  const username = cleanUsername(input.username);
  const name = safeText(input.name, 180);
  const email = safeText(input.email, 254).toLowerCase();
  const division = input.role === "division_manager" ? safeText(input.division, 150) : undefined;
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) throw new Error("Username must be 3–80 characters using letters, numbers, dot, underscore or hyphen.");
  if (!name) throw new Error("Display name is required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address or leave it blank.");
  if (!ROLE_ORDER.includes(input.role)) throw new Error("Invalid role.");
  if (input.role === "division_manager" && !division) throw new Error("Division Managers require a division scope.");
  return { username, name, email, ...(division ? { division } : {}) };
}

export async function localAuthStatus(): Promise<{ initialized: boolean; users: number }> {
  const users = await readUsers();
  return { initialized: users.length > 0, users: users.length };
}

export async function setupLocalAdmin(input: Omit<LocalUserInput, "role" | "division">): Promise<Session> {
  const existing = await readUsers();
  if (existing.length) throw new Error("Local workspace is already initialized.");
  validatePassword(input.password);
  const identity = validateIdentity({ ...input, role: "hr_admin" });
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const now = new Date().toISOString();
  const account: LocalUserAccount = {
    id: uid(), username: identity.username, name: identity.name, email: identity.email, role: "hr_admin", active: true,
    salt: bytesToBase64(salt), passwordHash: await derivePassword(input.password, salt), iterations: ITERATIONS,
    createdAt: now, updatedAt: now, createdBy: "first-run",
  };
  await writeUsers([account]);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: account.id, issuedAt: Date.now() } satisfies LocalSessionRecord));
  return toSession(account);
}

function attempts(): LoginAttempts {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || "null") ?? { count: 0, blockedUntil: 0 };
  } catch {
    return { count: 0, blockedUntil: 0 };
  }
}

export async function authenticateLocal(username: string, password: string): Promise<Session> {
  const state = attempts();
  if (state.blockedUntil > Date.now()) throw new Error(`Too many failed attempts. Try again in ${Math.ceil((state.blockedUntil - Date.now()) / 1000)} seconds.`);
  const users = await readUsers();
  const user = users.find((account) => account.username === cleanUsername(username));
  let valid = false;
  if (user) valid = constantTimeEqual(await derivePassword(password, base64ToBytes(user.salt), user.iterations), user.passwordHash);
  else await derivePassword(password || "invalid", crypto.getRandomValues(new Uint8Array(16)));
  if (!user || !valid || !user.active) {
    const count = state.count + 1;
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count: count >= 5 ? 0 : count, blockedUntil: count >= 5 ? Date.now() + 30_000 : 0 } satisfies LoginAttempts));
    throw new Error(user && !user.active ? "This account is inactive. Contact the local HR Admin." : "Invalid username or password.");
  }
  localStorage.removeItem(ATTEMPTS_KEY);
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, issuedAt: Date.now() } satisfies LocalSessionRecord));
  return toSession(user);
}

export async function getLocalSession(): Promise<Session | null> {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as LocalSessionRecord | null;
    if (!stored?.userId) return null;
    const user = (await readUsers()).find((account) => account.id === stored.userId && account.active);
    if (!user) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return toSession(user);
  } catch {
    return null;
  }
}

export function signOutLocal(): void {
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(SESSION_KEY);
}

export async function listLocalUsers(): Promise<PublicLocalUser[]> {
  return (await readUsers()).map(publicUser).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createLocalUser(input: LocalUserInput, actor: Session): Promise<PublicLocalUser> {
  if (actor.role !== "hr_admin") throw new Error("Only HR Admin can create users.");
  validatePassword(input.password);
  const identity = validateIdentity(input);
  const users = await readUsers();
  if (users.some((user) => user.username === identity.username)) throw new Error("That username already exists.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const now = new Date().toISOString();
  const account: LocalUserAccount = {
    id: uid(), username: identity.username, name: identity.name, email: identity.email, role: input.role, ...(identity.division ? { division: identity.division } : {}), active: true,
    salt: bytesToBase64(salt), passwordHash: await derivePassword(input.password, salt), iterations: ITERATIONS,
    createdAt: now, updatedAt: now, createdBy: actor.name,
  };
  await writeUsers([...users, account]);
  return publicUser(account);
}

export async function updateLocalUser(id: string, patch: Partial<Pick<LocalUserInput, "name" | "email" | "role" | "division">> & { active?: boolean }, actor: Session): Promise<PublicLocalUser> {
  if (actor.role !== "hr_admin") throw new Error("Only HR Admin can update users.");
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) throw new Error("User not found.");
  const current = users[index];
  if (current.id === actor.userId && (patch.active === false || (patch.role && patch.role !== "hr_admin"))) throw new Error("You cannot deactivate or remove your own HR Admin role.");
  const candidate: LocalUserInput = {
    username: current.username,
    name: patch.name ?? current.name,
    email: patch.email ?? current.email,
    role: patch.role ?? current.role,
    division: patch.division ?? current.division,
    password: "Placeholder1",
  };
  const identity = validateIdentity(candidate);
  const updated: LocalUserAccount = {
    ...current, name: identity.name, email: identity.email, role: candidate.role,
    ...(identity.division ? { division: identity.division } : { division: undefined }),
    ...(typeof patch.active === "boolean" ? { active: patch.active } : {}), updatedAt: new Date().toISOString(),
  };
  const next = [...users];
  next[index] = updated;
  if (!next.some((user) => user.active && user.role === "hr_admin")) throw new Error("At least one active HR Admin is required.");
  await writeUsers(next);
  return publicUser(updated);
}

export async function resetLocalPassword(id: string, password: string, actor: Session): Promise<void> {
  if (actor.role !== "hr_admin" && actor.userId !== id) throw new Error("You cannot reset this password.");
  validatePassword(password);
  const users = await readUsers();
  const index = users.findIndex((user) => user.id === id);
  if (index < 0) throw new Error("User not found.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  users[index] = { ...users[index], salt: bytesToBase64(salt), passwordHash: await derivePassword(password, salt), iterations: ITERATIONS, updatedAt: new Date().toISOString() };
  await writeUsers(users);
}

export async function deleteLocalUser(id: string, actor: Session): Promise<void> {
  if (actor.role !== "hr_admin") throw new Error("Only HR Admin can delete users.");
  if (id === actor.userId) throw new Error("You cannot delete your own account.");
  const users = await readUsers();
  const next = users.filter((user) => user.id !== id);
  if (next.length === users.length) throw new Error("User not found.");
  if (!next.some((user) => user.active && user.role === "hr_admin")) throw new Error("At least one active HR Admin is required.");
  await writeUsers(next);
}

/** Deletes credentials/session only. Workforce data remains untouched unless separately cleared. */
export async function resetLocalAuthentication(): Promise<void> {
  await idbDel(USERS_KEY);
  signOutLocal();
}
