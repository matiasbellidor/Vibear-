import type { Pin } from "./landing";

/** Sample looks for the scanner: two womenswear and two menswear outfits with 2+ garments. */
export function examplesFrom(pins: Pin[]): Pin[] {
  const outfits = pins.filter((pin) => pin.hotspots.length >= 2);
  return [
    ...outfits.filter((pin) => pin.kind === "woman").slice(0, 2),
    ...outfits.filter((pin) => pin.kind === "man").slice(0, 2),
  ];
}

/** A mixed board preview for the empty /saved: menswear, womenswear and a composed board. */
export function boardPreviewFrom(pins: Pin[]): Pin[] {
  const pick = (kind: Pin["kind"], count: number) => pins.filter((pin) => pin.kind === kind).slice(0, count);
  const board = pick("board", 1);
  return [...pick("man", 2), ...pick("woman", board.length ? 3 : 4), ...board].slice(0, 6);
}
