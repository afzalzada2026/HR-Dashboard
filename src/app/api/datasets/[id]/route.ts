import type { NextRequest } from "next/server";
import { desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/ensure";
import { datasetRecords, datasets } from "@/db/schema";
import { localOnlyApiDisabled } from "@/lib/mode";
import { applyRowLevelSecurity, can } from "@/lib/rbac";
import { deny, getSession, serverError, toMeta, writeAudit } from "@/lib/server";
import type { Employee } from "@/lib/types";
import { safeText } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: Ctx) {
  const disabled = localOnlyApiDisabled();
  if (disabled) return disabled;
  try {
    await ensureSchema();
    const { id } = await params;
    if (!UUID_RE.test(id)) return Response.json({ error: "Invalid dataset id" }, { status: 400 });
    const session = getSession(req);
    if (!can(session.role, "view_dashboard")) return deny("view_dashboard");
    const [row] = await db.select().from(datasets).where(eq(datasets.id, id));
    if (!row) return Response.json({ error: "Dataset not found" }, { status: 404 });
    const [rec] = await db.select({ employees: datasetRecords.employees }).from(datasetRecords).where(eq(datasetRecords.datasetId, id));
    return Response.json({ dataset: toMeta(row), employees: applyRowLevelSecurity((rec?.employees ?? []) as Employee[], session) });
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const disabled = localOnlyApiDisabled();
  if (disabled) return disabled;
  try {
    await ensureSchema();
    const { id } = await params;
    if (!UUID_RE.test(id)) return Response.json({ error: "Invalid dataset id" }, { status: 400 });
    const session = getSession(req);
    if (!can(session.role, "upload_data")) return deny("upload_data");
    const body = (await req.json().catch(() => ({}))) as { active?: boolean; name?: string };
    const [row] = await db.select().from(datasets).where(eq(datasets.id, id));
    if (!row) return Response.json({ error: "Dataset not found" }, { status: 404 });
    if (typeof body.name === "string" && body.name.trim()) {
      const name = safeText(body.name, 200);
      await db.update(datasets).set({ name }).where(eq(datasets.id, id));
      await writeAudit(req, session, "dataset.renamed", "data", `${row.name} → ${name}`);
    }
    if (body.active) {
      await db.transaction(async (tx) => {
        await tx.update(datasets).set({ isActive: false }).where(ne(datasets.id, id));
        await tx.update(datasets).set({ isActive: true }).where(eq(datasets.id, id));
      });
      await writeAudit(req, session, "dataset.activated", "data", row.name, { datasetId: id });
    }
    const [updated] = await db.select().from(datasets).where(eq(datasets.id, id));
    return Response.json({ dataset: toMeta(updated) });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const disabled = localOnlyApiDisabled();
  if (disabled) return disabled;
  try {
    await ensureSchema();
    const { id } = await params;
    if (!UUID_RE.test(id)) return Response.json({ error: "Invalid dataset id" }, { status: 400 });
    const session = getSession(req);
    if (!can(session.role, "delete_data")) return deny("delete_data");
    const [row] = await db.select().from(datasets).where(eq(datasets.id, id));
    if (!row) return Response.json({ error: "Dataset not found" }, { status: 404 });
    await db.delete(datasets).where(eq(datasets.id, id));
    if (row.isActive) {
      const [next] = await db.select().from(datasets).orderBy(desc(datasets.createdAt)).limit(1);
      if (next) await db.update(datasets).set({ isActive: true }).where(eq(datasets.id, next.id));
    }
    await writeAudit(req, session, "dataset.deleted", "data", `${row.name} · ${row.rowCount} rows`, { datasetId: id });
    return Response.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}
