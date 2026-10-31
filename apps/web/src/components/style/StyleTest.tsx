"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { analyze, COLOR_QUESTIONS, type ColorAnswers, type Option } from "@/lib/colorimetry";
import type { Pin } from "@/lib/landing";
import { pad } from "@/lib/labels";
import { finishProfile, resetProfile, saveColor, saveStyle, useProfile, type StyleAnswers } from "@/lib/profile";
import { EMPTY_STYLE, photoFor, STYLE_QUESTIONS } from "@/lib/style";
import { FadeImage } from "../FadeImage";
import { cx, primaryButton, textButton } from "../ui";
import { StyleResult } from "./StyleResult";

type Step =
  | { part: "style"; key: keyof StyleAnswers; title: string; help: string; options: Option[]; max?: number }
  | { part: "color"; key: keyof ColorAnswers; title: string; help: string; options: Option[]; max?: undefined };

const STEPS: Step[] = [
  ...STYLE_QUESTIONS.map((q) => ({ part: "style" as const, ...q })),
  ...COLOR_QUESTIONS.map((q) => ({ part: "color" as const, ...q })),
];
const PART_LABEL = { style: "Tu estilo", color: "Tu colorimetría" };
// A single answer moves on by itself, after a beat that shows the choice.
const ADVANCE_MS = 220;

/**
 * The style test: who they dress, the styles they like, their days, goals and budget, then six
 * questions for their colour analysis. One question per screen, every one skippable, the whole test
 * too. Answers are saved to the anonymous profile (lib/profile.ts) as they finish.
 */
export function StyleTest({ pins }: { pins: Pin[] }) {
  const profile = useProfile();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [retaking, setRetaking] = useState(false);
  const [style, setStyle] = useState<StyleAnswers>(EMPTY_STYLE);
  const [color, setColor] = useState<ColorAnswers>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Each question starts at the top: after the tall styles grid, the next one would open scrolled down.
  useEffect(() => {
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
  }, [step]);

  // The server render (and the first client one) can't read this browser's profile: hold the space.
  if (!profile.user) return <div className="min-h-[calc(100svh-3.5rem)]" />;
  if (profile.status === "done" && !retaking) {
    return (
      <StyleResult
        profile={profile}
        pins={pins}
        onRetake={() => {
          resetProfile();
          setStyle(EMPTY_STYLE);
          setColor({});
          setStep(0);
          setRetaking(true);
        }}
      />
    );
  }

  const current = STEPS[step];
  const chosen = (key: string): boolean => {
    if (current.part === "color") return color[current.key] === key;
    const value = style[current.key];
    return Array.isArray(value) ? value.includes(key) : value === key;
  };

  const finish = (finalColor: ColorAnswers) => {
    saveStyle(style);
    const answered = Object.values(finalColor).filter(Boolean).length;
    // The colour analysis needs most of its answers; with fewer, only the style is kept.
    saveColor(answered >= 4 ? analyze(finalColor) : null);
    setRetaking(false);
    window.scrollTo({ top: 0 });
  };

  const next = (finalColor = color) => {
    clearTimeout(timer.current);
    if (step === STEPS.length - 1) finish(finalColor);
    else setStep(step + 1);
  };

  const pick = (key: string) => {
    if (current.part === "color") {
      const updated = { ...color, [current.key]: key };
      setColor(updated);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => next(updated), ADVANCE_MS);
      return;
    }
    const value = style[current.key];
    if (Array.isArray(value)) {
      const has = value.includes(key);
      if (!has && value.length >= (current.max ?? 1)) return;
      setStyle({ ...style, [current.key]: has ? value.filter((k) => k !== key) : [...value, key] });
      return;
    }
    setStyle({ ...style, [current.key]: key });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => next(), ADVANCE_MS);
  };

  const multi = current.part === "style" && Array.isArray(style[current.key]);
  const photos = current.key === "aesthetics";
  const progress = (step + 1) / STEPS.length;

  return (
    <section aria-labelledby="quiz-title" className="mx-auto min-h-[calc(100svh-3.5rem)] max-w-4xl px-4 pb-16 pt-8 lg:px-8 lg:pt-12">
      <div className="flex items-center justify-between gap-4">
        <p className="text-micro text-wine-bright">
          {PART_LABEL[current.part]} · <span className="tabular-nums">{pad(step + 1)} / {pad(STEPS.length)}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            finishProfile("skipped");
            router.push("/");
          }}
          className={textButton}
        >
          Saltar el test
        </button>
      </div>
      <div aria-hidden="true" className="mt-3 h-px bg-line">
        <div className="h-px origin-left bg-wine-bright transition-transform duration-300 ease-out-soft" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {/* A new key per question, so each one arrives with the step animation. */}
      <div key={step} className="quiz-step mt-10">
        <h1 id="quiz-title" className="max-w-[22ch] font-display text-title tracking-tight">
          {current.title}
        </h1>
        <p className="mt-3 text-small text-muted">{current.help}</p>

        <div
          role="group"
          aria-label={current.title}
          className={cx("mt-8 grid gap-3", photos ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-2")}
        >
          {current.options.map((option, i) => {
            const on = chosen(option.key);
            const photo = photos ? photoFor(option.key, pins, style.dress) : undefined;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={on}
                onClick={() => pick(option.key)}
                className={cx(
                  "quiz-option group text-left transition-colors duration-200 ease-out-soft",
                  photos ? "block" : "flex min-h-14 items-center justify-between gap-3 border px-4 py-3",
                  !photos && (on ? "border-wine bg-wine text-cream" : "border-line hover:border-ink"),
                )}
                style={{ "--i": i } as CSSProperties}
              >
                {photos ? (
                  <>
                    <span
                      className={cx(
                        "relative block aspect-[3/4] overflow-hidden rounded-media bg-surface outline-offset-2 transition-[outline-color] duration-200",
                        on ? "outline-2 outline-wine-bright" : "outline-2 outline-transparent",
                      )}
                    >
                      {photo ? (
                        <FadeImage src={photo.src} alt="" className="h-full w-full object-cover" />
                      ) : (
                        // No look of this style yet: the name itself, set like a cover line.
                        <span aria-hidden="true" className="absolute inset-0 grid place-items-center p-4 text-center font-display text-numeral italic leading-none text-wine-bright">
                          {option.label}
                        </span>
                      )}
                      {on && (
                        <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-wine-bright text-small text-paper">
                          ✓
                        </span>
                      )}
                    </span>
                    <span className={cx("mt-2 block text-micro", on ? "text-wine-bright" : "text-ink/80")}>{option.label}</span>
                  </>
                ) : (
                  <>
                    <span className="text-body">{option.label}</span>
                    <span aria-hidden="true" className={cx("text-micro", on ? "text-cream" : "text-muted")}>
                      {on ? "✓" : pad(i + 1)}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
          {multi && (
            <button type="button" onClick={() => next()} className={primaryButton}>
              {step === STEPS.length - 1 ? "Ver mi resultado" : "Siguiente"}
            </button>
          )}
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className={textButton}>
              Atrás
            </button>
          )}
          <button type="button" onClick={() => next()} className={cx(textButton, "text-muted")}>
            {step === STEPS.length - 1 ? "Omitir y ver el resultado" : "Omitir pregunta"}
          </button>
        </div>
      </div>
    </section>
  );
}
