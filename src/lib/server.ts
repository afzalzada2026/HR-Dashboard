import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLogs, datasets } from "@/db/schema";
import { decodeSession, DEFAULT_SESSION, SESSION_COOKIE } from "./rbac";
import type { DatasetMeta, Permission, Role, Session } from "./types";

export class AuthenticationError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

const ROLE_CLAIMS: Record<string, Role> = {
  hr_admin: "hr_admin",
  "atoma.hradmin": "hr_admin",
  hradmin: "hr_admin",
  hr_officer: "hr_officer",
  "atoma.hrofficer": "hr_officer",
  hrofficer: "hr_officer",
  executive: "executive",
  "atoma.executive": "executive",
  division_manager: "division_manager",
  "atoma.divisionmanager": "division_manager",
  divisionmanager: "division_manager",
  viewer: "viewer",
  "atoma.viewer": "viewer",
};

function secureEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function headerText(req: NextRequest, name: string, max = 254): string {
  return (req.headers.get(name) || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

/**
 * Demo mode accepts the browser's role-switching cookie. Production proxy mode never trusts it:
 * an identity-aware proxy must validate the Entra token, strip incoming x-atoma-* headers, then
 * inject identity/app-role headers plus ATOMA_PROXY_SECRET on the private upstream request.
 */
export function getSession(req: NextRequest): Session {
  const mode = (process.env.ATOMA_AUTH_MODE || "demo").toLowerCase();
  if (mode !== "proxy" && mode !== "production") return decodeSession(req.cookies.get(SESSION_COOKIE)?.value) ?? DEFAULT_SESSION;

  const expectedSecret = process.env.ATOMA_PROXY_SECRET || "";
  const providedSecret = headerText(req, "x-atoma-proxy-secret", 500);
  if (expectedSecret.length < 32 || !secureEqual(expectedSecret, providedSecret)) throw new AuthenticationError();

  const userId = headerText(req, "x-atoma-user-id", 160);
  const email = headerText(req, "x-atoma-user-email").toLowerCase();
  const name = headerText(req, "x-atoma-user-name", 180) || email;
  const claims = headerText(req, "x-atoma-user-roles", 1_000)
    .split(/[;,]/)
    .map((claim) => ROLE_CLAIMS[claim.trim().toLowerCase()])
    .filter((role): role is Role => Boolean(role));
  const role = (["hr_admin", "hr_officer", "executive", "division_manager", "viewer"] as Role[]).find((candidate) => claims.includes(candidate));
  if (!userId || !email || !role) throw new AuthenticationError("Authenticated identity has no recognized ATOMA app role.");
  const division = role === "division_manager" ? headerText(req, "x-atoma-user-division", 150) : undefined;
  if (role === "division_manager" && !division) throw new AuthenticationError("Division Manager identity is missing its required division scope.");
  return { userId, email, name, role, ...(division ? { division } : {}) };
}

export function deny(perm: Permission): Response {
  return Response.json({ error: `Access denied — your role lacks the "${perm}" permission.` }, { status: 403 });
}

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export async function writeAudit(
  req: NextRequest,
  session: Session,
  action: string,
  category: string,
  details = "",
  meta?: Record<string, unknown> | null
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action,
      category,
      details,
      userName: session.name,
      userEmail: session.email,
      role: session.role,
      ip: clientIp(req),
      meta: meta ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}

export function toMeta(r: typeof datasets.$inferSelect): DatasetMeta {
  return {
    id: r.id,
    name: r.name,
    fileName: r.fileName,
    fileType: r.fileType,
    fileSize: r.fileSize,
    rowCount: r.rowCount,
    columnCount: r.columnCount,
    mapping: r.mapping ?? {},
    quality: r.quality ?? null,
    source: r.source === "demo" ? "demo" : "upload",
    uploadedBy: r.uploadedBy,
    uploadedRole: r.uploadedRole,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    storage: "server",
  };
}

export function serverError(err: unknown): Response {
  if (err instanceof AuthenticationError) return Response.json({ error: err.message }, { status: 401 });
  console.error("[api] error", err);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
