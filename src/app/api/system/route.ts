import { count, sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { auditLogs, datasets, scheduledReports } from "@/db/schema";

export const dynamic = "force-dynamic";

const mask = (v?: string) => (v ? `${v.slice(0, 4)}••••${v.slice(-4)}` : null);

export async function GET() {
  const azure = {
    configured: Boolean(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_TENANT_ID),
    tenantId: mask(process.env.AZURE_AD_TENANT_ID),
    clientId: mask(process.env.AZURE_AD_CLIENT_ID),
  };
  try {
    await ensureSchema();
    await db.execute(sql`select 1`);
    const [[d], [a], [r]] = await Promise.all([
      db.select({ n: count() }).from(datasets),
      db.select({ n: count() }).from(auditLogs),
      db.select({ n: count() }).from(scheduledReports),
    ]);
    return Response.json({ database: "connected", azure, counts: { datasets: Number(d.n), auditLogs: Number(a.n), reports: Number(r.n) }, time: new Date().toISOString() });
  } catch {
    return Response.json({ database: "unavailable", azure, counts: null, time: new Date().toISOString() });
  }
}
