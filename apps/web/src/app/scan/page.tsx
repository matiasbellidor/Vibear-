import type { Metadata } from "next";
import { STEPS } from "@/components/landing/ScanExplainer";
import { RecentLooks } from "@/components/RecentLooks";
import { Uploader } from "@/components/Uploader";
import { pad } from "@/lib/labels";

export const metadata: Metadata = { title: "Escanear" };

export default function ScanPage() {
  return (
    <>
      <section className="px-4 pt-8 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
          <h1 className="font-display text-title tracking-tight">Escaneá un look</h1>
          <p className="text-micro text-muted">Detecta 13 tipos de prenda</p>
        </div>
      </section>

      <section className="mt-10 grid gap-12 px-4 lg:mt-12 lg:grid-cols-12 lg:gap-10 lg:px-8">
        <div className="lg:col-span-7">
          <Uploader />
        </div>
        <div className="lg:col-span-5">
          <h2 className="text-micro text-muted">Cómo funciona</h2>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-6 py-6">
                <span aria-hidden="true" className="w-16 shrink-0 font-display text-numeral tabular-nums">
                  {pad(index + 1)}
                </span>
                <div className="pt-1.5">
                  <h3 className="text-micro">{step.title}</h3>
                  <p className="mt-2 text-small text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <RecentLooks />
    </>
  );
}
