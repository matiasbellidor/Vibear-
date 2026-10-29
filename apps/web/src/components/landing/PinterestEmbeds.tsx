"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    PinUtils?: { build?: () => void };
  }
}

const SCRIPT_SRC = "https://assets.pinterest.com/js/pinit.js";

/**
 * Pinterest's official widgets (embedBoard / embedPin): the real pins, served by Pinterest with
 * their author and a link back. pinit.js is loaded once per page (as Pinterest asks), and only
 * when the section gets close to the viewport, so it never weighs on the first load.
 */
export function PinterestEmbeds({ board, pins }: { board?: string; pins: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
          window.PinUtils?.build?.(); // after a client-side navigation the script is already there
          return;
        }
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="space-y-8">
      {board && (
        <div className="overflow-hidden">
          <a data-pin-do="embedBoard" data-pin-scale-height="480" data-pin-scale-width="110" href={board} className="text-micro underline">
            Ver el tablero en Pinterest
          </a>
        </div>
      )}
      {pins.length > 0 && (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {pins.map((url) => (
            <div key={url} className="mb-4 break-inside-avoid">
              <a data-pin-do="embedPin" data-pin-width="medium" href={url} className="text-micro underline">
                Ver el pin en Pinterest
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
