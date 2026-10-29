import Link from "next/link";
import type { CSSProperties } from "react";
import { PINS } from "@/lib/landing";
import { pad } from "@/lib/labels";
import { KineticText } from "../motion/KineticText";
import { InView } from "../motion/InView";
import { DriftColumns, PinWall } from "../motion/Loops";
import { MotionToggle } from "../motion/MotionToggle";
import { cx, creamButton, primaryButton, textButton } from "../ui";
import { PinCard } from "./Pin";
import { ScanExplainer } from "./ScanExplainer";

// The pins arrive interleaved (women, men, products, boards), so simple slicing keeps every
// column and every stretch of the wall mixed.
const columns = [0, 1, 2, 3].map((c) => PINS.filter((_, i) => i % 4 === c));
const closing = [PINS[0], PINS[11], PINS[6]]; // womenswear, a composed board, menswear

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export function Hero() {
  return (
    <section className="px-4 pt-6 lg:grid lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pt-0">
      <div className="flex flex-col justify-center lg:col-span-6 lg:py-16">
        <p className="enter flex items-center gap-2 text-micro text-muted" style={delay(0.1)}>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-wine" /> Moda por foto
        </p>
        <h1 className="@container mt-5 font-display">
          <span className="block text-display tracking-[-0.03em]">
            <KineticText lines={[{ text: "Lo viste." }, { text: "Encontralo.", className: "italic text-wine" }]} />
          </span>
        </h1>
        <p className="enter mt-8 max-w-[40ch] text-body text-muted" style={delay(0.7)}>
          Subí la captura de un Reel, un TikTok o un pin. Vibear reconoce cada prenda y te muestra dónde comprarla, de
          la más parecida a la menos.
        </p>
        <div className="enter mt-8 flex flex-wrap items-center gap-x-8 gap-y-4" style={delay(0.85)}>
          <Link href="/scan" className={primaryButton}>
            Empezá a escanear
          </Link>
          <a href="#como-funciona" className={textButton}>
            Cómo funciona
          </a>
        </div>
        <div className="enter mt-10" style={delay(1)}>
          <MotionToggle />
        </div>
      </div>
      <DriftColumns
        columns={columns}
        className="-mx-4 mt-12 h-[64svh] px-4 md:h-[72svh] lg:col-span-6 lg:mx-0 lg:mt-0 lg:h-[calc(100svh-3.5rem)] lg:px-0"
      />
    </section>
  );
}

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className="bg-wine px-4 py-28 text-cream lg:px-8 lg:py-44">
      <h2 id="problem-title" className="text-micro text-cream/70">
        El problema
      </h2>
      <div className="mt-8 font-display text-statement tracking-[-0.02em]">
        <p className="scrub-line">Lo viste en un Reel.</p>
        <p className="scrub-line">Lo guardaste.</p>
        <p className="scrub-line italic">Nunca supiste dónde comprarlo.</p>
      </div>
      <p className="reveal mt-12 max-w-[46ch] text-body text-cream/80">
        Las redes están llenas de ropa que te encanta y que no tiene nombre ni link. Vibear convierte esa captura en una
        búsqueda.
      </p>
    </section>
  );
}

export function Carousels() {
  return (
    <section aria-labelledby="carousel-title" className="overflow-hidden py-20 lg:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6 px-4 lg:px-8">
        <h2 id="carousel-title" className="reveal max-w-[13ch] font-display text-title tracking-tight">
          Todo lo que ves se puede <span className="italic text-wine">buscar</span>.
        </h2>
        <div className="reveal max-w-[36ch] space-y-3">
          <p className="text-small text-muted">
            Remeras, abrigos, pantalones, polleras y vestidos: Vibear reconoce 13 tipos de prenda, aunque no sepas cómo
            se llaman.
          </p>
          <p className="flex items-center gap-2 text-micro">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-paper bg-wine outline outline-1 outline-wine" />
            Cada punto es una prenda que Vibear detectó
          </p>
        </div>
      </div>
      <PinWall pins={PINS} seconds={95} className="mt-12 h-[30rem] sm:h-[36rem] md:h-[42rem]" />
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="how-title" className="scroll-mt-16 px-4 py-20 lg:px-8 lg:py-28">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 id="how-title" className="text-micro">
          Cómo funciona
        </h2>
        <span className="text-micro tabular-nums text-muted">3 pasos · 6 segundos</span>
      </div>
      <div className="mt-10 lg:mt-14">
        <ScanExplainer
          heading={
            <p className="reveal max-w-[14ch] font-display text-title tracking-tight">
              De la captura a la <span className="italic text-wine">tienda</span>.
            </p>
          }
        />
      </div>
    </section>
  );
}

const BENEFITS = [
  { title: "Solo con una foto", text: "No hace falta describirla ni saber cómo se llama. La captura alcanza." },
  { title: "Prenda por prenda", text: "Del look completo, buscás solo lo que te gustó: la campera, el pantalón o el vestido." },
  { title: "Cerca tuyo", text: "Mirá si hay locales de ropa en tu zona que vendan las marcas que encontraste." },
];

export function Benefits() {
  return (
    <section aria-labelledby="benefits-title" className="px-4 py-20 lg:px-8 lg:py-28">
      <h2 id="benefits-title" className="text-micro text-muted">
        Para qué sirve
      </h2>
      <ul className="mt-6 grid gap-px border-y border-line bg-line md:grid-cols-3">
        {BENEFITS.map((benefit, index) => (
          <li key={benefit.title} className="reveal bg-paper py-10 md:px-8 md:first:pl-0 md:last:pr-0">
            <span className="text-micro tabular-nums text-wine">{pad(index + 1)}</span>
            <h3 className="mt-3 font-display text-numeral italic tracking-tight">{benefit.title}</h3>
            <p className="mt-4 max-w-[34ch] text-small text-muted">{benefit.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TILTS = ["-5deg", "4deg", "-2deg"];

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="overflow-hidden bg-wine text-cream">
      <div className="grid items-center gap-14 px-4 py-24 lg:grid-cols-12 lg:gap-10 lg:px-8 lg:py-32">
        <div className="lg:col-span-6">
          <p className="text-micro text-cream/70">Tu turno</p>
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
        <InViewPins />
      </div>
      <div className="px-4 lg:px-8" aria-hidden="true">
        <p className="@container font-display">
          <span className="-ml-[0.03em] block text-hero tracking-[-0.045em] text-cream">VIBEAR</span>
        </p>
      </div>
    </section>
  );
}

function InViewPins() {
  return (
    <InView
      aria-hidden="true"
      className="relative mx-auto grid w-full max-w-[34rem] grid-cols-3 items-start gap-3 sm:gap-5 lg:col-span-6"
    >
      {closing.map((pin, i) => (
        <div
          key={pin.src}
          className={cx(
            "float-pin motion-loop bg-cream p-2 pb-3 text-ink [&_figcaption]:hidden sm:[&_figcaption]:flex",
            i === 1 && "mt-10",
          )}
          style={{ "--tilt": TILTS[i], "--float": `${6 + i}s` } as CSSProperties}
        >
          <PinCard pin={pin} />
        </div>
      ))}
    </InView>
  );
}
