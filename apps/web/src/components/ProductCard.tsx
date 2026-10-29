"use client";

import { mediaUrl, type Match } from "@/lib/api";
import { ratioOf } from "@/lib/masonry";
import { useSaved } from "@/lib/storage";
import { FadeImage } from "./FadeImage";
import { Icon, cx, icons } from "./ui";

/** Fixed caption height, so MasonryGrid can lay cards out before images load. */
export const CARD_CAPTION = 92;

export function ProductCard({ match }: { match: Match }) {
  const ratio = ratioOf(match.thumbnail_width, match.thumbnail_height);
  const score = match.similarity === null ? null : Math.round(match.similarity * 100);

  return (
    <article className="group">
      <div className="relative overflow-hidden rounded-media bg-surface" style={{ aspectRatio: `1 / ${ratio}` }}>
        <a href={mediaUrl(match.link)} target="_blank" rel="noopener noreferrer" className="absolute inset-0">
          {match.thumbnail ? (
            <FadeImage src={mediaUrl(match.thumbnail)} alt={match.title} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full place-items-center text-micro text-muted">Sin imagen</span>
          )}
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-ink/20 opacity-0 transition-opacity duration-200 ease-out-soft group-hover:opacity-100"
          />
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 bg-paper px-2.5 py-2 text-micro opacity-0 transition-opacity duration-200 ease-out-soft group-hover:opacity-100 group-has-[a:focus-visible]:opacity-100">
            Ver en tienda <Icon path={icons.arrowUpRight} />
          </span>
          <span className="sr-only">(se abre en una pestaña nueva)</span>
        </a>
        <SaveButton match={match} className="absolute right-2 top-2" />
      </div>
      <div className="overflow-hidden pt-2.5" style={{ height: CARD_CAPTION }}>
        <p className="truncate text-micro text-muted">{match.source ?? "Tienda"}</p>
        <h3 className="mt-1 line-clamp-2 text-small">{match.title}</h3>
        <p className="mt-1 flex items-baseline justify-between gap-2 text-small tabular-nums">
          <span className="truncate font-medium">{match.price ?? ""}</span>
          {score !== null && <span className="shrink-0 text-muted">{score}% similitud</span>}
        </p>
      </div>
    </article>
  );
}

export function SaveButton({ match, className }: { match: Match; className?: string }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(match.link);

  return (
    <button
      type="button"
      onClick={() => toggle(match)}
      aria-pressed={saved}
      aria-label={saved ? `Quitar de guardados: ${match.title}` : `Guardar: ${match.title}`}
      className={cx(
        "grid h-10 w-10 place-items-center bg-paper text-ink transition-opacity duration-200 ease-out-soft",
        // Pinterest-style: hidden until hover on mouse devices, always there on touch and once saved.
        !saved && "pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
    >
      <Icon path={icons.bookmark} filled={saved} />
    </button>
  );
}
