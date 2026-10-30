---
name: vibear-motion
description: Vibear's motion graphics system for apps/web. Covers the Apple-style scroll story (a sticky stage that plays with the scroll), page and tab transitions (View Transitions, the sliding wine tab pill), the per-tab banners, kinetic typography, scroll-driven reveals, the pin wall that slides with the scroll, sections opening like pages, timeline explainers (the animated scan demo), loop pausing and reduced-motion fallbacks, all CSS-first and cheap to run. Use this skill whenever you add or change any animation, transition, keyframe, scroll effect, carousel, marquee, ticker, hover motion, loading animation or landing page section, or when the user asks for motion graphics, "make it feel alive", more dynamic, animated or storytelling. Use it together with vibear-design, which owns layout, colour and type.
---

# Vibear motion

Motion in Vibear exists to **tell the product's story**, not to decorate. Each animation should answer a question a first-time visitor has:

| Motion | What it says |
|---|---|
| The scroll story: the headline leaves, a photo rises to the centre, pins fly in, a scan line passes, garments are boxed and read out | "this is exactly how the product works, and you are driving it" |
| Kinetic headline (words rising from a mask) | "this is a brand with a point of view" |
| Lines lighting up as you scroll | "here is the problem, one beat at a time" |
| Scan line, boxes drawing in, cards rising (the `/scan` demo) | "this is what will happen to your photo" |
| A wall of pins sliding sideways as you scroll, hotspots breathing | "every garment in these photos can be found" |
| Sections opening like pages, black then white; a wine progress bar under the header | "you are moving forward through a story" |
| Pins floating on the wine closing section | "this is what you get when you press the button" |
| A crosshair following the mouse over the hero, reading the garment under it | "point at anything, Vibear knows what it is" |
| A wine scan line sweeping the photo field, a blinking live dot and caret | "the scanner is on" |
| Terminal lines lighting up, the last one ending in `ERROR 404` | "this is the problem we fix" |

If you can't say what an animation explains, cut it.

## Where motion lives

| Zone | Routes | Budget |
|---|---|---|
| Story (expressive) | `/` (the landing), `/creditos` | kinetic type, loops, scroll scrubbing, the explainer |
| Tool (restrained) | `/scan`, `/look/[id]`, `/saved` | 150-250ms fades and overlays, plus one short banner per tab that plays when it opens (see vibear-design). People are working there: motion must never delay a task |
| Between pages | every navigation | View Transitions: tabs slide toward the tab picked, the wine pill morphs, other navigations crossfade (see below) |

## Principles

- **Editorial, not bouncy.** Expo-out easing (`--ease-expo`), no springs, no overshoot, no rotation. Things arrive like a page turn, not like a toy.
- **One hero moment per screen.** If the headline is moving, the rest of the viewport stays quiet.
- **Scroll tells, loops decorate.** The story beats are scroll-driven, so the visitor sets the pace and nobody waits. Loops (hotspots, floating pins, the live dot) are small texture. Clock-based explainers are short (6 s), because people watch them.
- **No word tickers.** A band of scrolling slogans ("Lo viste — Guardalo — Usalo") reads cheap; the user called it tacky. Move pictures, not slogans.
- **Choreograph with stagger.** Sequences step by 60-90ms per word or 250-500ms per object. Never all at once.
- **Final state is the default.** Base CSS shows the finished, readable state; keyframes animate *into* it. If an animation is off (reduced motion, unsupported browser, no JS), the page is still complete.

## Tokens and primitives

Everything is in `apps/web/src/app/globals.css`, so components only pick class names.

