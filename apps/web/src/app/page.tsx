import { RecentLooks } from "@/components/RecentLooks";
import { Uploader } from "@/components/Uploader";
import { pad } from "@/lib/labels";

const STEPS = [
  ["Subí una foto", "Una captura de Reels, TikTok o Pinterest, o una foto tuya."],
  ["Elegí la prenda", "Detectamos cada prenda del look por separado."],
  ["Encontrala", "Te mostramos dónde comprarla, ordenado por parecido."],
];

export default function Home() {
  return (
    <>
      <section className="px-4 pt-6 lg:px-8 lg:pt-8">
        {/* Tracking sits on the span: em-based letter-spacing resolves against the element that declares it. */}
        <h1 aria-label="Vibear" className="@container font-display">
          <span className="-ml-[0.03em] block text-hero tracking-[-0.045em]">VIBEAR</span>
        </h1>
        <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-ink pt-3">
          <p className="text-micro">Encontrá la ropa que viste</p>
          <p className="text-micro text-muted">Reels · TikTok · Pinterest</p>
        </div>
      </section>

      <section className="mt-12 grid gap-12 px-4 lg:mt-16 lg:grid-cols-12 lg:gap-10 lg:px-8">
        <div className="lg:col-span-7">
          <Uploader />
        </div>
        <div className="lg:col-span-5">
          <h2 className="text-micro text-muted">Cómo funciona</h2>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {STEPS.map(([title, text], index) => (
              <li key={title} className="flex gap-6 py-6">
                <span aria-hidden="true" className="w-16 shrink-0 font-display text-numeral tabular-nums">
                  {pad(index + 1)}
                </span>
                <div className="pt-1.5">
                  <h3 className="text-micro">{title}</h3>
                  <p className="mt-2 text-small text-muted">{text}</p>
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
