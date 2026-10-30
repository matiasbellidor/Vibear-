import type { Hotspot, Pin } from "./landing";
import { garmentName } from "./labels";

// Styles the outfits are tagged with (FashionCLIP zero-shot, apps/api/app/ml/describe.py STYLES).
export const STYLE_LABELS: Record<string, string> = {
  streetwear: "Streetwear",
  "old-money": "Old money",
  "clean-girl": "Clean girl",
  university: "University fit",
  tenis: "Tenis",
  pilates: "Pilates",
  casual: "Casual",
};

export type ShopLink = { shop: string; url: string };

const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Where to buy a garment like this one. Search pages rather than single products on purpose: a
 * product sells out in days and its link dies, a search keeps answering. Argentina only: shops that
 * sell here, prices in pesos.
 */
export function shopLinks(spot: Hotspot, gender: "woman" | "man"): ShopLink[] {
  const query = `${garmentName(spot)} ${gender === "woman" ? "mujer" : "hombre"}`;
  const slug = plain(query).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [
    { shop: "Mercado Libre", url: `https://listado.mercadolibre.com.ar/${slug}` },
    {
      shop: "Zara",
      url: `https://www.zara.com/ar/es/search?searchTerm=${encodeURIComponent(query)}&section=${gender === "woman" ? "WOMAN" : "MAN"}`,
    },
    {
      shop: "Google Shopping",
      url: `https://www.google.com.ar/search?tbm=shop&gl=ar&hl=es-419&q=${encodeURIComponent(query)}`,
    },
  ];
}

/** ISO 8601 week number (weeks start on Monday; week 1 holds the year's first Thursday). */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * The week's outfits: `perGender` of women and of men, a different style each where possible, and
 * a different set every week (the lists rotate by the week number). Same week, same outfits. Your
 * own photos (npm run dev, /landing-local/) always lead; the rotation applies to the rest.
 */
export function weeklyPick(pins: Pin[], week: number, perGender = 3): Pin[] {
  const pick = (gender: "woman" | "man") => {
    const pool = pins.filter((pin) => pin.kind === gender && pin.hotspots.length > 0);
    if (!pool.length) return [];
    const own = pool.filter((pin) => pin.src.startsWith("/landing-local/"));
    const rest = pool.filter((pin) => !own.includes(pin));
    const start = rest.length ? (week * perGender) % rest.length : 0;
    const rotated = [...own, ...rest.slice(start), ...rest.slice(0, start)];
    const chosen: Pin[] = [];
    for (const pin of rotated) {
      if (chosen.length < perGender && !chosen.some((other) => other.style && other.style === pin.style)) chosen.push(pin);
    }
    for (const pin of rotated) if (chosen.length < perGender && !chosen.includes(pin)) chosen.push(pin);
    return chosen;
  };
  const women = pick("woman");
  const men = pick("man");
  return women.flatMap((woman, i) => [woman, men[i]]).concat(men.slice(women.length)).filter(Boolean);
}
