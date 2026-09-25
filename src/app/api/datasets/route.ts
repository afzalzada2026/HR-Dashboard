import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { datasetRecords, datasets } from "@/db/schema";
import { can } from "@/lib/rbac";
import { deny, getSession, serverError, toMeta, writeAudit } from "@/lib/server";
import { sanitizeDatasetPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session = getSession(req);
    if (!can(session.role, "view_dashboard")) return deny("view_dashboard");
    const rows = await db.select().from(datasets).orderBy(desc(datasets.createdAt)).limit(50);
    return Response.json({ datasets: rows.map(toMeta) });
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const session = getSession(req);
    if (!can(session.role, "upload_data")) return deny("upload_data");
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 120_000_000) return Response.json({ error: "Dataset request exceeds the 120 MB limit." }, { status: 413 });
    let payload;
    try {
      payload = sanitizeDatasetPayload(await req.json());
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Invalid dataset payload." }, { status: 400 });
    }
    const created = await db.transaction(async (tx) => {
      await tx.update(datasets).set({ isActive: false }).where(eq(datasets.isActive, true));
      const [row] = await tx
        .insert(datasets)
        .values({
          name: payload.name,
          fileName: payload.fileName,
          fileType: payload.fileType,
          fileSize: payload.fileSize,
          rowCount: payload.employees.length,
          columnCount: payload.columnCount,
          mapping: payload.mapping,
          quality: payload.quality,
          source: payload.source,
          uploadedBy: session.name,
          uploadedRole: session.role,
          isActive: true,
        })
        .returning();
      await tx.insert(datasetRecords).values({ datasetId: row.id, employees: payload.employees });
      return row;
    });
    await writeAudit(req, session, payload.source === "demo" ? "dataset.demo_generated" : "dataset.uploaded", "data", `${payload.name} · ${created.rowCount} rows`, {
      datasetId: created.id,
      fileType: created.fileType,
      mapCoverage: payload.mapCoverage.coverage,
      unmatchedProvinces: payload.mapCoverage.unknown,
    });
    return Response.json({ dataset: toMeta(created) }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
