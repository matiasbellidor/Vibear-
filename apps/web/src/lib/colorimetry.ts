// Colour analysis ("colorimetría") from six questions anyone can answer in front of a mirror, in
// the 12-season system: undertone (warm, cool, neutral), depth (light to deep), contrast between
// hair, skin and eyes, and chroma (clear or soft) pick one of 12 seasons. Deterministic: the same
// answers always give the same season. It is a guide, not a draping session with a colourist.

import type { ColorResult } from "./profile";

export type Option = { key: string; label: string; hint?: string };
export type ColorQuestion = { key: keyof ColorAnswers; title: string; help: string; options: Option[] };
export type ColorAnswers = { veins?: string; metal?: string; sun?: string; hair?: string; eyes?: string; skin?: string };

export const COLOR_QUESTIONS: ColorQuestion[] = [
  {
    key: "veins",
    title: "¿De qué color se ven las venas de tu muñeca?",
    help: "Miralas con luz natural, cerca de una ventana.",
    options: [
      { key: "azules", label: "Azules o violetas" },
      { key: "verdes", label: "Verdes u oliva" },
      { key: "mezcla", label: "Una mezcla, no sé" },
    ],
  },
  {
    key: "metal",
    title: "¿Qué te queda mejor cerca de la cara?",
    help: "Pensá en aros o cadenitas: cuál te ilumina y cuál te apaga.",
    options: [
      { key: "plata", label: "Plata" },
      { key: "oro", label: "Oro" },
      { key: "ambos", label: "Los dos por igual" },
    ],
  },
  {
    key: "sun",
    title: "Cuando tomás sol sin protector…",
    help: "Lo que te pasa la primera vez en el verano.",
    options: [
      { key: "quema", label: "Me quemo y casi no me bronceo" },
      { key: "ambos", label: "Me quemo un poco y después me bronceo" },
      { key: "broncea", label: "Me bronceo fácil y casi nunca me quemo" },
    ],
  },
  {
    key: "hair",
    title: "Tu color de pelo natural",
    help: "El de raíz, sin tintura.",
    options: [
      { key: "rubio-claro", label: "Rubio claro" },
      { key: "rubio-oscuro", label: "Rubio oscuro o castaño claro" },
      { key: "castano", label: "Castaño" },
      { key: "castano-oscuro", label: "Castaño oscuro" },
      { key: "negro", label: "Negro" },
      { key: "pelirrojo", label: "Pelirrojo o cobrizo" },
      { key: "canoso", label: "Canoso o plateado" },
    ],
  },
  {
    key: "eyes",
    title: "Tus ojos",
    help: "El color que se ve a un metro, no el detalle del iris.",
    options: [
      { key: "celestes", label: "Celestes o grises" },
      { key: "verdes", label: "Verdes" },
      { key: "avellana", label: "Avellana o miel" },
      { key: "marron-claro", label: "Marrón claro" },
      { key: "marron-oscuro", label: "Marrón oscuro o negros" },
    ],
  },
  {
    key: "skin",
    title: "Tu piel",
    help: "En invierno, sin bronceado.",
    options: [
      { key: "muy-clara", label: "Muy clara" },
      { key: "clara", label: "Clara" },
      { key: "media", label: "Media" },
      { key: "morena", label: "Morena" },
      { key: "oscura", label: "Oscura" },
    ],
  },
];

// What each answer says: warmth (+ warm, - cool), depth 1-5 and, for eyes, how clear they read.
const WARMTH: Record<string, Record<string, number>> = {
  veins: { azules: -1, verdes: 1, mezcla: 0 },
  metal: { plata: -1, oro: 1, ambos: 0 },
  sun: { quema: -0.5, ambos: 0, broncea: 0.5 },
  hair: { "rubio-claro": 0, "rubio-oscuro": 0, castano: 0, "castano-oscuro": 0, negro: -0.25, pelirrojo: 1.5, canoso: -0.5 },
  eyes: { celestes: -0.5, verdes: 0.25, avellana: 0.5, "marron-claro": 0.25, "marron-oscuro": 0 },
};
const HAIR_DEPTH: Record<string, number> = { "rubio-claro": 1, "rubio-oscuro": 2, castano: 3, "castano-oscuro": 4, negro: 5, pelirrojo: 2, canoso: 2 };
const EYE_DEPTH: Record<string, number> = { celestes: 1, verdes: 2, avellana: 3, "marron-claro": 3, "marron-oscuro": 5 };
const EYE_CLARITY: Record<string, number> = { celestes: 1, verdes: 0.5, avellana: 0, "marron-claro": 0, "marron-oscuro": 0.25 };
const SKIN_DEPTH: Record<string, number> = { "muy-clara": 1, clara: 2, media: 3, morena: 4, oscura: 5 };

