import type { CSSProperties } from "react";
import type { Pin } from "@/lib/landing";
import { PinCard } from "../landing/Pin";
import { cx } from "../ui";
import { InView } from "./InView";
import { SlowOnHover } from "./SlowOnHover";

/**
 * A wall of pins that keeps moving on its own and slows down under the mouse (.marquee): columns of
 * two pins at their natural height, like a Pinterest board on its side. The list is there twice, so
 * the loop lands where it started; it pauses off-screen. With reduced motion, it is a row you swipe.
 */
export function PinWall({ pins, className, labels = true }: { pins: Pin[]; className?: string; labels?: boolean }) {
  const columns: Pin[][] = [];
  for (let i = 0; i < pins.length; i += 2) columns.push(pins.slice(i, i + 2));
  // About 40px a second on a laptop, whatever the number of photos.
  const speed = { "--marquee": `${columns.length * 6}s` } as CSSProperties;
  const copy = (hidden: boolean) => (
    <div className={cx("flex items-start", hidden && "marquee-copy")}>
      {columns.map((column, i) => (
        // The gap is padding on each column, not on the track, so the two copies measure the same.
        <div key={i} className="shrink-0 pr-3 md:pr-4">
          <div className="w-40 space-y-5 sm:w-48 md:w-56">
            {column.map((pin) => (
              <PinCard key={pin.src} pin={pin} labels={labels} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <InView aria-hidden="true" className={cx("marquee-wrap overflow-x-auto", className)}>
      <SlowOnHover name="marquee" className="mask-fade-b h-full">
        <div className="marquee motion-loop flex w-max px-4 lg:px-8" style={speed}>
          {copy(false)}
          {copy(true)}
        </div>
      </SlowOnHover>
    </InView>
  );
}
