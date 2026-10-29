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
  shoes: "Zapatos",
  full_image: "Foto completa",
};

// One word per garment, for tight places (pin captions).
const SHORT: Record<string, string> = {
  short_sleeved_shirt: "Top",
  long_sleeved_shirt: "Top",
  short_sleeved_outwear: "Abrigo",
  long_sleeved_outwear: "Abrigo",
  vest: "Musculosa",
  sling: "Top",
  shorts: "Short",
  trousers: "Pantalón",
  skirt: "Pollera",
  short_sleeved_dress: "Vestido",
  long_sleeved_dress: "Vestido",
  vest_dress: "Vestido",
  sling_dress: "Vestido",
  shoes: "Zapatos",
};

export function shortLabelFor(label: string): string {
  return SHORT[label] ?? labelFor(label);
}

export function labelFor(label: string): string {
  if (LABELS[label]) return LABELS[label];
  const words = label.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
