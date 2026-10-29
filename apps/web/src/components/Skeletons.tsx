"use client";

import { CARD_CAPTION } from "./ProductCard";
import { MasonryGrid } from "./MasonryGrid";

const RATIOS = [1.3, 1.5, 1.15, 1.4, 1.25, 1.6, 1.35, 1.2, 1.45, 1.3, 1.55, 1.25];

const shimmer =
  "bg-[linear-gradient(90deg,var(--color-surface)_0%,var(--color-surface-strong)_50%,var(--color-surface)_100%)] bg-[length:200%_100%] motion-safe:animate-shimmer";

export function ResultsSkeleton({ maxColumns = 4 }: { maxColumns?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Buscando resultados…</p>
      <MasonryGrid
        items={RATIOS}
        label="Cargando resultados"
        itemKey={(_, index) => String(index)}
        ratio={(ratio) => ratio}
        caption={CARD_CAPTION}
        minColumnWidth={200}
        maxColumns={maxColumns}
        renderItem={(ratio) => (
          <div aria-hidden="true">
            <div className={`rounded-media ${shimmer}`} style={{ aspectRatio: `1 / ${ratio}` }} />
            <div className="space-y-2 pt-3" style={{ height: CARD_CAPTION }}>
              <div className={`h-2.5 w-1/3 ${shimmer}`} />
              <div className={`h-3 w-4/5 ${shimmer}`} />
            </div>
          </div>
        )}
      />
    </div>
  );
}

export function LookSkeleton() {
  return (
    <div aria-busy="true" className="px-4 pb-10 pt-6 lg:grid lg:grid-cols-12 lg:gap-10 lg:px-8">
      <p className="sr-only">Cargando el look…</p>
      <div className="lg:col-span-5">
        <div className={`mt-12 aspect-[3/4] max-h-[55vh] rounded-media ${shimmer}`} />
      </div>
      <div className="mt-10 lg:col-span-7 lg:mt-0">
        <div className={`mb-6 h-12 w-1/2 ${shimmer}`} />
        <ResultsSkeleton />
      </div>
    </div>
  );
}
