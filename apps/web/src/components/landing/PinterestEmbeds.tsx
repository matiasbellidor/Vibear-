"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    PinUtils?: { build?: () => void };
  }
}

const SCRIPT_SRC = "https://assets.pinterest.com/js/pinit.js";
const BOARD_WIDTH = "300";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** usuario and tablero from https://www.pinterest.com/usuario/tablero/. */
function boardParts(url: string): { user: string; board: string } {
  const [, user = "", board = ""] = new URL(url).pathname.split("/");
  return { user: decodeURIComponent(user), board: decodeURIComponent(board) };
}

/**
 * The link pinit.js turns into a board. Until it does, or if Pinterest doesn't answer (a blocker,
 * its rate limit, no network), it is a card of the widget's size that opens the board.
 */
function boardHtml(url: string): string {
  const { user, board } = boardParts(url);
  return `<a data-pin-do="embedBoard" data-pin-board-width="${BOARD_WIDTH}" data-pin-scale-height="340" data-pin-scale-width="80" href="${escape(url)}" target="_blank" rel="noopener noreferrer" class="flex h-[455px] w-[320px] flex-col justify-between rounded-media border border-line bg-surface p-6 transition-colors duration-200 ease-out-soft hover:border-wine-bright">
  <span class="text-micro text-muted">Tablero de Pinterest</span>
  <span class="block">
    <span class="block font-display text-title italic leading-none text-wine-bright">${escape(board)}</span>
    <span class="mt-3 block text-small text-muted">de ${escape(user)}</span>
  </span>
  <span class="text-micro underline underline-offset-4">Abrir en Pinterest <span aria-hidden="true">↗</span></span>
</a>`;
}

const pinHtml = (url: string) =>
  `<a data-pin-do="embedPin" data-pin-width="medium" href="${escape(url)}" class="text-micro underline">Ver el pin en Pinterest</a>`;

/**
 * Pinterest's official widgets (embedBoard / embedPin): the real pins, served by Pinterest with
 * their author and a link back. pinit.js is loaded once per page (as Pinterest asks), and only
 * when the section gets close to the viewport, so it never weighs on the first load.
 *
 * pinit.js replaces each link with its own markup, so the links go in through innerHTML: React
 * never reconciles nodes it no longer owns (it would try to remove a link that is already gone).
 */
export function PinterestEmbeds({ boards, pins }: { boards: string[]; pins: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // Some links can still be waiting (the widget answered late, or the page came back from another
    // tab): build again once, a few seconds later.
    const buildLeft = () => {
      retry = setTimeout(() => {
        if (element.querySelector("a[data-pin-do]")) window.PinUtils?.build?.();
      }, 3000);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
          window.PinUtils?.build?.(); // after a client-side navigation the script is already there
          buildLeft();
          return;
        }
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = buildLeft;
        document.body.appendChild(script);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(retry);
    };
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
            className="wine-scroll -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 pb-4 lg:-mx-8 lg:scroll-px-8 lg:px-8"
          >
            {boards.map((board) => (
              <li key={board} className="min-h-[455px] w-[320px] shrink-0 snap-start" dangerouslySetInnerHTML={{ __html: boardHtml(board) }} />
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
            <div key={url} className="mb-4 break-inside-avoid" dangerouslySetInnerHTML={{ __html: pinHtml(url) }} />
          ))}
        </div>
      )}
    </div>
  );
}
