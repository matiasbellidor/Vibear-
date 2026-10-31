/// <reference lib="webworker" />
// Cuts a product photo out of its white background off the main thread, so a dozen bottles (or a
// 1400px one) never stall the scroll. Same algorithm as the fallback (lib/cutout-core.ts).
import { knockOut } from "./cutout-core";

export type CutRequest = { id: number; src: string; maxSide: number };
export type CutReply =
  | { id: number; ok: true; blob: Blob; width: number; height: number; tint?: string }
  | { id: number; ok: false; cut: false }; // no white around it, or the CDN refused: use the photo as is

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = async ({ data: { id, src, maxSide } }: MessageEvent<CutRequest>) => {
  try {
    // CORS, no cookies, no referrer: the shop's CDN serves it like any hotlinked photo.
    const response = await fetch(src, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error(String(response.status));
    const bitmap = await createImageBitmap(await response.blob());
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const pixels = context.getImageData(0, 0, w, h);
    const box = knockOut(pixels.data, w, h);
    if (!box) {
      scope.postMessage({ id, ok: false, cut: false } satisfies CutReply);
      return;
    }
    context.putImageData(pixels, 0, 0);
    const trimmed = new OffscreenCanvas(box.width, box.height);
    trimmed.getContext("2d")!.drawImage(canvas, box.left, box.top, box.width, box.height, 0, 0, box.width, box.height);
    const blob = await trimmed.convertToBlob({ type: "image/png" });
    scope.postMessage({ id, ok: true, blob, width: box.width, height: box.height, tint: box.tint } satisfies CutReply);
  } catch {
    scope.postMessage({ id, ok: false, cut: false } satisfies CutReply);
  }
};
