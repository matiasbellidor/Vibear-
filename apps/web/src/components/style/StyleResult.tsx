"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { SEASONS, TRAITS, type Swatch } from "@/lib/colorimetry";
import type { Pin } from "@/lib/landing";
import { STYLE_LABELS } from "@/lib/outfits";
import type { Profile } from "@/lib/profile";
import { downloadStyleCard } from "@/lib/style-card";
import { forYouFirst, gendersOf, GOAL_TIPS, isForYou } from "@/lib/style";
import { PinCard } from "../landing/Pin";
import { cx, primaryButton, textButton } from "../ui";

function Swatches({ colors, label, crossed = false }: { colors: Swatch[]; label: string; crossed?: boolean }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-x-5 gap-y-6">
      {colors.map((color, i) => (
        <li key={color.name} className="swatch-pop flex w-16 flex-col items-center gap-2 text-center" style={{ "--i": i } as CSSProperties}>
          <span
            aria-hidden="true"
            className={cx("relative block size-14 rounded-full ring-1 ring-ink/15", crossed && "opacity-70")}
            style={{ backgroundColor: color.hex }}
          >
            {crossed && <span className="absolute left-1/2 top-[-4px] h-[64px] w-0.5 -translate-x-1/2 rotate-45 bg-ink" />}
          </span>
          <span className="text-micro normal-case leading-tight tracking-normal text-muted">{color.name}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The test's result: the colour season with its palette, neutrals, colours to avoid, metals and
 * outfit ideas; then their styles, a tip per goal and real looks that match. It is also what a
 * returning visitor sees at /estilo, with a way to download it as a card or take the test again.
 */
export function StyleResult({ profile, pins, onRetake }: { profile: Profile; pins: Pin[]; onRetake: () => void }) {
  const [saving, setSaving] = useState(false);
  const season = profile.color ? SEASONS[profile.color.season] : undefined;
  const style = profile.style;
  const looks = forYouFirst(
    pins.filter((pin) => gendersOf(profile).includes(pin.kind) && pin.hotspots.length),
    profile,
  ).slice(0, 3);
  const [first, ...rest] = season?.name.split(" ") ?? [];

  return (
    <article aria-labelledby="result-title" className="px-4 pb-20 pt-10 lg:px-8 lg:pt-14">
      <p className="text-micro text-wine-bright">{season ? "Tu colorimetría" : "Tu estilo"}</p>
      <h1 id="result-title" className="mt-4 font-display text-statement leading-none tracking-tight">
        {season ? (
          <>
            {first} <span className="italic text-wine-bright">{rest.join(" ")}</span>
          </>
        ) : (
          <>
            Tu <span className="italic text-wine-bright">estilo</span>
          </>
        )}
      </h1>
      {season && profile.color && (
        <>
          <p className="mt-5 max-w-[48ch] text-body text-muted">{season.line}</p>
          <ul aria-label="Tus rasgos" className="mt-6 flex flex-wrap gap-2">
            {[profile.color.undertone, profile.color.contrast, profile.color.chroma]
              .filter((trait) => TRAITS[trait])
              .map((trait) => (
                <li key={trait} className="rounded-full border border-line px-3 py-1 text-micro text-ink/80">
                  {TRAITS[trait]}
                </li>
              ))}
          </ul>

          <div className="mt-14 grid gap-14 lg:grid-cols-12 lg:gap-10">
            <section aria-labelledby="palette-title" className="lg:col-span-7">
              <h2 id="palette-title" className="border-b border-line pb-3 text-micro">
                Tu paleta
              </h2>
              <div className="mt-6">
                <Swatches colors={season.palette} label="Colores que te favorecen" />
              </div>
              <h3 className="mt-12 border-b border-line pb-3 text-micro">Tus neutros</h3>
              <div className="mt-6">
                <Swatches colors={season.neutrals} label="Neutros" />
              </div>
              <h3 className="mt-12 border-b border-line pb-3 text-micro">Mejor evitá cerca de la cara</h3>
              <div className="mt-6">
                <Swatches colors={season.avoid} label="Colores a evitar" crossed />
              </div>
              <p className="mt-10 text-small text-muted">
                <span className="text-micro text-ink">Metales</span> · {season.metals}
              </p>
            </section>

            <section aria-labelledby="ideas-title" className="lg:col-span-5">
              <h2 id="ideas-title" className="border-b border-line pb-3 text-micro">
                Ideas de outfits
              </h2>
              <ul className="divide-y divide-line">
                {season.outfits.map((outfit) => (
                  <li key={outfit.text} className="flex items-center gap-4 py-4">
                    <span aria-hidden="true" className="flex shrink-0 -space-x-2">
                      {outfit.colors.map((hex) => (
                        <span key={hex} className="block size-8 rounded-full ring-2 ring-paper" style={{ backgroundColor: hex }} />
                      ))}
                    </span>
                    <span className="text-small">{outfit.text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 border border-line p-5">
                <p className="text-micro text-wine-bright">Antes de comprar</p>
                <p className="mt-2 text-small text-muted">
                  Escaneá la prenda que te gustó: Vibear te dice si su color es de tu paleta y dónde conseguirla.
                </p>
                <Link href="/scan" transitionTypes={["nav-forward"]} className={cx(primaryButton, "mt-4")}>
                  Escanear una prenda
                </Link>
              </div>
            </section>
          </div>
        </>
      )}

      {style && (style.aesthetics.length > 0 || style.goals.length > 0) && (
        <section aria-labelledby="style-title" className="mt-20">
          <h2 id="style-title" className="border-b border-line pb-3 text-micro">
            Tu estilo
          </h2>
          {style.aesthetics.length > 0 && (
            <ul aria-label="Tus estilos" className="mt-6 flex flex-wrap gap-2">
              {style.aesthetics.map((key) => (
                <li key={key} className="rounded-full bg-wine px-3.5 py-1.5 text-micro text-cream">
                  {STYLE_LABELS[key] ?? key}
                </li>
              ))}
            </ul>
          )}
          {style.goals.length > 0 && (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {style.goals.map((goal) => (
                <li key={goal} className="border-l-2 border-wine-bright pl-4 text-small text-muted">
                  {GOAL_TIPS[goal]}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {looks.length > 0 && (
        <section aria-labelledby="looks-title" className="mt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-3">
            <h2 id="looks-title" className="text-micro">
              Looks para vos
            </h2>
            <Link href="/#outfits" className={textButton}>
              Outfits de la semana
            </Link>
          </div>
          <ul className="mt-8 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-3">
            {looks.map((pin) => (
              <li key={pin.src}>
                <PinCard pin={pin} caption={false} />
                {isForYou(pin, profile) && pin.style && (
                  <p className="mt-2 text-micro text-wine-bright">{STYLE_LABELS[pin.style]}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!season && !style?.aesthetics.length && (
        <p className="mt-6 max-w-[46ch] text-body text-muted">
          Con tan pocas respuestas no podemos armarte la paleta. Hacé el test de nuevo: es un minuto.
        </p>
      )}

      <div className="mt-16 flex flex-wrap items-center gap-x-6 gap-y-4">
        {season && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              downloadStyleCard(profile).finally(() => setSaving(false));
            }}
            className={primaryButton}
          >
            {saving ? "Armando tu tarjeta…" : "Descargar mi tarjeta"}
          </button>
        )}
        <button type="button" onClick={onRetake} className={textButton}>
          Hacer el test de nuevo
        </button>
      </div>
    </article>
  );
}
