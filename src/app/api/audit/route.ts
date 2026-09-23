import type { NextRequest } from "next/server";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { auditLogs } from "@/db/schema";
import { can } from "@/lib/rbac";
import { deny, getSession, serverError, writeAudit } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = getSession(req);
    if (!can(session.role, "view_audit")) return deny("view_audit");
    const sp = req.nextUrl.searchParams;
    const category = sp.get("category") || "";
    const q = (sp.get("q") || "").trim();
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));
    const offset = Math.max(0, Number(sp.get("offset")) || 0);
    const conds: SQL[] = [];
    if (category) conds.push(eq(auditLogs.category, category));
    if (q) {
      const like = `%${q}%`;
      const c = or(ilike(auditLogs.action, like), ilike(auditLogs.details, like), ilike(auditLogs.userName, like), ilike(auditLogs.role, like));
      if (c) conds.push(c);
    }
    const where = conds.length ? and(...conds) : undefined;
    const [rows, totalRes, cats] = await Promise.all([
      db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(limit).offset(offset),
      db.select({ n: count() }).from(auditLogs).where(where),
      db.selectDistinct({ category: auditLogs.category }).from(auditLogs),
    ]);
    return Response.json({
      logs: rows.map((r) => ({ id: r.id, action: r.action, category: r.category, details: r.details, userName: r.userName, userEmail: r.userEmail, role: r.role, ip: r.ip, createdAt: r.createdAt.toISOString() })),
      total: Number(totalRes[0]?.n ?? 0),
      categories: cats.map((c) => c.category).sort(),
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = getSession(req);
    const body = (await req.json().catch(() => ({}))) as { action?: string; category?: string; details?: string; meta?: Record<string, unknown> };
    const action = String(body.action || "").slice(0, 120);
    if (!action) return Response.json({ error: "action is required" }, { status: 400 });
    await writeAudit(req, session, action, String(body.category || "general").slice(0, 40), String(body.details || "").slice(0, 1000), body.meta ?? null);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
