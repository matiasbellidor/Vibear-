import Link from "next/link";
import type { CSSProperties } from "react";
import type { Pin } from "@/lib/landing";
import { pad } from "@/lib/labels";
import { pinterestConfig } from "@/lib/pinterest";
import { Brackets, ScanField } from "../motion/Hud";
import { InView } from "../motion/InView";
import { PinWall } from "../motion/Loops";
import { cx, creamButton } from "../ui";
import { PinCard } from "./Pin";
import { PinterestEmbeds } from "./PinterestEmbeds";

const GARMENT_CLASSES = 13; // DeepFashion2, the detector's training set

const LOG = [
  { command: "lo_viste_en_un_reel", status: "OK" },
  { command: "lo_guardaste", status: "OK" },
  { command: "¿dónde_comprarlo?", status: "ERROR 404", error: true },
];

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className="page theme-light px-4 py-24 lg:px-8 lg:py-36">
      <h2 id="problem-title" className="text-micro text-muted">
        El problema
      </h2>
      <div className="mt-8 max-w-4xl space-y-2 font-mono text-terminal">
        {LOG.map((line) => (
          <p key={line.command} className={cx("scrub-line flex items-end gap-3", line.error && "text-wine-bright")}>
            <span className="text-muted">&gt;</span>
            <span>{line.command}</span>
            <span aria-hidden="true" className="mb-[0.45em] min-w-6 flex-1 border-b border-dotted border-line" />
            <span className="shrink-0">{line.status}</span>
          </p>
        ))}
      </div>
      <p className="reveal mt-14 font-display text-statement tracking-[-0.02em]">
        Vibear arregla ese <span className="italic text-wine-bright">404</span>.
      </p>
      <p className="reveal mt-6 max-w-[46ch] text-body text-muted">
        Las redes están llenas de ropa que te encanta y que no tiene nombre ni link. Vibear convierte esa captura en una
        búsqueda.
      </p>
    </section>
  );
}

export function Carousels({ pins }: { pins: Pin[] }) {
  return (
    <section aria-labelledby="carousel-title" className="page overflow-hidden py-20 lg:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6 px-4 lg:px-8">
        <h2 id="carousel-title" className="reveal max-w-[13ch] font-display text-title tracking-tight">
          Todo lo que ves se puede <span className="italic text-wine-bright">buscar</span>.
        </h2>
        <div className="reveal max-w-[36ch] space-y-3">
          <p className="text-small text-muted">
            Remeras, abrigos, pantalones, polleras y vestidos: Vibear reconoce {GARMENT_CLASSES} tipos de prenda, aunque
            no sepas cómo se llaman.
          </p>
          <p className="flex items-center gap-2 text-micro">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-ink bg-wine-bright" />
            Cada punto es una prenda que Vibear detectó
          </p>
        </div>
      </div>
      <ScanField className="mt-12">
        <PinWall pins={pins} labels={false} className="h-[30rem] sm:h-[36rem] md:h-[42rem]" />
      </ScanField>
    </section>
  );
}

