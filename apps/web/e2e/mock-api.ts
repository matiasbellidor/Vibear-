import type { Page } from "@playwright/test";
import type { Look, Match, SearchMode } from "../src/lib/api";

// 1x1 PNG served for every image request.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export const LOOK: Look = {
  image_id: "aaaaaaaaaaaaaaaa",
  width: 810,
  height: 1080,
  items: [
    {
      crop_id: "1111111111111111",
      label: "long_sleeved_outwear",
      confidence: 0.69,
      box: [229, 472, 342, 708],
      crop_url: "/media/1111111111111111.jpg",
    },
    {
      crop_id: "2222222222222222",
      label: "trousers",
      confidence: 0.87,
      box: [59, 631, 202, 862],
      crop_url: "/media/2222222222222222.jpg",
    },
  ],
};

const HEIGHTS = [400, 300, 450, 380, 520, 300, 410, 360, 470, 330, 390, 440];

export function matches(prefix: string, count = 12): Match[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `${prefix} ${i + 1}`,
    link: `https://shop.test/${prefix}-${i + 1}`,
    source: "Shop Test",
    thumbnail: `https://img.test/${prefix}-${i + 1}.png`,
    thumbnail_width: 300,
    thumbnail_height: HEIGHTS[i % HEIGHTS.length],
    price: i % 3 === 0 ? "$ 45.000" : null,
    similarity: Number((0.95 - i * 0.02).toFixed(2)),
  }));
}

const PREFIX: Record<string, string> = { "1111111111111111": "abrigo", "2222222222222222": "pantalon" };

type Options = { mode?: SearchMode; search?: "ok" | "empty" | 503; detect?: "ok" | 422 };

export const SHOPS = [
  { name: "Shop Test Palermo", lat: -34.589, lng: -58.43, distance_m: 120, address: "Honduras 4800", kind: "clothes", brand_match: true },
  { name: "Tienda Cerca", lat: -34.588, lng: -58.431, distance_m: 340, address: null, kind: "clothes", brand_match: false },
];

export const nearbyCalls: { lat: string | null; lng: string | null; radius: string | null }[] = [];

export const FRAGRANCE_BOARD = {
  fragrance: { id: "erba-pura", name: "Erba Pura", house: "Xerjoff", notes: "Frutas cítricas, ámbar, vainilla y almizcle", size_ml: 100 },
  offers: [
    { shop: "Perfumería A", url: "https://a.test/erba-pura", price: 480000, currency: "ARS", title: "Xerjoff Erba Pura 100 ml", source: "shopping" },
    { shop: "Perfumería B", url: "https://b.test/erba-pura", price: 520000, currency: "ARS", title: "Erba Pura EDP", source: "shopping" },
    { shop: "Perfumería C", url: "https://c.test/erba-pura", price: 585000, currency: "ARS", title: "Erba Pura 100 ml", source: "page", image: "https://img.test/erba-pura.png" },
  ],
  image: "https://img.test/erba-pura.png",
  checked: 4,
  updated_at: Math.floor(Date.now() / 1000),
};

const perfume = (id: string, name: string, house: string, price: number | null) => ({
  fragrance: { id, name, house, notes: "Notas", size_ml: 100 },
  offers: price === null ? [] : [{ shop: "Neve", url: `https://neve.test/${id}`, price, currency: "ARS", title: name, source: "page", image: `https://img.test/${id}.png` }],
  image: `https://img.test/${id}.png`,
  checked: 1,
  updated_at: Math.floor(Date.now() / 1000),
});

export const CATALOGUE = {
  items: [
    { ...FRAGRANCE_BOARD, offers: FRAGRANCE_BOARD.offers.slice(2) },
    perfume("naxos", "Naxos", "Xerjoff", 630000),
    perfume("bianco-latte", "Bianco Latte", "Giardini di Toscana", 540000),
    perfume("kirke", "Kirke", "Tiziana Terenzi", null),
  ],
  updated_at: Math.floor(Date.now() / 1000),
};

