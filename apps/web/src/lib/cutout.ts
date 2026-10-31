import { useEffect, useState } from "react";
import { knockOut } from "./cutout-core";
import type { CutReply, CutRequest } from "./cutout.worker";

/**
 * A product photo on white, cut out in the browser: the white that touches the photo's edges turns
 * transparent (with a soft rim), and the picture is trimmed to the product, so a perfume bottle stands
 * on its own like a PNG. The photo is the shop's own, hotlinked from its CDN (Tiendanube's allows it
 * with CORS); nothing is stored or re-published. When a CDN doesn't allow it, the photo is used as is.
 *
 * The cutting runs in a worker (lib/cutout.worker.ts): on the main thread a 1400px bottle took ~100 ms
 * on a laptop and ~600 ms on a phone-speed CPU, right as the perfumery scrolled in.
 */

/** `tint`: the bottle's own colour (its most colourful pixels, averaged), for a backdrop that matches it. */
export type Cutout = { src: string; width: number; height: number; cut: boolean; tint?: string };

const MAX_SIDE = 640; // a catalogue card; the perfume film asks for more
const cache = new Map<string, Promise<Cutout>>();

export function cutout(src: string, maxSide = MAX_SIDE): Promise<Cutout> {
  const key = `${maxSide} ${src}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = workerCut(src, maxSide) ?? mainThreadCut(src, maxSide);
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}

/** The cut-out photo for a component; null while it is being cut. A photo that fails shows as is. */
export function useCutout(src: string | null, maxSide = MAX_SIDE): Cutout | null {
  const [shot, setShot] = useState<{ key: string; cut: Cutout } | null>(null);
  const key = `${maxSide} ${src}`;
  useEffect(() => {
    if (!src) return;
    let live = true;
    cutout(src, maxSide).then(
      (cut) => live && setShot({ key, cut }),
      () => live && setShot({ key, cut: { src, width: 3, height: 4, cut: false } }),
    );
    return () => {
      live = false;
    };
  }, [src, maxSide, key]);
  return src && shot && shot.key === key ? shot.cut : null;
}

// ─── In a worker ──────────────────────────────────────────────────────────────────────────────
let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, (reply: CutReply) => void>();

function workerCut(src: string, maxSide: number): Promise<Cutout> | null {
  if (worker === undefined) {
    try {
      worker =
        typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
          ? new Worker(new URL("./cutout.worker.ts", import.meta.url), { type: "module" })
          : null;
      worker?.addEventListener("message", ({ data }: MessageEvent<CutReply>) => {
        waiting.get(data.id)?.(data);
        waiting.delete(data.id);
      });
    } catch {
      worker = null;
    }
  }
  if (!worker) return null;
  const id = nextId++;
  return new Promise<Cutout>((resolve) => {
    waiting.set(id, (reply) =>
      resolve(
        reply.ok
          ? { src: URL.createObjectURL(reply.blob), width: reply.width, height: reply.height, cut: true, tint: reply.tint }
          : loadPlain(src),
      ),
    );
    worker!.postMessage({ id, src, maxSide } satisfies CutRequest);
  });
}

/** The photo as is, measured by loading it. */
function loadPlain(src: string): Promise<Cutout> {
  return load(src, false).then(plain);
}

// ─── On the main thread (browsers without workers or OffscreenCanvas) ───────────────────────────
// One photo at a time, with a breath between them: a catalogue cuts a dozen bottles, and doing them
// all at once would stall the scroll just as the section arrives.
let queue: Promise<unknown> = Promise.resolve();
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

function mainThreadCut(src: string, maxSide: number): Promise<Cutout> {
  const pending = queue.then(breathe).then(() => load(src, true).then((image) => cut(image, maxSide), () => loadPlain(src)));
  queue = pending.catch(() => undefined);
  return pending;
}

function load(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (cors) image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    setTimeout(() => reject(new Error("timeout")), 15_000); // a stalled photo must not hold the queue
    image.src = src;
  });
}

function plain(image: HTMLImageElement): Cutout {
  return { src: image.src, width: image.naturalWidth, height: image.naturalHeight, cut: false };
}

async function cut(image: HTMLImageElement, maxSide: number): Promise<Cutout> {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const w = Math.max(1, Math.round(image.naturalWidth * scale));
  const h = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return plain(image);
  context.drawImage(image, 0, 0, w, h);
  let pixels: ImageData;
  try {
    pixels = context.getImageData(0, 0, w, h);
  } catch {
    return plain(image); // tainted after all: show the photo as it is
  }
  const box = knockOut(pixels.data, w, h);
  if (!box) return plain(image);
  context.putImageData(pixels, 0, 0);

  const trimmed = document.createElement("canvas");
  trimmed.width = box.width;
  trimmed.height = box.height;
  trimmed.getContext("2d")!.drawImage(canvas, box.left, box.top, box.width, box.height, 0, 0, box.width, box.height);
  const blob = await new Promise<Blob | null>((resolve) => trimmed.toBlob(resolve, "image/png"));
  if (!blob) return plain(image);
  return { src: URL.createObjectURL(blob), width: box.width, height: box.height, cut: true, tint: box.tint };
}
