import Link from "next/link";
import type { CSSProperties } from "react";
import type { Explainer, Pin } from "@/lib/landing";
import { pad, shortLabelFor } from "@/lib/labels";
import { Brackets, LiveClock } from "../motion/Hud";
import { KineticText } from "../motion/KineticText";
import { MotionToggle } from "../motion/MotionToggle";
import { cx, primaryButton } from "../ui";
import { PinCard } from "./Pin";
import { NETWORKS, SocialLogo, networkName } from "./SocialLogos";

const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;
const pct = (value: number) => `${Math.round(value * 100)}%`;

// Where the four side pins rest around the photo, and where they fly in from.
const SIDES = [
  { place: "left-[3%] top-[12%]", tilt: "-6deg", fromX: "-60vw", fromR: "-18deg", show: "hidden md:block" },
  { place: "left-[9%] bottom-[16%]", tilt: "4deg", fromX: "-75vw", fromR: "14deg", show: "hidden lg:block" },
  { place: "right-[3%] top-[9%]", tilt: "5deg", fromX: "60vw", fromR: "16deg", show: "hidden md:block" },
  { place: "right-[9%] bottom-[14%]", tilt: "-4deg", fromX: "75vw", fromR: "-12deg", show: "hidden lg:block" },
];

function sidePins(pins: Pin[], explainer: Explainer): Pin[] {
  const others = pins.filter((pin) => !pin.credits.some((credit) => credit.url && credit.url === explainer.credit.url));
  const first = (kind: Pin["kind"], skip = 0) => others.filter((pin) => pin.kind === kind)[skip];
  return [first("woman"), first("man"), first("board") ?? first("woman", 1), first("woman", 1) ?? first("man", 1)].filter(
    (pin): pin is Pin => Boolean(pin),
  );
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
      text: boxes.map((box) => `${shortLabelFor(box.label)} ${pct(box.confidence)}`).join(" · "),
    },
    { title: "Encontrala", text: "Online, de la más parecida a la menos, o en un local cerca tuyo." },
  ];

  return (
    <section aria-labelledby="story-title" className="story relative bg-grid">
      <div className="story-stage">
        <div className="story-intro flex flex-col items-center justify-center px-4 py-8 text-center">
          <p className="enter flex items-center gap-3 text-micro text-muted" style={delay(0.1)}>
            <span className="flex items-center gap-1.5 text-wine-bright">
              <span aria-hidden="true" className="blink motion-loop h-1.5 w-1.5 rounded-full bg-wine-bright" /> En vivo
            </span>
            <LiveClock />
          </p>
          {/* Width capped by the stage height too, so the headline fits a landscape iPad or a laptop. */}
          <h1 id="story-title" className="@container mt-5 w-full max-w-[min(64rem,calc((100svh-3.5rem)*0.9))] font-display">
            <span className="block text-display tracking-[-0.03em]">
              <KineticText lines={[{ text: "Lo viste." }, { text: "Encontralo.", className: "italic text-wine-bright" }]} />
            </span>
          </h1>
          <p className="enter mt-6 max-w-[44ch] text-body text-muted" style={delay(0.7)}>
            Subí la captura y Vibear encuentra cada prenda del look: online o en un local cerca tuyo.
          </p>
          <div className="enter mt-8" style={delay(0.85)}>
            <p className="text-micro text-muted">La ropa que viste en</p>
            <ul className="mt-3 flex items-center justify-center gap-6 sm:gap-8">
              {NETWORKS.map((network) => (
                <li key={network} className="flex items-center gap-2 text-ink">
                  <SocialLogo network={network} className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="hidden text-micro sm:inline">{networkName(network)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="enter mt-9 flex flex-col items-center gap-4" style={delay(1)}>
            <Link href="/scan" className={primaryButton}>
              Empezá a escanear
            </Link>
            <span className="text-micro text-muted">
              Bajá para ver cómo <span aria-hidden="true">↓</span>
            </span>
            <MotionToggle />
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
                } as CSSProperties
              }
            >
              <PinCard pin={pin} caption={false} labels={false} />
            </div>
          ))}

          <div
            className="story-card relative -translate-y-[4%]"
            style={{
              width: "min(84vw, calc((100svh - 3.5rem) * 0.6 * 2 / 3), 26rem)",
              aspectRatio: `${width} / ${height}`,
            }}
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
                    {shortLabelFor(box.label)} · {pct(box.confidence)}
                  </span>
                </div>
              );
            })}
            <Brackets className="-m-3" />
          </div>
        </div>

        <div className="story-captions px-4 pb-6 sm:pb-8">
          <div className="mx-auto max-w-3xl">
            <h2 className="story-caption-title text-center text-micro text-muted">Cómo funciona</h2>
            <ol className="story-caption-stack mt-3 grid gap-4 sm:grid-cols-3 sm:gap-6">
              {steps.map((step, i) => (
                <li
                  key={step.title}
                  className="story-caption bg-paper/85 p-3 text-center backdrop-blur-sm"
                  style={{ "--caption": `caption-${i + 1}` } as CSSProperties}
                >
                  <p className="text-micro text-wine-bright">
                    {pad(i + 1)} · {step.title}
                  </p>
                  <p className="mt-1 text-small text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
