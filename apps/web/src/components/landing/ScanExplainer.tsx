import type { CSSProperties, ReactNode } from "react";
import { EXPLAINER } from "@/lib/landing";
import { labelFor, pad } from "@/lib/labels";
import { InView } from "../motion/InView";
import { cx } from "../ui";

export const STEPS = [
  { title: "Subí una captura", text: "De un Reel, un TikTok, un pin o tu galería. También sirve el link de una imagen." },
  { title: "Elegí la prenda", text: "Vibear marca cada prenda del look. Tocás la que querés encontrar." },
  { title: "Encontrala", text: "Te mostramos dónde comprarla, de la más parecida a la menos, y qué locales hay cerca tuyo." },
];

const BOX_LINE = "border border-paper shadow-[0_0_0_1px_rgb(10_10_10/0.45)]";
const SELECTED = "border-2 border-paper shadow-[0_0_0_1px_var(--color-wine),inset_0_0_0_1px_var(--color-wine)]";

const at = (i: number, extra: Record<string, string | number> = {}) => ({ "--i": i, ...extra }) as CSSProperties;

/**
 * The product in six seconds, on a loop (timeline in globals.css, .x-*):
 * 0-33% the photo arrives and gets scanned · 33-66% garments are boxed and one is tapped ·
 * 66-100% matches rise in, similarity counting up. Boxes and numbers are real model output.
 * The written steps carry the meaning; the stage is decorative.
 */
export function ScanExplainer({ heading }: { heading: ReactNode }) {
  return (
    // Mobile reads heading → stage → steps; desktop puts heading + steps left and the stage right.
    <InView restart className="x-root grid gap-10 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-10 lg:gap-y-10">
      <div className="order-1 lg:order-none lg:col-span-5">{heading}</div>
      <ol className="order-3 divide-y divide-line border-y border-line lg:order-none lg:col-span-5 lg:row-start-2 lg:self-start">
        {STEPS.map((step, i) => (
          <li key={step.title} className="x-anim x-step motion-loop relative flex gap-6 py-6" style={at(i)}>
            <span aria-hidden="true" className="w-16 shrink-0 font-display text-numeral tabular-nums">
              {pad(i + 1)}
            </span>
            <div className="pt-1.5">
              <h3 className="text-micro">{step.title}</h3>
              <p className="mt-2 max-w-[40ch] text-small text-muted">{step.text}</p>
            </div>
            <span
              aria-hidden="true"
              className="x-anim x-step-bar motion-loop absolute inset-x-0 -bottom-px h-px bg-wine"
              style={at(i)}
            />
          </li>
        ))}
      </ol>
      <ScanStage className="order-2 mx-auto w-full max-w-[36rem] lg:order-none lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:mr-0 lg:self-center" />
    </InView>
  );
}

/** The stage alone, looping, for screens that only need the picture (the scanner page). */
export function ScanDemo({ className }: { className?: string }) {
  return (
    <InView restart className={cx("x-root", className)}>
      <ScanStage />
    </InView>
  );
}

function ScanStage({ className }: { className?: string }) {
  const { src, width, height, boxes, matches, credit } = EXPLAINER;

  return (
    <figure className={className}>
      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-[1.35fr_1fr] sm:items-end sm:gap-4">
        {/* Narrower on phones so the photo and the results row fit on one screen. From sm it fills its
            grid cell: auto margins would shrink it to its (absolute-only) content, i.e. to 0×0. */}
        <div
          className="relative mx-auto w-[62%] overflow-hidden rounded-media bg-surface sm:mx-0 sm:w-full"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP */}
          <img
            src={src}
            width={width}
            height={height}
            alt=""
            loading="lazy"
            decoding="async"
            className="x-anim x-photo motion-loop absolute inset-0 h-full w-full object-cover"
          />
          <div className="x-anim x-scan motion-loop absolute inset-0">
            <span className="block h-0.5 bg-paper mix-blend-difference" />
          </div>
          {boxes.map((item, i) => {
            const [x1, y1, x2, y2] = item.box;
            return (
              <div
                key={item.label}
                className={cx("x-anim x-box motion-loop absolute", BOX_LINE)}
                style={at(i, {
                  left: `${(x1 / width) * 100}%`,
                  top: `${(y1 / height) * 100}%`,
                  width: `${((x2 - x1) / width) * 100}%`,
                  height: `${((y2 - y1) / height) * 100}%`,
                })}
              >
                <span className="absolute left-0 top-0 whitespace-nowrap bg-paper px-1.5 py-0.5 text-micro tabular-nums">
                  {pad(i + 1)} {labelFor(item.label)}
                </span>
                {i === 0 && (
                  <>
                    <span className={cx("x-anim x-select motion-loop absolute -inset-px", SELECTED)} />
                    <span className="x-anim x-tap motion-loop absolute left-1/2 top-1/2 -ml-5 -mt-5 h-10 w-10 rounded-full border-2 border-paper bg-wine/40" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3">
          {matches.map((match, i) => (
            <div key={match.src} className="x-anim x-card motion-loop" style={at(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP */}
              <img
                src={match.src}
                width={match.width}
                height={match.height}
                alt=""
                loading="lazy"
                decoding="async"
                className="aspect-[3/4] w-full rounded-media bg-surface object-cover"
              />
              <p className="mt-1.5 text-micro tabular-nums">
                <span
                  className="x-anim x-count motion-loop text-wine"
                  style={at(i, { "--target": Math.round(match.similarity * 100) })}
                />
                <span className="hidden text-muted sm:inline"> similitud</span>
              </p>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-4 text-micro text-muted">
        Ejemplo real: cajas del detector YOLO y similitud de FashionCLIP. Foto:{" "}
        <a href={credit.url} className="underline underline-offset-4 hover:no-underline">
          {credit.author}
        </a>
        , {credit.license}.
      </figcaption>
    </figure>
  );
}
