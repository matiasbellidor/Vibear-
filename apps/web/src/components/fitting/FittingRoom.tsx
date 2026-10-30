"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ApiError, api, type CutGarments, type Slot } from "@/lib/api";
import {
  EMPTY,
  LAYERS,
  NO_FIT,
  dataUrl,
  loadWardrobe,
  place,
  renderLook,
  saveWardrobe,
  wear,
  type Garment,
  type Wardrobe,
} from "@/lib/fitting";
import { labelFor } from "@/lib/labels";
import { downscale } from "@/lib/resize";
import { useSaved } from "@/lib/storage";
import { Brackets } from "../motion/Hud";
import { Icon, Notice, cx, icons, outlineButton, primaryButton, textButton } from "../ui";

const SLOT_NAMES: Record<Slot, { group: string; one: string }> = {
  top: { group: "Arriba", one: "Prenda de arriba" },
  outer: { group: "Abrigos", one: "Abrigo" },
  bottom: { group: "Abajo", one: "Prenda de abajo" },
  dress: { group: "Vestidos", one: "Vestido" },
};
const GROUPS: Slot[] = ["top", "outer", "bottom", "dress"];

const nameOf = (garment: Garment) => garment.name ?? (garment.label ? labelFor(garment.label) : SLOT_NAMES[garment.slot].one);

// Not crypto.randomUUID: it only exists on https or localhost, and a phone on the LAN uses plain http.
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function garmentsFrom(cut: CutGarments): Garment[] {
  return cut.items.map((item) => ({
    ...item,
    id: newId(),
    source: { width: cut.width, height: cut.height, pose: cut.pose },
  }));
}

/**
 * The fitting room: upload a full-body photo of yourself, add your garments (a photo each, or a whole
 * outfit at once, garment by garment), and try them on like a dress-up game. Each piece is placed by
 * your body's keypoints, then you drag it, resize it, or take it off. For men and women alike: it
 * works from your photo. Everything stays on this device.
 */
