"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Catalogue, type FragranceBoard } from "@/lib/api";
import { whatsappUrl } from "@/lib/contact";
import { useCutout, type Cutout } from "@/lib/cutout";
import { InView } from "../motion/InView";
import { cx, textButton } from "../ui";
import { money, PerfumeFilm } from "./PerfumeFilm";

const FEATURED = "erba-pura";
// The film's three covers: the featured fragrance, then two of the most wanted.
const COVERS = ["erba-pura", "le-male-elixir", "good-girl"];

// WhatsApp glyph, Simple Icons v13.21.0 (CC0). Nominative use: it says where the button leads.
const WHATSAPP =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

const ask = (board: FragranceBoard) =>
  whatsappUrl(`Hola! Vengo de Vibear y quiero el mejor precio para ${board.fragrance.name} de ${board.fragrance.house}.`);

type State<T> = { status: "idle" | "loading" | "error" } | { status: "ready"; data: T };

function ago(seconds: number): string {
  const minutes = Math.max(0, Math.round((Date.now() / 1000 - seconds) / 60));
  if (minutes < 2) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx("fill-current", className)}>
      <path d={WHATSAPP} />
    </svg>
  );
}

function BottleImage({ shot, alt, className }: { shot: Cutout; alt: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a shop's CDN photo (or its cut-out blob): not for next/image
    <img
      src={shot.src}
      alt={alt}
      width={shot.width}
      height={shot.height}
      referrerPolicy="no-referrer"
      className={cx("swap-in", !shot.cut && "rounded-media mix-blend-multiply", className)}
    />
  );
}

function Bottle({ board, className }: { board: FragranceBoard; className?: string }) {
  const shot = useCutout(board.image);
  if (!shot) return null;
  return <BottleImage shot={shot} alt={`${board.fragrance.name} de ${board.fragrance.house}`} className={className} />;
}

/**
 * Perfumería: a film of three fragrance covers (PerfumeFilm: the shops' photos, cut out in the
 * browser); then the featured fragrance compared shop by shop, the catalogue (photo, price, where),
 * and a WhatsApp line to the supplier. Prices come from Argentine shops only, in pesos, read by
 * the API and fetched when the section gets close.
 */
