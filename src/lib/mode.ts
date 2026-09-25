/**
 * Browser-only mode is the default. Set NEXT_PUBLIC_ATOMA_LOCAL_ONLY=false at build time
 * only when intentionally deploying the optional PostgreSQL/Entra enterprise backend.
 */
export const LOCAL_ONLY = process.env.NEXT_PUBLIC_ATOMA_LOCAL_ONLY !== "false";

export const runtimeModeLabel = LOCAL_ONLY ? "Browser-only local mode" : "Enterprise mode";

export function localOnlyApiDisabled(): Response | null {
  return LOCAL_ONLY
    ? Response.json({ error: "Server data APIs are disabled in browser-only mode. Data must remain in IndexedDB on this device." }, { status: 410 })
    : null;
}
