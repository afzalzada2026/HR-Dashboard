import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { scheduledReports } from "@/db/schema";
import { can } from "@/lib/rbac";
import { computeNextRun, type Frequency } from "@/lib/schedule";
import { deny, getSession, serverError, writeAudit } from "@/lib/server";

export const dynamic = "force-dynamic";

const FREQS: Frequency[] = ["daily", "weekly", "monthly"];
const FORMATS = ["pdf", "xlsx", "csv", "png"];

function serializeReport(r: typeof scheduledReports.$inferSelect) {
  return {
    ...r,
    lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
    nextRunAt: r.nextRunAt ? r.nextRunAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET() {
  try {
    await ensureSchema();
    const rows = await db.select().from(scheduledReports).orderBy(desc(scheduledReports.createdAt));
    return Response.json({ reports: rows.map(serializeReport) });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = getSession(req);
    if (!can(session.role, "manage_reports")) return deny("manage_reports");
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = String(b.name || "").trim().slice(0, 150);
    const frequency = FREQS.includes(b.frequency as Frequency) ? (b.frequency as Frequency) : null;
    const format = FORMATS.includes(String(b.format)) ? String(b.format) : null;
    if (!name || !frequency || !format) return Response.json({ error: "Name, frequency and format are required." }, { status: 400 });
    const timeOfDay = /^\d{2}:\d{2}$/.test(String(b.timeOfDay)) ? String(b.timeOfDay) : "08:00";
    const dayOfWeek = Math.min(6, Math.max(0, Number(b.dayOfWeek) || 0));
    const dayOfMonth = Math.min(28, Math.max(1, Number(b.dayOfMonth) || 1));
    const sections = Array.isArray(b.sections) ? b.sections.map(String).slice(0, 20) : [];
    const [row] = await db
      .insert(scheduledReports)
      .values({
        name,
        frequency,
        format,
        recipients: String(b.recipients || "").slice(0, 1000),
        sections,
        timeOfDay,
        dayOfWeek,
        dayOfMonth,
        isActive: true,
        nextRunAt: computeNextRun(frequency, timeOfDay, dayOfWeek, dayOfMonth),
        createdBy: session.name,
      })
      .returning();
    await writeAudit(req, session, "report.scheduled", "reports", `${name} · ${frequency} · ${format.toUpperCase()}`);
    return Response.json({ report: serializeReport(row) }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
