"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useSaved } from "@/lib/storage";
import { cx } from "./ui";

export function Header() {
  const pathname = usePathname();
  const { items } = useSaved();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper">
      <div className="flex h-14 items-center justify-between px-4 lg:px-8">
        <Link href="/" aria-label="Vibear, inicio" className="font-display text-logo tracking-[0.22em]">
          VIBEAR
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-6">
          <NavLink href="/scan" active={pathname === "/scan" || pathname.startsWith("/look")}>
            Escanear
          </NavLink>
          <NavLink href="/saved" active={pathname === "/saved"}>
            Guardados{items.length > 0 && <span className="tabular-nums"> ({items.length})</span>}
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "py-3 text-micro decoration-1 underline-offset-[6px] hover:underline",
        active && "underline decoration-wine-bright",
      )}
    >
      {children}
    </Link>
  );
}
