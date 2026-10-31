import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import type { Explainer, Pin } from "@/lib/landing";
import { garmentKind, pad } from "@/lib/labels";
import { Brackets, LiveClock } from "../motion/Hud";
import { KineticText } from "../motion/KineticText";
import { MotionToggle } from "../motion/MotionToggle";
import { StyleLink } from "../style/StyleEntry";
import { cx, primaryButton } from "../ui";
import { PinCard } from "./Pin";
import { AppIcon, NETWORKS, type Network } from "./SocialLogos";

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;
const pct = (value: number) => `${Math.round(value * 100)}%`;

// Where the four side pins rest around the photo, and where they fly in from. On a laptop the steps
// take turns beside the photo (left, then right), so the pins on that side step back meanwhile (--dim).
const LEFT = { "--dim-from": "16%", "--dim-to": "46%" };
const RIGHT = { "--dim-from": "44%", "--dim-to": "70%" };
const SIDES = [
  { place: "left-[3%] top-[12%]", tilt: "-6deg", fromX: "-60vw", fromR: "-18deg", show: "hidden md:block", dim: LEFT },
  { place: "left-[9%] bottom-[16%]", tilt: "4deg", fromX: "-75vw", fromR: "14deg", show: "hidden lg:block", dim: LEFT },
  { place: "right-[3%] top-[9%]", tilt: "5deg", fromX: "60vw", fromR: "16deg", show: "hidden md:block", dim: RIGHT },
  { place: "right-[9%] bottom-[14%]", tilt: "-4deg", fromX: "75vw", fromR: "-12deg", show: "hidden lg:block", dim: RIGHT },
];

// The brand marks in an arc over the first line (cqw of the headline box): TikTok's note left of
// "Lo", Pinterest's badge above the middle, Instagram behind "viste.". "Encontralo." stays clear,
// since wine on Pinterest red can't be read. Each glows in its own colour. --from-* is where each
// pops out from (behind the centre); --spread is where it flies as you scroll the headline away.
const APP_SPOTS: Record<Network, { place: string; tilt: string; glow: string; motion: Record<string, string> }> = {
  tiktok: {
    place: "-left-[9cqw] -top-[8cqw] w-[27cqw]",
    tilt: "-12deg",
    glow: "[filter:drop-shadow(-0.5cqw_0_2.5cqw_rgb(37_244_238/0.55))_drop-shadow(0.5cqw_0_2.5cqw_rgb(254_44_85/0.55))]",
    motion: { "--from-x": "28cqw", "--from-y": "16cqw", "--from-r": "10deg", "--spread": "-30cqw -18cqw" },
  },
  instagram: {
    place: "-right-[8cqw] -top-[11cqw] w-[28cqw]",
    tilt: "11deg",
    glow: "[filter:drop-shadow(0_0_3cqw_rgb(214_41_118/0.6))]",
    motion: { "--from-x": "-26cqw", "--from-y": "20cqw", "--from-r": "-12deg", "--spread": "30cqw -22cqw" },
  },
  pinterest: {
    place: "left-[39cqw] -top-[18cqw] w-[22cqw]",
    tilt: "6deg",
    glow: "[filter:drop-shadow(0_0_3cqw_rgb(230_0_35/0.65))]",
    motion: { "--from-x": "0cqw", "--from-y": "18cqw", "--from-r": "-10deg", "--spread": "0cqw -24cqw" },
  },
};

function sidePins(pins: Pin[], explainer: Explainer): Pin[] {
  const others = pins.filter((pin) => !pin.credits.some((credit) => credit.url && credit.url === explainer.credit.url));
  const first = (kind: Pin["kind"], skip = 0) => others.filter((pin) => pin.kind === kind)[skip];
  const chosen = [first("woman"), first("man"), first("board") ?? first("product"), first("woman", 1) ?? first("man", 1)].filter(
    (pin): pin is Pin => Boolean(pin),
  );
  // A set without one kind (a board that's all menswear) still fills the four places.
  for (const pin of others) if (chosen.length < 4 && !chosen.includes(pin)) chosen.push(pin);
  return chosen;
}

