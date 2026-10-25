// Electrical plan symbols as SVG path data on a 24×24 box centered at (12, 12), shared by
// the SVG UI (palette, legends) and the Konva canvas (Konva.Path accepts the same data).

export type SymbolKind = 'panel' | 'junction_box' | 'socket' | 'switch' | 'ceiling' | 'riser';

export const symbolPaths: Record<SymbolKind, string> = {
  panel: 'M3 6h18v12H3z M3 18L21 6',
  junction_box: 'M5 5h14v14H5z M5 5L19 19 M19 5L5 19',
  socket: 'M5 15a7 7 0 0 1 14 0z M9 11V6 M15 11V6',
  switch: 'M9 15a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M14 13l6-8 M20 5l2 1.5',
  ceiling: 'M6 12a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M7.8 7.8l8.4 8.4 M16.2 7.8l-8.4 8.4',
  riser: 'M12 3v18 M8 7l4-4 4 4 M8 17l4 4 4-4',
};

/** Dash pattern for provision elements (conduit only, no wire yet). */
export const provisionDash = [3, 2];
