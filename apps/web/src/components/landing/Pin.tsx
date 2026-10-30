import type { Pin } from "@/lib/landing";
import type { Hotspot } from "@/lib/landing";
import { garmentKind, garmentName } from "@/lib/labels";
import { Icon, cx, icons } from "../ui";
import { Photo } from "./Photo";

export function captionFor(pin: Pin): string {
  if (pin.kind === "board") return "Look armado";
  return [...new Set(pin.hotspots.map((spot) => garmentKind(spot)))].join(" + ") || "Outfit";
}

function readout(spot: Hotspot): string {
  return spot.confidence === null ? garmentName(spot) : `${garmentKind(spot)} · ${Math.round(spot.confidence * 100)}%`;
}

/** Twice the polygon's area (shoelace), in the outline's 0-100 units: only used to stack outlines. */
function area(outline: string): number {
  const points = outline.split(" ").map((pair) => pair.split(",").map(Number));
  return Math.abs(points.reduce((sum, [x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length];
    return sum + x * ny - nx * y;
  }, 0));
}

/**
 * A Pinterest-style pin: the photo with a wine hotspot on each garment Vibear recognised (real
 * YOLO output, confidence included), and a short caption. Decorative: the section text carries
 * the meaning. Each garment's outline (YOLO's mask) carries `data-garment` for the ScanField
 * crosshair, smallest on top, so the cursor reads the garment it is really over: the shirt under a
 * jacket's opening, the trousers below it.
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
  const outlined = pin.hotspots.filter((spot) => spot.outline).sort((a, b) => area(b.outline!) - area(a.outline!));
  return (
    <figure className={cx("group/pin", className)}>
      <div className="relative">
        <Photo photo={pin} eager={eager} />
        {outlined.length > 0 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
            {outlined.map((spot) => (
              <polygon key={`${spot.label}-${spot.x}`} points={spot.outline} data-garment={readout(spot)} className="scan-area" />
            ))}
          </svg>
        )}
        {pin.hotspots.map((spot, i) => (
          <span
            key={`${spot.label}-${spot.x}`}
            className="pointer-events-none absolute -ml-1.5 -mt-1.5"
            style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
          >
            <span className="relative block h-3 w-3">
              {/* One breathing ring per pin is enough texture, and keeps a wall of pins cheap. */}
              {i === 0 && <span className="hotspot-ring motion-loop absolute inset-0 rounded-full bg-wine-bright" />}
              <span className="absolute inset-0 rounded-full border-2 border-ink bg-wine-bright" />
            </span>
            {labels && (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap bg-paper/90 px-2 py-1 text-micro tabular-nums text-ink opacity-0 transition-opacity duration-200 ease-out-soft group-hover/pin:opacity-100">
                {readout(spot)}
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
