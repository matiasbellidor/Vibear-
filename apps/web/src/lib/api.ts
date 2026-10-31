// Typed client for the FastAPI service. Every call goes through /api, which Next proxies to the API.

export type Box = [number, number, number, number];

export type DetectedItem = {
  crop_id: string;
  label: string;
  confidence: number | null;
  box: Box;
  crop_url: string;
  /** What it really is ("Buzo polo de corderito negro"), when the API could tell; see garmentName(). */
  name?: string | null;
  kind?: string | null;
  /** A brand read from the photo alone, only when the model was very sure. */
  brand?: string | null;
  /** No brand: whose signature design it resembles ("Polo Ralph Lauren" → "Símil Polo Ralph Lauren"). */
  similar?: string | null;
  /** Its main colour's name ("azul marino"), checked against the visitor's palette (lib/colorimetry.ts). */
  color?: string | null;
};

export type Look = {
  image_id: string;
  width: number;
  height: number;
  items: DetectedItem[];
};

export type Match = {
  title: string;
  link: string;
  source: string | null;
  thumbnail: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  price: string | null;
  similarity: number | null;
};

/** The brand most of the closest results agree on (real search only). */
export type BrandGuess = { name: string; count: number; total: number };

export type SearchResult = { crop_id: string; cached: boolean; results: Match[]; brand?: BrandGuess | null };

export type SearchMode = "serpapi" | "demo" | "off";

/** A shop's price for a fragrance (GET /v1/fragrances/{id}/prices), cheapest first, pesos first. */
export type Offer = {
  shop: string;
  url: string;
  price: number; // pesos: Argentine shops only
  currency: string;
  title: string;
  source: "shopping" | "page";
  image?: string | null; // the shop's own product photo
};

export type FragranceBoard = {
  fragrance: { id: string; name: string; house: string; notes: string; size_ml: number };
  offers: Offer[]; // cheapest first; empty when no shop has it in stock
  image: string | null; // the bottle, from a shop's page (white background, cut out by lib/cutout.ts)
  checked: number; // sources read this round
  updated_at: number; // epoch seconds
};

export type Catalogue = { items: FragranceBoard[]; updated_at: number };

/** Fitting room. Points are [x, y] as fractions of their photo. */
export type Point = [number, number];
export type BodyPoints = Partial<
  Record<
    "nose" | "left_shoulder" | "right_shoulder" | "left_hip" | "right_hip" | "left_knee" | "right_knee" | "left_ankle" | "right_ankle",
    Point
  >
>;
export type Slot = "top" | "outer" | "bottom" | "dress";
export type CutGarment = {
  slot: Slot;
  label: string | null;
  name: string | null;
  image: string; // data: URL, transparent around the garment
  box: [number, number, number, number]; // where it was in its photo
};
export type CutGarments = { width: number; height: number; pose: BodyPoints | null; items: CutGarment[] };

const TRYON_MESSAGES: Record<number, string> = {
  422: "No encontramos una prenda en esa foto. Probá con la prenda entera, de frente y con buena luz.",
};
const BODY_MESSAGES: Record<number, string> = {
  422: "No te encontramos de cuerpo entero. Probá con una foto de pies a cabeza, de frente y con luz.",
};

export type Place = { lat: number; lng: number; label: string };

export type Shop = {
  name: string;
  lat: number;
  lng: number;
  distance_m: number;
  address: string | null;
  kind: string;
  brand_match: boolean;
};

const BASE = "/api";
const SEARCH_LIMIT = 48;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const MESSAGES: Record<number, string> = {
  0: "No hay conexión con la API. Revisá que esté corriendo (npm run dev).",
  404: "Ese look ya no existe. Subí la foto de nuevo.",
  413: "La imagen pesa demasiado. Probá con una más liviana.",
  422: "No pudimos leer esa imagen. Probá con un JPG, PNG o WebP, o con otro link.",
  500: "La API no respondió. Revisá que esté corriendo (npm run dev) y mirá la terminal.",
  502: "Google Lens no respondió. Probá de nuevo en un rato.",
  503: "La búsqueda está apagada. Agregá tu key de SerpApi en apps/api/.env o activá DEMO_SEARCH=true.",
};

