/**
 * Stable public entry point for the ATOMA organogram.
 *
 * The implementation is split across focused modules (kept small and testable):
 *   • `organogram-levels` — L6 → L1 vocabulary and level helpers
 *   • `orgtree`           — reporting-line engine, division heads, overrides
 *   • `orglayout`         — landscape layout (level rows, roster cards, bus connectors)
 *   • `orgexport`         — SVG / vector PDF / Visio / print renderers
 *
 * Import from "@/lib/organogram" when you want the whole API; import the individual
 * modules when you only need one layer.
 */
export * from "./organogram-levels";
export * from "./orgtree";
export * from "./orglayout";
export * from "./legacy-to-mod";