/** The season and the four traits behind it. Unanswered questions count as "in the middle". */
export function analyze(answers: ColorAnswers): ColorResult {
  const warmth = (Object.keys(WARMTH) as (keyof typeof WARMTH)[]).reduce(
    (sum, key) => sum + (WARMTH[key][answers[key as keyof ColorAnswers] ?? ""] ?? 0),
    0,
  );
  const undertone = warmth > 0.75 ? "calido" : warmth < -0.75 ? "frio" : "neutro";

  const hair = HAIR_DEPTH[answers.hair ?? ""] ?? 3;
  const eyes = EYE_DEPTH[answers.eyes ?? ""] ?? 3;
  const skin = SKIN_DEPTH[answers.skin ?? ""] ?? 3;
  const average = (hair + eyes + skin) / 3;
  const depth = average <= 2.2 ? "light" : average >= 3.6 ? "deep" : "medium";
  const spread = Math.max(Math.abs(hair - skin), Math.abs(eyes - skin));
  const contrast = spread >= 3 ? "alto" : spread === 2 ? "medio" : "bajo";
  const clarity = (contrast === "alto" ? 1 : contrast === "bajo" ? -1 : 0) + (EYE_CLARITY[answers.eyes ?? ""] ?? 0);
  const chroma = clarity >= 1 ? "brillante" : clarity <= -0.5 ? "suave" : "medio";

  let family: "primavera" | "verano" | "otono" | "invierno";
  if (undertone === "calido") family = depth === "deep" || chroma === "suave" ? "otono" : "primavera";
  else if (undertone === "frio") family = depth === "deep" || chroma === "brillante" ? "invierno" : "verano";
  else if (depth === "light") family = chroma === "brillante" ? "primavera" : "verano";
  else if (depth === "deep") family = chroma === "suave" ? "otono" : "invierno";
  else if (chroma === "brillante") family = warmth >= 0 ? "primavera" : "invierno";
  else family = warmth >= 0 ? "otono" : "verano";

  // Within the family, the trait that stands out; a neutral undertone leans to the in-between types.
  const neutral = undertone === "neutro";
  const sub = {
    primavera: chroma === "brillante" && contrast !== "bajo" ? "brillante" : depth === "light" || neutral ? "clara" : "calida",
    verano: chroma === "suave" || contrast === "bajo" || (neutral && depth !== "light") ? "suave" : depth === "light" ? "claro" : "frio",
    otono: depth === "deep" ? "profundo" : chroma === "suave" || neutral ? "suave" : "calido",
    invierno: chroma === "brillante" || (neutral && depth !== "deep") ? "brillante" : depth === "deep" ? "profundo" : "frio",
  }[family];

  return { season: `${family}-${sub}`, undertone, contrast, chroma };
}

export type Swatch = { name: string; hex: string };
export type Season = {
  name: string;
  line: string;
  palette: Swatch[];
  neutrals: Swatch[];
  avoid: Swatch[];
  metals: string;
  outfits: { text: string; colors: string[] }[];
};

const sw = (name: string, hex: string): Swatch => ({ name, hex });

