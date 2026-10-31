"use client";

import { useSyncExternalStore } from "react";
import type { Pin } from "@/lib/landing";
import { garmentName, pad } from "@/lib/labels";
import { STYLE_LABELS, isoWeek, shopLinks, weeklyPick } from "@/lib/outfits";
import { useProfile } from "@/lib/profile";
import { forYouFirst, isForYou } from "@/lib/style";
import { cx, tapArea } from "../ui";
import { PinCard } from "./Pin";

const noSubscribe = () => () => {};

/**
 * "Outfits de la semana": three looks for women and three for men, each garment named (what the
 * model recognised) with places to buy it. The set changes every ISO week; the server can't know
 * the week while prerendering, so it renders week 0 and the browser switches to this week's. After
 * the style test, the looks for who they dress and in the styles they like come first ("Para vos").
 */
export function WeeklyOutfits({ pins }: { pins: Pin[] }) {
  const week = useSyncExternalStore(noSubscribe, () => isoWeek(new Date()), () => 0);
  const profile = useProfile();
  const outfits = forYouFirst(weeklyPick(pins, week), profile);

  return (
    <section id="outfits" aria-labelledby="outfits-title" className="page px-4 py-20 lg:px-8 lg:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-micro text-muted">{week ? `Semana ${pad(week)}` : "Esta semana"}</p>
          <h2 id="outfits-title" className="mt-3 max-w-[12ch] font-display text-title tracking-tight">
            Outfits de la <span className="italic text-wine-bright">semana</span>.
          </h2>
        </div>
        <p className="max-w-[40ch] text-small text-muted">
          Tres looks de mujer y tres de hombre, con dónde conseguir cada prenda. Cambian todos los lunes
          {profile.style ? ", y van primero los de tu estilo." : "."}
        </p>
      </div>

      <ul className="mt-12 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {outfits.map((pin) => {
          const gender = pin.kind === "woman" ? "woman" : "man";
          return (
            <li key={pin.src} className="reveal">
              <article aria-label={`Outfit ${STYLE_LABELS[pin.style ?? ""] ?? ""} de ${gender === "woman" ? "mujer" : "hombre"}`}>
                <PinCard pin={pin} caption={false} className="max-w-[22rem]" />
                <p className="mt-4 flex items-center gap-2 text-micro">
                  {isForYou(pin, profile) && <span className="rounded-full bg-wine-bright px-2.5 py-0.5 text-paper">Para vos</span>}
                  {pin.style && (
                    <span className="rounded-full border border-wine-bright px-2.5 py-0.5 text-wine-bright">
                      {STYLE_LABELS[pin.style] ?? pin.style}
                    </span>
                  )}
                  <span className="text-muted">{gender === "woman" ? "Mujer" : "Hombre"}</span>
                </p>
                <ul className="mt-3 divide-y divide-line border-y border-line">
                  {pin.hotspots.map((spot) => (
                    <li key={`${spot.label}-${spot.x}`} className="py-3">
                      <p className="text-small">{garmentName(spot)}</p>
                      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {shopLinks(spot, gender).map((link) => (
                          <a
                            key={link.shop}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cx("text-micro text-muted underline underline-offset-4 hover:text-ink", tapArea)}
                          >
                            {link.shop} <span aria-hidden="true">↗</span>
                            <span className="sr-only">: {garmentName(spot)} (se abre en otra pestaña)</span>
                          </a>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
