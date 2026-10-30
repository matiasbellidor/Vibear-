import type { BodyPoints, CutGarment, Point, Slot } from "./api";

// The fitting room (Outfits tab): your full-body photo, garments cut out of their photos, and where
// each one goes on you. Everything lives on this device (IndexedDB): photos never leave it except to
// be read once by the API, which doesn't keep them.

export type Body = { src: string; width: number; height: number; keypoints: BodyPoints };
export type Garment = CutGarment & {
  id: string;
  /** The photo it came from, and the person wearing it there (null: a flat lay or a product shot). */
  source: { width: number; height: number; pose: BodyPoints | null };
};
/** Your nudges on a worn garment: a shift (fractions of your photo) and a size factor. */
export type Fit = { dx: number; dy: number; scale: number };
export type Wardrobe = { body: Body | null; garments: Garment[]; worn: Partial<Record<Slot, string>>; fits: Record<string, Fit> };
/** Where a garment sits on your photo, as fractions of it (CSS percentages). */
export type Rect = { left: number; top: number; width: number; height: number };

export const EMPTY: Wardrobe = { body: null, garments: [], worn: {}, fits: {} };
export const NO_FIT: Fit = { dx: 0, dy: 0, scale: 1 };
/** Bottom to top: trousers under a dress under a top under a jacket. */
export const LAYERS: Slot[] = ["bottom", "dress", "top", "outer"];

type Anchors = { shoulders: Point; shoulderWidth: number; hips: Point; hipWidth: number; feet: Point; torso: number };

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** The body parts that carry clothes, in the photo's pixels. Needs shoulders and hips. */
function anchors(points: BodyPoints, width: number, height: number): Anchors | null {
  const px = (point?: Point): Point | null => (point ? [point[0] * width, point[1] * height] : null);
  const [ls, rs, lh, rh] = [px(points.left_shoulder), px(points.right_shoulder), px(points.left_hip), px(points.right_hip)];
  if (!ls || !rs || !lh || !rh) return null;
  const shoulders = mid(ls, rs);
  const hips = mid(lh, rh);
  const torso = dist(shoulders, hips);
  const [la, ra, lk, rk] = [px(points.left_ankle), px(points.right_ankle), px(points.left_knee), px(points.right_knee)];
  // No ankles in the photo: the knees are halfway down the legs; no knees either, legs ~1.6 torsos.
  const feet: Point = la && ra ? mid(la, ra) : lk && rk ? [mid(lk, rk)[0], hips[1] + (mid(lk, rk)[1] - hips[1]) * 2] : [hips[0], hips[1] + torso * 1.6];
  return { shoulders, shoulderWidth: dist(ls, rs), hips, hipWidth: dist(lh, rh), feet, torso };
}

/**
 * Where a garment goes on your photo. Cut from a photo of someone wearing it, it's scaled by the same
 * body parts on both (shoulder width, torso, hips: the median, so one odd keypoint doesn't throw it)
 * and pinned where it sat on them, by the shoulders, or the hips for trousers and skirts. From a flat
 * lay or a product shot, it's sized to you by rule of thumb. Then your nudges.
 */
export function place(garment: Garment, body: Body, fit: Fit = NO_FIT): Rect | null {
  const you = anchors(body.keypoints, body.width, body.height);
  if (!you) return null;
  const { width: W, height: H } = garment.source;
  const [x1, y1, x2, y2] = garment.box;
  const gw = (x2 - x1) * W;
  const gh = (y2 - y1) * H;
  const lower = garment.slot === "bottom";
  const them = garment.source.pose ? anchors(garment.source.pose, W, H) : null;

  let left: number, top: number, width: number, height: number;
  if (them) {
    const ratios = [you.shoulderWidth / them.shoulderWidth, you.torso / them.torso, you.hipWidth / them.hipWidth];
    const k = Math.min(5, Math.max(0.2, median(ratios.filter((r) => Number.isFinite(r) && r > 0))));
    const pin = lower ? "hips" : "shoulders";
    left = you[pin][0] + (x1 * W - them[pin][0]) * k;
    top = you[pin][1] + (y1 * H - them[pin][1]) * k;
    width = gw * k;
    height = gh * k;
  } else {
    const aspect = gh / gw;
    if (lower) {
      const short = garment.label === "shorts" || garment.label === "skirt";
      height = short ? you.hipWidth * 2.4 * aspect : you.feet[1] - you.hips[1] + you.torso * 0.12;
      width = height / aspect;
      left = you.hips[0] - width / 2;
      top = you.hips[1] - you.torso * 0.12;
    } else {
      width = you.shoulderWidth * (garment.slot === "outer" ? 1.95 : garment.slot === "dress" ? 1.6 : 1.75);
      height = width * aspect;
      left = you.shoulders[0] - width / 2;
      top = you.shoulders[1] - you.torso * 0.12;
    }
  }
  // Your nudges: a size change around the garment's centre, then the shift.
  const cx = left + width / 2 + fit.dx * body.width;
  const cy = top + height / 2 + fit.dy * body.height;
  width *= fit.scale;
  height *= fit.scale;
  return { left: (cx - width / 2) / body.width, top: (cy - height / 2) / body.height, width: width / body.width, height: height / body.height };
}

/** Wearing one thing takes off what it can't be worn with: a dress replaces a top and trousers. */
export function wear(worn: Wardrobe["worn"], garment: Garment): Wardrobe["worn"] {
  const next = { ...worn };
  if (next[garment.slot] === garment.id) {
    delete next[garment.slot];
    return next;
  }
  if (garment.slot === "dress") {
    delete next.top;
    delete next.bottom;
  }
  if (garment.slot === "top" || garment.slot === "bottom") delete next.dress;
  next[garment.slot] = garment.id;
  return next;
}

// IndexedDB, one record. Private windows or blocked storage: the room still works, it just forgets.
const DB = "vibear-probador";
const STORE = "state";
const KEY = "wardrobe";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

export async function loadWardrobe(): Promise<Wardrobe> {
  try {
    const db = await database();
    const saved = await new Promise<Wardrobe | undefined>((resolve, reject) => {
      const read = db.transaction(STORE).objectStore(STORE).get(KEY);
      read.onsuccess = () => resolve(read.result as Wardrobe | undefined);
      read.onerror = () => reject(read.error);
    });
    db.close();
    return { ...EMPTY, ...saved };
  } catch {
    return EMPTY;
  }
}

export async function saveWardrobe(wardrobe: Wardrobe): Promise<void> {
  try {
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(wardrobe, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Storage blocked or full: keep going without saving.
  }
}

export function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** The look as one picture: your photo with every worn garment drawn where it sits. */
export async function renderLook(body: Body, layers: { garment: Garment; rect: Rect }[]): Promise<Blob | null> {
  const load = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  const canvas = document.createElement("canvas");
  canvas.width = body.width;
  canvas.height = body.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(await load(body.src), 0, 0, body.width, body.height);
  for (const { garment, rect } of layers) {
    const image = await load(garment.image);
    context.drawImage(image, rect.left * body.width, rect.top * body.height, rect.width * body.width, rect.height * body.height);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}