export function FittingRoom() {
  const [wardrobe, setWardrobe] = useState<Wardrobe | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "body" | "garments">(null);
  const [error, setError] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; dx: number; dy: number } | null>(null);
  const { items: saved } = useSaved();

  useEffect(() => {
    loadWardrobe().then(setWardrobe);
  }, []);

  // Saved on every change, a beat later, so a drag writes once.
  useEffect(() => {
    if (!wardrobe) return;
    const id = setTimeout(() => saveWardrobe(wardrobe), 300);
    return () => clearTimeout(id);
  }, [wardrobe]);

  if (!wardrobe) {
    return <p className="py-24 text-center text-small text-muted">Abriendo tu probador…</p>;
  }

  const update = (change: (current: Wardrobe) => Wardrobe) => setWardrobe((current) => change(current ?? EMPTY));
  const failed = (cause: unknown) => setError(cause instanceof ApiError ? cause.message : "Algo falló. Probá de nuevo.");

  async function addBody(file: File) {
    setBusy("body");
    setError(null);
    try {
      const photo = await downscale(file);
      const found = await api.body(photo);
      const src = await dataUrl(photo);
      update((current) => ({ ...current, body: { src, width: found.width, height: found.height, keypoints: found.keypoints } }));
    } catch (cause) {
      failed(cause);
    } finally {
      setBusy(null);
    }
  }

  async function addGarments(sources: (File | string)[]) {
    setBusy("garments");
    setError(null);
    const added: Garment[] = [];
    try {
      for (const source of sources) {
        const cut = typeof source === "string" ? await api.garmentsUrl(source) : await api.garmentsFile(await downscale(source));
        added.push(...garmentsFrom(cut));
      }
    } catch (cause) {
      failed(cause);
    } finally {
      if (added.length) {
        // A new photo's garments go straight on, so you see the result at once.
        update((current) => ({
          ...current,
          garments: [...current.garments, ...added],
          worn: added.reduce((worn, garment) => wear(worn, garment), { ...current.worn }),
        }));
      }
      setBusy(null);
    }
  }

  const { body, garments, worn, fits } = wardrobe;
  const byId = new Map(garments.map((garment) => [garment.id, garment]));
  const layers = body
    ? LAYERS.flatMap((slot) => {
        const garment = worn[slot] ? byId.get(worn[slot]!) : undefined;
        const rect = garment && place(garment, body, fits[garment.id]);
        return garment && rect ? [{ garment, rect }] : [];
      })
    : [];
  const current = selected && layers.some((layer) => layer.garment.id === selected) ? byId.get(selected)! : null;

  const nudge = (id: string, change: (fit: typeof NO_FIT) => typeof NO_FIT) =>
    update((state) => ({ ...state, fits: { ...state.fits, [id]: change(state.fits[id] ?? NO_FIT) } }));

  function onPointerDown(event: PointerEvent<HTMLImageElement>, id: string) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const fit = fits[id] ?? NO_FIT;
    drag.current = { id, x: event.clientX, y: event.clientY, dx: fit.dx, dy: fit.dy };
    setSelected(id);
  }
  function onPointerMove(event: PointerEvent<HTMLImageElement>) {
    const start = drag.current;
    const box = stage.current?.getBoundingClientRect();
    if (!start || !box) return;
    nudge(start.id, (fit) => ({
      ...fit,
      dx: start.dx + (event.clientX - start.x) / box.width,
      dy: start.dy + (event.clientY - start.y) / box.height,
    }));
  }
  function onKey(event: KeyboardEvent<HTMLImageElement>, id: string) {
    const step = 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    nudge(id, (fit) => ({ ...fit, dx: fit.dx + move[0], dy: fit.dy + move[1] }));
  }

  async function download() {
    if (!body) return;
    const blob = await renderLook(body, layers);
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "mi-look-vibear.jpg";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  }

  const fromSaved = saved.filter((item) => item.thumbnail).slice(0, 12);

  return (
    <div className="px-4 py-8 lg:px-8 lg:py-12">
      <header className="max-w-2xl">
        <p className="text-micro text-wine-bright">Probador · hombre y mujer</p>
        <h1 className="mt-3 font-display text-title tracking-tight">Armá tu outfit.</h1>
        <p className="mt-4 text-small text-muted">
          Subí una foto tuya de cuerpo entero y sumá tus prendas: te las probamos encima, una por una, como en un juego de
          vestir. Una foto de un outfit completo suma cada prenda por separado. Tus fotos quedan en este dispositivo.
        </p>
      </header>

      {error && (
        <div className="mt-6">
          <Notice urgent action={<button type="button" className={textButton} onClick={() => setError(null)}>Cerrar</button>}>
            {error}
          </Notice>
        </div>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-12">
        {/* The stage: your photo, the worn garments on it. */}
        <div className="lg:col-span-7">
          {!body ? (
            <label
              className={cx(
                "relative flex aspect-[3/4] max-h-[70svh] w-full cursor-pointer flex-col items-center justify-center gap-4 border border-ink px-6 text-center",
                busy === "body" && "pointer-events-none",
              )}
            >
              <Brackets className="m-2" />
              <Icon path={icons.camera} className="h-8 w-8" />
              <span className="text-micro">{busy === "body" ? "Buscando tu cuerpo…" : "Subí tu foto de cuerpo entero"}</span>
              <span className="max-w-[34ch] text-small text-muted">De pies a cabeza, de frente, con luz pareja. Ropa ajustada ayuda.</span>
              <input
                type="file"
                accept="image/*"
                aria-label="Subí tu foto de cuerpo entero"
                className="sr-only"
                disabled={busy !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) addBody(file);
                }}
              />
              {busy === "body" && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-ink motion-safe:animate-scan" />}
            </label>
          ) : (
            <>
              <div
                ref={stage}
                className="relative mx-auto w-full touch-none select-none overflow-hidden rounded-media bg-surface"
                style={{ aspectRatio: `${body.width} / ${body.height}`, maxWidth: `calc(72svh * ${body.width / body.height})` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- your own photo, a data: URL */}
                <img src={body.src} alt="Tu foto" className="absolute inset-0 h-full w-full" draggable={false} />
                {layers.map(({ garment, rect }) => (
                  // eslint-disable-next-line @next/next/no-img-element -- a cut-out, a data: URL
                  <img
                    key={garment.id}
                    src={garment.image}
                    alt={`Llevás puesto: ${nameOf(garment)}`}
                    tabIndex={0}
                    draggable={false}
                    onPointerDown={(event) => onPointerDown(event, garment.id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={() => (drag.current = null)}
                    onPointerCancel={() => (drag.current = null)}
                    onFocus={() => setSelected(garment.id)}
                    onKeyDown={(event) => onKey(event, garment.id)}
                    className={cx(
                      "absolute max-w-none cursor-grab touch-none drop-shadow-[0_6px_10px_rgb(0_0_0/0.25)] active:cursor-grabbing",
                      current?.id === garment.id && "outline-1 outline-offset-2 outline-wine-bright outline-dashed",
                    )}
                    style={{ left: `${rect.left * 100}%`, top: `${rect.top * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}
                  />
                ))}
                {busy === "garments" && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-ink mix-blend-difference motion-safe:animate-scan" />}
              </div>

              {/* The selected garment: size, reset, off. Drag it, or move it with the arrow keys. */}
              <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3 border-y border-line py-2">
                {current ? (
                  <>
                    <span className="min-w-0 truncate text-small">{nameOf(current)}</span>
                    <span className="flex items-center gap-1">
                      <button type="button" aria-label="Achicar" className={iconButton} onClick={() => nudge(current.id, (fit) => ({ ...fit, scale: Math.max(0.3, fit.scale * 0.94) }))}>
                        <Icon path={icons.minus} />
                      </button>
                      <button type="button" aria-label="Agrandar" className={iconButton} onClick={() => nudge(current.id, (fit) => ({ ...fit, scale: Math.min(3, fit.scale * 1.06) }))}>
                        <Icon path={icons.plus} />
                      </button>
                      <button type="button" className={cx(textButton, "ml-3")} onClick={() => nudge(current.id, () => NO_FIT)}>
                        Acomodar
                      </button>
                      <button type="button" className={cx(textButton, "ml-3")} onClick={() => update((state) => ({ ...state, worn: wear(state.worn, current) }))}>
                        Sacar
                      </button>
                    </span>
                  </>
                ) : (
                  <span className="text-small text-muted">
                    {layers.length ? "Tocá una prenda para moverla o cambiarle el tamaño." : "Elegí prendas de tu ropero para probártelas."}
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                {layers.length > 0 && (
                  <button type="button" className={outlineButton} onClick={download}>
                    <Icon path={icons.download} /> Descargar look
                  </button>
                )}
                <label className={cx(textButton, "cursor-pointer")}>
                  Cambiar mi foto
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Cambiar mi foto de cuerpo entero"
                    className="sr-only"
                    disabled={busy !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) addBody(file);
                    }}
                  />
                </label>
              </div>
            </>
          )}
        </div>

        {/* The wardrobe: your garments by where they go, a tap to put on or take off. */}
        <section aria-labelledby="wardrobe-title" className="lg:col-span-5">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <h2 id="wardrobe-title" className="text-micro">
              Tu ropero
            </h2>
            <span className="text-micro tabular-nums text-muted">{garments.length} prendas</span>
          </div>
          <label className={cx(primaryButton, "mt-5 w-full cursor-pointer", busy !== null && "pointer-events-none opacity-60")}>
            <Icon path={icons.camera} />
            {busy === "garments" ? "Recortando prendas…" : "Sumar prendas"}
            <input
              type="file"
              accept="image/*"
              multiple
              aria-label="Sumar prendas"
              className="sr-only"
              disabled={busy !== null}
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = "";
                if (files.length) addGarments(files);
              }}
            />
          </label>
          <p className="mt-2 text-micro normal-case tracking-normal text-muted">
            Una prenda colgada o en el piso, o una foto tuya con el outfit puesto: recortamos cada prenda.
          </p>

          {garments.length === 0 && <p className="py-10 text-center text-small text-muted">Todavía no sumaste prendas.</p>}
          {GROUPS.map((slot) => {
            const group = garments.filter((garment) => garment.slot === slot);
            if (!group.length) return null;
            return (
              <div key={slot} className="mt-6">
                <h3 className="text-micro text-muted">{SLOT_NAMES[slot].group}</h3>
                <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-3">
                  {group.map((garment) => {
                    const on = worn[garment.slot] === garment.id;
                    return (
                      <li key={garment.id} className="relative">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => {
                            update((state) => ({ ...state, worn: wear(state.worn, garment) }));
                            setSelected(on ? null : garment.id);
                          }}
                          className={cx("block w-full text-left", on && "text-wine-bright")}
                        >
                          <span
                            className={cx(
                              "flex aspect-square items-center justify-center overflow-hidden rounded-media bg-surface p-2 outline-offset-2",
                              on && "outline-2 outline-wine-bright outline",
                            )}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- a cut-out, a data: URL */}
                            <img src={garment.image} alt="" className="max-h-full max-w-full object-contain" />
                          </span>
                          <span className="mt-1.5 line-clamp-2 block text-micro normal-case tracking-normal">{nameOf(garment)}</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Borrar ${nameOf(garment)} del ropero`}
                          onClick={() =>
                            update((state) => {
                              const next = { ...state.worn };
                              if (next[garment.slot] === garment.id) delete next[garment.slot];
                              return { ...state, garments: state.garments.filter((g) => g.id !== garment.id), worn: next };
                            })
                          }
                          className="absolute right-1 top-1 grid h-7 w-7 place-items-center bg-paper/90 text-ink"
                        >
                          <Icon path={icons.close} className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {fromSaved.length > 0 && (
            <div className="mt-8 border-t border-line pt-5">
              <h3 className="text-micro">Probate lo que guardaste</h3>
              <ul className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {fromSaved.map((item) => (
                  <li key={item.link} className="w-20 shrink-0">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => addGarments([item.thumbnail!])}
                      aria-label={`Sumar al ropero: ${item.title}`}
                      className="block w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a shop's thumbnail */}
                      <img src={item.thumbnail!} alt="" referrerPolicy="no-referrer" className="aspect-[3/4] w-full rounded-media bg-surface object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const iconButton =
  "grid h-10 w-10 place-items-center border border-line transition-colors duration-200 ease-out-soft hover:border-ink";
