import type { ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Filled, sharp, uppercase: the only primary action style in Vibear. */
export const primaryButton =
  "inline-flex h-12 items-center justify-center gap-3 bg-ink px-7 text-micro text-paper transition-colors duration-200 ease-out-soft hover:bg-ink/85 disabled:bg-muted";

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
};
