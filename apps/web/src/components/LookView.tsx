"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api, type Look, type SearchMode, type SearchResult } from "@/lib/api";
import { labelFor } from "@/lib/labels";
import { ratioOf } from "@/lib/masonry";
import { forgetLook, rememberLook } from "@/lib/storage";
import { GarmentRail } from "./GarmentRail";
import { LookCanvas } from "./LookCanvas";
import { MasonryGrid } from "./MasonryGrid";
import { CARD_CAPTION, ProductCard } from "./ProductCard";
import { LookSkeleton, ResultsSkeleton } from "./Skeletons";
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
  const router = useRouter();
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
    api.search(selected.crop_id, controller.signal).then(
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
  const select = (cropId: string) => router.replace(`/look/${id}?item=${cropId}`, { scroll: false });

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
          <h1 id="results-title" className="font-display text-title tracking-tight">
            {labelFor(selected.label)}
          </h1>
          <p className="text-micro tabular-nums text-muted">
            {results?.status === "ready" ? `${results.data.results.length} resultados · por similitud` : "Buscando…"}
          </p>
        </header>

        {mode === "demo" && (
          <Notice>
            Modo demo: los resultados son tus propias fotos, no productos reales. Agregá tu key de SerpApi para ver
            tiendas.
          </Notice>
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
                ? "En modo demo los resultados salen de tus otras fotos. Subí un par más y volvé a probar."
                : "Google Lens no encontró nada para esta prenda. Probá con otra."}
            </p>
          )}
          {results?.status === "ready" && results.data.results.length > 0 && (
            <MasonryGrid
              items={results.data.results}
              label={`Resultados para ${labelFor(selected.label)}`}
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
