import type { ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Filled, sharp, uppercase, wine: the only primary action style in Vibear. */
export const primaryButton =
  "inline-flex h-12 items-center justify-center gap-3 bg-wine px-7 text-micro text-cream transition-colors duration-200 ease-out-soft hover:bg-wine-deep disabled:bg-muted";

/** The primary action on a wine section: cream with wine text. */
export const creamButton =
  "inline-flex h-12 items-center justify-center gap-3 bg-cream px-7 text-micro text-wine transition-colors duration-200 ease-out-soft hover:bg-paper";

/** Secondary action: a sharp 1px ink frame. */
export const outlineButton =
  "inline-flex h-11 items-center justify-center gap-2 border border-ink px-5 text-micro transition-colors duration-200 ease-out-soft hover:bg-ink hover:text-paper disabled:border-line disabled:text-muted disabled:hover:bg-transparent";

export const textButton = "text-micro underline decoration-1 underline-offset-[6px] hover:no-underline";

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
  arrowRight: "M3 12h17M14 6l6 6-6 6",
  arrowLeft: "M21 12H4M10 6l-6 6 6 6",
  arrowUpRight: "M7 17 17 7M8 7h9v9",
  pin: "M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21zM12 12.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  target: "M12 3v3M12 18v3M3 12h3M18 12h3M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z",
  close: "M6 6l12 12M18 6 6 18",
};
