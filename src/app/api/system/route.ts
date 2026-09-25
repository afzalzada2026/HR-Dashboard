import type { NextRequest } from "next/server";
import { count, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { auditLogs, datasets, scheduledReports } from "@/db/schema";
import { can } from "@/lib/rbac";
import { deny, getSession, serverError } from "@/lib/server";

export const dynamic = "force-dynamic";

const mask = (value?: string) => (value ? `${value.slice(0, 4)}••••${value.slice(-4)}` : null);

export async function GET(req: NextRequest) {
  try {
    const session = getSession(req);
    if (!can(session.role, "view_audit")) return deny("view_audit");
    const azure = {
      configured: Boolean(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_TENANT_ID),
      tenantId: mask(process.env.AZURE_AD_TENANT_ID),
      clientId: mask(process.env.AZURE_AD_CLIENT_ID),
      authMode: process.env.ATOMA_AUTH_MODE || "demo",
    };
    await ensureSchema();
    await db.execute(sql`select 1`);
    const [[datasetCount], [auditCount], [reportCount]] = await Promise.all([
      db.select({ n: count() }).from(datasets),
      db.select({ n: count() }).from(auditLogs),
      db.select({ n: count() }).from(scheduledReports),
    ]);
    return Response.json({
      database: "connected",
      azure,
      counts: { datasets: Number(datasetCount.n), auditLogs: Number(auditCount.n), reports: Number(reportCount.n) },
      time: new Date().toISOString(),
    });
  } catch (error) {
    return serverError(error);
  }
}
