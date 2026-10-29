"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { cx } from "./ui";

/**
 * Every image in Vibear goes through here: it fades in on load and degrades to a quiet placeholder.
 * Plain <img> on purpose: product thumbnails come from hundreds of shop domains, which next/image
 * remote patterns can't enumerate. The parent reserves the box (aspect-ratio), so nothing shifts.
 */
export function FadeImage({ className, alt, ...props }: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  if (state === "error") {
    return (
      <span className={cx("grid place-items-center bg-surface text-micro text-muted", className)}>Sin imagen</span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setState("loaded")}
      onError={() => setState("error")}
      className={cx(
        "transition-opacity duration-500 ease-out-soft",
        state === "loaded" ? "opacity-100" : "opacity-0",
        className,
      )}
      {...props}
    />
  );
}
