declare module "@klyratech/mermaid-to-visio" {
  export interface VsdxStats {
    shapes: number;
    texts: number;
  }
  export function svgElementToVsdx(
    svg: SVGElement,
    options?: { title?: string; author?: string }
  ): { bytes: ArrayBuffer; stats: VsdxStats };
}
