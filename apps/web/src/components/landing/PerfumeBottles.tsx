import type { CSSProperties } from "react";
import { cx } from "../ui";

// Three bottles drawn for Vibear (not any brand's design): suede-touch glass, a gold cap and a gold
// plaque, after the warm amber/vanilla mood the user referenced. Vector, so they stay sharp.

type Glass = { id: string; dark: string; mid: string; light: string };

const GLASSES: Record<"turquoise" | "amber" | "smoke", Glass> = {
  turquoise: { id: "turquoise", dark: "#0a5f63", mid: "#1fbfb6", light: "#7fe3d6" },
  amber: { id: "amber", dark: "#5a2c0c", mid: "#c3752b", light: "#f2b866" },
  smoke: { id: "smoke", dark: "#2b1d14", mid: "#7b5434", light: "#c39462" },
};

function Bottle({ glass, className }: { glass: Glass; className?: string }) {
  const g = glass.id;
  return (
    <svg viewBox="0 0 200 300" aria-hidden="true" className={cx("block overflow-visible", className)}>
      <defs>
        <linearGradient id={`${g}-glass`} x1="0" x2="1">
          <stop offset="0" stopColor={glass.dark} />
          <stop offset="0.42" stopColor={glass.mid} />
          <stop offset="0.7" stopColor={glass.light} />
          <stop offset="1" stopColor={glass.dark} />
        </linearGradient>
        <linearGradient id={`${g}-gold`} x1="0" x2="1">
          <stop offset="0" stopColor="#7a5418" />
          <stop offset="0.3" stopColor="#f7df8e" />
          <stop offset="0.55" stopColor="#b8862c" />
          <stop offset="0.8" stopColor="#f3d47e" />
          <stop offset="1" stopColor="#6e4a14" />
        </linearGradient>
        <linearGradient id={`${g}-shine`} x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        {/* Suede: fine noise over the glass, multiplied in so it reads as a soft, matte touch. */}
        <filter id={`${g}-suede`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="grain" />
          <feComponentTransfer in="grain">
            <feFuncA type="linear" slope="0.22" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <clipPath id={`${g}-body`}>
          <rect x="30" y="74" width="140" height="196" rx="24" />
        </clipPath>
      </defs>

      <ellipse cx="100" cy="286" rx="78" ry="9" fill="#000" opacity="0.45" />
      <rect x="30" y="74" width="140" height="196" rx="24" fill={`url(#${g}-glass)`} />
      <g clipPath={`url(#${g}-body)`}>
        <rect x="30" y="74" width="140" height="196" fill="#fff" filter={`url(#${g}-suede)`} />
        <rect x="44" y="82" width="18" height="180" rx="9" fill={`url(#${g}-shine)`} opacity="0.7" />
      </g>
      {/* Gold plaque, engraved with two fine lines. */}
      <rect x="62" y="150" width="76" height="40" rx="5" fill={`url(#${g}-gold)`} />
      <rect x="66" y="154" width="68" height="32" rx="3" fill="none" stroke="#5c3d0e" strokeOpacity="0.5" />
      <line x1="80" y1="166" x2="120" y2="166" stroke="#5c3d0e" strokeOpacity="0.55" />
      <line x1="88" y1="174" x2="112" y2="174" stroke="#5c3d0e" strokeOpacity="0.4" />
      {/* Neck and cap. */}
      <rect x="86" y="58" width="28" height="20" rx="3" fill={`url(#${g}-gold)`} />
      <rect x="62" y="6" width="76" height="56" rx="10" fill={`url(#${g}-gold)`} />
      <rect x="70" y="12" width="10" height="44" rx="5" fill="#fff" opacity="0.35" />
    </svg>
  );
}

/**
 * The welcome for the fragrance part: three bottles rise into a warm glow as it scrolls in (like the
 * brand marks in the hero), then keep floating. Choreography in globals.css (.fragrance-*).
 */
export function PerfumeBottles() {
  const bottles = [
    { glass: GLASSES.amber, size: "w-[24%]", place: "translate-y-[12%]", tilt: "-9deg", from: "-40%", i: 1 },
    { glass: GLASSES.turquoise, size: "w-[34%]", place: "z-10", tilt: "0deg", from: "0%", i: 0 },
    { glass: GLASSES.smoke, size: "w-[24%]", place: "translate-y-[12%]", tilt: "8deg", from: "40%", i: 2 },
  ];
  return (
    <div aria-hidden="true" className="fragrance-stage relative mx-auto flex max-w-xl items-end justify-center gap-[3%] pt-10">
      {/* The glow fades out inside its own box, so no edge ever shows when the part is clipped. */}
      <span className="fragrance-glow motion-loop pointer-events-none absolute inset-x-0 top-[5%] bottom-[-10%] rounded-full bg-[radial-gradient(closest-side,rgb(255_186_102/0.55),rgb(31_191_182/0.18)_55%,transparent)]" />
      {bottles.map((bottle) => (
        <span
          key={bottle.glass.id}
          className={cx("fragrance-bottle relative block", bottle.size, bottle.place)}
          style={{ rotate: bottle.tilt, "--from-x": bottle.from, "--i": bottle.i } as CSSProperties}
        >
          <span className="fragrance-float motion-loop block" style={{ "--i": bottle.i } as CSSProperties}>
            <Bottle glass={bottle.glass} className="w-full drop-shadow-[0_0_30px_rgb(255_186_102/0.35)]" />
          </span>
        </span>
      ))}
    </div>
  );
}
