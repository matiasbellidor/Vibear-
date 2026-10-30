"use client";

import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { FragranceBoard, Offer } from "@/lib/api";
import { useCutout } from "@/lib/cutout";
import { pad } from "@/lib/labels";
import { Brackets } from "../motion/Hud";
import { cx, textButton } from "../ui";

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export const money = (offer: Offer) => pesos.format(offer.price);

// Where each chapter starts and leaves, in contain % of the film's scroll (phase table in globals.css).
const CHAPTERS = [
  { in: "3%", out: "29%" },
  { in: "35%", out: "61%" },
  { in: "67%", out: "94%" },
];

/** Tiendanube serves each photo in several sizes: the film wants the biggest one (1024 px). */
function largest(url: string): string {
  return url.includes("mitiendanube.com") ? url.replace(/-\d+-\d+\.(webp|jpe?g|png)$/, "-1024-1024.$1") : url;
}

/** "Frutas cítricas, ámbar, vainilla y almizcle" → Frutas cítricas · Ámbar · Vainilla · Almizcle. */
function notesOf(notes: string): string[] {
  return notes
    .split(/,\s*|\s+y\s+/)
    .filter(Boolean)
    .map((note) => note[0].toUpperCase() + note.slice(1));
}

/**
 * The perfumery's opening, a film you scroll: three magazine covers, one fragrance each. The name
 * runs across the page like a masthead with the bottle standing in front of it, the backdrop takes
 * the bottle's own colour, a light glides over the glass, Vibear's scan line reads the notes and the
 * day's best price lands. Then the cover gives way to the next. Choreography in globals.css (.film-*);
 * without scroll timelines, with reduced motion or on a short screen, the three covers sit side by side.
 */
export function PerfumeFilm({ boards, intro }: { boards: (FragranceBoard | undefined)[]; intro: ReactNode }) {
  return (
    <div className="film -mx-4 lg:-mx-8">
      <div className="film-stage">
        <div className="film-intro px-4 text-center">{intro}</div>
        <ol aria-label="Fragancias destacadas" className="film-covers">
          {boards.map((board, i) => (
            <Cover key={i} board={board} index={i} />
          ))}
        </ol>
        <ol aria-hidden="true" className="film-ticks">
          {boards.map((_, i) => (
            <li key={i} className="film-tick" style={{ "--in": CHAPTERS[i].in, "--out": CHAPTERS[i].out } as CSSProperties}>
              <span className="text-micro text-muted">{pad(i + 1)}</span>
              <span className="film-tick-on text-micro text-wine-bright">{pad(i + 1)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Cover({ board, index }: { board?: FragranceBoard; index: number }) {
  const shot = useCutout(board?.image ? largest(board.image) : null, 1400);
  const chapter = CHAPTERS[index];
  const style = {
    "--in": chapter.in,
    "--out": chapter.out,
    "--tint": shot?.tint ?? "var(--color-wine-bright)",
    "--len": board?.fragrance.name.length ?? 10,
  } as CSSProperties;
  const className = cx("film-cover", `film-cover-${index + 1}`);
  if (!board) return <li className={className} style={style} />;

  const { fragrance, offers } = board;
  const best = offers[0];
  const words = fragrance.name.split(" ");
  // Each letter's index in the whole name, for the stagger.
  const startOf = (w: number) => words.slice(0, w).join("").length;
  return (
    <li className={className} style={style}>
      <div className="film-visual">
        <span aria-hidden="true" className="film-tint" />
        <h3 className="film-masthead font-display">
          {words.map((word, w) => (
            <Fragment key={w}>
              {w > 0 && " "}
              <span className="film-word">
                {[...word].map((char, c) => (
                  <span key={c} className="film-letter" style={{ "--l": startOf(w) + c } as CSSProperties}>
                    {char}
                  </span>
                ))}
              </span>
            </Fragment>
          ))}
        </h3>
        <div className="film-bottle">
          <span className="film-drift">
            <span aria-hidden="true" className="film-shadow" />
            {shot && (
              // eslint-disable-next-line @next/next/no-img-element -- a shop's CDN photo cut out into a blob: not for next/image
              <img
                src={shot.src}
                alt={`${fragrance.name} de ${fragrance.house}`}
                width={shot.width}
                height={shot.height}
                referrerPolicy="no-referrer"
                className={cx("film-image swap-in", !shot.cut && "rounded-media mix-blend-multiply")}
              />
            )}
            {/* The light on the glass only falls on the bottle: the cut-out is its mask. */}
            {shot?.cut && (
              <span aria-hidden="true" className="film-sheen" style={{ maskImage: `url(${shot.src})`, WebkitMaskImage: `url(${shot.src})` }}>
                <span className="film-sheen-band" />
              </span>
            )}
            <span aria-hidden="true" className="film-scan" />
            <Brackets className="film-brackets -m-5" />
          </span>
        </div>
      </div>

      <div className="film-meta">
        <p className="film-kicker col-span-2 text-micro text-muted">
          Nº {pad(index + 1)} · {fragrance.house} · {fragrance.size_ml} ml
        </p>
        <div className="film-notes">
          <p className="film-kicker text-micro text-wine-bright">Notas que detectamos</p>
          <ul className="mt-1">
            {notesOf(fragrance.notes).map((note, n) => (
              <li key={note} className="film-note font-display text-cta italic lg:text-step" style={{ "--n": n } as CSSProperties}>
                {note}
              </li>
            ))}
          </ul>
        </div>
        <div className="film-price">
          {best ? (
            <>
              <p className="text-micro text-muted">Mejor precio hoy</p>
              <p className="mt-1 font-display text-cta tabular-nums lg:text-numeral">{money(best)}</p>
              <p className="mt-1 text-micro normal-case tracking-normal text-muted">
                en {best.shop}
                {offers.length > 1 && ` · ${offers.length} tiendas comparadas`}
              </p>
              <a href={best.url} target="_blank" rel="noopener noreferrer" className={cx(textButton, "mt-4")}>
                Comprar <span aria-hidden="true">↗</span>
                <span className="sr-only">
                  {" "}
                  {fragrance.name} en {best.shop} (se abre en otra pestaña)
                </span>
              </a>
            </>
          ) : (
            <p className="text-micro text-muted">Sin stock hoy · consultanos</p>
          )}
        </div>
      </div>
    </li>
  );
}
