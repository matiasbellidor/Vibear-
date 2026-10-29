// Typed client for the FastAPI service. Every call goes through /api, which Next proxies to the API.

export type Box = [number, number, number, number];

export type DetectedItem = {
  crop_id: string;
  label: string;
  confidence: number | null;
  box: Box;
  crop_url: string;
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

export type SearchResult = { crop_id: string; cached: boolean; results: Match[] };

export type SearchMode = "serpapi" | "demo" | "off";

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
  search: (cropId: string, signal?: AbortSignal) =>
    request<SearchResult>("/v1/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crop_id: cropId, limit: SEARCH_LIMIT }),
      signal,
    }),
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
