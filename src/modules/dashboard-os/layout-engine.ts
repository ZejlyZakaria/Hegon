// ─── HEGON dashboard — Layout Engine ──────────────────────────────────────────
// PURE. No React, no Zustand, no DOM, no pixels in the core. It answers one
// question: given items with cell footprints and a column count, WHERE does each
// one sit on the grid (in cell coordinates)? The "how it moves there" (springs)
// is a separate Motion Engine; the pixel mapping is a thin adapter at the bottom.
//
// Keeping this layer pure is the long-term investment: it is trivially testable,
// could run in a Web Worker, and never breaks when the rendering/animation
// changes. Pin / lock / preferred-column / multi-page all plug in here later
// without touching the signature.

export interface EngineItem {
  id: string;
  colSpan: number;
  rowSpan: number;
}

export interface PlacedItem {
  id: string;
  col: number;      // 0-based column of the top-left cell
  row: number;      // 0-based row of the top-left cell
  colSpan: number;  // clamped to the grid width
  rowSpan: number;
}

export interface LayoutResult {
  items: PlacedItem[];
  byId: Record<string, PlacedItem>;
  rows: number;     // total rows the grid occupies (drives the container height)
}

export interface ComputeOptions {
  // true (default): first-fit — a later item may fill an earlier gap, so the grid
  // stays COMPACT with no holes (owner's preference). false: strict reading-order
  // flow (predictable order, may leave holes) — reserved for a future toggle.
  backfill?: boolean;
}

// First-fit packing of `items` (in order) into a grid `cols` wide. Returns each
// item's cell position. Deterministic and pure.
export function computeGridLayout(
  items: EngineItem[],
  cols: number,
  { backfill = true }: ComputeOptions = {},
): LayoutResult {
  const safeCols = Math.max(1, cols);
  const occupied: boolean[][] = []; // occupied[row][col]

  const ensureRow = (r: number) => {
    while (occupied.length <= r) occupied.push(new Array(safeCols).fill(false));
  };
  const fits = (row: number, col: number, w: number, h: number): boolean => {
    if (col + w > safeCols) return false;
    for (let r = row; r < row + h; r++) {
      ensureRow(r);
      for (let c = col; c < col + w; c++) if (occupied[r][c]) return false;
    }
    return true;
  };
  const occupy = (row: number, col: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++) {
      ensureRow(r);
      for (let c = col; c < col + w; c++) occupied[r][c] = true;
    }
  };

  const placed: PlacedItem[] = [];
  // Without backfill we never scan above the cursor row → strict forward flow.
  let cursorRow = 0;

  for (const item of items) {
    const w = Math.min(Math.max(1, item.colSpan), safeCols);
    const h = Math.max(1, item.rowSpan);

    let row = backfill ? 0 : cursorRow;
    let placedAt: { row: number; col: number } | null = null;

    for (; placedAt === null; row++) {
      for (let col = 0; col <= safeCols - w; col++) {
        if (fits(row, col, w, h)) {
          placedAt = { row, col };
          break;
        }
      }
    }

    occupy(placedAt.row, placedAt.col, w, h);
    if (!backfill) cursorRow = placedAt.row;
    placed.push({ id: item.id, row: placedAt.row, col: placedAt.col, colSpan: w, rowSpan: h });
  }

  return {
    items: placed,
    byId: Object.fromEntries(placed.map((p) => [p.id, p])),
    rows: occupied.length,
  };
}

// ─── pixel adapter (the only place that knows about pixels) ───────────────────

export interface GridMetrics {
  colW: number;    // width of one column track
  rowUnit: number; // height of one row track
  gap: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Cell position → absolute pixel box. A span absorbs the inner gaps (so an item
// spanning N columns is N·colW + (N−1)·gap wide), which is what makes a widget's
// edge line up exactly with the app icons beneath it.
export function placedToBox(p: PlacedItem, m: GridMetrics): Box {
  return {
    x: p.col * (m.colW + m.gap),
    y: p.row * (m.rowUnit + m.gap),
    w: p.colSpan * m.colW + (p.colSpan - 1) * m.gap,
    h: p.rowSpan * m.rowUnit + (p.rowSpan - 1) * m.gap,
  };
}

// Total pixel height of a result — for the (relatively-positioned) container.
export function layoutHeight(result: LayoutResult, m: GridMetrics): number {
  return result.rows > 0 ? result.rows * m.rowUnit + (result.rows - 1) * m.gap : 0;
}
