"use client";

import Link from "next/link";
import { pad } from "@/lib/labels";
import type { Pin } from "@/lib/landing";
import { ratioOf } from "@/lib/masonry";
import { useSaved } from "@/lib/storage";
import { MasonryGrid } from "./MasonryGrid";
import { CARD_CAPTION, ProductCard } from "./ProductCard";
import { ProfileCard } from "./style/StyleEntry";
import { ClosetBanner } from "./TabBanners";
import { primaryButton } from "./ui";

/**
 * The closet ("placard"): everything the user bookmarked, newest first. It lives in this browser,
 * with an anonymous backup in the API (lib/storage.ts) so Safari's 7-day purge doesn't erase it.
 */
export function SavedBoard({ preview = [] }: { preview?: Pin[] }) {
  const { items } = useSaved();
  const mine = items.flatMap((item) => (item.thumbnail ? [{ key: item.link, src: item.thumbnail }] : [])).slice(0, 5);
  const example = mine.length === 0;

  return (
    <div className="px-4 pb-10 pt-8 lg:px-8">
      <header className="flex items-end justify-between border-b border-line pb-4">
        <h1 className="font-display text-title tracking-tight">Guardados</h1>
        <p className="text-micro tabular-nums text-muted">
          {pad(items.length)} {items.length === 1 ? "producto" : "productos"}
        </p>
      </header>

      <ProfileCard />

      <ClosetBanner cards={example ? preview.map((pin) => ({ key: pin.src, src: pin.src })) : mine} example={example} />

      {items.length === 0 ? (
        <div className="mx-auto max-w-md pb-6 text-center">
          <p className="font-display text-title tracking-tight">
            Tu <span className="italic text-wine-bright">placard</span>
          </p>
          <p className="mt-5 text-body">Todavía no guardaste nada.</p>
          <p className="mt-2 text-small text-muted">Tocá el marcador de cualquier resultado y armá tu placard acá.</p>
          <Link href="/scan" transitionTypes={["nav-back"]} className={`${primaryButton} mt-8`}>
            Escanear un look
          </Link>
        </div>
      ) : (
        <div className="mt-2">
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

      <p className="mx-auto mt-12 max-w-[72ch] text-center text-micro normal-case tracking-normal text-muted">
        Tu placard se guarda en este navegador, con una copia anónima en Vibear (sin cuenta). En iPhone, Safari borra
        los datos de las páginas que no abrís en 7 días: con esa copia tu placard vuelve, salvo que borres los datos de
        Safari o uses navegación privada.
      </p>
    </div>
  );
}