/** The fitting room: a person standing in the middle of any photo; a photo with a top and trousers. */
export const BODY = {
  width: 300,
  height: 600,
  keypoints: { left_shoulder: [0.62, 0.22], right_shoulder: [0.38, 0.22], left_hip: [0.58, 0.5], right_hip: [0.42, 0.5], left_ankle: [0.56, 0.95], right_ankle: [0.44, 0.95] },
};
const CUT = `data:image/png;base64,${PNG.toString("base64")}`;
export const GARMENTS = {
  width: 300,
  height: 600,
  pose: BODY.keypoints,
  items: [
    { slot: "top", label: "short_sleeved_shirt", name: "Remera blanca", image: CUT, box: [0.3, 0.18, 0.7, 0.52] },
    { slot: "bottom", label: "trousers", name: "Jean azul", image: CUT, box: [0.36, 0.48, 0.64, 0.97] },
  ],
};

/** The API's anonymous closet backup, as this test left it (newest copy wins, like the real one). */
export const closetBackup: { items: Match[]; updated_at: number } = { items: [], updated_at: 0 };

/** Mock every /api call the browser makes. Returns the crop ids that were searched, in order. */
export async function mockApi(page: Page, { mode = "serpapi", search = "ok", detect = "ok" }: Options = {}) {
  const searched: string[] = [];
  nearbyCalls.length = 0;
  closetBackup.items = [];
  closetBackup.updated_at = 0;
  const image = { body: PNG, contentType: "image/png" };

  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", search: mode } }));
  await page.route("**/api/media/**", (route) => route.fulfill(image));
  // Like Tiendanube's CDN, the test images allow CORS, so the perfumery can cut them out.
  await page.route("https://img.test/**", (route) => route.fulfill({ ...image, headers: { "access-control-allow-origin": "*" } }));
  await page.route("**/api/v1/detect", (route) =>
    detect === 422
      ? route.fulfill({ status: 422, json: { detail: "File is not a valid image" } })
      : route.fulfill({ json: LOOK }),
  );
  await page.route("**/api/v1/looks/*", (route) =>
    route.request().url().endsWith(LOOK.image_id)
      ? route.fulfill({ json: LOOK })
      : route.fulfill({ status: 404, json: { detail: "Unknown look" } }),
  );
  await page.route("**/api/v1/places/geocode**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    return q.toLowerCase().includes("nowhere")
      ? route.fulfill({ status: 404, json: { detail: "Location not found" } })
      : route.fulfill({ json: { lat: -34.5888, lng: -58.4302, label: "Palermo" } });
  });
  await page.route("**/api/v1/places/nearby**", (route) => {
    const params = new URL(route.request().url()).searchParams;
    nearbyCalls.push({ lat: params.get("lat"), lng: params.get("lng"), radius: params.get("radius") });
    return route.fulfill({ json: { radius: Number(params.get("radius")), shops: SHOPS } });
  });
  await page.route("**/api/v1/fragrances/*/prices", (route) => route.fulfill({ json: FRAGRANCE_BOARD }));
  await page.route("**/api/v1/fragrances", (route) => route.fulfill({ json: CATALOGUE }));
  await page.route("**/api/v1/tryon/body", (route) => route.fulfill({ json: BODY }));
  await page.route("**/api/v1/tryon/garments", (route) => route.fulfill({ json: GARMENTS }));
  await page.route("**/api/v1/closet", (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as typeof closetBackup;
      if (body.updated_at >= closetBackup.updated_at) Object.assign(closetBackup, body);
    }
    return route.fulfill({ json: closetBackup });
  });
  await page.route("**/api/v1/search", (route) => {
    const { crop_id: cropId } = route.request().postDataJSON() as { crop_id: string };
    searched.push(cropId);
    if (search === 503) return route.fulfill({ status: 503, json: { detail: "Search is disabled" } });
    const results = search === "empty" ? [] : matches(PREFIX[cropId] ?? "item");
    return route.fulfill({ json: { crop_id: cropId, cached: false, results } });
  });
  return searched;
}
