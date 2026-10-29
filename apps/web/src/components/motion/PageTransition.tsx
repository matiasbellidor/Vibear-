import { ViewTransition, type ReactNode } from "react";

// Tab changes slide in the direction of the tab picked (the Header tags each link with
// nav-forward or nav-back); any other navigation crossfades. Keyframes in globals.css.
const MOTION = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "page-fade" };

/** Wraps a page's content. It goes in each page.tsx: layouts persist, so they never enter or exit. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={MOTION} exit={MOTION} default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
