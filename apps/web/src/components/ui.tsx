import type { ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Filled, sharp, uppercase: white on the black stage, wine on hover. The only primary action style. */
export const primaryButton =
  "inline-flex h-12 items-center justify-center gap-3 bg-ink px-7 text-micro text-paper transition-colors duration-200 ease-out-soft hover:bg-wine-bright disabled:bg-muted";

/** The primary action on a wine section: cream with wine text. */
export const creamButton =
  "inline-flex h-12 items-center justify-center gap-3 bg-cream px-7 text-micro text-wine transition-colors duration-200 ease-out-soft hover:bg-paper";

/** Secondary action: a sharp 1px ink frame. */
export const outlineButton =
  "inline-flex h-11 items-center justify-center gap-2 border border-ink px-5 text-micro transition-colors duration-200 ease-out-soft hover:bg-ink hover:text-paper disabled:border-line disabled:text-muted disabled:hover:bg-transparent";

/**
 * A small link's touch area grown to ~40px tall with an invisible pseudo-element, so a micro label
 * stays a micro label on screen but is easy to hit with a thumb.
 */
export const tapArea = "relative after:absolute after:-inset-x-1.5 after:-inset-y-3 after:content-['']";

export const textButton = `text-micro underline decoration-1 underline-offset-[6px] hover:no-underline ${tapArea}`;

/** One-line message between hairlines: demo mode, recoverable errors. */
export function Notice({
  children,
  action,
  urgent = false,
}: {
  children: ReactNode;
  action?: ReactNode;
  urgent?: boolean;
}) {
  return (
    <div
      role={urgent ? "alert" : "status"}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y border-line py-3"
    >
      <p className="text-small">{children}</p>
      {action}
    </div>
  );
}

export function Icon({ path, filled = false, className }: { path: string; filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

export const icons = {
  bookmark: "M6 3.5h12v17l-6-4.5-6 4.5z",
  home: "M3.5 10.5 12 3.8l8.5 6.7v9.7h-5.7v-6h-5.6v6H3.5z",
  scan: "M3.5 8V3.5H8M16 3.5h4.5V8M20.5 16v4.5H16M8 20.5H3.5V16M3.5 12h17",
  arrowRight: "M3 12h17M14 6l6 6-6 6",
  arrowLeft: "M21 12H4M10 6l-6 6 6 6",
  arrowUpRight: "M7 17 17 7M8 7h9v9",
  pin: "M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21zM12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z",
  close: "M6 6l12 12M18 6 6 18",
  hanger: "M10 5.5a2 2 0 1 1 2 2v2.2M12 9.7 3.5 16.5h17z",
  camera: "M4 7.5h3.5L9 5h6l1.5 2.5H20v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  download: "M12 4v11M7 10l5 5 5-5M5 19.5h14",
};
