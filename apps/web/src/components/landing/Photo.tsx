import type { Photo as PhotoData } from "@/lib/landing";
import { cx } from "../ui";

/** A pre-sized WebP from /public/landing. Decorative (the meaning is in the text next to it). */
export function Photo({ photo, eager = false, className }: { photo: PhotoData; eager?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- already resized WebP, no optimizer needed
    <img
      src={photo.src}
      width={photo.width}
      height={photo.height}
      alt=""
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cx("block h-auto w-full rounded-media bg-surface", className)}
    />
  );
}
