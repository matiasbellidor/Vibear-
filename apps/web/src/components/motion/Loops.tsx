import type { CSSProperties } from "react";
import type { Pin } from "@/lib/landing";
import { PinCard } from "../landing/Pin";
import { cx } from "../ui";
import { InView } from "./InView";

const DRIFT_SECONDS = [64, 78, 58, 72];

/** Pinterest-style columns drifting in alternating directions. The 4th column appears from md. */
export function DriftColumns({ columns, className }: { columns: Pin[][]; className?: string }) {
  return (
    <InView aria-hidden="true" className={cx("flex gap-3 overflow-hidden mask-fade-y", className)}>
      {columns.map((pins, c) => (
        <div key={c} className={cx("min-w-0 flex-1", c === 3 && "hidden md:block")}>
          <div
            className="drift-track motion-loop"
            data-direction={c % 2 ? "reverse" : undefined}
            style={{ "--drift-duration": `${DRIFT_SECONDS[c % DRIFT_SECONDS.length]}s` } as CSSProperties}
          >
            {/* Duplicated once, with the gap on each item, so -50% lands exactly where it started. */}
            {[...pins, ...pins].map((pin, i) => (
              <div key={i} className="pb-3">
                <PinCard pin={pin} caption={false} eager={i < 2} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </InView>
  );
}

/**
 * A wall of pins sliding sideways: columns of two pins at their natural height, like a
 * Pinterest board on its side. The uneven bottom edge fades out. Pauses on hover and off-screen.
 */
export function PinWall({ pins, seconds, className }: { pins: Pin[]; seconds: number; className?: string }) {
  const columns: Pin[][] = [];
  for (let i = 0; i < pins.length; i += 2) columns.push(pins.slice(i, i + 2));
  const doubled = [...columns, ...columns];

  return (
    <InView aria-hidden="true" className={cx("marquee overflow-hidden", className)}>
      <div className="mask-fade-b h-full">
        <div className="marquee-track motion-loop items-start" style={{ "--marquee-duration": `${seconds}s` } as CSSProperties}>
          {doubled.map((column, i) => (
            <div key={i} className="w-40 shrink-0 space-y-5 pr-3 sm:w-48 md:w-56 md:pr-4">
              {column.map((pin) => (
                <PinCard key={pin.src} pin={pin} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </InView>
  );
}