// Swatches are data (each season's colours), not the site's design tokens.
export const SEASONS: Record<string, Season> = {
  "primavera-clara": {
    name: "Primavera clara",
    line: "Luminosa y delicada: colores claros y cálidos, con aire.",
    palette: [sw("Durazno", "#F6B99A"), sw("Coral claro", "#F88A7A"), sw("Amarillo manteca", "#F5DC8C"), sw("Verde menta", "#A8D8B9"), sw("Aqua", "#5CC5C0"), sw("Celeste agua", "#8FD3E0"), sw("Lavanda cálida", "#C6B2E0"), sw("Salmón", "#F4A39A")],
    neutrals: [sw("Marfil", "#F7EEDC"), sw("Beige claro", "#E8D8BC"), sw("Camel claro", "#D8B486"), sw("Gris piedra", "#B9AFA2")],
    avoid: [sw("Negro", "#111111"), sw("Gris carbón", "#3A3A3D"), sw("Bordó oscuro", "#5A1622"), sw("Azul noche", "#1B2340")],
    metals: "Oro claro y oro rosa",
    outfits: [
      { text: "Camisa durazno, jean claro y zapatillas blancas", colors: ["#F6B99A", "#A9C4DE", "#F7EEDC"] },
      { text: "Sweater menta con pantalón marfil", colors: ["#A8D8B9", "#F7EEDC", "#D8B486"] },
      { text: "Vestido o camisa aqua con sandalias camel", colors: ["#5CC5C0", "#D8B486", "#F7EEDC"] },
    ],
  },
  "primavera-calida": {
    name: "Primavera cálida",
    line: "Sol de media tarde: colores dorados, frescos y vivos.",
    palette: [sw("Coral", "#FF7F61"), sw("Mandarina", "#F28C28"), sw("Amarillo dorado", "#F2C14E"), sw("Verde manzana", "#8DC63F"), sw("Turquesa", "#30B5AB"), sw("Terracota clara", "#E07A5F"), sw("Azul aqua", "#3FA7C9"), sw("Salmón", "#FA8072")],
    neutrals: [sw("Crema", "#F3E5C3"), sw("Camel", "#C19A6B"), sw("Beige dorado", "#D9C3A0"), sw("Marrón dorado", "#8B5A2B")],
    avoid: [sw("Negro", "#111111"), sw("Gris frío", "#9EA3AA"), sw("Fucsia frío", "#C2185B"), sw("Azul hielo", "#CFE3F0")],
    metals: "Oro amarillo",
    outfits: [
      { text: "Blazer camel, remera crema y jean índigo", colors: ["#C19A6B", "#F3E5C3", "#3B5B92"] },
      { text: "Camisa coral con pantalón beige", colors: ["#FF7F61", "#D9C3A0", "#8B5A2B"] },
      { text: "Buzo turquesa y cargo camel", colors: ["#30B5AB", "#C19A6B", "#F3E5C3"] },
    ],
  },
  "primavera-brillante": {
    name: "Primavera brillante",
    line: "Alto voltaje: colores saturados y cálidos, con contraste.",
    palette: [sw("Rojo amapola", "#E8352C"), sw("Coral intenso", "#FF5A4E"), sw("Amarillo limón", "#F7D917"), sw("Verde kelly", "#2EAA4A"), sw("Turquesa vivo", "#00A6A6"), sw("Azul real", "#2F5DC4"), sw("Fucsia cálido", "#E9407A"), sw("Violeta", "#7A4FC9")],
    neutrals: [sw("Blanco cálido", "#FBF7EE"), sw("Azul marino", "#22305E"), sw("Carbón cálido", "#44403C"), sw("Camel", "#C19A6B")],
    avoid: [sw("Rosa empolvado", "#C8B4B8"), sw("Marrón opaco", "#6F5B4B"), sw("Gris ceniza", "#A9A9A9"), sw("Mostaza apagada", "#B59B48")],
    metals: "Oro brillante",
    outfits: [
      { text: "Remera blanca, jean azul y campera roja", colors: ["#FBF7EE", "#2F5DC4", "#E8352C"] },
      { text: "Sweater verde kelly con pantalón azul marino", colors: ["#2EAA4A", "#22305E", "#FBF7EE"] },
      { text: "Camisa turquesa y chino camel", colors: ["#00A6A6", "#C19A6B", "#FBF7EE"] },
    ],
  },
  "verano-claro": {
    name: "Verano claro",
    line: "Brisa de mar: pasteles fríos, suaves y claros.",
    palette: [sw("Rosa empolvado", "#E6B7C1"), sw("Lavanda", "#B9A7D8"), sw("Celeste", "#A7C7E7"), sw("Periwinkle", "#8E9CE0"), sw("Verde agua", "#9FD3C7"), sw("Malva", "#C4A0B6"), sw("Frambuesa suave", "#D9819E"), sw("Azul acero", "#8FA9C3")],
    neutrals: [sw("Blanco suave", "#F4F4F2"), sw("Gris perla", "#C9CCD3"), sw("Azul grisáceo", "#9AA8B8"), sw("Topo frío", "#A39E9C")],
    avoid: [sw("Naranja", "#F28C28"), sw("Negro", "#111111"), sw("Mostaza", "#C9A227"), sw("Marrón cálido", "#7B4A2A")],
    metals: "Plata",
    outfits: [
      { text: "Camisa celeste, pantalón gris perla y mocasines", colors: ["#A7C7E7", "#C9CCD3", "#F4F4F2"] },
      { text: "Sweater lavanda con jean claro", colors: ["#B9A7D8", "#A9C4DE", "#F4F4F2"] },
      { text: "Vestido o remera rosa empolvado con blanco", colors: ["#E6B7C1", "#F4F4F2", "#9AA8B8"] },
    ],
  },
  "verano-frio": {
    name: "Verano frío",
    line: "Fresco y elegante: azules, rosas y ciruelas con base fría.",
    palette: [sw("Rosa frío", "#E07AA0"), sw("Frambuesa", "#B23A5B"), sw("Azul medio", "#4A78B5"), sw("Lavanda", "#A08CC9"), sw("Ciruela suave", "#8E4E7E"), sw("Verde azulado", "#3E8E8A"), sw("Azul pizarra", "#5E7A99"), sw("Azul francia", "#3D5A99")],
    neutrals: [sw("Blanco", "#F7F7F7"), sw("Gris azulado", "#8C99A6"), sw("Gris medio", "#8A8D91"), sw("Marino suave", "#2E3A59")],
    avoid: [sw("Naranja", "#F28C28"), sw("Amarillo dorado", "#F2C14E"), sw("Camel", "#C19A6B"), sw("Verde oliva", "#6B6B2A")],
    metals: "Plata y oro blanco",
    outfits: [
      { text: "Saco azul pizarra, camisa blanca y pantalón gris", colors: ["#5E7A99", "#F7F7F7", "#8A8D91"] },
      { text: "Sweater frambuesa con jean oscuro", colors: ["#B23A5B", "#2E3A59", "#F7F7F7"] },
      { text: "Remera lavanda con pantalón marino", colors: ["#A08CC9", "#2E3A59", "#F7F7F7"] },
    ],
  },
  "verano-suave": {
    name: "Verano suave",
    line: "Neblina elegante: colores apagados, grisáceos y serenos.",
    palette: [sw("Rosa viejo", "#C48B93"), sw("Malva", "#B08B9E"), sw("Verde salvia", "#9CAF9C"), sw("Azul grisáceo", "#7F95A8"), sw("Lavanda gris", "#A79BB5"), sw("Frambuesa apagada", "#A35A6E"), sw("Jade suave", "#6E9E8F"), sw("Petróleo suave", "#4F7280")],
    neutrals: [sw("Crema fría", "#ECE6DA"), sw("Topo", "#9A8B80"), sw("Gris piedra", "#A8A39B"), sw("Gris rosado", "#BBA9A8")],
    avoid: [sw("Negro", "#111111"), sw("Naranja", "#F28C28"), sw("Blanco puro", "#FFFFFF"), sw("Amarillo limón", "#F7D917")],
    metals: "Plata mate y oro rosa",
    outfits: [
      { text: "Sweater salvia, pantalón topo y zapatillas crema", colors: ["#9CAF9C", "#9A8B80", "#ECE6DA"] },
      { text: "Camisa azul grisácea con chino piedra", colors: ["#7F95A8", "#A8A39B", "#ECE6DA"] },
      { text: "Buzo rosa viejo con jean lavado", colors: ["#C48B93", "#8FA3B8", "#ECE6DA"] },
    ],
  },
  "otono-suave": {
    name: "Otoño suave",
    line: "Tierra y bruma: cálidos apagados, nada estridente.",
    palette: [sw("Salvia", "#9CAF88"), sw("Oliva claro", "#8A8A55"), sw("Terracota suave", "#C2785C"), sw("Durazno apagado", "#D49C8A"), sw("Mostaza suave", "#C9A44C"), sw("Petróleo", "#3E6E73"), sw("Caqui", "#A89A6E"), sw("Rosa terroso", "#B98477")],
    neutrals: [sw("Crema", "#EDE3CC"), sw("Camel", "#C19A6B"), sw("Topo cálido", "#8A735E"), sw("Chocolate suave", "#5E4636")],
    avoid: [sw("Negro", "#111111"), sw("Blanco puro", "#FFFFFF"), sw("Fucsia", "#E0218A"), sw("Azul eléctrico", "#1F4FFF")],
    metals: "Oro mate y bronce",
    outfits: [
      { text: "Sweater salvia, pantalón crema y mocasines marrones", colors: ["#9CAF88", "#EDE3CC", "#5E4636"] },
      { text: "Camisa terracota con jean lavado", colors: ["#C2785C", "#8FA3B8", "#EDE3CC"] },
      { text: "Campera caqui, remera crema y chino camel", colors: ["#A89A6E", "#EDE3CC", "#C19A6B"] },
    ],
  },
  "otono-calido": {
    name: "Otoño cálido",
    line: "Hojas y especias: dorados profundos, ricos y cálidos.",
    palette: [sw("Terracota", "#C1592E"), sw("Naranja quemado", "#CC5500"), sw("Mostaza", "#D4A017"), sw("Verde oliva", "#6B6B2A"), sw("Rojo ladrillo", "#A23B2C"), sw("Verde musgo", "#59633A"), sw("Turquesa oscuro", "#2C7873"), sw("Camel", "#C19A6B")],
    neutrals: [sw("Crema", "#F0E2C3"), sw("Caqui", "#A89A6E"), sw("Chocolate", "#5B3A29"), sw("Camel", "#C19A6B")],
    avoid: [sw("Negro", "#111111"), sw("Gris frío", "#9EA3AA"), sw("Rosa chicle", "#F7A1C4"), sw("Azul hielo", "#CFE3F0")],
    metals: "Oro y cobre",
    outfits: [
      { text: "Campera de cuero marrón, remera crema y jean", colors: ["#5B3A29", "#F0E2C3", "#3B5B92"] },
      { text: "Sweater mostaza con pantalón chocolate", colors: ["#D4A017", "#5B3A29", "#F0E2C3"] },
      { text: "Camisa verde oliva y chino camel", colors: ["#6B6B2A", "#C19A6B", "#F0E2C3"] },
    ],
  },
  "otono-profundo": {
    name: "Otoño profundo",
    line: "Bosque de noche: oscuros cálidos, intensos y elegantes.",
    palette: [sw("Bordó", "#6D1A2A"), sw("Verde bosque", "#234F33"), sw("Mostaza oscura", "#B8860B"), sw("Petróleo", "#1F4E5A"), sw("Berenjena cálida", "#4E2A3A"), sw("Rojo tomate", "#B5332E"), sw("Naranja óxido", "#A0461E"), sw("Camel oscuro", "#9C7A4F")],
    neutrals: [sw("Café", "#4B2E1F"), sw("Negro marrón", "#2B211C"), sw("Crema oscura", "#E3D3B2"), sw("Verde bosque", "#234F33")],
    avoid: [sw("Pastel rosa", "#F4C2C2"), sw("Gris claro frío", "#C9CCD3"), sw("Rosa chicle", "#F7A1C4"), sw("Celeste bebé", "#BFDFF5")],
    metals: "Oro antiguo y bronce",
    outfits: [
      { text: "Saco bordó, camisa crema y pantalón café", colors: ["#6D1A2A", "#E3D3B2", "#4B2E1F"] },
      { text: "Sweater verde bosque con jean oscuro", colors: ["#234F33", "#24324F", "#E3D3B2"] },
      { text: "Campera camel oscura sobre total look café", colors: ["#9C7A4F", "#4B2E1F", "#2B211C"] },
    ],
  },
  "invierno-profundo": {
    name: "Invierno profundo",
    line: "Medianoche: contraste fuerte, oscuros fríos y joyas.",
    palette: [sw("Bordó frío", "#7A1F3D"), sw("Esmeralda", "#00704A"), sw("Azul marino", "#1B2A4A"), sw("Rojo cereza", "#B3123B"), sw("Ciruela", "#5B2A55"), sw("Zafiro", "#1F4E9C"), sw("Violeta profundo", "#4B2A7A"), sw("Blanco", "#FFFFFF")],
    neutrals: [sw("Negro", "#111111"), sw("Carbón", "#36393F"), sw("Azul marino", "#1B2A4A"), sw("Blanco", "#FFFFFF")],
    avoid: [sw("Camel", "#C19A6B"), sw("Naranja", "#F28C28"), sw("Mostaza", "#C9A227"), sw("Beige", "#D9C3A0")],
    metals: "Plata y oro blanco",
    outfits: [
      { text: "Total black con un toque bordó", colors: ["#111111", "#7A1F3D", "#FFFFFF"] },
      { text: "Camisa blanca, saco marino y pantalón carbón", colors: ["#FFFFFF", "#1B2A4A", "#36393F"] },
      { text: "Sweater esmeralda con jean negro", colors: ["#00704A", "#111111", "#FFFFFF"] },
    ],
  },
  "invierno-frio": {
    name: "Invierno frío",
    line: "Hielo y tinta: colores fríos, puros y definidos.",
    palette: [sw("Fucsia", "#D1197A"), sw("Azul rey", "#2349B0"), sw("Rojo frío", "#C8102E"), sw("Esmeralda", "#009473"), sw("Violeta", "#6A3FA0"), sw("Rosa helado", "#F2C6DD"), sw("Azul hielo", "#CFE3F0"), sw("Gris acero", "#6E7783")],
    neutrals: [sw("Negro", "#111111"), sw("Blanco", "#FFFFFF"), sw("Gris acero", "#6E7783"), sw("Azul marino", "#1B2A4A")],
    avoid: [sw("Naranja", "#F28C28"), sw("Camel", "#C19A6B"), sw("Mostaza", "#C9A227"), sw("Marrón cálido", "#7B4A2A")],
    metals: "Plata",
    outfits: [
      { text: "Blazer negro, camisa blanca y jean oscuro", colors: ["#111111", "#FFFFFF", "#1B2A4A"] },
      { text: "Sweater azul rey con pantalón gris acero", colors: ["#2349B0", "#6E7783", "#FFFFFF"] },
      { text: "Remera rosa helado y pantalón negro", colors: ["#F2C6DD", "#111111", "#FFFFFF"] },
    ],
  },
  "invierno-brillante": {
    name: "Invierno brillante",
    line: "Neón sobre negro: colores puros y contraste máximo.",
    palette: [sw("Rojo puro", "#E4002B"), sw("Fucsia eléctrico", "#E0218A"), sw("Azul eléctrico", "#1F4FFF"), sw("Esmeralda brillante", "#00A86B"), sw("Limón helado", "#F4E04D"), sw("Turquesa frío", "#00B2C2"), sw("Violeta", "#7F3FBF"), sw("Rosa hielo", "#F7D7E6")],
    neutrals: [sw("Negro", "#111111"), sw("Blanco", "#FFFFFF"), sw("Carbón", "#36393F"), sw("Azul marino", "#1B2A4A")],
    avoid: [sw("Topo", "#9A8B80"), sw("Camel", "#C19A6B"), sw("Verde oliva", "#6B6B2A"), sw("Mostaza apagada", "#B59B48")],
    metals: "Plata brillante",
    outfits: [
      { text: "Remera blanca, jean negro y campera roja", colors: ["#FFFFFF", "#111111", "#E4002B"] },
      { text: "Sweater azul eléctrico con pantalón negro", colors: ["#1F4FFF", "#111111", "#FFFFFF"] },
      { text: "Camisa fucsia con traje marino", colors: ["#E0218A", "#1B2A4A", "#FFFFFF"] },
    ],
  },
};

