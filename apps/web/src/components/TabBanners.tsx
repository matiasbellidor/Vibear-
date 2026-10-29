import type { CSSProperties } from "react";
import type { Pin } from "@/lib/landing";
import { shortLabelFor } from "@/lib/labels";
import { Icon, cx, icons } from "./ui";

// What each tab does, shown the moment it opens. The animations are one-shot CSS (.tab-* in
// globals.css); a page that Activity hid and shows again restarts them, so they play on every visit.

const pct = (value: number | null) => (value === null ? "" : ` · ${Math.round(value * 100)}%`);

/** Escanear: a strip of looks with a scan beam crossing it; each garment is named as the beam passes. */
export function ScanBanner({ pins }: { pins: Pin[] }) {
  const looks = pins.filter((pin) => (pin.kind === "woman" || pin.kind === "man") && pin.hotspots.length).slice(0, 6);
  return (
    <figure aria-hidden="true" className="relative max-w-3xl">
      <div className="relative overflow-hidden">
        {/* --n is how many tiles show, so each chip appears when the beam reaches its tile. */}
        <div className="grid grid-cols-4 gap-2 [--n:4] sm:grid-cols-6 sm:gap-3 sm:[--n:6]">
          {looks.map((pin, i) => {
            const spot = pin.hotspots[0];
            return (
              <div
                key={pin.src}
                className={cx("relative aspect-[3/4] overflow-hidden rounded-media bg-surface", i >= 4 && "hidden sm:block")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP */}
                <img src={pin.src} alt="" width={pin.width} height={pin.height} decoding="async" className="h-full w-full object-cover" />
                {/* The dot marks the garment; its name sits along the tile's foot, so it never gets cut. */}
                <span
                  className="tab-chip absolute -ml-1.5 -mt-1.5 h-3 w-3 rounded-full border-2 border-ink bg-wine-bright"
                  style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, "--i": i } as CSSProperties}
                />
                <span
                  className="tab-chip absolute inset-x-1.5 bottom-1.5 truncate bg-paper/90 px-1.5 py-0.5 text-micro tabular-nums"
                  style={{ "--i": i } as CSSProperties}
                >
                  {shortLabelFor(spot.label)}
                  <span className="hidden sm:inline">{pct(spot.confidence)}</span>
                </span>
              </div>
            );
          })}
        </div>
        <div className="tab-beam pointer-events-none absolute inset-0">
          <span className="absolute inset-y-0 left-0 w-0.5 bg-wine-bright shadow-[0_0_18px_4px_rgb(232_84_108/0.55)]" />
        </div>
      </div>
      <figcaption className="mt-3 text-micro text-muted">Así lee Vibear cada foto</figcaption>
    </figure>
  );
}

type Card = { key: string; src: string };
const TILTS = ["-9deg", "-4deg", "1deg", "5deg", "10deg"];

/** Guardados: the latest things you saved drop onto the board like pins, then the bookmark lands. */
export function ClosetBanner({ cards, example }: { cards: Card[]; example: boolean }) {
  const shown = cards.slice(0, 5);
  return (
    <figure aria-hidden="true" className="flex flex-col items-center py-6 sm:py-8">
      <div className="relative flex justify-center">
        {shown.map((card, i) => (
          <div
            key={card.key}
            className="tab-drop -ml-6 w-[clamp(4.5rem,17vw,8.5rem)] shrink-0 first:ml-0 sm:-ml-8 overflow-hidden rounded-media border-2 border-paper bg-surface shadow-[0_12px_30px_-10px_rgb(0_0_0/0.8)]"
            style={{ "--i": i, "--r": TILTS[i], transform: `rotate(${TILTS[i]})` } as CSSProperties}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- shop thumbnails come from many domains */}
            <img src={card.src} alt="" referrerPolicy="no-referrer" decoding="async" className="aspect-[3/4] h-auto w-full object-cover" />
          </div>
        ))}
        <span
          className="tab-pop absolute -right-3 -top-4 grid h-10 w-10 place-items-center rounded-full bg-wine text-cream shadow-[0_8px_20px_-6px_rgb(0_0_0/0.8)]"
          style={{ "--n": shown.length } as CSSProperties}
        >
          <Icon path={icons.bookmark} filled />
        </span>
      </div>
      <figcaption className="mt-5 text-micro text-muted">{example ? "Así se va a ver tu placard" : "Lo último que guardaste"}</figcaption>
    </figure>
  );
}
