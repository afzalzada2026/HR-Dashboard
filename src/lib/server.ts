import type { NextRequest } from "next/server";
import { db } from "@/db";
import { auditLogs, datasets } from "@/db/schema";
import { decodeSession, DEFAULT_SESSION, SESSION_COOKIE } from "./rbac";
import type { DatasetMeta, Permission, Session } from "./types";

export function getSession(req: NextRequest): Session {
  return decodeSession(req.cookies.get(SESSION_COOKIE)?.value) ?? DEFAULT_SESSION;
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
  console.error("[api] error", err);
  return Response.json({ error: err instanceof Error ? err.message : "Unexpected server error" }, { status: 500 });
}
