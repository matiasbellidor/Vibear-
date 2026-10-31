// The cut-out itself, on raw pixels: shared by the worker (lib/cutout.worker.ts) and the
// main-thread fallback in lib/cutout.ts.

// Shop photos sit on 254-255 white; a white bottle's edge is ~234. At 236 the flood ate into Naxos's
// white glass, at 248 it stops at the glass.
const WHITE = 248; // a pixel this light on every channel, and grey, is background when it touches the edge
const GREY = 10; // max spread between channels: a pale-blue bottle is not background

export type Knocked = { left: number; top: number; width: number; height: number; tint?: string };

/**
 * Makes the white that touches the picture's edges transparent, in place (with a soft rim, the white
 * taken back out of its colour so no pale halo shows on a dark page). Returns the product's box and
 * its colour (solid pixels weighted by how colourful they are: gold beats a black stripe), or null
 * when there is no white around it (not a studio shot) or nothing left.
 */
export function knockOut(data: Uint8ClampedArray, w: number, h: number): Knocked | null {
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
  if (tail === 0) return null;

  let top = h, left = w, bottom = -1, right = -1;
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
    } else {
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
  if (bottom < 0) return null;
  const tint = weight ? `rgb(${Math.round(tr / weight)} ${Math.round(tg / weight)} ${Math.round(tb / weight)})` : undefined;
  return { left, top, width: right - left + 1, height: bottom - top + 1, tint };
}
