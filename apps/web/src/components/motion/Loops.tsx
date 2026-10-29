import type { Pin } from "@/lib/landing";
import { PinCard } from "../landing/Pin";
import { cx } from "../ui";

/**
 * A wall of pins that slides sideways as you scroll past it (scroll-driven, see .scroll-row):
 * columns of two pins at their natural height, like a Pinterest board on its side. Without
 * scroll timelines or with reduced motion, it is a row you can swipe.
 */
export function PinWall({ pins, className, labels = true }: { pins: Pin[]; className?: string; labels?: boolean }) {
  const columns: Pin[][] = [];
  for (let i = 0; i < pins.length; i += 2) columns.push(pins.slice(i, i + 2));

  return (
    <div aria-hidden="true" className={cx("scroll-row-wrap overflow-x-auto", className)}>
      <div className="mask-fade-b h-full">
        <div className="scroll-row flex w-max items-start gap-3 px-4 md:gap-4 lg:px-8">
          {columns.map((column, i) => (
            <div key={i} className="w-40 shrink-0 space-y-5 sm:w-48 md:w-56">
              {column.map((pin) => (
                <PinCard key={pin.src} pin={pin} labels={labels} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
