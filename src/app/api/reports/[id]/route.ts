import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { scheduledReports } from "@/db/schema";
import { localOnlyApiDisabled } from "@/lib/mode";
import { can } from "@/lib/rbac";
import { computeNextRun, type Frequency } from "@/lib/schedule";
import { deny, getSession, serverError, writeAudit } from "@/lib/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function serialize(r: typeof scheduledReports.$inferSelect) {
  return { ...r, lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null, nextRunAt: r.nextRunAt ? r.nextRunAt.toISOString() : null, createdAt: r.createdAt.toISOString() };
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const disabled = localOnlyApiDisabled();
  if (disabled) return disabled;
  try {
    await ensureSchema();
    const session = getSession(req);
    if (!can(session.role, "manage_reports")) return deny("manage_reports");
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
    const body = (await req.json().catch(() => ({}))) as { isActive?: boolean; run?: boolean };
    const [row] = await db.select().from(scheduledReports).where(eq(scheduledReports.id, id));
    if (!row) return Response.json({ error: "Report not found" }, { status: 404 });
    const patch: Partial<typeof scheduledReports.$inferInsert> = {};
    if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
    if (body.run) {
      patch.lastRunAt = new Date();
      patch.runCount = row.runCount + 1;
    }
    patch.nextRunAt = computeNextRun(row.frequency as Frequency, row.timeOfDay, row.dayOfWeek, row.dayOfMonth);
    const [updated] = await db.update(scheduledReports).set(patch).where(eq(scheduledReports.id, id)).returning();
    await writeAudit(req, session, body.run ? "report.executed" : body.isActive ? "report.enabled" : "report.paused", "reports", row.name);
    return Response.json({ report: serialize(updated) });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const disabled = localOnlyApiDisabled();
  if (disabled) return disabled;
  try {
    await ensureSchema();
    const session = getSession(req);
    if (!can(session.role, "manage_reports")) return deny("manage_reports");
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid id" }, { status: 400 });
    const [row] = await db.delete(scheduledReports).where(eq(scheduledReports.id, id)).returning();
    if (!row) return Response.json({ error: "Report not found" }, { status: 404 });
    await writeAudit(req, session, "report.deleted", "reports", row.name);
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
