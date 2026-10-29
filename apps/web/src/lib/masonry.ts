export type Placement = { x: number; y: number; width: number; height: number };

export type MasonryLayout = { placements: Placement[]; height: number };

/**
 * Pinterest-style masonry that keeps rank order: each item goes to the currently shortest column.
 *
 * Heights are computed from known aspect ratios (plus a fixed caption height), so the layout is
 * final before any image loads: no layout shift, and the DOM stays in rank order for keyboard
 * and screen-reader users (CSS columns would read column by column instead).
 */
export function layoutMasonry(
  ratios: number[],
  containerWidth: number,
  columns: number,
  gap: number,
  captionHeight: number,
): MasonryLayout {
  const columnWidth = (containerWidth - gap * (columns - 1)) / columns;
  const heights = new Array<number>(columns).fill(0);
  const placements = ratios.map((ratio) => {
    const column = heights.indexOf(Math.min(...heights));
    const height = columnWidth * ratio + captionHeight;
    const placement = { x: column * (columnWidth + gap), y: heights[column], width: columnWidth, height };
    heights[column] += height + gap;
    return placement;
  });
  return { placements, height: Math.max(0, Math.max(...heights) - gap) };
}

/** Height / width, with a portrait fallback when the size is unknown. */
export function ratioOf(width: number | null | undefined, height: number | null | undefined): number {
  return width && height ? height / width : 4 / 3;
}
