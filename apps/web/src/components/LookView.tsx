"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api, type BrandGuess, type Look, type SearchMode, type SearchResult } from "@/lib/api";
import { garmentName } from "@/lib/labels";
import { ratioOf } from "@/lib/masonry";
import { forgetLook, rememberLook } from "@/lib/storage";
import { GarmentRail } from "./GarmentRail";
import { LookCanvas } from "./LookCanvas";
import { MasonryGrid } from "./MasonryGrid";
import { NearbyPanel, brandsFrom } from "./NearbyPanel";
import { CARD_CAPTION, ProductCard } from "./ProductCard";
import { LookSkeleton, ResultsSkeleton } from "./Skeletons";
import { PaletteBadge } from "./style/StyleEntry";
import { Icon, Notice, icons, primaryButton, textButton } from "./ui";

type Loaded<T> = { status: "ready"; data: T } | { status: "error"; message: string; code: number };

function failure(error: unknown): { status: "error"; message: string; code: number } {
  return error instanceof ApiError
    ? { status: "error", message: error.message, code: error.status }
    : { status: "error", message: "Algo salió mal. Probá de nuevo.", code: -1 };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Results are stored with the key they answer, so a stale response never shows for a new selection. */
export function LookView({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const [look, setLook] = useState<{ id: string; result: Loaded<Look> } | null>(null);
  const [search, setSearch] = useState<{ key: string; result: Loaded<SearchResult> } | null>(null);
  const [mode, setMode] = useState<SearchMode | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api.look(id, controller.signal).then(
      (data) => {
        rememberLook(data);
        setLook({ id, result: { status: "ready", data } });
      },
      (error) => {
        if (isAbort(error)) return;
        if (error instanceof ApiError && error.status === 404) forgetLook(id);
        setLook({ id, result: failure(error) });
      },
    );
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    api.health().then(
      (health) => setMode(health.search),
      () => setMode(null),
    );
  }, []);

  const current = look?.id === id ? look.result : null;
  const items = current?.status === "ready" ? current.data.items : [];
  const requested = searchParams.get("item");
  const selected = items.find((item) => item.crop_id === requested) ?? items[0];
  const searchKey = selected ? `${selected.crop_id}:${attempt}` : null;

  useEffect(() => {
    if (!selected || !searchKey) return;
    const controller = new AbortController();
    api.search(selected.crop_id, selected.label, controller.signal).then(
      (data) => setSearch({ key: searchKey, result: { status: "ready", data } }),
      (error) => {
        if (!isAbort(error)) setSearch({ key: searchKey, result: failure(error) });
      },
    );
    return () => controller.abort();
  }, [selected, searchKey]);

  if (!current) return <LookSkeleton />;
  if (current.status === "error") return <LookMissing message={current.message} />;

  const results = search?.key === searchKey ? search.result : null;
  // Native history (synced with useSearchParams by Next): switching garments needs no server round-trip.
  const select = (cropId: string) => window.history.replaceState(null, "", `/look/${id}?item=${cropId}`);

  return (
    <div className="px-4 pb-10 pt-4 lg:grid lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pt-6">
      {/* Sticky like a product page; scrolls on its own if photo + rail are taller than the window. */}
      <aside className="lg:sticky lg:top-20 lg:col-span-5 lg:-ml-1 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-2 lg:pl-1 lg:pr-2">

        <Link href="/scan" className="inline-flex items-center gap-2 py-2 text-micro hover:underline">
          <Icon path={icons.arrowLeft} /> Nueva búsqueda
        </Link>
        <div className="mt-3">
          <LookCanvas look={current.data} selectedId={selected.crop_id} onSelect={select} />
        </div>
        <GarmentRail items={items} selectedId={selected.crop_id} onSelect={select} />
      </aside>

      <section aria-labelledby="results-title" className="mt-10 lg:col-span-7 lg:mt-0">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
          <div>
            <h1 id="results-title" className="font-display text-title tracking-tight">
              {garmentName(selected)}
            </h1>
            <div className="mt-2 empty:hidden">
              <PaletteBadge color={selected.color} />
            </div>
          </div>
          <p className="text-micro tabular-nums text-muted">
            {results?.status === "ready" ? `${results.data.results.length} resultados · por similitud` : "Buscando…"}
          </p>
        </header>
        {results?.status === "ready" && (
          <BrandLine
            guess={results.data.brand ?? null}
            hint={selected.brand ?? null}
            similar={selected.similar ?? null}
            searched={mode === "serpapi"}
          />
        )}

        <div className="mt-4">
          <NearbyPanel
            brands={results?.status === "ready" ? brandsFrom(results.data.results.map((match) => match.source)) : []}
          />
        </div>

        {mode === "demo" && (
          <div className="mt-4">
            <Notice>
              Modo demo: los resultados salen de un catálogo de ejemplo con fotos libres, no de tiendas. Agregá tu key
              de SerpApi para ver productos reales.
            </Notice>
          </div>
        )}

        <div className="mt-6">
          {!results && <ResultsSkeleton />}
          {results?.status === "error" && (
            <Notice
              urgent
              action={
                <button type="button" className={textButton} onClick={() => setAttempt((n) => n + 1)}>
                  Reintentar
                </button>
              }
            >
              {results.message}
            </Notice>
          )}
          {results?.status === "ready" && results.data.results.length === 0 && (
            <p className="py-16 text-center text-small text-muted">
              {mode === "demo"
                ? "El catálogo de ejemplo no tiene nada parecido a esta prenda. Probá con otra."
                : "No encontramos en tiendas argentinas prendas que se parezcan de verdad. Probá con otra prenda o una foto más de cerca."}
            </p>
          )}
          {results?.status === "ready" && results.data.results.length > 0 && (
            <MasonryGrid
              items={results.data.results}
              label={`Resultados para ${garmentName(selected)}`}
              itemKey={(match, index) => `${index}-${match.link}`}
              ratio={(match) => ratioOf(match.thumbnail_width, match.thumbnail_height)}
              caption={CARD_CAPTION}
              minColumnWidth={200}
              maxColumns={4}
              renderItem={(match) => <ProductCard match={match} />}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Which brand it is, when the results agree (or the photo says so). Otherwise, honestly, none, with
 * the design's reference when it is someone's signature ("Símil Polo Ralph Lauren").
 */
function BrandLine({
  guess,
  hint,
  similar,
  searched,
}: {
  guess: BrandGuess | null;
  hint: string | null;
  similar: string | null;
  searched: boolean;
}) {
  if (!guess && !hint && !similar && !searched) return null;
  return (
    <p className="mt-3 flex items-center gap-2 text-small text-muted">
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-wine-bright" />
      {guess ? (
        <span>
          Marca probable: <span className="text-ink">{guess.name}</span> · la mencionan {guess.count} de {guess.total}{" "}
          resultados
        </span>
      ) : hint ? (
        <span>
          Posible marca: <span className="text-ink">{hint}</span> (por la foto)
        </span>
      ) : similar ? (
        <span>
          Sin marca identificada: <span className="text-ink">símil {similar}</span>, por el diseño. Te mostramos los más
          parecidos.
        </span>
      ) : (
        <span>No identificamos la marca: te mostramos los diseños más parecidos.</span>
      )}
    </p>
  );
}

function LookMissing({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-28 text-center">
      <p className="font-display text-title tracking-tight">Ups</p>
      <p className="mt-4 text-small text-muted">{message}</p>
      <Link href="/scan" className={`${primaryButton} mt-8`}>
        Nueva búsqueda
      </Link>
    </div>
  );
}
