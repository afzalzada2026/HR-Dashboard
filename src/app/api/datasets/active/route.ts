import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { datasetRecords, datasets } from "@/db/schema";
import { applyRowLevelSecurity } from "@/lib/rbac";
import { getSession, serverError, toMeta } from "@/lib/server";
import type { Employee } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = getSession(req);
    let [row] = await db.select().from(datasets).where(eq(datasets.isActive, true)).orderBy(desc(datasets.createdAt)).limit(1);
    if (!row) [row] = await db.select().from(datasets).orderBy(desc(datasets.createdAt)).limit(1);
    if (!row) return Response.json({ dataset: null, employees: [] });
    const [rec] = await db.select({ employees: datasetRecords.employees }).from(datasetRecords).where(eq(datasetRecords.datasetId, row.id));
    const employees = applyRowLevelSecurity((rec?.employees ?? []) as Employee[], session);
    return Response.json({ dataset: { ...toMeta(row), isActive: true }, employees });
  } catch (err) {
    return serverError(err);
  }
}
