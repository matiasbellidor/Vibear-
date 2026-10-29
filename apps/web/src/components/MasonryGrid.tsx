"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { layoutMasonry } from "@/lib/masonry";

type Props<T> = {
  items: T[];
  label: string;
  itemKey: (item: T, index: number) => string;
  /** height / width of the item's media */
  ratio: (item: T) => number;
  /** fixed px height of the text under the media (must match what renderItem draws) */
  caption?: number;
  minColumnWidth?: number;
  maxColumns?: number;
  renderItem: (item: T, index: number) => ReactNode;
};

export function MasonryGrid<T>({
  items,
  label,
  itemKey,
  ratio,
  caption = 0,
  minColumnWidth = 220,
  maxColumns = 5,
  renderItem,
}: Props<T>) {
  const ref = useRef<HTMLOListElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Notifications arrive after layout and before paint, so the first frame is already laid out.
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const gap = width < 640 ? 8 : 16;
  const columns = Math.min(maxColumns, Math.max(2, Math.floor((width + gap) / (minColumnWidth + gap))));
  const layout = width > 0 ? layoutMasonry(items.map(ratio), width, columns, gap, caption) : null;

  return (
    <ol ref={ref} aria-label={label} className="relative w-full" style={{ height: layout?.height ?? 0 }}>
      {layout &&
        items.map((item, index) => {
          const { x, y, width: itemWidth } = layout.placements[index];
          return (
            <li
              key={itemKey(item, index)}
              className="absolute left-0 top-0"
              style={{ width: itemWidth, transform: `translate(${x}px, ${y}px)` }}
            >
              {renderItem(item, index)}
            </li>
          );
        })}
    </ol>
  );
}
