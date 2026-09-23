import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { datasetRecords, datasets } from "@/db/schema";
import { can } from "@/lib/rbac";
import { deny, getSession, serverError, toMeta, writeAudit } from "@/lib/server";
import type { DatasetPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
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
    const body = (await req.json()) as Partial<DatasetPayload>;
    if (!body || !Array.isArray(body.employees) || !body.employees.length) {
      return Response.json({ error: "Dataset must contain at least one employee record." }, { status: 400 });
    }
    if (body.employees.length > 150_000) return Response.json({ error: "Dataset exceeds 150,000 rows." }, { status: 413 });
    const name = String(body.name || body.fileName || "Untitled dataset").slice(0, 200);
    const created = await db.transaction(async (tx) => {
      await tx.update(datasets).set({ isActive: false }).where(eq(datasets.isActive, true));
      const [row] = await tx
        .insert(datasets)
        .values({
          name,
          fileName: String(body.fileName || name).slice(0, 255),
          fileType: String(body.fileType || "unknown").slice(0, 20),
          fileSize: Math.max(0, Math.round(Number(body.fileSize) || 0)),
          rowCount: body.employees!.length,
          columnCount: Math.max(0, Math.round(Number(body.columnCount) || 0)),
          mapping: body.mapping ?? {},
          quality: body.quality ?? null,
          source: body.source === "demo" ? "demo" : "upload",
          uploadedBy: session.name,
          uploadedRole: session.role,
          isActive: true,
        })
        .returning();
      await tx.insert(datasetRecords).values({ datasetId: row.id, employees: body.employees! });
      return row;
    });
    await writeAudit(req, session, body.source === "demo" ? "dataset.demo_generated" : "dataset.uploaded", "data", `${name} · ${created.rowCount} rows`, {
      datasetId: created.id,
      fileType: created.fileType,
    });
    return Response.json({ dataset: toMeta(created) }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
