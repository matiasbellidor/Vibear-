"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    PinUtils?: { build?: () => void };
  }
}

const SCRIPT_SRC = "https://assets.pinterest.com/js/pinit.js";
const BOARD_WIDTH = "300";

/** "fits" from https://www.pinterest.com/anitaragoness/fits/: the link's text until the embed loads. */
function boardName(url: string): string {
  const [, user, board] = new URL(url).pathname.split("/");
  return board ? `${decodeURIComponent(board)} de ${user}` : url;
}

/**
 * Pinterest's official widgets (embedBoard / embedPin): the real pins, served by Pinterest with
 * their author and a link back. pinit.js is loaded once per page (as Pinterest asks), and only
 * when the section gets close to the viewport, so it never weighs on the first load.
 */
export function PinterestEmbeds({ boards, pins }: { boards: string[]; pins: string[] }) {
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
      {boards.length > 0 && (
        // Every board in one row to scroll sideways, each with its owner's avatar and name as
        // Pinterest shows it. The widget is the board width plus 20px of frame: 320px fits the
        // narrowest phone, and four fit a laptop.
        <div>
          <ul
            aria-label="Tableros de Pinterest"
            className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-4 lg:-mx-8 lg:scroll-px-8 lg:px-8"
          >
            {boards.map((board) => (
              <li key={board} className="w-[320px] shrink-0 snap-start">
                <a
                  data-pin-do="embedBoard"
                  data-pin-board-width={BOARD_WIDTH}
                  data-pin-scale-height="340"
                  data-pin-scale-width="80"
                  href={board}
                  className="text-micro underline"
                >
                  {boardName(board)} en Pinterest
                </a>
              </li>
            ))}
          </ul>
          {boards.length > 1 && (
            <p className="mt-2 text-micro normal-case tracking-normal text-muted lg:hidden">
              Deslizá para ver los {boards.length} tableros <span aria-hidden="true">→</span>
            </p>
          )}
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
