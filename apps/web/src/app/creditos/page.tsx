import type { Metadata } from "next";
import { PHOTOS } from "@/lib/landing";
import { pad } from "@/lib/labels";

export const metadata: Metadata = { title: "Créditos de fotos" };

export default function CreditsPage() {
  return (
    <div className="px-4 pb-10 pt-8 lg:px-8">
      <header className="flex items-end justify-between border-b border-line pb-4">
        <h1 className="font-display text-title tracking-tight">Créditos</h1>
        <p className="text-micro tabular-nums text-muted">{pad(PHOTOS.length)} fotos</p>
      </header>
      <p className="mt-6 max-w-[60ch] text-small text-muted">
        Las fotos de la página de inicio son de Wikimedia Commons, con licencias libres. Las redimensionamos y las
        convertimos a WebP; los recortes del ejemplo salen de esas mismas fotos.
      </p>
      <ol className="mt-8 divide-y divide-line border-y border-line">
        {PHOTOS.map((photo, index) => (
          <li key={photo.src} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3 text-small">
            <span className="w-8 shrink-0 text-micro tabular-nums text-muted">{pad(index + 1)}</span>
            <a href={photo.credit.url} className="min-w-0 flex-1 underline-offset-4 hover:underline">
              {photo.credit.title}
            </a>
            <span className="text-muted">
              {photo.credit.author} · {photo.credit.license}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
