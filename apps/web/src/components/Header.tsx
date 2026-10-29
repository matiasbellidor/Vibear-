"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, ViewTransition, useEffect } from "react";
import { syncCloset, useSaved } from "@/lib/storage";
import { Icon, cx, icons } from "./ui";

// The tabs in order. Picking a tab to the right slides the page left, and the other way round
// (PageTransition); the wine pill morphs from the old tab to the new one.
const TABS = [
  { href: "/", label: "Inicio", icon: icons.home },
  { href: "/scan", label: "Escanear", icon: icons.scan },
  { href: "/saved", label: "Guardados", icon: icons.bookmark },
] as const;

function tabOf(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/scan" || pathname.startsWith("/look/")) return 1;
  if (pathname === "/saved") return 2;
  return -1;
}

export function Header() {
  // The header is on every page, so it is where the closet backup syncs, once per load.
  useEffect(syncCloset, []);

  return (
    // Named, so it stays put while the page underneath slides (see globals.css).
    <header className="sticky top-0 z-30 border-b border-line bg-paper" style={{ viewTransitionName: "site-header" }}>
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-8">
        <Link
          href="/"
          aria-label="Vibear, inicio"
          className="font-display text-logo tracking-[0.16em] sm:tracking-[0.22em]"
        >
          VIBEAR
        </Link>
        {/* The active tab depends on the URL, which the prerendered shell of /look/[id] can't know. */}
        <Suspense fallback={<Tabs active={-1} />}>
          <CurrentTabs />
        </Suspense>
      </div>
    </header>
  );
}

function CurrentTabs() {
  return <Tabs active={tabOf(usePathname())} />;
}

function Tabs({ active }: { active: number }) {
  const { items } = useSaved();

  return (
    <nav aria-label="Principal">
      <ul className="flex items-center gap-1 sm:gap-2">
        {TABS.map((tab, i) => {
          const current = i === active;
          const count = tab.href === "/saved" ? items.length : 0;
          const pill = (
            <span
              className={cx(
                "flex h-9 items-center gap-2 rounded-full text-micro transition-colors duration-200 ease-out-soft",
                current ? "bg-wine px-3.5 text-cream" : "px-2.5 text-ink/70 hover:bg-surface hover:text-ink sm:px-3.5",
              )}
            >
              <Icon path={tab.icon} filled={current && tab.href === "/saved"} />
              {/* On phones only the current tab shows its name; the others keep it for screen readers. */}
              <span className={current ? undefined : "sr-only sm:not-sr-only"}>{tab.label}</span>
              {count > 0 && <span className="tabular-nums">{count}</span>}
            </span>
          );
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-label={count > 0 ? `${tab.label} (${count})` : tab.label}
                aria-current={current ? "page" : undefined}
                transitionTypes={active < 0 || current ? undefined : [i > active ? "nav-forward" : "nav-back"]}
                className="block rounded-full"
              >
                {current ? (
                  <ViewTransition name="nav-pill" share="nav-pill" default="none">
                    {pill}
                  </ViewTransition>
                ) : (
                  pill
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
