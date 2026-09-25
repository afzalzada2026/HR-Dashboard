import { LOCAL_ONLY } from "@/lib/mode";

export const dynamic = "force-dynamic";

export async function GET() {
  if (LOCAL_ONLY) return Response.json({ ok: true, mode: "browser-only" });
  try {
    const [{ db }, { sql }] = await Promise.all([import("@/db"), import("drizzle-orm")]);
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, mode: "enterprise" });
  } catch {
    return Response.json({ ok: false, mode: "enterprise" }, { status: 500 });
  }
}
