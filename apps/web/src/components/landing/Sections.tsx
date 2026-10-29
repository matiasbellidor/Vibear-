import Link from "next/link";
import type { CSSProperties } from "react";
import { PHOTOS } from "@/lib/landing";
import { KineticText } from "../motion/KineticText";
import { DriftColumns, Marquee } from "../motion/Loops";
import { MotionToggle } from "../motion/MotionToggle";
import { cx, primaryButton, textButton } from "../ui";
import { ScanExplainer } from "./ScanExplainer";

// Hero columns and carousel rows draw from the same pool, offset so neighbours differ.
const columns = [0, 1, 2, 3].map((c) => PHOTOS.filter((_, i) => i % 4 === c));
const rowA = PHOTOS.filter((_, i) => i % 2 === 0);
const rowB = PHOTOS.filter((_, i) => i % 2 === 1).reverse();

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export function Hero() {
  return (
    <section className="px-4 pt-6 lg:grid lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-12 lg:gap-10 lg:px-8 lg:pt-0">
      <div className="flex flex-col justify-center lg:col-span-6 lg:py-16">
        <p className="enter text-micro text-muted" style={delay(0.1)}>
          Moda por foto
        </p>
        <h1 className="@container mt-5 font-display">
          <span className="block text-display tracking-[-0.03em]">
            <KineticText lines={[{ text: "Lo viste." }, { text: "Encontralo.", className: "italic" }]} />
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
        className="-mx-4 mt-12 h-[64svh] px-4 lg:col-span-6 lg:mx-0 lg:mt-0 lg:h-[calc(100svh-3.5rem)] lg:px-0"
      />
    </section>
  );
}

export function Problem() {
  return (
    <section aria-labelledby="problem-title" className="px-4 py-28 lg:px-8 lg:py-44">
      <h2 id="problem-title" className="text-micro text-muted">
        El problema
      </h2>
      <div className="mt-8 font-display text-statement tracking-[-0.02em]">
        <p className="scrub-line">Lo viste en un Reel.</p>
        <p className="scrub-line">Lo guardaste.</p>
        <p className="scrub-line italic">Nunca supiste dónde comprarlo.</p>
      </div>
      <p className="reveal mt-12 max-w-[46ch] text-body text-muted">
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
          Todo lo que ves se puede buscar.
        </h2>
        <p className="reveal max-w-[36ch] text-small text-muted">
          Remeras, abrigos, pantalones, polleras y vestidos: Vibear reconoce 13 tipos de prenda, aunque no sepas cómo se
          llaman.
        </p>
      </div>
      <div className="mt-12 space-y-3 md:space-y-4">
        <Marquee items={rowA} seconds={75} />
        <Marquee items={rowB} seconds={90} reverse />
      </div>
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
        <span className="text-micro tabular-nums text-muted">3 pasos</span>
      </div>
      <div className="mt-10 lg:mt-14">
        <ScanExplainer
          heading={
            <p className="reveal max-w-[14ch] font-display text-title tracking-tight">De la captura a la tienda.</p>
          }
        />
      </div>
    </section>
  );
}

const BENEFITS = [
  { title: "Solo con una foto", text: "No hace falta describirla ni saber cómo se llama. La captura alcanza." },
  { title: "Prenda por prenda", text: "Del look completo, buscás solo lo que te gustó: la campera, el pantalón o el vestido." },
  { title: "Lo más parecido, primero", text: "Cada resultado muestra qué tan parecido es. Lo que te gusta, lo guardás." },
];

export function Benefits() {
  return (
    <section aria-labelledby="benefits-title" className="px-4 py-20 lg:px-8 lg:py-28">
      <h2 id="benefits-title" className="text-micro text-muted">
        Para qué sirve
      </h2>
      <ul className="mt-6 grid gap-px border-y border-line bg-line md:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <li key={benefit.title} className="reveal bg-paper py-10 md:px-8 md:first:pl-0 md:last:pr-0">
            <h3 className="font-display text-numeral italic tracking-tight">{benefit.title}</h3>
            <p className="mt-4 max-w-[34ch] text-small text-muted">{benefit.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TICKER = ["Lo viste", "Encontralo", "Guardalo", "Usalo"];

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="pt-16 lg:pt-24">
      <Marquee
        items={TICKER}
        seconds={40}
        className="border-y border-ink py-5"
        render={(word) => (
          <span className="flex items-center pr-10 font-display text-ticker italic tracking-[-0.03em]">
            {word}
            <span className="pl-10 not-italic">—</span>
          </span>
        )}
      />
      <div className="px-4 py-24 text-center lg:px-8 lg:py-36">
        <h2 id="cta-title" className="reveal font-display text-statement tracking-[-0.02em]">
          ¿Qué viste hoy?
        </h2>
        <p className="reveal mx-auto mt-6 max-w-[38ch] text-body text-muted">
          Tu próxima prenda favorita está en una captura. Subila y encontrala en segundos.
        </p>
        <div className="reveal mt-10">
          <Link href="/scan" className={cx(primaryButton, "h-14 px-10")}>
            Empezá a escanear
          </Link>
        </div>
        <p className="mt-5 text-micro text-muted">Sin cuenta · Desde el celu o la compu</p>
      </div>
      <div className="px-4 lg:px-8" aria-hidden="true">
        <p className="@container font-display">
          <span className="-ml-[0.03em] block text-hero tracking-[-0.045em]">VIBEAR</span>
        </p>
      </div>
    </section>
  );
}
