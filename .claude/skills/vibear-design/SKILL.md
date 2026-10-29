---
name: vibear-design
description: Vibear's visual design system and UI rules. Editorial fashion minimalism (oversized didone type, white space, monochrome, sharp UI chrome, uppercase micro labels) crossed with a Pinterest-style discovery grid (masonry, rounded image cards, hover actions, save-to-board). Use this skill whenever you create or change anything in apps/web, including pages, components, Tailwind classes, colors, fonts, copy, loading/empty/error states, images or layout, even a small tweak to one button. Also use it when the user mentions the Vibear look, design, UI, frontend, grid, cards, branding or "make it look better".
---

# Vibear design

Vibear is "a fashion scanner": the restraint of a fashion editorial (Bodoni display type, white space, sharp chrome) on a black stage, with the HUD of a scanning tool (monospace labels, measuring grid, crosshair, live readouts) and the density of a Pinterest feed. Photos glow on black; wine is the signal. It should feel cool, precise and fast, never cluttered.

Two strands of DNA, and one rule that decides which applies where:

| | Editorial (the chrome) | Discovery (the content) |
|---|---|---|
| Applies to | header, type, buttons, inputs, labels, page structure | photos, crops, product cards, grids |
| Shape | sharp corners, 1px hairlines | `rounded-media` (12px) |
| Colour | ink on paper, with wine as the one signal colour | the photos bring the colour |
| Rhythm | generous white space, few elements | dense masonry, many items |
| Motion | almost none | soft fade-in, hover overlays |

**Chrome is sharp, media is soft.** If you are unsure whether something is chrome or content, ask: is it a picture of clothing? Then it is content.

This is an original identity. It borrows moods, not marks: never use another brand's logo, typeface, colour (no Pinterest red) or name in the UI.

## Tokens

The source of truth is the `@theme` block in `apps/web/src/app/globals.css`. Use the utilities those tokens generate and never hard-code hex values or font sizes in components. When a new value is genuinely needed, add a token first, so the next change stays consistent.

| Utility | Value | Use |
|---|---|---|
| `text-ink` / `bg-ink` | `#f2efe9` | text (near white), borders that matter, the primary button |
| `bg-paper` | `#0a0a0b` | the black stage (page background) |
| `bg-surface` | `#141416` | image placeholders, skeletons |
| `surface-strong` | `#1f1f22` | the bright band of the skeleton shimmer |
| `border-line` | `#2a2a2e` | hairline dividers |
| `text-muted` | `#8f8f96` | secondary text (~6:1 on the stage, passes AA) |
| `wine` / `wine-deep` | `#6b1523` / `#4e0e19` | wine fills: the closing story section, deep hovers |
| `wine-bright` | `#e8546c` | the readable wine on black (5.5:1): accent words, hotspots, selection glow, live dot, HUD keys, button hover |
| `blush` | `#2a1418` | quiet wine tint on black: badges like "Marca de tus resultados" |
| `cream` | `#f7f0e8` | text and buttons on wine sections (14:1 on wine) |
| `font-display` | Bodoni Moda | wordmark, page titles, big numbers. Nothing else |
| `font-sans` | Inter Tight | body copy (the default) |
| `font-mono` | Geist Mono | the HUD voice: `text-micro` uses it; terminal lines and counters too |
| `text-micro` | 11px mono, uppercase, 0.08em tracking, 500 | nav, buttons, labels, metadata, readouts (an `@utility`) |
| `text-terminal` | `clamp(1.05rem, 2.4vw, 1.875rem)` | terminal lines and big counters (with `font-mono`) |
| `bg-grid` | 56px, 1px lines | the measuring grid behind scanner areas (hero, drop zone) |
| `text-small` / `text-body` | 13px / 15px | captions and help text / body copy |
| `text-title` | `clamp(2.25rem, 5vw, 3.75rem)` | page and results titles (display face) |
| `text-numeral` | `clamp(2.5rem, 4vw, 3.5rem)` | editorial step numbers `01 02 03` |
| `text-hero` | `calc(100cqw / 3.7)` | the giant wordmark; needs an `@container` parent |
| `rounded-media` | 12px | photos and product cards only |
| `ease-out-soft` | `cubic-bezier(.2,.8,.2,1)` | all transitions |
| `animate-scan` / `animate-shimmer` | | detecting line / skeletons |

Shared class strings live in `components/ui.tsx`: `primaryButton` (white on black, wine-bright on hover: the only filled action style), `creamButton` (the primary action on a wine section), `outlineButton` (secondary: 1px ink frame), `textButton` (underlined micro label), plus `Notice`, `Icon` and `cx`. HUD pieces live in `components/motion/Hud.tsx`: `Brackets` (corner marks around a scanned area), `LiveClock`, `ScanField` (the crosshair).

### Using wine

Wine is what gives the page life, and it works because it is rare. On black, text and strokes use `wine-bright`; `wine` is for fills. Use it for:
- the primary button's hover (the button itself is white on the stage);
- what is selected or saved: the chosen garment, a saved bookmark, the active nav underline;
- the garment hotspots on pins;
- one accent word in a display heading: "*Encontralo.*", "se puede *buscar*";
- at most two full-bleed wine sections per page, as story beats (on the landing: the problem and the closing CTA).

