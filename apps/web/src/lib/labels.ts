// DeepFashion2 classes returned by the detector, in the product's voice (Rioplatense Spanish).
const LABELS: Record<string, string> = {
  short_sleeved_shirt: "Top manga corta",
  long_sleeved_shirt: "Top manga larga",
  short_sleeved_outwear: "Abrigo manga corta",
  long_sleeved_outwear: "Abrigo manga larga",
  vest: "Musculosa",
  sling: "Top de breteles",
  shorts: "Short",
  trousers: "Pantalón",
  skirt: "Pollera",
  short_sleeved_dress: "Vestido manga corta",
  long_sleeved_dress: "Vestido manga larga",
  vest_dress: "Vestido sin mangas",
  sling_dress: "Vestido de breteles",
  full_image: "Foto completa",
};

export function labelFor(label: string): string {
  if (LABELS[label]) return LABELS[label];
  const words = label.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
