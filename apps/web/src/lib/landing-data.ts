import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EXPLAINER, PINS, type Credit, type Explainer, type Pin } from "./landing";

export type LandingData = { pins: Pin[]; explainer: Explainer; local: boolean };

/**
 * Landing photos for server components. `npm run photos` builds your own folder into
 * public/landing-local/; that set is used by `npm run dev` only, so builds, tests and anything
 * published always use the freely licensed set committed in lib/landing.ts.
 */
export function getLanding(): LandingData {
  if (process.env.NODE_ENV === "development") {
    const manifest = path.join(process.cwd(), "public", "landing-local", "manifest.json");
    if (existsSync(manifest)) {
      try {
        const data = JSON.parse(readFileSync(manifest, "utf8")) as { pins: Pin[]; explainer: Explainer | null };
        if (data.pins.length >= 4) return { pins: data.pins, explainer: data.explainer ?? EXPLAINER, local: true };
      } catch {
        // A half-written manifest: fall back to the published set.
      }
    }
  }
  return { pins: PINS, explainer: EXPLAINER, local: false };
}

/** Every photo once, even when it appears both in a composed board and on its own. */
export function creditsOf(pins: Pin[]): Credit[] {
  return [...new Map(pins.flatMap((pin) => pin.credits).map((credit) => [credit.url || credit.title, credit])).values()];
}