Never use it for body text or decoration, and never for two competing things in one view. On a wine section, text is cream (secondary at `cream/70-80`) and the button is `creamButton`.

### The HUD voice

What makes Vibear cool is the scanner personality, applied with restraint:
- monospace micro labels everywhere (`VIBEAR/SCAN v1.0`, `● EN VIVO`, `01 / INPUT`);
- real readouts only: the live clock, pin and garment counts, YOLO confidences, FashionCLIP similarities. Never fake stats;
- one terminal joke per page where it makes the point (`¿dónde_comprarlo? ... ERROR 404`, then "Vibear arregla ese *404*.");
- the measuring grid and corner brackets around areas that get scanned.

One theme, dark, on purpose: the scanner is the personality, and photos glow on black. A second theme would double the QA for little gain. Lines drawn over photos are white with a dark halo (or white with `mix-blend-difference`), so they read on any picture. The wine closing section is the one colour beat.

## Typography

- The display face is for moments: the giant `VIBEAR` wordmark, a page title, the step numbers. Keep display text short (1-4 words), with tight tracking and line-height under 1.
- Body copy stays at `text-small`/`text-body` in Inter Tight, sentence case, max ~60ch per line.
- Micro labels carry the editorial voice: `NUEVA BÚSQUEDA`, `GUARDADOS (3)`, `06 PRENDAS`. Use them for navigation, buttons, section labels and metadata, never for anything longer than ~4 words.
- Numbers that compare (similarity %, prices, counts) use `tabular-nums`.
- Put `tracking-[…em]` on the **same element** as the font size. Letter-spacing in `em` resolves against the element that declares it, so tracking on a parent of `text-hero` uses the parent's 15px and the wordmark overflows.

## Layout

- Gutters: `px-4` on mobile, `lg:px-8` from 1024px. No horizontal scroll at any width, ever.
- Grids go full-bleed inside the gutters. Text blocks get a max width.
- Header (`components/Header.tsx`): sticky, white, one hairline, wordmark left, micro-label nav right, 56px tall. The active link is underlined with a 6px offset.
- The look page (`components/LookView.tsx`) splits on `lg`: a sticky left column (5/12) with the photo and the garment rail, which scrolls on its own if it is taller than the window, and results on the right (7/12). On mobile: photo (max 55vh), then a horizontal rail, then results.
- Vertical rhythm comes from space, not boxes. Prefer a hairline or a gap over a bordered card.

## The masonry grid

Results are a ranked list, so the best match must sit in the top row, and keyboard and screen-reader order must follow the rank. CSS `columns` fills top to bottom, which breaks both. Use `components/MasonryGrid.tsx`, which calls `layoutMasonry()` from `lib/masonry.ts`:

- Each item goes to the currently shortest column, absolutely positioned, with the DOM kept in rank order.
- Heights come from known aspect ratios plus a **fixed caption height** (`CARD_CAPTION` in `ProductCard.tsx`). The layout is final before any image loads, so nothing shifts. If you change what a caption shows, keep its height fixed and update the constant.
- Column count comes from the container width (`minColumnWidth`, `maxColumns`), never from the viewport, so the same grid works full width or inside the look page. The gap is 8px under 640px, 16px above.
- Ratios come from `thumbnail_width/height` (the API measures the thumbnail it downloaded), with `ratioOf()` falling back to 3:4.

## Components

All in `apps/web/src/components/`. Reuse before you create, and when you create, follow the closest existing one.

