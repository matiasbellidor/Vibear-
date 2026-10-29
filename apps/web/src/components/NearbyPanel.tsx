"use client";

import { useState, type FormEvent } from "react";
import { ApiError, api, type Place, type Shop } from "@/lib/api";
import { useSavedLocation } from "@/lib/storage";
import { Icon, Notice, cx, icons, outlineButton, primaryButton, textButton } from "./ui";

const RADII = [1000, 2000, 5000];
const ONLINE_ONLY = new Set(["catalogo demo", "mercado libre", "amazon", "pinterest", "instagram", "aliexpress", "shein", "temu", "ebay"]);

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; place: Place; shops: Shop[]; radius: number };

function distance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}

function normalize(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Brands worth looking for in physical shops: result sources, minus online-only marketplaces. */
export function brandsFrom(sources: (string | null)[]): string[] {
  const seen = new Map<string, string>();
  for (const source of sources) {
    if (source && !ONLINE_ONLY.has(normalize(source))) seen.set(normalize(source), source);
  }
  return [...seen.values()].slice(0, 30);
}

const directions = (shop: Shop) => `https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`;
const areaSearch = (place: Place) => `https://www.google.com/maps/search/tiendas+de+ropa/@${place.lat},${place.lng},15z`;

/**
 * "Buscar en mi zona": where the visitor is (device location, an address or a Google Maps link)
 * → clothing shops nearby from OpenStreetMap, shops of brands seen in the results first.
 */
export function NearbyPanel({ brands }: { brands: string[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [radius, setRadius] = useState(RADII[1]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [saved, setSaved] = useSavedLocation();

  const search = async (place: Place, withinMeters = radius) => {
    setPhase({ kind: "loading", message: "Buscando locales…" });
    try {
      const { shops } = await api.nearby(place, withinMeters, brands);
      setSaved(place);
      setPhase({ kind: "ready", place, shops, radius: withinMeters });
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof ApiError ? error.message : "Algo salió mal. Probá de nuevo." });
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setPhase({ kind: "loading", message: "Ubicando…" });
    try {
      await search(await api.geocode(query.trim()));
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof ApiError ? error.message : "Algo salió mal. Probá de nuevo." });
    }
  };

  const useDeviceLocation = () => {
    if (!("geolocation" in navigator)) {
      setPhase({ kind: "error", message: "Este navegador no comparte la ubicación. Escribí tu barrio o pegá un link de Google Maps." });
      return;
    }
    setPhase({ kind: "loading", message: "Ubicando…" });
    navigator.geolocation.getCurrentPosition(
      (position) => void search({ lat: position.coords.latitude, lng: position.coords.longitude, label: "tu ubicación" }),
      () =>
        setPhase({
          kind: "error",
          message: "No pudimos usar tu ubicación. Escribí tu barrio o pegá un link de Google Maps.",
        }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  };

  const changeRadius = (next: number) => {
    setRadius(next);
    if (phase.kind === "ready") void search(phase.place, next);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={outlineButton}>
        <Icon path={icons.pin} /> Buscar en mi zona
      </button>
    );
  }

  return (
    <section aria-labelledby="nearby-title" className="border border-ink p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="nearby-title" className="text-micro">
            Locales cerca tuyo
          </h2>
          <p className="mt-2 max-w-[52ch] text-small text-muted">
            Decinos dónde estás y te mostramos tiendas de ropa de la zona. Primero, las que venden marcas de estos
            resultados.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar locales cerca tuyo" className="-m-2 p-2">
          <Icon path={icons.close} />
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={useDeviceLocation} className={cx(primaryButton, "h-11 shrink-0")}>
          <Icon path={icons.target} /> Usar mi ubicación
        </button>
        <form onSubmit={onSubmit} className="flex min-w-0 flex-1 border border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink">
          <label htmlFor="nearby-query" className="sr-only">
            Barrio, dirección o link de Google Maps
          </label>
          <input
            id="nearby-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Barrio, dirección o link de Google Maps"
            autoComplete="street-address"
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-small outline-none placeholder:text-muted"
          />
          <button type="submit" aria-label="Buscar locales" className="grid h-11 w-11 shrink-0 place-items-center border-l border-ink hover:bg-ink hover:text-paper">
            <Icon path={icons.arrowRight} />
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-micro text-muted">Radio</span>
        {RADII.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={radius === value}
            onClick={() => changeRadius(value)}
            className={cx("text-micro decoration-1 underline-offset-[6px]", radius === value ? "text-wine-bright underline" : "hover:underline")}
          >
            {distance(value)}
          </button>
        ))}
        {saved && phase.kind === "idle" && (
          <button type="button" onClick={() => void search(saved)} className={cx(textButton, "ml-auto")}>
            Buscar cerca de {saved.label}
          </button>
        )}
      </div>

      <div className="mt-5" aria-live="polite">
        {phase.kind === "loading" && <p className="text-micro text-muted">{phase.message}</p>}
        {phase.kind === "error" && <Notice urgent>{phase.message}</Notice>}
        {phase.kind === "ready" && (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line pb-3">
              <p className="text-micro">
                {phase.shops.length === 0
                  ? `Sin locales de ropa a menos de ${distance(phase.radius)}`
                  : `${phase.shops.length} locales a menos de ${distance(phase.radius)} · ${phase.place.label}`}
              </p>
              <a href={areaSearch(phase.place)} target="_blank" rel="noopener noreferrer" className={cx(textButton, "inline-flex items-center gap-1")}>
                Ver en Google Maps <Icon path={icons.arrowUpRight} />
              </a>
            </div>
            {phase.shops.length === 0 ? (
              <p className="py-6 text-small text-muted">
                No encontramos tiendas de ropa en esa zona. Probá con un radio más grande o abrí Google Maps.
              </p>
            ) : (
              <ol aria-label="Locales cercanos" className="max-h-96 divide-y divide-line overflow-y-auto">
                {phase.shops.map((shop) => (
                  <li key={`${shop.name}-${shop.lat}`} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-small font-medium">{shop.name}</p>
                      <p className="text-micro tabular-nums text-muted">
                        {distance(shop.distance_m)}
                        {shop.address && ` · ${shop.address}`}
                      </p>
                      {shop.brand_match && (
                        <p className="mt-1 inline-block bg-blush px-2 py-0.5 text-micro text-wine-bright">Marca de tus resultados</p>
                      )}
                    </div>
                    <a
                      href={directions(shop)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Cómo llegar a ${shop.name}`}
                      className={cx(textButton, "inline-flex shrink-0 items-center gap-1")}
                    >
                      Cómo llegar <Icon path={icons.arrowUpRight} />
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      <p className="mt-4 text-micro text-muted">
        Locales: © colaboradores de OpenStreetMap. Tu ubicación queda solo en este navegador.
      </p>
    </section>
  );
}
