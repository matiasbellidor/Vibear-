import type { Pin } from "@/lib/landing";
import { labelFor, shortLabelFor } from "@/lib/labels";
import { Icon, cx, icons } from "../ui";
import { Photo } from "./Photo";

export function captionFor(pin: Pin): string {
  if (pin.kind === "board") return "Look armado";
  return [...new Set(pin.hotspots.map((spot) => shortLabelFor(spot.label)))].join(" + ") || "Outfit";
}

/**
 * A Pinterest-style pin: the photo with wine hotspots on each garment Vibear recognises
 * (real YOLO output), and a short caption. Decorative: the section text carries the meaning.
 */
export function PinCard({
  pin,
  caption = true,
  eager = false,
  className,
}: {
  pin: Pin;
  caption?: boolean;
  eager?: boolean;
  className?: string;
}) {
  return (
    <figure className={cx("group/pin", className)}>
      <div className="relative">
        <Photo photo={pin} eager={eager} />
        {pin.hotspots.map((spot) => (
          <span
            key={`${spot.label}-${spot.x}`}
            className="absolute -ml-1.5 -mt-1.5"
            style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
          >
            <span className="relative block h-3 w-3">
              <span className="hotspot-ring motion-loop absolute inset-0 rounded-full bg-wine" />
              <span className="absolute inset-0 rounded-full border-2 border-paper bg-wine" />
            </span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap bg-paper px-2 py-1 text-micro text-ink opacity-0 transition-opacity duration-200 ease-out-soft group-hover/pin:opacity-100">
              {labelFor(spot.label)}
            </span>
          </span>
        ))}
      </div>
      {caption && (
        <figcaption className="mt-2 flex items-center justify-between gap-2 text-micro">
          <span className="truncate">{captionFor(pin)}</span>
          <Icon path={icons.bookmark} className="shrink-0 text-muted" />
        </figcaption>
      )}
    </figure>
  );
}
