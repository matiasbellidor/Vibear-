"use client";

import Link from "next/link";
import { imageUrl } from "@/lib/api";
import { pad } from "@/lib/labels";
import { useRecentLooks, type RecentLook } from "@/lib/storage";
import { FadeImage } from "./FadeImage";
import { MasonryGrid } from "./MasonryGrid";

const CAPTION = 30;

function countLabel(look: RecentLook): string {
  if (look.count === 0) return "Foto completa";
  return look.count === 1 ? "1 prenda" : `${look.count} prendas`;
}

export function RecentLooks() {
  const looks = useRecentLooks();
  if (looks.length === 0) return null;

  return (
    <section aria-labelledby="recent-title" className="mt-24 px-4 lg:px-8">
      <div className="mb-5 flex items-baseline justify-between border-b border-line pb-3">
        <h2 id="recent-title" className="text-micro">
          Tus looks
        </h2>
        <span className="text-micro tabular-nums text-muted">{pad(looks.length)}</span>
      </div>
      <MasonryGrid
        items={looks}
        label="Tus looks recientes"
        itemKey={(look) => look.image_id}
        ratio={(look) => look.height / look.width}
        caption={CAPTION}
        minColumnWidth={170}
        maxColumns={6}
        renderItem={(look) => (
          <Link href={`/look/${look.image_id}`} className="group block">
            <div
              className="relative overflow-hidden rounded-media bg-surface"
              style={{ aspectRatio: `${look.width} / ${look.height}` }}
            >
              <FadeImage src={imageUrl(look.image_id)} alt="Look buscado" className="h-full w-full object-cover" />
              <span
                aria-hidden="true"
                className="absolute inset-0 bg-ink/20 opacity-0 transition-opacity duration-200 ease-out-soft group-hover:opacity-100"
              />
            </div>
            <p className="pt-2 text-micro text-muted" style={{ height: CAPTION }}>
              {countLabel(look)}
            </p>
          </Link>
        )}
      />
    </section>
  );
}