const PLACE_MESSAGES: Record<number, string> = {
  404: "No encontramos esa ubicación. Probá con barrio y ciudad, o pegá un link de Google Maps.",
  422: "Ese link no tiene una ubicación. Abrí el lugar en Google Maps, tocá Compartir y pegá ese link.",
  502: "El mapa de locales no respondió. Probá de nuevo en un rato.",
};

async function request<T>(path: string, init?: RequestInit, messages: Record<number, string> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(MESSAGES[0], 0);
  }
  if (!response.ok) {
    const status = response.status;
    throw new ApiError(messages[status] ?? MESSAGES[status] ?? MESSAGES[500], status);
  }
  return (await response.json()) as T;
}

function form(field: string, value: Blob | string): FormData {
  const body = new FormData();
  if (typeof value === "string") body.append(field, value);
  else body.append(field, value, "photo.jpg");
  return body;
}

export const api = {
  health: () => request<{ status: string; search: SearchMode }>("/health"),
  detectFile: (file: Blob) => request<Look>("/v1/detect", { method: "POST", body: form("file", file) }),
  detectUrl: (url: string) => request<Look>("/v1/detect", { method: "POST", body: form("image_url", url) }),
  look: (id: string, signal?: AbortSignal) => request<Look>(`/v1/looks/${encodeURIComponent(id)}`, { signal }),
  /** `label` (the garment's class) lets the API drop results of another kind, like shoes for a sweater. */
  search: (cropId: string, label: string | null, signal?: AbortSignal) =>
    request<SearchResult>("/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // "full_image" (nothing detected) has no category to filter by.
      body: JSON.stringify({ crop_id: cropId, limit: SEARCH_LIMIT, label: label === "full_image" ? null : label }),
      signal,
    }),
  fragrancePrices: (id: string, signal?: AbortSignal) =>
    request<FragranceBoard>(`/v1/fragrances/${encodeURIComponent(id)}/prices`, { signal }),
  fragrances: (signal?: AbortSignal) => request<Catalogue>("/v1/fragrances", { signal }),
  /** Your keypoints in a full-body photo. The photo isn't stored by the API. */
  body: (file: Blob) =>
    request<{ width: number; height: number; keypoints: BodyPoints }>(
      "/v1/tryon/body",
      { method: "POST", body: form("file", file) },
      BODY_MESSAGES,
    ),
  /** Every garment in a photo (or at a link), cut out. Nothing is stored by the API. */
  garmentsFile: (file: Blob) =>
    request<CutGarments>("/v1/tryon/garments", { method: "POST", body: form("file", file) }, TRYON_MESSAGES),
  garmentsUrl: (url: string) =>
    request<CutGarments>("/v1/tryon/garments", { method: "POST", body: form("image_url", url) }, TRYON_MESSAGES),
  geocode: (query: string) =>
    request<Place>(`/v1/places/geocode?q=${encodeURIComponent(query)}`, undefined, PLACE_MESSAGES),
  nearby: (place: Pick<Place, "lat" | "lng">, radius: number, brands: string[]) => {
    const params = new URLSearchParams({ lat: String(place.lat), lng: String(place.lng), radius: String(radius) });
    for (const brand of brands) params.append("brands", brand);
    return request<{ radius: number; shops: Shop[] }>(`/v1/places/nearby?${params}`, undefined, PLACE_MESSAGES);
  },
};

/** API paths (/media/..., /demo/...) go through the proxy; external URLs stay as they are. */
export function mediaUrl(path: string): string {
  return path.startsWith("/media/") || path.startsWith("/demo/") ? BASE + path : path;
}

export function imageUrl(imageId: string): string {
  return `${BASE}/media/${imageId}.jpg`;
}