| Token / class | What |
|---|---|
| `--ease-expo` | `cubic-bezier(.16,1,.3,1)`, for reveals and kinetic type |
| `--ease-in-out-soft` | `cubic-bezier(.65,0,.35,1)`, for timeline moves |
| `.kinetic-mask` > `.kinetic-word` (`--i`) | words rising from an overflow mask on load, staggered by `--i` |
| `.reveal` | fades and rises as it scrolls in (CSS scroll-driven, `animation-timeline: view()`) |
| `.scrub-line` | text going from 15% to 100% opacity as it crosses the viewport |
| `.story` > `.story-stage` | the scroll story: a 250svh section with a sticky stage and a named view timeline `--story` (see below). The user found 330svh too slow to scroll through |
| `.story-intro`, `-app`, `-card`, `-side`, `-scan`, `-box`, `-chip`, `-caption`, `-caption-title` | its parts, each with an `animation-range` in `contain` percentages of `--story`; boxes and chips stagger with `--i` |
| `.scroll-row` (inside `.scroll-row-wrap`) | the pin wall: slides from its start to its end while it crosses the viewport (`view()`, `cover 0%` → `cover 100%`) |
| `.page` | a section whose background (a `::before`, so text never scales) opens from 90% width as it enters; the top corners stay rounded, like a sheet. It also has `content-visibility: auto` |
| `.app-pop`, `.app-float` (`--i`, `--from-*`) | the brand marks behind the headline: they come out from behind its centre one by one, then float (a loop); `.story-app` spreads them outward (`--spread`) as the headline scrolls away |
| `.tab-beam`, `.tab-chip` (`--n`), `.tab-drop`, `.tab-pop` | the tab banners: one-shot, so they replay each time the tab opens |
| `.fragrance-bottle` (`--from-x`, `--i`), `.fragrance-float`, `.fragrance-glow` | the perfumery welcome (real bottles, cut out): they rise into the glow as the section scrolls in (`view()`, centre first), then float; the glow breathes. Both loops carry `.motion-loop` |
| `.scan-area` (inside `.scan-field`) | a garment's outline on a pin lights up (wine fill + stroke, 150 ms) under the ScanField crosshair; mouse only |
| `.swap-in` | a quick (0.5 s) arrival for content that changes after a choice, like the 404's look per mood |
| `::view-transition-*(.nav-forward / .nav-back / .page-fade / .nav-pill / site-header)` | page transitions: 150 ms out, 380 ms in; the header never moves |
| `.scroll-progress` | the 2px wine reading bar under the header, on `scroll(root)` |
| `.motion-loop` | **every infinite animation gets this class**: it is what pausing and reduced motion target |
| `.x-*` | the scan explainer timeline (one `--loop: 6s` shared by every part; per-item delays are fractions of `--loop`, so changing the duration keeps the choreography) |
| `.hotspot-ring` | the breathing ring around a garment dot on a pin |
| `.float-pin` (`--tilt`, `--float`) | a pin floating in place; the base style keeps the tilt when motion is off |
| `.sweep` | a scan line sweeping down its parent (the element is 10% tall and travels 1100% of itself) |
| `.blink` | the live dot and the terminal caret (`steps(1)`, so it ticks instead of fading) |

