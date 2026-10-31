"use client";

import Link from "next/link";
import { useState } from "react";
import type { Pin } from "@/lib/landing";
import { garmentName } from "@/lib/labels";
import { STYLE_LABELS, shopLinks } from "@/lib/outfits";
import { PinCard } from "./landing/Pin";
import { cx, primaryButton, tapArea, textButton } from "./ui";

// Every way out: the 404 is a detour, so it shows the whole site.
const ELSEWHERE = [
  { href: "/", label: "Inicio" },
  { href: "/scan", label: "Escanear" },
  { href: "/#outfits", label: "Outfits de la semana" },
  { href: "/#perfumeria", label: "Perfumería" },
  { href: "/outfits", label: "Probador" },
  { href: "/saved", label: "Guardados" },
];

// How you want to feel, and the styles that get you there (styles: describe.py STYLES).
const MOODS = [
  { label: "Segura/o", styles: ["streetwear", "old-money"], line: "Hombros atrás: este look camina solo." },
  { label: "Tranqui", styles: ["casual", "clean-girl"], line: "Cómodo y prolijo, el mejor plan para un día sin plan." },
  { label: "Elegante", styles: ["old-money", "university"], line: "Pocas piezas, bien elegidas. Nada grita, todo suma." },
  { label: "Con energía", styles: ["tenis", "pilates", "streetwear"], line: "Ropa que se mueve con vos." },
];

/**
 * The 404 as a detour, not a dead end: pick how you want to feel and get a look for it, with where
 * to buy each piece. The giant 404 is filled with that look's photo.
 */
export function LostAndFound({ pins }: { pins: Pin[] }) {
  const [mood, setMood] = useState(0);
  const [turn, setTurn] = useState(0);
  const outfits = pins.filter((pin) => (pin.kind === "woman" || pin.kind === "man") && pin.hotspots.length);
  const matching = outfits.filter((pin) => pin.style && MOODS[mood].styles.includes(pin.style));
  const pool = matching.length ? matching : outfits;
  const look = pool.length ? pool[turn % pool.length] : null;

  return (
    <section aria-labelledby="lost-title" className="bg-grid px-4 pb-16 pt-10 lg:px-8 lg:pt-14">
      <p className="text-micro text-wine-bright">Error 404 · Página no encontrada</p>
      <div className="@container mt-4">
        <p
          aria-hidden="true"
          className="bg-cover bg-center bg-clip-text font-display text-hero leading-[0.8] tracking-[-0.045em] text-transparent transition-[background-image] duration-500"
          style={look ? { backgroundImage: `url(${look.src})`, backgroundColor: "var(--color-ink)" } : { color: "var(--color-ink)" }}
        >
          404
        </p>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <h1 id="lost-title" className="font-display text-title tracking-tight">
            Esta página se perdió. <span className="italic text-wine-bright">Tu estilo, no.</span>
          </h1>
          <p className="mt-5 max-w-[44ch] text-body text-muted">
            Ya que estás acá, cambiemos de plan: ¿cómo te querés sentir hoy? Elegí y te armamos el look.
          </p>
          <div role="group" aria-label="Cómo te querés sentir" className="mt-8 flex flex-wrap gap-2">
            {MOODS.map((option, index) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={index === mood}
                onClick={() => {
                  setMood(index);
                  setTurn(0);
                }}
                className={cx(
                  "h-10 rounded-full px-4 text-micro transition-colors duration-200 ease-out-soft",
                  index === mood ? "bg-wine text-cream" : "border border-line text-ink/80 hover:border-ink hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-10 border border-line p-5">
            <p className="text-micro text-wine-bright">¿No sabés qué ponerte?</p>
            <p className="mt-2 text-small text-muted">Un test de un minuto: tus estilos, tu colorimetría y looks para vos.</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/estilo" className={primaryButton}>
                Descubrí tu estilo
              </Link>
              <Link href="/scan" className={textButton}>
                Escanear un look
              </Link>
            </div>
          </div>
          <nav aria-label="Seguí por acá" className="mt-10">
            <p className="text-micro text-muted">Seguí por acá</p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
              {ELSEWHERE.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={textButton}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {look && (
          // A new key per look, so each one arrives with the swap animation.
          <div key={`${mood}-${turn}`} className="swap-in lg:col-span-6">
            <div className="grid gap-6 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-start">
              <PinCard pin={look} caption={false} />
              <div>
                <p className="flex items-center gap-2 text-micro">
                  {look.style && (
                    <span className="rounded-full border border-wine-bright px-2.5 py-0.5 text-wine-bright">
                      {STYLE_LABELS[look.style] ?? look.style}
                    </span>
                  )}
                  <span className="text-muted">{look.kind === "woman" ? "Mujer" : "Hombre"}</span>
                </p>
                <p className="mt-3 font-display text-numeral italic leading-tight tracking-tight">{MOODS[mood].line}</p>
                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {look.hotspots.map((spot) => (
                    <li key={`${spot.label}-${spot.x}`} className="py-3">
                      <p className="text-small">{garmentName(spot)}</p>
                      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {shopLinks(spot, look.kind === "woman" ? "woman" : "man").map((link) => (
                          <a
                            key={link.shop}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cx("text-micro text-muted underline underline-offset-4 hover:text-ink", tapArea)}
                          >
                            {link.shop} <span aria-hidden="true">↗</span>
                          </a>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
                {pool.length > 1 && (
                  <button type="button" onClick={() => setTurn((n) => n + 1)} className={cx(textButton, "mt-5")}>
                    Otro look
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