- **Uploader**: a sharp 1px ink frame and the only drop target. Accepts drag and drop, file picker, paste (Ctrl/Cmd+V anywhere) and an image link. It downscales in the browser (`lib/resize.ts`) before uploading. While detecting, the preview shows a scan line (`mix-blend-difference`, so it reads on any photo).
- **LookCanvas**: the photo with numbered garment boxes, drawn as a double line (paper + ink) so they read on dark and light photos. Its width is derived from the height cap, so the box is final before the image loads. The boxes are mouse shortcuts (`aria-hidden`); the rail is the accessible control.
- **GarmentRail**: one button per garment: crop (`rounded-media`), `01` + Spanish label, confidence. `aria-pressed` marks the selection, together with a 2px ink outline. A horizontal scroller with `snap-x` needs `scroll-px-*` equal to its padding, or the first tile snaps flush to the screen edge.
- **ProductCard**: image (aspect reserved) → source in muted micro → title (2 lines max) → price and `87% similitud`. On hover a 20% ink overlay fades in with `VER EN TIENDA ↗`. Reveal on `group-hover` and on `group-has-[a:focus-visible]`, never on `focus-within`, because a mouse click leaves focus behind and the label would stay stuck.
- **SaveButton** (in ProductCard): a 40px white square with an ink bookmark, filled when saved. Hidden until hover only on `pointer-fine` devices, so it is always visible on touch and once saved. Saved items live in localStorage (`lib/storage.ts`) and feed `/saved`, the moodboard.
- **FadeImage**: every image goes through it. It fades in on load, degrades to a "Sin imagen" placeholder and sets `loading="lazy"` and `referrerPolicy="no-referrer"`. It is plain `<img>` on purpose: thumbnails come from hundreds of shop domains, which `next/image` remote patterns can't list.
- **Notice** (in ui.tsx): one line between hairlines, for the demo banner and recoverable errors. Pass `urgent` for `role="alert"`.
- **NearbyPanel**: "Buscar en mi zona" on the look page. Location comes from the device, typed text or a Google Maps link; it shows OpenStreetMap shops with the brands of the results first (`blush` badge), each linking to Google Maps directions. It credits OpenStreetMap and says the location stays in the browser.
- **Pins** (`components/landing/Pin.tsx`): landing photos with wine hotspot dots on each detected garment and a one-word caption (`shortLabelFor`). Hover chips show label and confidence; pass `labels={false}` inside a ScanField. The landing, `/scan` and the empty `/saved` reuse pins as representative images; pages read them with `getLanding()` (`lib/landing-data.ts`) and pass them down as props.
- **Photos you don't own** (Pinterest, Instagram): never copy them into the site or the repo. Show them with Pinterest's official embed (`PinterestEmbeds`, configured by `NEXT_PUBLIC_PINTEREST_BOARD` or `NEXT_PUBLIC_PINTEREST_PINS`), or keep them in `apps/web/local-photos/` (gitignored), built by `npm run photos` and shown by `npm run dev` only.
- **Skeletons**: `ResultsSkeleton` and `LookSkeleton` are `bg-surface` shapes of the real layout with a slow shimmer.
- **RecentLooks** / **SavedBoard**: the masonry reused for the user's history and board.

## Imagery

- Always reserve space before the image loads (`aspect-ratio`), on `bg-surface`.
- Fade in on load (~500ms). Never stretch: `object-cover` inside a reserved box.
- Alt text = the product title, or the garment label for crops.

## Motion

Motion has its own skill, **vibear-motion**: read it before touching any animation. The split it defines:
- The landing (`/`) tells the story with expressive motion: kinetic type, drifting photo columns, marquees and the scan explainer.
- The tool screens (`/scan`, `/look`, `/saved`) stay restrained: 150-250ms (500ms for image fade-in), `ease-out-soft`, opacity and transform only, no bounce, no parallax, no hover lift on cards. The restraint is the luxury.
- Tailwind's `hover:` already applies only on devices that can hover. Put loops behind `motion-safe:` or the `.motion-loop` class.

## Voice and copy

Spanish, Rioplatense voseo, short and confident. Micro labels in uppercase (the utility does it, so write them in sentence case in the JSX); help text in sentence case. Say what happens next, not what went wrong in the abstract.

| Instead of | Write |
|---|---|
| "Upload your image here to begin the search process" | `SUBÍ UNA FOTO` / "Arrastrá una imagen, pegala con Ctrl+V o elegí un archivo." |
| "Error 503" | "La búsqueda está apagada. Agregá tu key de SerpApi en apps/api/.env o activá DEMO_SEARCH=true." |
| "No results found" | "Google Lens no encontró nada para esta prenda. Probá con otra." |
| "Loading..." | `DETECTANDO PRENDAS…` (with the scan line) |

API errors become sentences in one place, `MESSAGES` in `lib/api.ts`. Garment classes map to Spanish in `lib/labels.ts` (`long_sleeved_outwear` → "Abrigo manga larga"). Add new ones there, never inline.

## States

Design every screen in four states before calling it done: loading (skeleton or scan), empty (one sentence + one action), error (specific + recovery action, such as `Reintentar`) and success. Demo mode adds a fifth: a Notice saying the results are the user's own photos, not products.

## Accessibility

- Visible focus everywhere (a global `:focus-visible` outline in ink). Inputs that hide their own outline move it to the wrapper with `focus-within:outline-*`.
- Real buttons and links, no clickable divs. Icon-only buttons get an `aria-label` that names the item ("Guardar: <title>").
- Touch targets at least 40px.
- Colour is never the only signal: a selected garment gets a thicker outline *and* `aria-pressed`.
- Next renders its own empty `role="alert"` route announcer, so tests must filter alerts by text.

## Performance

- No UI kits or icon libraries: icons are path strings in `ui.tsx` (`icons.bookmark`...).
- Fonts through `next/font` (self-hosted, no layout shift).
- Client components only where there is interaction. Data is fetched in the browser through `/api` (proxied to FastAPI by `next.config.ts`).

## Before you call a UI change done

1. `npm run check` from the repo root: API tests, typecheck, lint with zero warnings, production build, and the Playwright suite (flows plus no horizontal overflow at 360, 768, 1024 and 1440px).
2. Look at the screenshots the layout test leaves in `apps/web/test-results/`, or run the app (`npm run dev`) and check the changed screen at mobile and desktop width. A passing build says nothing about whether it looks right, and the mock images in the tests are flat colour: check real photos too.
