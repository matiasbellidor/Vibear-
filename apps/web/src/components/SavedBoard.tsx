"use client";

import Link from "next/link";
import { pad } from "@/lib/labels";
import { ratioOf } from "@/lib/masonry";
import { useSaved } from "@/lib/storage";
import { MasonryGrid } from "./MasonryGrid";
import { CARD_CAPTION, ProductCard } from "./ProductCard";
import { primaryButton } from "./ui";

/** The moodboard: everything the user bookmarked, newest first. Lives in this browser only. */
export function SavedBoard() {
  const { items } = useSaved();

  return (
    <div className="px-4 pb-10 pt-8 lg:px-8">
      <header className="flex items-end justify-between border-b border-line pb-4">
        <h1 className="font-display text-title tracking-tight">Guardados</h1>
        <p className="text-micro tabular-nums text-muted">{pad(items.length)}</p>
      </header>

      {items.length === 0 ? (
        <div className="mx-auto max-w-md py-24 text-center">
          <p className="text-body">Todavía no guardaste nada.</p>
          <p className="mt-2 text-small text-muted">
            Tocá el marcador de cualquier resultado y armá tu moodboard acá.
          </p>
          <Link href="/scan" className={`${primaryButton} mt-8`}>
            Escanear un look
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <MasonryGrid
            items={items}
            label="Productos guardados"
            itemKey={(item) => item.link}
            ratio={(item) => ratioOf(item.thumbnail_width, item.thumbnail_height)}
            caption={CARD_CAPTION}
            minColumnWidth={200}
            maxColumns={5}
            renderItem={(item) => <ProductCard match={item} />}
          />
        </div>
      )}
    </div>
  );
}
