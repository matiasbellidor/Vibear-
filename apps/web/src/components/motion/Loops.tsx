import type { CSSProperties, ReactNode } from "react";
import type { Photo as PhotoData } from "@/lib/landing";
import { Photo } from "../landing/Photo";
import { cx } from "../ui";
import { InView } from "./InView";

const DRIFT_SECONDS = [64, 78, 58, 72];

/** Pinterest-style columns drifting in alternating directions. The 4th column appears from md. */
export function DriftColumns({ columns, className }: { columns: PhotoData[][]; className?: string }) {
  return (
    <InView aria-hidden="true" className={cx("flex gap-3 overflow-hidden mask-fade-y", className)}>
      {columns.map((photos, c) => (
        <div key={c} className={cx("min-w-0 flex-1", c === 3 && "hidden md:block")}>
          <div
            className="drift-track motion-loop"
            data-direction={c % 2 ? "reverse" : undefined}
            style={{ "--drift-duration": `${DRIFT_SECONDS[c % DRIFT_SECONDS.length]}s` } as CSSProperties}
          >
            {/* Duplicated once, with the gap on each item, so -50% lands exactly where it started. */}
            {[...photos, ...photos].map((photo, i) => (
              <div key={i} className="pb-3">
                <Photo photo={photo} eager={i < 2} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </InView>
  );
}

/** A horizontal loop of photos (or any items). Pauses on hover and off-screen. */
export function Marquee({
  items,
  seconds,
  reverse = false,
  className,
  render,
}: {
  items: PhotoData[] | string[];
  seconds: number;
  reverse?: boolean;
  className?: string;
  render?: (item: string, index: number) => ReactNode;
}) {
  const doubled = [...items, ...items];
  return (
    <InView aria-hidden="true" className={cx("marquee", className)} data-direction={reverse ? "reverse" : undefined}>
      <div className="marquee-track motion-loop" style={{ "--marquee-duration": `${seconds}s` } as CSSProperties}>
        {doubled.map((item, i) =>
          typeof item === "string" ? (
            <span key={i} className="shrink-0">
              {render ? render(item, i) : item}
            </span>
          ) : (
            <div key={i} className="w-36 shrink-0 pr-3 md:w-52 md:pr-4">
              <Photo photo={item} className="aspect-[2/3] object-cover" />
            </div>
          ),
        )}
      </div>
    </InView>
  );
}
