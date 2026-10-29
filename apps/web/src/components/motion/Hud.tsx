"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "../ui";

const everySecond = (onChange: () => void) => {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
};
const currentSecond = () => Math.floor(Date.now() / 1000);

/** The real local time, ticking: the scanner is "live". */
export function LiveClock() {
  const second = useSyncExternalStore(everySecond, currentSecond, () => 0);
  return (
    <time className="tabular-nums">
      {second ? new Date(second * 1000).toLocaleTimeString("es-AR", { hour12: false }) : "--:--:--"}
    </time>
  );
}

/**
 * A field the mouse scans: a crosshair follows the pointer with its coordinates and, over a pin,
 * the garment Vibear detected there (from the pin's data-garment, real YOLO output).
 * Writes straight to the DOM in a frame callback, so moving the mouse never re-renders React.
 */
export function ScanField({ children, className }: { children: ReactNode; className?: string }) {
  const field = useRef<HTMLDivElement>(null);
  const reticle = useRef<HTMLDivElement>(null);
  const coords = useRef<HTMLSpanElement>(null);
  const garment = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = field.current;
    if (!element) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const pin = (event.target as Element | null)?.closest<HTMLElement>("[data-garment]");
        if (!reticle.current || !coords.current || !garment.current) return;
        reticle.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        reticle.current.dataset.on = "true";
        coords.current.textContent = `X ${String(Math.round(x)).padStart(3, "0")} · Y ${String(Math.round(y)).padStart(3, "0")}`;
        garment.current.textContent = pin?.dataset.garment ?? "";
        garment.current.dataset.on = pin?.dataset.garment ? "true" : "false";
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      if (reticle.current) reticle.current.dataset.on = "false";
    };
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div ref={field} className={cx("relative", className)}>
      {children}
      <div
        ref={reticle}
        data-on="false"
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-10 opacity-0 transition-opacity duration-150 data-[on=true]:opacity-100"
      >
        <span className="absolute -left-6 top-0 h-px w-12 bg-wine-bright" />
        <span className="absolute -top-6 left-0 h-12 w-px bg-wine-bright" />
        <span className="absolute -left-3 -top-3 h-6 w-6 border border-ink/80" />
        <span ref={coords} className="absolute left-5 top-4 whitespace-nowrap bg-paper/80 px-1.5 py-0.5 text-micro tabular-nums text-muted" />
        <span
          ref={garment}
          data-on="false"
          className="absolute left-5 top-10 whitespace-nowrap bg-wine-bright px-1.5 py-0.5 text-micro text-paper opacity-0 data-[on=true]:opacity-100"
        />
      </div>
    </div>
  );
}

/** Four corner marks framing a scanned area. */
export function Brackets({ className }: { className?: string }) {
  const mark = "absolute h-3.5 w-3.5 border-wine-bright";
  return (
    <span aria-hidden="true" className={cx("pointer-events-none absolute inset-0", className)}>
      <span className={cx(mark, "left-0 top-0 border-l border-t")} />
      <span className={cx(mark, "right-0 top-0 border-r border-t")} />
      <span className={cx(mark, "bottom-0 left-0 border-b border-l")} />
      <span className={cx(mark, "bottom-0 right-0 border-b border-r")} />
    </span>
  );
}
