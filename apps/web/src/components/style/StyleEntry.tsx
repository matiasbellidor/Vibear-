"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { paletteFit, SEASONS } from "@/lib/colorimetry";
import { useProfile } from "@/lib/profile";
import { cx, creamButton, textButton } from "../ui";

// The ways into the style test (/estilo), and what it gives back around the site. Each one reads the
// anonymous profile (lib/profile.ts): a first-time visitor is invited, a returning one sees theirs.

// A sample of the four families' colours, for the invitation.
const TEASER = ["#F6B99A", "#30B5AB", "#E6B7C1", "#7F95A8", "#C2785C", "#6B6B2A", "#7A1F3D", "#2349B0", "#F2C14E", "#9CAF88", "#1B2A4A", "#E0218A"];

/** One line under the hero's button: the test, or their season once they took it. */
export function StyleLink() {
  const profile = useProfile();
  const season = profile.color ? SEASONS[profile.color.season] : undefined;
  return (
    <Link href="/estilo" className={cx(textButton, "text-ink/80")}>
      {season ? `Tu paleta: ${season.name}` : "¿Qué colores te quedan bien? Test de 1 minuto"} <span aria-hidden="true">→</span>
    </Link>
  );
}

/** The landing's invitation to the test, or the visitor's own palette when they already took it. */
export function StyleTeaser() {
  const profile = useProfile();
  const season = profile.color ? SEASONS[profile.color.season] : undefined;
  const dots = season ? [...season.palette, ...season.neutrals].map((swatch) => swatch.hex) : TEASER;

  return (
    // A wine sheet: .page draws its background from --color-paper.
    <section aria-labelledby="style-teaser-title" className="page px-4 py-20 text-cream [--color-paper:var(--color-wine)] lg:px-8 lg:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="text-micro text-cream/70">{season ? "Tu colorimetría" : "Test de estilo · 1 minuto"}</p>
          <h2 id="style-teaser-title" className="reveal mt-4 max-w-[14ch] font-display text-title tracking-tight">
            {season ? (
              <>
                Sos <span className="italic">{season.name}</span>.
              </>
            ) : (
              <>
                ¿Qué colores te <span className="italic">favorecen</span>?
              </>
            )}
          </h2>
          <p className="mt-5 max-w-[44ch] text-body text-cream/80">
            {season
              ? `${season.line} Escaneá una prenda y te decimos si es de tu paleta.`
              : "Seis preguntas frente al espejo y te decimos tu estación, tu paleta y qué evitar. Más tus estilos, para mostrarte primero los looks que van con vos. Sin registrarte."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/estilo" className={cx(creamButton, "h-12 px-8")}>
              {season ? "Ver mi resultado" : "Hacer el test"}
            </Link>
            {season && (
              <Link href="/scan" transitionTypes={["nav-forward"]} className={cx(textButton, "text-cream")}>
                Escanear una prenda
              </Link>
            )}
          </div>
        </div>
        <ul aria-hidden="true" className="grid w-full max-w-md grid-cols-4 gap-3 justify-self-center sm:gap-4 lg:col-span-6 lg:justify-self-end">
          {dots.slice(0, 12).map((hex, i) => (
            <li
              key={`${hex}-${i}`}
              className="swatch-rise aspect-square rounded-full ring-1 ring-cream/20"
              style={{ backgroundColor: hex, "--i": i } as CSSProperties}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

/** At the top of the closet: their palette as a strip, or an invitation to the test. */
export function ProfileCard() {
  const profile = useProfile();
  if (!profile.user) return null;
  const season = profile.color ? SEASONS[profile.color.season] : undefined;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-line px-4 py-3">
      {season ? (
        <p className="flex flex-wrap items-center gap-3 text-micro">
          <span className="text-wine-bright">Tu paleta</span>
          <span>{season.name}</span>
          <span aria-hidden="true" className="flex -space-x-1.5">
            {season.palette.slice(0, 6).map((swatch) => (
              <span key={swatch.hex} className="block size-5 rounded-full ring-2 ring-paper" style={{ backgroundColor: swatch.hex }} />
            ))}
          </span>
        </p>
      ) : (
        <p className="text-small text-muted">Hacé el test de estilo y guardá con tu paleta a mano.</p>
      )}
      <Link href="/estilo" className={textButton}>
        {season ? "Ver mi resultado" : "Hacer el test (1 min)"}
      </Link>
    </div>
  );
}

/** Under a scanned garment: whether its colour is one of the visitor's (once they took the test). */
export function PaletteBadge({ color }: { color: string | null | undefined }) {
  const profile = useProfile();
  const season = profile.color?.season;
  const fit = season ? paletteFit(season, color) : null;
  if (!fit || !season) return null;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-micro",
        fit === "in" ? "bg-wine-bright text-paper" : "border border-line text-muted",
      )}
    >
      {fit === "in" ? "✓ Va con tu paleta" : "Fuera de tu paleta"}
    </span>
  );
}
