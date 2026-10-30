"use client";

import { useEffect, useRef, useState } from "react";
import { api, type FragranceBoard, type Offer } from "@/lib/api";
import { whatsappUrl } from "@/lib/contact";
import { cx } from "../ui";
import { PerfumeBottles } from "./PerfumeBottles";

const FRAGRANCE = "erba-pura";

// WhatsApp glyph, Simple Icons v13.21.0 (CC0). Nominative use: it says where the button leads.
const WHATSAPP =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

type State = { status: "idle" | "loading" | "error" } | { status: "ready"; board: FragranceBoard };

function money(offer: Offer): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: offer.currency,
    maximumFractionDigits: offer.currency === "ARS" ? 0 : 2,
  }).format(offer.price);
}

function ago(seconds: number): string {
  const minutes = Math.max(0, Math.round((Date.now() / 1000 - seconds) / 60));
  if (minutes < 2) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}

/**
 * "Potenciá tu outfit con una fragancia": glowing bottles as it scrolls in, then where to buy at the
 * best price (read from several shops by the API, fetched only when this part gets close), and a
 * direct WhatsApp line to the supplier for better prices.
 */
export function Fragrance() {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setState({ status: "loading" });
        api.fragrancePrices(FRAGRANCE, controller.signal).then(
          (board) => setState({ status: "ready", board }),
          () => !controller.signal.aborted && setState({ status: "error" }),
        );
      },
      { rootMargin: "300px" },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, []);

  const offers = state.status === "ready" ? state.board.offers : [];
  // The API sorts pesos first, then cheapest. Prices in different currencies can't be compared
  // honestly without an exchange rate, so the badge names its currency when there are several.
  const currencies = new Set(offers.map((offer) => offer.currency));
  const best = offers[0];

  return (
    // overflow-x-clip: the glow spills past the bottles on purpose, but never into a sideways scroll.
    <div aria-labelledby="fragrance-title" role="group" className="mt-24 overflow-x-clip lg:mt-32">
      <div className="text-center">
        <p className="text-micro text-wine-bright">Nuevo · Fragancias</p>
        <h3 id="fragrance-title" className="mx-auto mt-4 max-w-[18ch] font-display text-title tracking-tight">
          Potenciá tu outfit con una <span className="italic text-wine-bright">fragancia</span>.
        </h3>
        <p className="mx-auto mt-4 max-w-[46ch] text-small text-muted">
          Erba Pura de Xerjoff: frutas cítricas, ámbar, vainilla y almizcle. Cálida, luminosa y de las que se
          recuerdan.
        </p>
      </div>

      <PerfumeBottles />

      <div ref={ref} className="mx-auto mt-14 max-w-2xl">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h4 className="text-micro">Dónde comprarla al mejor precio</h4>
          {state.status === "ready" && (
            <span className="text-micro tabular-nums text-muted">Actualizado {ago(state.board.updated_at)}</span>
          )}
        </div>

        {(state.status === "idle" || state.status === "loading") && (
          <ul aria-label="Cargando precios" className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex h-14 items-center justify-between">
                <span className="h-3 w-32 bg-surface motion-safe:animate-shimmer" />
                <span className="h-3 w-20 bg-surface motion-safe:animate-shimmer" />
              </li>
            ))}
          </ul>
        )}

        {state.status === "ready" && offers.length > 0 && (
          <ul aria-label="Precios por tienda" className="divide-y divide-line">
            {offers.map((offer) => (
              <li key={`${offer.shop}-${offer.url}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-4">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-body">{offer.shop}</span>
                  {offer === best && (
                    <span className="shrink-0 rounded-full bg-wine px-2.5 py-0.5 text-micro text-cream">
                      {currencies.size > 1 ? `Mejor precio en ${offer.currency}` : "Mejor precio"}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-5">
                  <span className="font-mono text-body tabular-nums">{money(offer)}</span>
                  <a href={offer.url} target="_blank" rel="noopener noreferrer" className="text-micro underline underline-offset-4 hover:no-underline">
                    Ver <span aria-hidden="true">↗</span>
                    <span className="sr-only"> en {offer.shop} (se abre en otra pestaña)</span>
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}

        {((state.status === "ready" && offers.length === 0) || state.status === "error") && (
          <p className="py-8 text-center text-small text-muted">
            No pudimos leer los precios de las tiendas ahora. Escribinos y te pasamos el mejor.
          </p>
        )}

        <p className={cx("mt-4 text-micro normal-case tracking-normal text-muted", state.status !== "ready" && "invisible")}>
          Precios publicados por cada tienda{currencies.size > 1 ? ", en su moneda" : ""}. Pueden cambiar: confirmalos antes
          de comprar.
        </p>

        {/* The supplier's direct line: wa.me opens the chat with the message already written. */}
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <a
            href={whatsappUrl("Hola! Vengo de Vibear y quiero el mejor precio para Erba Pura de Xerjoff.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-14 items-center justify-center gap-3 rounded-full bg-wine-bright px-8 text-micro text-paper shadow-[0_0_40px_-6px_rgb(232_84_108/0.7)] transition-transform duration-200 ease-out-soft hover:scale-[1.03]"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
              <path d={WHATSAPP} />
            </svg>
            ¿Querés mejores precios? Hablá con el proveedor
          </a>
          <span className="text-micro normal-case tracking-normal text-muted">Te responde por WhatsApp</span>
        </div>
      </div>
    </div>
  );
}