export function Perfumery() {
  const ref = useRef<HTMLElement>(null);
  const [catalogue, setCatalogue] = useState<State<Catalogue>>({ status: "idle" });
  const [featured, setFeatured] = useState<State<FragranceBoard>>({ status: "idle" });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setCatalogue({ status: "loading" });
        setFeatured({ status: "loading" });
        const failed = (set: (state: { status: "error" }) => void) => () => !controller.signal.aborted && set({ status: "error" });
        api.fragrances(controller.signal).then((data) => setCatalogue({ status: "ready", data }), failed(setCatalogue));
        api.fragrancePrices(FEATURED, controller.signal).then((data) => setFeatured({ status: "ready", data }), failed(setFeatured));
      },
      { rootMargin: "1200px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, []);

  const items = catalogue.status === "ready" ? catalogue.data.items : [];
  const byId = new Map(items.map((item) => [item.fragrance.id, item]));
  const offers = featured.status === "ready" ? featured.data.offers : [];

  return (
    // overflow-x-clip: the glow spills past the bottles on purpose, but never into a sideways scroll.
    <section
      ref={ref}
      id="perfumeria"
      aria-labelledby="perfumery-title"
      className="page theme-light overflow-x-clip px-4 py-20 lg:px-8 lg:py-28"
    >
      <PerfumeFilm
        boards={COVERS.map((id) => byId.get(id))}
        intro={
          <>
            <p className="text-micro text-wine-bright">Perfumería · tiendas argentinas</p>
            <h2 id="perfumery-title" className="mx-auto mt-4 max-w-[18ch] font-display text-title tracking-tight">
              Potenciá tu outfit con una <span className="italic text-wine-bright">fragancia</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-[46ch] text-small text-muted">
              Frascos originales, con el mejor precio que encontramos hoy en perfumerías de Argentina.
            </p>
          </>
        }
      />

      {/* The featured fragrance, shop by shop (Google Shopping included when there's a SerpApi key). */}
      <div className="mx-auto mt-12 max-w-2xl">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h3 className="text-micro">Erba Pura de Xerjoff · dónde comprarla al mejor precio</h3>
          {featured.status === "ready" && (
            <span className="shrink-0 text-micro tabular-nums text-muted">Actualizado {ago(featured.data.updated_at)}</span>
          )}
        </div>
        {(featured.status === "idle" || featured.status === "loading") && (
          <ul aria-label="Cargando precios" className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex h-14 items-center justify-between">
                <span className="h-3 w-32 bg-surface motion-safe:animate-shimmer" />
                <span className="h-3 w-20 bg-surface motion-safe:animate-shimmer" />
              </li>
            ))}
          </ul>
        )}
        {featured.status === "ready" && offers.length > 0 && (
          <ul aria-label="Precios por tienda" className="divide-y divide-line">
            {offers.map((offer, i) => (
              <li key={`${offer.shop}-${offer.url}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-body">{offer.shop}</span>
                  {i === 0 && <span className="shrink-0 rounded-full bg-wine px-2.5 py-0.5 text-micro text-cream">Mejor precio</span>}
                </span>
                <span className="flex items-center gap-5">
                  <span className="font-mono text-body tabular-nums">{money(offer)}</span>
                  <a href={offer.url} target="_blank" rel="noopener noreferrer" className={textButton}>
                    Ver <span aria-hidden="true">↗</span>
                    <span className="sr-only"> en {offer.shop} (se abre en otra pestaña)</span>
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        {((featured.status === "ready" && offers.length === 0) || featured.status === "error") && (
          <p className="py-8 text-center text-small text-muted">
            No pudimos leer los precios de las tiendas ahora. Escribinos y te pasamos el mejor.
          </p>
        )}
      </div>

      {/* The catalogue, like any shop: the bottle, what it is, the best price and where. */}
      <div className="mx-auto mt-20 max-w-6xl">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h3 className="text-micro">Catálogo</h3>
          {catalogue.status === "ready" && <span className="text-micro tabular-nums text-muted">{items.length} fragancias</span>}
        </div>
        {(catalogue.status === "idle" || catalogue.status === "loading") && (
          <ul aria-label="Cargando catálogo" className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }, (_, i) => (
              <li key={i}>
                <span className="block aspect-[4/5] rounded-media bg-surface motion-safe:animate-shimmer" />
                <span className="mt-3 block h-3 w-2/3 bg-surface motion-safe:animate-shimmer" />
                <span className="mt-2 block h-3 w-1/3 bg-surface motion-safe:animate-shimmer" />
              </li>
            ))}
          </ul>
        )}
        {catalogue.status === "ready" && (
          <ul aria-label="Catálogo de fragancias" className="mt-6 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {items.map((board) => (
              <li key={board.fragrance.id}>
                <PerfumeCard board={board} />
              </li>
            ))}
          </ul>
        )}
        {catalogue.status === "error" && (
          <p className="py-10 text-center text-small text-muted">
            No pudimos leer el catálogo ahora. Escribinos y te pasamos precios y stock.
          </p>
        )}
        <p className="mt-8 text-micro normal-case tracking-normal text-muted">
          Precio de lista en pesos, publicado por cada perfumería argentina, solo frascos en stock. Puede cambiar:
          confirmalo antes de comprar.
        </p>
      </div>

      {/* The supplier's direct line: wa.me opens the chat with the message already written. A light runs
          round its border, a shine crosses it and the WhatsApp mark pings (loops that pause off-screen). */}
      <InView className="mt-16 flex flex-col items-center gap-4 text-center">
        <a
          href={whatsappUrl("Hola! Vengo de Vibear y quiero precios de perfumes originales.")}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative isolate inline-flex overflow-hidden rounded-full p-[3px] shadow-[0_18px_50px_-12px_rgb(163_32_58/0.55)] transition-transform duration-200 ease-out-soft hover:scale-[1.03]"
        >
          <span
            aria-hidden="true"
            className="supplier-ring motion-loop absolute left-1/2 top-1/2 -z-10 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,var(--color-wine)_0%_50%,var(--color-wine-bright)_72%,var(--color-cream)_86%,var(--color-wine-bright)_92%,var(--color-wine)_100%)]"
          />
          <span className="relative flex items-center gap-4 overflow-hidden rounded-full bg-wine py-3 pl-3 pr-6 text-cream sm:pr-8">
            <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-cream text-wine">
              <span aria-hidden="true" className="hotspot-ring motion-loop absolute inset-0 rounded-full border-2 border-cream" />
              <WhatsAppGlyph className="h-6 w-6" />
            </span>
            <span className="flex flex-col text-left">
              <span className="text-micro text-cream/70">¿Querés mejores precios?</span>
              <span className="font-display text-cta italic">Hablá con el proveedor</span>
            </span>
            <span
              aria-hidden="true"
              className="hidden text-body transition-transform duration-200 ease-out-soft group-hover:translate-x-1 sm:inline"
            >
              →
            </span>
            <span
              aria-hidden="true"
              className="supplier-shine motion-loop pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[linear-gradient(100deg,transparent,rgb(255_255_255/0.28),transparent)]"
            />
          </span>
        </a>
        <span className="flex items-center gap-2 text-micro normal-case tracking-normal text-muted">
          <span aria-hidden="true" className="blink motion-loop size-1.5 rounded-full bg-wine-bright" />
          Te responde por WhatsApp
        </span>
      </InView>
    </section>
  );
}

function PerfumeCard({ board }: { board: FragranceBoard }) {
  const { fragrance, offers } = board;
  const best = offers[0];
  const id = `perfume-${fragrance.id}`;
  return (
    <article aria-labelledby={id} className="flex h-full flex-col">
      <div className="relative flex aspect-[4/5] items-end justify-center overflow-hidden rounded-media bg-surface px-[12%] pb-[10%] pt-[12%]">
        <span aria-hidden="true" className="absolute inset-x-[18%] bottom-[7%] h-[7%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(0_0_0/0.16),transparent)]" />
        <Bottle board={board} className="relative max-h-full w-auto max-w-full object-contain drop-shadow-[0_12px_14px_rgb(0_0_0/0.14)]" />
      </div>
      <p className="mt-3 truncate text-micro text-muted">{fragrance.house}</p>
      <h4 id={id} className="mt-1 text-body font-medium leading-snug">
        {fragrance.name}
      </h4>
      <p className="mt-0.5 line-clamp-1 text-small text-muted">{fragrance.notes}</p>
      <p className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-body tabular-nums">{best ? money(best) : "Sin stock"}</span>
        <span className="shrink-0 text-micro tabular-nums text-muted">{fragrance.size_ml} ml</span>
      </p>
      <p className="mt-0.5 truncate text-micro normal-case tracking-normal text-muted">
        {best ? `en ${best.shop}${offers.length > 1 ? ` · ${offers.length} tiendas` : ""}` : "Consultanos por WhatsApp"}
      </p>
      {offers.length > 1 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-micro text-muted underline underline-offset-4">Comparar {offers.length} tiendas</summary>
          <ul className="mt-1 divide-y divide-line">
            {offers.map((offer) => (
              <li key={offer.url} className="flex items-center justify-between gap-2 py-1.5 text-small">
                <a href={offer.url} target="_blank" rel="noopener noreferrer" className="truncate underline-offset-4 hover:underline">
                  {offer.shop}
                </a>
                <span className="font-mono tabular-nums">{money(offer)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {/* Last and pushed down, so the buttons line up across a row whatever is above them. */}
      <div className="mt-auto flex items-center gap-2 pt-3">
        {best && (
          <a
            href={best.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 flex-1 items-center justify-center gap-1 bg-ink px-3 text-micro text-paper transition-colors duration-200 ease-out-soft hover:bg-wine-bright"
          >
            Comprar <span aria-hidden="true">↗</span>
            <span className="sr-only">
              {" "}
              {fragrance.name} en {best.shop} (se abre en otra pestaña)
            </span>
          </a>
        )}
        <a
          href={ask(board)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Consultar ${fragrance.name} por WhatsApp`}
          className={cx(
            "inline-flex h-10 items-center justify-center gap-2 border border-ink text-micro transition-colors duration-200 ease-out-soft hover:bg-ink hover:text-paper",
            best ? "w-10" : "flex-1 px-3",
          )}
        >
          <WhatsAppGlyph className="h-4 w-4" />
          {!best && "Consultar"}
        </a>
      </div>
    </article>
  );
}
