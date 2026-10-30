"use client";

import { mediaUrl, type DetectedItem } from "@/lib/api";
import { garmentName, pad } from "@/lib/labels";
import { FadeImage } from "./FadeImage";
import { cx } from "./ui";

/** One button per detected garment. Horizontal rail on mobile, grid under the photo on desktop. */
export function GarmentRail({
  items,
  selectedId,
  onSelect,
}: {
  items: DetectedItem[];
  selectedId: string;
  onSelect: (cropId: string) => void;
}) {
  const fullImage = items.length === 1 && items[0].label === "full_image";

  return (
    <div className="mt-6">
      <h2 className="text-micro text-muted">
        {fullImage ? "No detectamos prendas: buscamos la foto completa" : `${pad(items.length)} prendas`}
      </h2>
      {/* scroll-px: snap points ignore padding, so without it the first tile snaps flush to the screen edge. */}
      <ul className="-mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {items.map((item, index) => {
          const active = item.crop_id === selectedId;
          return (
            <li key={item.crop_id} className="w-26 shrink-0 snap-start lg:w-auto">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(item.crop_id)}
                className="group block w-full text-left"
              >
                <span
                  className={cx(
                    "block aspect-[3/4] overflow-hidden rounded-media bg-surface outline-offset-2 transition-[outline-color] duration-200",
                    active ? "outline-2 outline-wine-bright" : "outline-1 outline-transparent group-hover:outline-line",
                  )}
                >
                  <FadeImage src={mediaUrl(item.crop_url)} alt={garmentName(item)} className="h-full w-full object-cover" />
                </span>
                <span className="mt-2 block text-micro">
                  <span className="tabular-nums text-muted">{pad(index + 1)}</span> {garmentName(item)}
                </span>
                {item.confidence !== null && (
                  <span className="block text-micro tabular-nums text-muted">
                    {Math.round(item.confidence * 100)}% seguro
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
