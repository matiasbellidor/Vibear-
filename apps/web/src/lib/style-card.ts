// "Mi tarjeta de estilo": the test's result drawn on a canvas as a 1080x1350 PNG (a phone story or
// feed post), in Vibear's look: black stage, the season in the display face, the palette as dots.
// Colours and fonts come from the page's own tokens, so the card follows the design system.

import { SEASONS, TRAITS } from "./colorimetry";
import { STYLE_LABELS } from "./outfits";
import type { Profile } from "./profile";

const W = 1080;
const H = 1350;

function token(name: string): string {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

export async function downloadStyleCard(profile: Profile): Promise<void> {
  const season = profile.color ? SEASONS[profile.color.season] : undefined;
  if (!season || !profile.color) return;
  const display = token("--font-display") || "serif";
  const sans = token("--font-sans") || "sans-serif";
  const mono = token("--font-mono") || "monospace";
  await Promise.all([document.fonts.load(`120px ${display}`), document.fonts.load(`italic 120px ${display}`), document.fonts.load(`28px ${mono}`)]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const ink = token("--color-ink") || "#f2efe9";
  const muted = token("--color-muted") || "#8f8f96";
  const wine = token("--color-wine-bright") || "#e8546c";
  ctx.fillStyle = token("--color-paper") || "#0a0a0b";
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.font = `44px ${display}`;
  ctx.letterSpacing = "14px";
  ctx.fillText("VIBEAR", 80, 130);
  ctx.letterSpacing = "4px";
  ctx.fillStyle = wine;
  ctx.font = `500 24px ${mono}`;
  ctx.fillText("MI COLORIMETRÍA", 80, 250);

  const [first, ...rest] = season.name.split(" ");
  ctx.letterSpacing = "-2px";
  ctx.fillStyle = ink;
  ctx.font = `150px ${display}`;
  ctx.fillText(first, 72, 410);
  ctx.fillStyle = wine;
  ctx.font = `italic 150px ${display}`;
  ctx.fillText(rest.join(" "), 72, 550);

  ctx.letterSpacing = "0px";
  ctx.fillStyle = muted;
  ctx.font = `34px ${sans}`;
  ctx.fillText(season.line, 80, 630, W - 160);
  const traits = [profile.color.undertone, profile.color.contrast, profile.color.chroma].map((t) => TRAITS[t]).filter(Boolean);
  ctx.font = `500 22px ${mono}`;
  ctx.letterSpacing = "3px";
  ctx.fillText(traits.join("  ·  ").toUpperCase(), 80, 690, W - 160);

  // The palette: two rows of four dots.
  season.palette.slice(0, 8).forEach((color, i) => {
    const x = 160 + (i % 4) * 253;
    const y = 830 + Math.floor(i / 4) * 210;
    ctx.beginPath();
    ctx.arc(x, y, 70, 0, Math.PI * 2);
    ctx.fillStyle = color.hex;
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.font = `500 20px ${mono}`;
    ctx.letterSpacing = "1px";
    ctx.textAlign = "center";
    ctx.fillText(color.name.toUpperCase(), x, y + 108, 230);
    ctx.textAlign = "left";
  });

  const styles = profile.style?.aesthetics.map((key) => STYLE_LABELS[key] ?? key) ?? [];
  ctx.fillStyle = ink;
  ctx.font = `500 22px ${mono}`;
  ctx.letterSpacing = "3px";
  if (styles.length) ctx.fillText(`ESTILO · ${styles.join(" · ").toUpperCase()}`, 80, 1200, W - 160);
  ctx.fillStyle = muted;
  ctx.fillText(`METALES · ${season.metals.toUpperCase()}`, 80, 1250, W - 160);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vibear-${profile.color.season}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
