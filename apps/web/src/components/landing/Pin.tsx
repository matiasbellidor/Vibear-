import type { Pin } from "@/lib/landing";
import { labelFor, shortLabelFor } from "@/lib/labels";
import { Icon, cx, icons } from "../ui";
import { Photo } from "./Photo";

export function captionFor(pin: Pin): string {
  if (pin.kind === "board") return "Look armado";
  return [...new Set(pin.hotspots.map((spot) => shortLabelFor(spot.label)))].join(" + ") || "Outfit";
}

function readout(label: string, confidence: number | null): string {
  return confidence === null ? labelFor(label) : `${shortLabelFor(label)} · ${Math.round(confidence * 100)}%`;
}

/**
 * A Pinterest-style pin: the photo with a wine hotspot on each garment Vibear recognised (real
 * YOLO output, confidence included), and a short caption. Decorative: the section text carries
 * the meaning. `data-garment` feeds the ScanField crosshair.
 */
export function PinCard({
  pin,
  caption = true,
  labels = true,
  eager = false,
  className,
}: {
  pin: Pin;
  caption?: boolean;
  /** Hover chips per hotspot; off where a ScanField crosshair already reads the garment. */
  labels?: boolean;
  eager?: boolean;
  className?: string;
}) {
  const top = pin.hotspots[0];
  return (
    <figure className={cx("group/pin", className)} data-garment={top ? readout(top.label, top.confidence) : undefined}>
      <div className="relative">
        <Photo photo={pin} eager={eager} />
        {pin.hotspots.map((spot, i) => (
          <span
            key={`${spot.label}-${spot.x}`}
            className="absolute -ml-1.5 -mt-1.5"
            style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
          >
            <span className="relative block h-3 w-3">
              {/* One breathing ring per pin is enough texture, and keeps a wall of pins cheap. */}
              {i === 0 && <span className="hotspot-ring motion-loop absolute inset-0 rounded-full bg-wine-bright" />}
              <span className="absolute inset-0 rounded-full border-2 border-ink bg-wine-bright" />
            </span>
            {labels && (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap bg-paper/90 px-2 py-1 text-micro tabular-nums text-ink opacity-0 transition-opacity duration-200 ease-out-soft group-hover/pin:opacity-100">
                {readout(spot.label, spot.confidence)}
              </span>
            )}
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