Components (`apps/web/src/components/motion/`):
- `InView.tsx`: wraps a section and sets `data-inview="true|false"` with an IntersectionObserver. Loops inside pause off-screen, so a long landing costs no CPU for what you can't see. `restart` rewinds clock-based animations each time the section enters (scroll-driven ones are skipped: setting their `currentTime` throws).
- `KineticText.tsx`: splits lines into masked words with stagger. Server component, no JS.
- `Loops.tsx`: `PinWall`, columns of two pins at their natural height in a `.scroll-row`, the uneven bottom faded with `mask-fade-b`. Without scroll timelines it is a plain horizontal scroller (`overflow-x-auto`).
- `Hud.tsx`: `ScanField` (crosshair, coordinates and the garment under the pointer, read from each pin's `data-garment`; it writes to the DOM inside a frame callback, so moving the mouse never re-renders React; mouse only), `LiveClock` (`useSyncExternalStore` on a 1 s interval) and `Brackets`.
- `MotionToggle.tsx`: the visible "Pausar movimiento" button. It stores the choice in localStorage (`useMotionPreference` in `lib/storage.ts`) and sets `data-motion="paused"` on `<html>`.
- `PageTransition.tsx`: React's `<ViewTransition>` with enter/exit classes per transition type. Every `page.tsx` wraps its content in it (layouts persist, so they never enter or exit). Links that change tab carry `transitionTypes={["nav-forward"]}` or `["nav-back"]` by tab order (Inicio, Escanear, Guardados); the Header does it for its tabs, and in-page CTAs to `/scan` set it by hand.

The landing itself is `components/landing/`: `Story.tsx` (the scroll-story hero with the network logos), `Sections.tsx` (problem, pin wall, benefits, Pinterest embed, closing CTA), `SocialLogos.tsx`, `Pin.tsx`, `Photo.tsx`, and `ScanExplainer.tsx`, whose `ScanDemo` now lives on `/scan` only. Its pins, hotspots and explainer data in `lib/landing.ts`, and the API's demo catalog, are generated by `apps/api/scripts/build_landing_assets.py`. The photo lists there keep menswear and womenswear balanced; change them and rerun, never edit the generated files by hand.

## Page transitions and tab speed

- `cacheComponents: true` in `next.config.ts` keeps the last visited routes mounted but hidden (React `<Activity>`, `display: none`), so going back to a tab shows it instead of rebuilding it. Effects run again when a page reappears; CSS animations restart too, which is what replays the tab banners. Hidden pages stay in the DOM: in tests use `getByRole` (it skips them) or check visibility.
- With cacheComponents, anything that reads the URL (`usePathname`, `params`) must sit inside a `<Suspense>`, or the build fails for `/look/[id]`. The Header wraps its tabs in one.
- The header is named (`viewTransitionName: "site-header"`), so it stays still while the page slides; the current tab's pill is a named `<ViewTransition name="nav-pill" share="nav-pill">` that morphs between tabs.
- Measured on a phone-speed CPU (4x throttle): a tab switch went from ~2 s to 0.25-0.7 s after a first visit (~1 s on the first). `npm run dev` is slower by nature (it compiles each page on first open; `scripts/warm.mjs` opens them at start). Judge speed with `npm run preview`.

## Rules that keep it fast

- Animate **only `transform` and `opacity`** (plus `clip-path` for small box draw-ins). Never width, height, top/left, `border-radius` or filters on large areas: they force layout or paint on every frame. The section-opening animation used to animate the radius; it repainted the whole section each frame.
- No `backdrop-filter` over content that moves (the scroll story's captions had a blur over the rising photo): use a solid `bg-paper/90`.
- Big sections below the fold get `content-visibility: auto` (`.page` has it), so the landing renders and reappears at the cost of what's on screen.
- Count loops in a section: one breathing ring per pin, not one per garment (the pin wall had 51 rings), and at most 20 pins in the wall.
- No JavaScript animation loops (`requestAnimationFrame` per frame, scroll listeners). CSS keyframes and scroll-driven timelines run on the compositor. JS only decides *whether* something plays (`InView`, `MotionToggle`), or follows the pointer once per frame while it moves (`ScanField`).
- Third-party widgets (the Pinterest embed) load their script once, and only when their section gets near the viewport.
- `will-change: transform` only on moving tracks, never on everything.
- Seamless loops: put the gap on each item (margin or padding), not on the track (`gap`), and duplicate the list once. Then `translate(-50%)` lands exactly where it started.
- Moving content never creates horizontal page overflow: the pin wall and the flying side pins live in an `overflow: hidden` container (the layout test catches it at every width).
- Photos in motion are small WebP files (~400px wide, ~40 KB) with width/height set; the hero photo is the exception (1080px, quality 82: it's the first thing seen and it's big). Only the first viewport loads eagerly. Measured first load of the landing: ~1.3 MB on desktop, ~1 MB on mobile. Don't let it grow without reason.
- Sizes that depend on a column (the hero headline) use container units (`cqw`) with an `@container` parent, never `vw`: the scrollbar and the gutters make `vw` overflow.

## Accessibility (not optional)

- **`prefers-reduced-motion: reduce`**: loops and reveals are off and the final state shows (the explainer shows photo + boxes + results at once; the scroll story becomes a static column with the boxes, readouts and three steps visible; the pin wall becomes a horizontal scroller).
- **Pause, stop, hide (WCAG 2.2.2)**: anything that moves for more than 5 seconds on its own needs a control. `MotionToggle` sits in the hero. Scroll-driven motion only moves while the visitor scrolls, so it needs no control.
- Duplicated and decorative motion content is `aria-hidden` with `alt=""`; the meaning lives in real text next to it.
- Never convey information only through motion: the explainer's steps are also written out as a list.

## Building a scroll story

The hero (`components/landing/Story.tsx` + the `.story-*` block in `globals.css`) is the model:
1. A tall section (`250svh`) with `view-timeline-name: --story` and a sticky stage of one viewport under the header (`top: 3.5rem; height: calc(100svh - 3.5rem)`). Every part animates on `animation-timeline: --story` with `animation-range: contain X% contain Y%`, so the whole story plays while the stage is pinned.
2. Keep a phase table in a comment above the block (0-16% headline leaves · 0-34% photo rises, pins fly in · 36-56% scan · 44-66% boxes · 62-82% readouts · captions follow the three beats). Change the table first, then the ranges.
3. All of it sits inside `@media (prefers-reduced-motion: no-preference) and (min-height: 600px) { @supports (animation-timeline: view()) {…} }`. Outside it, the same markup is a normal column: intro, photo with boxes and chips, the three steps. A phone held sideways (390px tall) has no room for a pinned stage, so it gets the column too.
4. What starts hidden must start out of the way: the photo begins below the fold (`translateY(115%) scale(.5)`), or it overlaps the headline on short screens. Captions take turns in one grid cell (`grid-area: 1/1`), and their heading fades in with the first one.
5. The headline is sized by its container (`cqw`) and the container's width is also capped by the stage height (`max-w-[min(64rem,calc((100svh-3.5rem)*0.9))]`). Without the cap it covered the button on a landscape iPad.
6. Check it frame by frame at real device sizes, including landscape: scroll to 0/30/55/85% of the story and screenshot each with a short Playwright script. Assert in tests with `mouse.wheel` and computed opacity, not with timeouts.

## Building a timeline explainer

Use the scan demo (`components/landing/ScanExplainer.tsx`) as the model:
1. One duration for everything (`--loop: 10s`) and a phase table in a comment. For example: 0-33% upload + scan line, 33-66% boxes + selection, 66-100% results.
2. Each part has its own keyframes, written in percentages of the loop. Siblings reuse one keyframe set with a small `animation-delay` (`--i`), keeping the last sibling's exit inside the loop.
3. Steps highlight in sync with the same trick: one "active for a third" keyframe, delayed by `n × loop / 3`.
4. The data behind it should be real. The demo boxes and similarity numbers come from YOLO and FashionCLIP run on that photo (`lib/landing.ts`, generated). Don't animate made-up numbers.
5. Grid items with `mx-auto` shrink to their content. A stage whose children are all absolute then collapses to 0×0, and the photo silently disappears; it happened on desktop while mobile looked fine. Fill the cell from `sm` (`sm:mx-0 sm:w-full`). The layout test now asserts the stage has a real size at every width.
6. Keep the stage within one viewport (at most ~36rem wide on desktop; on phones the photo shrinks and the results become one row underneath), or the viewer never sees all three phases at once.
7. Order for phones: heading → stage → steps. On desktop the heading and steps sit left and the stage spans both rows on the right (explicit grid rows plus `order-*` classes).

## Verifying motion

- `npm run check` includes `e2e/motion.spec.ts`. It checks that loops run on the landing, that "Pausar movimiento" and reduced motion actually stop them (`document.getAnimations()` play states), that scrolling drives the story (the headline fades out, the readouts appear), that the network logos are there, and that the CTA leads to `/scan`.
- For screenshots of clock-based explainers, freeze time instead of waiting: `document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; })`. For scroll-driven parts, scroll to a position instead.
- Look at phone (390×844), iPad mini and Air portrait (768×1024, 820×1180), iPad landscape (1180×820), phone landscape (844×390), laptop (1366×768) and desktop. The layout test only proves there is no overflow; overlaps show up in screenshots only.
- Measure, don't guess: a Playwright script with `Emulation.setCPUThrottlingRate` 4 (a mid-range phone) that counts long tasks, frames over 34 ms while scrolling, and click-to-visible time for tab switches measured inside the page (Playwright's own polling forces layouts and inflates the numbers). A Chrome trace grouped by event name tells style, layout, paint and React (`MessagePort::Accept`) apart.
- `e2e/nav.spec.ts` checks the three tabs, the wine pill on the current one, the phone labels and that a tab switch runs a view transition.
