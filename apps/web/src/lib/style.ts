// The style half of the test: who they dress, the aesthetics they like (the same styles the outfits
// are tagged with, lib/outfits.ts STYLE_LABELS), their days, what they want from their clothes and
// their budget per garment in pesos. Keys are short and ASCII: the API stores them (app/schemas.py).

import type { Pin } from "./landing";
import type { Option } from "./colorimetry";
import type { Profile, StyleAnswers } from "./profile";

export type StyleQuestion = {
  key: keyof StyleAnswers;
  title: string;
  help: string;
  options: Option[];
  max?: number; // several answers allowed, up to this many
};

export const STYLE_QUESTIONS: StyleQuestion[] = [
  {
    key: "dress",
    title: "¿Para quién buscás ropa?",
    help: "Así te mostramos primero los looks que te sirven.",
    options: [
      { key: "mujer", label: "Mujer" },
      { key: "hombre", label: "Hombre" },
      { key: "ambos", label: "Para los dos" },
    ],
  },
  {
    key: "aesthetics",
    title: "¿Qué estilos te gustan?",
    help: "Elegí hasta tres.",
    max: 3,
    options: [
      { key: "clean-girl", label: "Clean / minimal" },
      { key: "old-money", label: "Old money" },
      { key: "streetwear", label: "Streetwear" },
      { key: "casual", label: "Casual" },
      { key: "university", label: "University fit" },
      { key: "tenis", label: "Tenis" },
      { key: "pilates", label: "Pilates / athleisure" },
    ],
  },
  {
    key: "lifestyle",
    title: "¿Cómo son tus días?",
    help: "Elegí todos los que apliquen.",
    max: 7,
    options: [
      { key: "oficina", label: "Oficina" },
      { key: "facultad", label: "Facultad" },
      { key: "home-office", label: "Home office" },
      { key: "salidas", label: "Salidas de noche" },
      { key: "eventos", label: "Eventos" },
      { key: "deporte", label: "Deporte" },
      { key: "viajes", label: "Viajes" },
    ],
  },
  {
    key: "goals",
    title: "¿Qué querés lograr con tu ropa?",
    help: "Elegí hasta dos.",
    max: 2,
    options: [
      { key: "alto", label: "Verme más alto/a" },
      { key: "estilizar", label: "Estilizar la figura" },
      { key: "comodidad", label: "Estar cómodo/a" },
      { key: "destacar", label: "Destacar" },
      { key: "versatil", label: "Un placard que combine" },
      { key: "ahorrar", label: "Gastar menos" },
    ],
  },
  {
    key: "budget",
    title: "¿Cuánto gastás por prenda?",
    help: "En pesos, más o menos.",
    options: [
      { key: "bajo", label: "Hasta $30.000" },
      { key: "medio", label: "$30.000 a $80.000" },
      { key: "alto", label: "$80.000 a $150.000" },
      { key: "premium", label: "Más de $150.000" },
    ],
  },
];

export const EMPTY_STYLE: StyleAnswers = { dress: null, aesthetics: [], lifestyle: [], goals: [], budget: null };

/** A tip per goal, shown with the result. */
export const GOAL_TIPS: Record<string, string> = {
  alto: "Un mismo color de pies a cabeza (o pantalón y zapatos iguales) alarga la silueta.",
  estilizar: "Calce recto y telas que caen: marcan sin apretar. Una prenda clara arriba y oscura abajo equilibra.",
  comodidad: "Telas con algo de elastano y calces amplios bien proporcionados: cómodo no es desprolijo.",
  destacar: "Un solo foco por look: un color fuerte de tu paleta o una prenda statement, lo demás neutro.",
  versatil: "Tres neutros de tu paleta como base y dos colores de acento: todo combina con todo.",
  ahorrar: "Antes de comprar, escaneá la prenda: Vibear te muestra la más parecida al mejor precio.",
};

/** Which pin genders this profile dresses (both when it didn't say). */
export function gendersOf(profile: Profile): Pin["kind"][] {
  const dress = profile.style?.dress;
  return dress === "mujer" ? ["woman"] : dress === "hombre" ? ["man"] : ["woman", "man"];
}

/** Whether an outfit matches the styles they picked. */
export function isForYou(pin: Pin, profile: Profile): boolean {
  return Boolean(pin.style && profile.style?.aesthetics.includes(pin.style) && gendersOf(profile).includes(pin.kind));
}

/** Looks that match the profile first (their gender, then their styles); nothing is dropped. */
export function forYouFirst(pins: Pin[], profile: Profile): Pin[] {
  if (!profile.style) return pins;
  const genders = gendersOf(profile);
  const score = (pin: Pin) => (isForYou(pin, profile) ? 2 : 0) + (genders.includes(pin.kind) ? 1 : 0);
  return pins.map((pin, i) => ({ pin, i })).sort((a, b) => score(b.pin) - score(a.pin) || a.i - b.i).map(({ pin }) => pin);
}

/** A photo for a style option: a look of that style, of their gender when there is one. */
export function photoFor(style: string, pins: Pin[], dress: string | null): Pin | undefined {
  const tagged = pins.filter((pin) => pin.style === style && pin.hotspots.length);
  const wanted = dress === "mujer" ? "woman" : dress === "hombre" ? "man" : null;
  return tagged.find((pin) => pin.kind === wanted) ?? tagged[0];
}
