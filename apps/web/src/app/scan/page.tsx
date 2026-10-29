import type { Metadata } from "next";
import { ScanDemo, STEPS } from "@/components/landing/ScanExplainer";
import { RecentLooks } from "@/components/RecentLooks";
import { Uploader } from "@/components/Uploader";
import { pad } from "@/lib/labels";

export const metadata: Metadata = { title: "Escanear" };

export default function ScanPage() {
  return (
    <>
      <section className="px-4 pt-8 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line pb-4">
          <h1 className="font-display text-title tracking-tight">
            Escaneá un <span className="italic text-wine">look</span>
          </h1>
          <p className="text-micro text-muted">Detecta 13 tipos de prenda</p>
        </div>
      </section>

      <section className="mt-10 grid gap-12 px-4 lg:mt-12 lg:grid-cols-12 lg:gap-10 lg:px-8">
        <div className="lg:col-span-7">
          <Uploader />
        </div>
        <aside className="lg:col-span-5">
          <h2 className="text-micro text-muted">Así funciona</h2>
          {/* What happens after the upload, shown rather than told. */}
          <ScanDemo className="mt-4 max-w-[30rem]" />
          <ol className="mt-8 divide-y divide-line border-y border-line">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-5 py-4">
                <span aria-hidden="true" className="w-8 shrink-0 text-micro tabular-nums text-wine">
                  {pad(index + 1)}
                </span>
                <div>
                  <h3 className="text-micro">{step.title}</h3>
                  <p className="mt-1 text-small text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <RecentLooks />
    </>
  );
}