export function FromPinterest() {
  const { board, pins } = pinterestConfig();
  const configured = Boolean(board || pins.length);
  if (!configured && process.env.NODE_ENV !== "development") return null;

  return (
    <section aria-labelledby="pinterest-title" className="page px-4 py-20 lg:px-8 lg:py-28">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
        <h2 id="pinterest-title" className="text-micro">
          Desde Pinterest
        </h2>
        <span className="text-micro text-muted">Embed oficial · los pins son de sus autores</span>
      </div>
      <p className="reveal mt-10 max-w-[16ch] font-display text-title tracking-tight">
        Tu tablero, <span className="italic text-wine-bright">escaneable</span>.
      </p>
      <p className="mt-4 max-w-[46ch] text-small text-muted">
        Guardás en Pinterest, encontrás con Vibear: sacale una captura a cualquier pin y escaneala.
      </p>
      <div className="mt-10">
        {configured ? (
          <PinterestEmbeds board={board} pins={pins} />
        ) : (
          // Only shown by `npm run dev`, to whoever runs the site: published builds hide the section.
          <div className="relative border border-dashed border-line p-6 text-small text-muted">
            <Brackets />
            <p className="text-micro text-ink">Solo en desarrollo · falta tu tablero</p>
            <p className="mt-3 max-w-[62ch]">
              Agregá tu tablero en <code className="font-mono text-ink">apps/web/.env.local</code> con{" "}
              <code className="font-mono text-ink">NEXT_PUBLIC_PINTEREST_BOARD=https://www.pinterest.com/usuario/tablero/</code>{" "}
              (o pins sueltos en <code className="font-mono text-ink">NEXT_PUBLIC_PINTEREST_PINS</code>, separados por
              comas) y reiniciá <code className="font-mono text-ink">npm run dev</code>.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

const SPECS = [
  { key: "Input", title: "Solo una foto", text: "No hace falta describirla ni saber cómo se llama. La captura alcanza." },
  { key: "Output", title: "Prenda por prenda", text: "Del look completo buscás solo lo que te gustó, ordenado por parecido." },
  { key: "Radio", title: "Cerca tuyo", text: "Locales de ropa en tu zona, primero los que venden las marcas que encontraste." },
];

export function Benefits() {
  return (
    <section aria-labelledby="benefits-title" className="page theme-light px-4 py-20 lg:px-8 lg:py-28">
      <h2 id="benefits-title" className="text-micro text-muted">
        Para qué sirve
      </h2>
      <ul className="mt-6 grid border-t border-line lg:grid-cols-3">
        {SPECS.map((spec, index) => (
          <li key={spec.key} className="reveal relative border-b border-line py-10 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0">
            <span className="text-micro tabular-nums text-wine-bright">
              {pad(index + 1)} / {spec.key}
            </span>
            <h3 className="mt-3 font-display text-numeral italic tracking-tight">{spec.title}</h3>
            <p className="mt-4 max-w-[34ch] text-small text-muted">{spec.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TILTS = ["-5deg", "4deg", "-2deg"];

export function FinalCta({ pins }: { pins: Pin[] }) {
  const closing = [pins[0], pins.find((pin) => pin.kind === "board") ?? pins[2], pins[1]].filter(Boolean);
  return (
    <section aria-labelledby="cta-title" className="overflow-hidden bg-wine text-cream">
      <div className="grid items-center gap-14 px-4 py-24 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-32">
        <div className="lg:col-span-6">
          <p className="font-mono text-small text-cream/80">
            &gt; listo para escanear<span aria-hidden="true" className="blink motion-loop">_</span>
          </p>
          <h2 id="cta-title" className="reveal mt-5 font-display text-statement tracking-[-0.02em]">
            ¿Qué viste <span className="italic">hoy</span>?
          </h2>
          <p className="reveal mt-6 max-w-[38ch] text-body text-cream/80">
            Tu próxima prenda favorita está en una captura. Subila y encontrala en segundos.
          </p>
          <div className="reveal mt-10">
            <Link href="/scan" className={cx(creamButton, "h-14 px-10")}>
              Empezá a escanear
            </Link>
          </div>
          <p className="mt-5 text-micro text-cream/70">Sin cuenta · Desde el celu o la compu</p>
        </div>
        {/* Three pins floating like a board pinned to the wall: they show what the button leads to. */}
        <InView
          aria-hidden="true"
          className="relative mx-auto grid w-full max-w-[34rem] grid-cols-3 items-start gap-3 sm:gap-5 lg:col-span-6"
        >
          {closing.map((pin, i) => (
            <div
              key={pin.src}
              className={cx(
                "float-pin motion-loop bg-cream p-2 pb-3 text-paper [&_figcaption]:hidden sm:[&_figcaption]:flex",
                i === 1 && "mt-10",
              )}
              style={{ "--tilt": TILTS[i], "--float": `${6 + i}s` } as CSSProperties}
            >
              <PinCard pin={pin} />
            </div>
          ))}
        </InView>
      </div>
      <div className="px-4 lg:px-8" aria-hidden="true">
        <p className="@container font-display">
          <span className="-ml-[0.03em] block text-hero tracking-[-0.045em] text-cream">VIBEAR</span>
        </p>
      </div>
    </section>
  );
}
