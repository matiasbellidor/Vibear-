/**
 * A product photo on white, cut out in the browser: the white that touches the photo's edges turns
 * transparent (with a soft rim), and the picture is trimmed to the product, so a perfume bottle stands
 * on its own like a PNG. The photo is the shop's own, hotlinked from its CDN (Tiendanube's allows it
 * with CORS); nothing is stored or re-published. When a CDN doesn't allow it, the photo is used as is.
 */
import { useEffect, useState } from "react";

/** `tint`: the bottle's own colour (its most colourful pixels, averaged), for a backdrop that matches it. */
export type Cutout = { src: string; width: number; height: number; cut: boolean; tint?: string };

const MAX_SIDE = 640; // a catalogue card; the perfume film asks for more
// Shop photos sit on 254-255 white; a white bottle's edge is ~234. At 236 the flood ate into Naxos's
// white glass, at 248 it stops at the glass.
const WHITE = 248; // a pixel this light on every channel, and grey, is background when it touches the edge
const GREY = 10; // max spread between channels: a pale-blue bottle is not background
const cache = new Map<string, Promise<Cutout>>();
// One photo at a time, with a breath between them: a catalogue cuts a dozen bottles, and doing them
// all at once would stall the scroll just as the section arrives.
let queue: Promise<unknown> = Promise.resolve();
const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));

export function cutout(src: string, maxSide = MAX_SIDE): Promise<Cutout> {
  const key = `${maxSide} ${src}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = queue.then(breathe).then(() => load(src, true).then((image) => cut(image, maxSide), () => load(src, false).then(plain)));
    queue = pending.catch(() => undefined);
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
  const data = pixels.data;
  const isWhite = (p: number) => {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    return Math.min(r, g, b) >= WHITE && Math.max(r, g, b) - Math.min(r, g, b) <= GREY;
  };

  // Flood the background from every edge pixel that is white.
  const background = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const seed = (p: number) => {
    if (!background[p] && isWhite(p)) {
      background[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const p = queue[head++];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < w * (h - 1)) seed(p + w);
  }
  if (tail === 0) return plain(image); // no white around it: not a studio shot, leave it alone

  // Background out; the product's rim (next to the background) fades by how white it is, with the
  // white taken back out of its colour, so no pale halo shows on a dark page.
  let top = h, left = w, bottom = -1, right = -1;
  // The tint: solid product pixels, weighted by how colourful they are (gold beats a black stripe).
  let tr = 0, tg = 0, tb = 0, weight = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (background[p]) {
      data[i + 3] = 0;
      continue;
    }
    const x = p % w, y = (p - x) / w;
    const rim = (x > 0 && background[p - 1]) || (x < w - 1 && background[p + 1]) || (y > 0 && background[p - w]) || (y < h - 1 && background[p + w]);
    if (rim) {
      const alpha = Math.min(1, (255 - Math.min(data[i], data[i + 1], data[i + 2])) / 60);
      if (alpha < 0.04) {
        data[i + 3] = 0;
        continue;
      }
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, (data[i + c] - 255 * (1 - alpha)) / alpha));
      data[i + 3] = Math.round(alpha * 255);
    }
    if (!rim) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma > 24 && Math.max(r, g, b) > 28) {
        tr += r * chroma;
        tg += g * chroma;
        tb += b * chroma;
        weight += chroma;
      }
    }
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  if (bottom < 0) return plain(image);
  context.putImageData(pixels, 0, 0);

  const trimmed = document.createElement("canvas");
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext("2d")!.drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  const blob = await new Promise<Blob | null>((resolve) => trimmed.toBlob(resolve, "image/png"));
  if (!blob) return plain(image);
  const tint = weight ? `rgb(${Math.round(tr / weight)} ${Math.round(tg / weight)} ${Math.round(tb / weight)})` : undefined;
  return { src: URL.createObjectURL(blob), width: trimmed.width, height: trimmed.height, cut: true, tint };
}
