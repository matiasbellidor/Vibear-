import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/PageTransition";
import type { Credit } from "@/lib/landing";
import { creditsOf, getLanding } from "@/lib/landing-data";
import { pad } from "@/lib/labels";

export const metadata: Metadata = { title: "Créditos de fotos" };

export default function CreditsPage() {
  const credits = creditsOf(getLanding().pins);
  return (
    <PageTransition>
      <div className="px-4 pb-10 pt-8 lg:px-8">
        <header className="flex items-end justify-between border-b border-line pb-4">
          <h1 className="font-display text-title tracking-tight">Créditos</h1>
          <p className="text-micro tabular-nums text-muted">{pad(credits.length)} fotos</p>
        </header>
        <p className="mt-6 max-w-[62ch] text-small text-muted">
          Las fotos de la página de inicio y del catálogo de ejemplo son de Wikimedia Commons, con licencias libres (CC0,
          CC BY y CC BY-SA). Las redimensionamos, recortamos y convertimos a WebP; los tableros de outfit combinan fotos de
          producto recortadas.
        </p>
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {credits.map((credit: Credit, index) => (
            <li key={credit.url || credit.title} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3 text-small">
              <span className="w-8 shrink-0 text-micro tabular-nums text-muted">{pad(index + 1)}</span>
              {credit.url ? (
                <a href={credit.url} className="min-w-0 flex-1 underline-offset-4 hover:underline">
                  {credit.title}
                </a>
              ) : (
                <span className="min-w-0 flex-1">{credit.title}</span>
              )}
              <span className="text-muted">
                {credit.author} · {credit.license}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </PageTransition>
  );
}
