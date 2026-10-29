"use client";

import Link from "next/link";
import { pad } from "@/lib/labels";
import { ratioOf } from "@/lib/masonry";
import { useSaved } from "@/lib/storage";
import { MasonryGrid } from "./MasonryGrid";
import type { Pin } from "@/lib/landing";
import { Photo } from "./landing/Photo";
import { CARD_CAPTION, ProductCard } from "./ProductCard";
import { Icon, icons, primaryButton } from "./ui";


/** The moodboard: everything the user bookmarked, newest first. Lives in this browser only. */
export function SavedBoard({ preview = [] }: { preview?: Pin[] }) {
  const { items } = useSaved();

  return (
    <div className="px-4 pb-10 pt-8 lg:px-8">
      <header className="flex items-end justify-between border-b border-line pb-4">
        <h1 className="font-display text-title tracking-tight">Guardados</h1>
        <p className="text-micro tabular-nums text-muted">{pad(items.length)}</p>
      </header>

      {items.length === 0 ? (
        <div className="grid items-center gap-12 py-12 lg:grid-cols-12 lg:gap-10 lg:py-16">
          <div className="lg:col-span-5">
            <p className="font-display text-title tracking-tight">
              Tu <span className="italic text-wine-bright">moodboard</span>
            </p>
            <p className="mt-5 text-body">Todavía no guardaste nada.</p>
            <p className="mt-2 max-w-[40ch] text-small text-muted">
              Tocá el marcador de cualquier resultado y armá tu tablero acá: queda guardado en este navegador.
            </p>
            <Link href="/scan" className={`${primaryButton} mt-8`}>
              Escanear un look
            </Link>
          </div>
          <figure aria-hidden="true" className="lg:col-span-7">
            {/* A preview of what a board looks like (decorative, so CSS columns are fine here). */}
            <div className="columns-3 gap-3 opacity-90 sm:gap-4">
              {preview.map((pin) => (
                <div key={pin.src} className="relative mb-3 break-inside-avoid sm:mb-4">
                  <Photo photo={pin} />
                  <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center bg-wine text-cream">
                    <Icon path={icons.bookmark} filled />
                  </span>
                </div>
              ))}
            </div>
            <figcaption className="mt-3 text-micro text-muted">Así se va a ver tu tablero</figcaption>
          </figure>
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