export const TRAITS: Record<string, string> = {
  calido: "Subtono cálido",
  frio: "Subtono frío",
  neutro: "Subtono neutro",
  alto: "Contraste alto",
  medio: "Contraste medio",
  bajo: "Contraste bajo",
  brillante: "Colores vivos",
  suave: "Colores suaves",
};

// Which of the garment colour names the API gives (app/ml/describe.py color_name) suit each family.
const FAMILY_FIT: Record<string, { good: string[]; avoid: string[] }> = {
  primavera: {
    good: ["crema", "beige", "camel", "naranja", "amarillo", "verde", "celeste", "rosa", "rojo", "azul"],
    avoid: ["negro", "gris oscuro", "bordó"],
  },
  verano: {
    good: ["gris", "celeste", "azul", "azul marino", "rosa", "lila", "violeta", "blanco"],
    avoid: ["naranja", "amarillo", "camel", "marrón", "negro", "caqui", "verde oliva"],
  },
  otono: {
    good: ["camel", "marrón", "caqui", "verde oliva", "crema", "beige", "naranja", "bordó", "rojo", "verde", "amarillo"],
    avoid: ["negro", "gris", "blanco", "rosa", "lila", "celeste"],
  },
  invierno: {
    good: ["negro", "blanco", "gris oscuro", "gris", "azul marino", "azul", "rojo", "bordó", "violeta", "verde", "rosa", "lila"],
    avoid: ["camel", "naranja", "beige", "crema", "marrón", "caqui", "verde oliva"],
  },
};

/**
 * Whether a garment's colour suits a season: "in", "out" or null (no colour, or a colour the season
 * neither wears well nor needs to avoid). A two-tone garment ("azul marino y crema") is "out" if
 * either colour is.
 */
export function paletteFit(season: string, color: string | null | undefined): "in" | "out" | null {
  if (!color) return null;
  const fit = FAMILY_FIT[season.split("-")[0]];
  if (!fit) return null;
  const colors = color.split(" y ").map((part) => part.trim());
  if (colors.some((part) => fit.avoid.includes(part))) return "out";
  if (colors.every((part) => fit.good.includes(part))) return "in";
  return null;
}
