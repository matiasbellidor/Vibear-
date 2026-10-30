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

// One or two words per garment, for tight places (pin captions, chips). A shirt class covers tees,
// shirts and sweaters alike, so it's named by its sleeves.
const SHORT: Record<string, string> = {
  short_sleeved_shirt: "Remera",
  long_sleeved_shirt: "Manga larga",
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

/** A detected garment's name: what the API recognised ("Buzo polo de corderito negro"), else its class. */
export function garmentName(item: { label: string; name?: string | null }): string {
  return item.name ?? labelFor(item.label);
}

/** The short form for chips and captions ("Buzo polo"). */
export function garmentKind(item: { label: string; kind?: string | null }): string {
  return item.kind ?? shortLabelFor(item.label);
}

export function labelFor(label: string): string {
  if (LABELS[label]) return LABELS[label];
  const words = label.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}
