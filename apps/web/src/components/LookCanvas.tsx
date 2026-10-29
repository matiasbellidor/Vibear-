"use client";

import { imageUrl, type Look } from "@/lib/api";
import { pad } from "@/lib/labels";
import { FadeImage } from "./FadeImage";
import { cx } from "./ui";

// White line with a dark halo, so a box reads on both dark and light photos; the selected one glows wine.
const ACTIVE = "border-2 border-wine-bright shadow-[0_0_0_1px_rgb(10_10_11/0.6),0_0_24px_rgb(232_84_108/0.4)]";
const IDLE = "border border-ink/80 shadow-[0_0_0_1px_rgb(10_10_11/0.5)] opacity-80 hover:opacity-100";

/** The uploaded photo with one numbered box per garment. The GarmentRail is the accessible control. */
export function LookCanvas({
  look,
  selectedId,
  onSelect,
}: {
  look: Look;
  selectedId: string;
  onSelect: (cropId: string) => void;
}) {
  const ratio = look.width / look.height;
  const showBoxes = look.items.some((item) => item.label !== "full_image");

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-media bg-surface lg:mx-0 [--canvas-h:55vh] lg:[--canvas-h:calc(100dvh-24rem)]"
      // Width derived from the height cap, so the box is final before the image loads.
      style={{ aspectRatio: `${look.width} / ${look.height}`, width: `min(100%, calc(var(--canvas-h) * ${ratio}))` }}
    >
      <FadeImage src={imageUrl(look.image_id)} alt="Tu foto" className="absolute inset-0 h-full w-full object-cover" />
      {showBoxes &&
        look.items.map((item, index) => {
          const [x1, y1, x2, y2] = item.box;
          const active = item.crop_id === selectedId;
          return (
            <button
              key={item.crop_id}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onSelect(item.crop_id)}
              className={cx("absolute transition-opacity duration-200 ease-out-soft", active ? ACTIVE : IDLE)}
              style={{
                left: `${(x1 / look.width) * 100}%`,
                top: `${(y1 / look.height) * 100}%`,
                width: `${((x2 - x1) / look.width) * 100}%`,
                height: `${((y2 - y1) / look.height) * 100}%`,
              }}
            >
              <span
                className={cx(
                  "absolute left-0 top-0 px-1.5 py-0.5 text-micro tabular-nums",
                  active ? "bg-wine-bright text-paper" : "bg-paper text-ink",
                )}
              >
                {pad(index + 1)}
              </span>
            </button>
          );
        })}
    </div>
  );
}