/**
 * The hero, Apple-style: a tall section with a sticky stage that plays with the scroll
 * (choreography in globals.css, .story-*). The headline leaves, the photo rises to the centre,
 * pins fly in, a scan line passes, the garments are boxed and read out. Boxes and percentages
 * are real YOLO output. Without scroll timelines or with reduced motion it is a static column.
 */
export function Story({ pins, explainer }: { pins: Pin[]; explainer: Explainer }) {
  const { src, width, height, boxes } = explainer;
  const steps = [
    { title: "Subí una captura", text: "De un Reel, un TikTok o un pin. También desde tu galería." },
    {
      title: "Detectamos cada prenda",
      text: boxes.map((box) => `${garmentKind(box)} ${pct(box.confidence)}`).join(" · "),
    },
    { title: "Encontrala", text: "Online, de la más parecida a la menos, o en un local cerca tuyo." },
  ];

  return (
    <section aria-labelledby="story-title" className="story relative overflow-x-clip bg-grid">
      <div className="story-stage">
        <div className="story-intro flex flex-col items-center justify-center px-4 py-8 text-center">
          {/* Width capped by the stage height too, so the headline fits a landscape iPad or a laptop.
              The app icons sit behind it, sized and placed in container units of the headline. */}
          <div className="@container relative isolate mt-[9svh] w-full max-w-[min(64rem,calc((100svh-3.5rem)*0.9))]">
            <h1 id="story-title" className="font-display [text-shadow:0_0.04em_0.35em_rgb(10_10_11/0.85)]">
              <span className="block text-display tracking-[-0.03em]">
                <KineticText lines={[{ text: "Lo viste." }, { text: "Encontralo.", className: "italic text-wine-bright" }]} />
              </span>
            </h1>
            <ul aria-label="Dónde la viste" className="pointer-events-none absolute inset-0 -z-10">
              {NETWORKS.map((network, i) => (
                <li
                  key={network}
                  className={cx("story-app absolute", APP_SPOTS[network].place)}
                  style={{ rotate: APP_SPOTS[network].tilt, ...APP_SPOTS[network].motion } as CSSProperties}
                >
                  <span className="app-pop block" style={{ "--i": i } as CSSProperties}>
                    <span className="app-float motion-loop block" style={{ "--i": i } as CSSProperties}>
                      <AppIcon network={network} className={cx("size-full", APP_SPOTS[network].glow)} />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="enter mt-6 max-w-[44ch] text-body text-muted" style={delay(0.7)}>
            ¿Lo viste en Pinterest, Instagram o TikTok? Subí la captura y Vibear encuentra cada prenda del look: online o
            en un local cerca tuyo.
          </p>
          <div className="enter mt-9 flex flex-col items-center gap-4" style={delay(1)}>
            <Link href="/scan" transitionTypes={["nav-forward"]} className={primaryButton}>
              Empezá a escanear
            </Link>
            {/* One row with the scroll hint, so the hero stays as tall as it was: on a 720px screen the
                pause button must stay inside the sticky stage. */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <span className="text-micro text-muted">
                Bajá para ver cómo <span aria-hidden="true">↓</span>
              </span>
              <StyleLink />
            </div>
            <div className="flex items-center gap-5">
              <p className="flex items-center gap-3 text-micro text-muted">
                <span className="flex items-center gap-1.5 text-wine-bright">
                  <span aria-hidden="true" className="blink motion-loop h-1.5 w-1.5 rounded-full bg-wine-bright" /> En
                  vivo
                </span>
                <LiveClock />
              </p>
              <MotionToggle />
            </div>
          </div>
        </div>

        <div aria-hidden="true" className="story-visual relative flex items-center justify-center px-4 py-16">
          {sidePins(pins, explainer).map((pin, i) => (
            <div
              key={pin.src}
              className={cx("story-side absolute w-[clamp(7rem,11vw,12rem)]", SIDES[i].place, SIDES[i].show)}
              style={
                {
                  transform: `rotate(${SIDES[i].tilt})`,
                  "--tilt": SIDES[i].tilt,
                  "--from-x": SIDES[i].fromX,
                  "--from-r": SIDES[i].fromR,
                  ...SIDES[i].dim,
                } as CSSProperties
              }
            >
              <div className="story-side-dim">
                <PinCard pin={pin} caption={false} labels={false} />
              </div>
            </div>
          ))}

          <div
            className="story-card relative w-(--photo-w) -translate-y-[4%]"
            style={{ aspectRatio: `${width} / ${height}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP */}
            <img
              src={src}
              width={width}
              height={height}
              alt=""
              decoding="async"
              className="absolute inset-0 h-full w-full rounded-media bg-surface object-cover"
            />
            <div className="story-scan pointer-events-none absolute inset-x-0 top-0 h-[10%] opacity-0">
              <span className="block h-0.5 bg-wine-bright shadow-[0_0_18px_3px_rgb(232_84_108/0.6)]" />
            </div>
            {boxes.map((box, i) => {
              const [x1, y1, x2, y2] = box.box;
              const area = {
                left: `${(x1 / width) * 100}%`,
                top: `${(y1 / height) * 100}%`,
                width: `${((x2 - x1) / width) * 100}%`,
                height: `${((y2 - y1) / height) * 100}%`,
              };
              return (
                <div key={box.label}>
                  <div
                    className={cx(
                      "story-box absolute",
                      i === 0
                        ? "border-2 border-wine-bright shadow-[0_0_24px_rgb(232_84_108/0.45)]"
                        : "border border-ink/90 shadow-[0_0_0_1px_rgb(10_10_11/0.5)]",
                    )}
                    style={{ ...area, "--i": i } as CSSProperties}
                  >
                    <span className="absolute left-0 top-0 bg-paper px-1.5 py-0.5 text-micro tabular-nums">{pad(i + 1)}</span>
                  </div>
                  <span
                    className="story-chip absolute whitespace-nowrap bg-wine-bright px-2 py-1 text-micro tabular-nums text-paper"
                    style={{ left: area.left, top: `calc(${(y2 / height) * 100}% - 1.75rem)`, "--i": i } as CSSProperties}
                  >
                    {garmentKind(box)} · {pct(box.confidence)}
                  </span>
                </div>
              );
            })}
            <Brackets className="-m-3" />
          </div>
        </div>

        {/* How it works, big: each step takes the stage in turn, somewhere else around the photo (left,
            right, under it on a laptop; under it from alternating sides on a phone). Static, a 3-column list. */}
        <div className="story-captions px-4 pb-6 pt-12 sm:pb-8 lg:px-8">
          <h2 className="story-caption-title text-center text-micro text-muted">Cómo funciona</h2>
          <ol className="story-caption-stack mx-auto mt-8 grid max-w-5xl gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className={cx("story-caption", `story-step-${i + 1}`)}>
                <div aria-hidden="true" className="step-head flex items-center gap-4">
                  <span className="step-rule step-rule-a" />
                  <span className="step-num font-display text-numeral italic tabular-nums text-wine-bright">{pad(i + 1)}</span>
                  <span className="step-rule step-rule-b" />
                </div>
                <h3 className="step-title mt-2 font-display text-step tracking-[-0.02em]">
                  {step.title.split(" ").map((word, w) => (
                    <Fragment key={w}>
                      {w > 0 && " "}
                      <span className="kinetic-mask">
                        <span className="step-word inline-block" style={{ "--w": w } as CSSProperties}>
                          {word}
                        </span>
                      </span>
                    </Fragment>
                  ))}
                </h3>
                <p className="step-text mt-3 max-w-[34ch] text-small text-ink/80 lg:text-body">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
