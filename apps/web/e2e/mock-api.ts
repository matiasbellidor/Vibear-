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

/** Mock every /api call the browser makes. Returns the crop ids that were searched, in order. */
export async function mockApi(page: Page, { mode = "serpapi", search = "ok", detect = "ok" }: Options = {}) {
  const searched: string[] = [];
  const image = { body: PNG, contentType: "image/png" };

  await page.route("**/api/health", (route) => route.fulfill({ json: { status: "ok", search: mode } }));
  await page.route("**/api/media/**", (route) => route.fulfill(image));
  await page.route("https://img.test/**", (route) => route.fulfill(image));
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
  await page.route("**/api/v1/search", (route) => {
    const { crop_id: cropId } = route.request().postDataJSON() as { crop_id: string };
    searched.push(cropId);
    if (search === 503) return route.fulfill({ status: 503, json: { detail: "Search is disabled" } });
    const results = search === "empty" ? [] : matches(PREFIX[cropId] ?? "item");
    return route.fulfill({ json: { crop_id: cropId, cached: false, results } });
  });
  return searched;
}
