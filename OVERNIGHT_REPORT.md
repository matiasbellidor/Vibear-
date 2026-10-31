# Overnight report · 2026-10-31

Brief: turn Vibear into a premium aesthetic-advice app (style, colour analysis, closet, scanner, weekly outfits, fragrances), implement, test, commit, push and document. Everything below is on `main` at https://github.com/matiasbellidor/Vibear-.

## Summary

| Priority | Item | Status |
|---|---|---|
| P0 | Performance, no freezes, instant tabs | ✅ improved and measured (details below) |
| P0 | Closet persistence | ✅ already in place (localStorage + anonymous API backup), verified |
| P0 | Temporary / anonymous user | ✅ new: a UUID on the first visit + `/v1/profile`, same anonymous cookie as the closet |
| P0 | Home tab, distinct active tab, tab animation | ✅ already in place (Inicio tab, wine pill that morphs, slide transitions), verified |
| P0 | Scan and Saved visuals when tapped | ✅ already in place (`ScanBanner`, `ClosetBanner`), verified |
| P0 | Genuinely similar results | ✅ new colour-aware ranking, calibrated on fixtures |
| P1 | Onboarding, style quiz, colour analysis | ✅ new: `/estilo` |
| P1 | 404 redesign | ✅ extended (style test CTA, links to every section) |
| P1 | Weekly outfits for men and women with shop links | ✅ already in place; now personalised (*Para vos*) |
| P1 | Pinterest board https://pin.it/YVQUHF1HU | ✅ already integrated (see decisions) |
| P2 | Fragrance section, glowing welcome, price comparison, WhatsApp CTA | ✅ welcome added; comparison and CTA already in place, verified |
| P2 | README, admin guide, this report | ✅ |

## What was implemented

### Similarity that respects colour (P0)
- `apps/api/app/colorsig.py`: a colour signature per picture (median CIELAB of its middle 60%, studio white left out; a white garment keeps its white).
- `apps/api/app/rerank.py`: similarity = CLIP look ± up to 0.05 by colour agreement (`COLOR_WEIGHT = 0.1`). The category filter and the 0.55 floor still judge the look alone, as calibrated.
- Calibration on the demo catalog (73 real garment crops, 52 usable queries, top 5 of the same family from other photos): colour distance 26.7 → 22.6 (−15%), CLIP similarity 0.677 → 0.673. Higher weights bought little colour and started to cost look.
- Limitation: Google Lens results need `SERPAPI_API_KEY`; without it the demo catalog stands in (labelled). That, not the ranking, is why searches looked "more or less similar" before.

### Performance (P0)
- Perfume photo cut-outs moved to a Web Worker (`lib/cutout.worker.ts`, OffscreenCanvas; the algorithm in `lib/cutout-core.ts`, a main-thread fallback kept). Long tasks while scrolling the landing on a laptop CPU: 5 tasks / 389 ms → **0**.
- Tab switches (production, laptop CPU): new page visible in **35–161 ms**, transition finished in **344–550 ms** (it was 530–750 ms before yesterday's shorter transitions).
- Compositor-only animations: the scan demo's boxes (looped `clip-path`, a style recalc every frame) and the hero's boxes now grow with `scale`; the hero intro's `visibility` is its own tiny animation.
- Bug fixed: the style test now starts each question at the top (after the tall styles grid the next question opened scrolled down).

### Anonymous user and profile (P0)
- `apps/web/src/lib/profile.ts`: on the first visit the browser makes up a UUID; the profile (status, style answers, colour result) lives in localStorage and is backed up with `GET/PUT /v1/profile` under the closet's HttpOnly cookie (one anonymous user). Newest copy wins. The server only creates a file once the visitor saves, answers or skips, so bots create nothing.
- API: `Profile`, `StyleAnswers`, `ColorResult` in `app/schemas.py` (short ASCII keys only, size-capped), `profiles/<id>.json` in `app/storage.py`, 4 new tests.
- No login (the owner chose this earlier). `ADMIN_GUIDE.md` explains what is stored, how to count, erase and clean up.

### Style test and colour analysis (P1)
- `/estilo` (`components/style/StyleTest.tsx`): 11 questions, one per screen, every one skippable and the whole test too, mobile-first, animated steps.
  - Style: who you dress, styles (picked on real looks of each style), days, goals, budget in pesos.
  - Colour: veins, gold/silver, sun, natural hair, eyes, skin → undertone, depth, contrast, chroma → one of 12 seasons (`lib/colorimetry.ts`, deterministic).
- Result (`StyleResult.tsx`): season, palette, neutrals, colours to avoid near the face, metals, outfit ideas, style chips, a tip per goal, looks for you, a downloadable 1080×1350 style card (`lib/style-card.ts`), retake.
- Personalisation:
  - weekly outfits put your gender and styles first, marked *Para vos*;
  - a scanned garment says "Va con tu paleta" / "Fuera de tu paleta" (the API now returns each garment's colour name);
  - the closet shows your palette;
  - the landing has a wine invitation section and a line next to the hero's scroll hint, both showing your season once you have one.

### 404 (P1)
Already an editorial 404 (giant 404 filled with a look, mood-based looks with shop links, another look on demand). Added: the style test as the first action, and links to Inicio, Escanear, Outfits de la semana, Perfumería, Probador and Guardados.

### Fragrances (P2)
- The perfume film (three magazine covers, built yesterday) now opens like the hero: the three real bottles rise from behind "Potenciá tu outfit con una fragancia", glow in their own colour over an amber-to-turquoise halo, float, and fly apart as the film starts. On phones, only the featured bottle.
- Price comparison across Argentine shops and the WhatsApp CTA (`https://wa.me/5491168300606` with a prefilled message) were already in place and are covered by E2E tests.

### Docs
- `README.md`: a new cover (vision, feature table, badges, screenshots), environment variables, look-and-colour ranking, worker cut-outs, anonymous user, style test, troubleshooting, credits, updated roadmap.
- `ADMIN_GUIDE.md` (new), `apps/api/.env.example` (all settings), `CLAUDE.md`, and the two design and motion skills updated.
- `docs/screenshots/`: two real screenshots of screens without third-party photos.

## Decisions and assumptions
- **No login.** The owner chose an anonymous closet earlier; the brief says not to force login. The anonymous cookie id is the bridge if accounts come later.
- **Argentina only, in pesos.** The project's standing rule: shops, prices and links stay Argentine.
- **Real perfume photos, not placeholders.** The brief suggested licensed placeholders, but the owner explicitly asked for the real bottles. They are the shops' own photos, hotlinked and cut out in the visitor's browser, never stored or committed.
- **Pinterest.** https://pin.it/YVQUHF1HU resolves to the owner's own board (`vibear`). It is already the first board in "Inspo de tableros" (Pinterest's official embed), and its 5 pins (3 menswear outfits, 2 flat lays) are already in the gitignored `apps/web/local-photos/`, used in development only. No pins were copied into the repo or a published build, by the project's rule.
- **Colour analysis is a guide.** Six self-reported answers can't replace a draping session; the result page says it gives the season, and the logic is deterministic and readable.
- **Screenshots in the README** only show screens without third-party photos.

## Files and routes
- New routes: `/estilo`; API `GET/PUT /v1/profile`; `/v1/detect` items now include `color`.
- New files:
  - API: `apps/api/app/colorsig.py`, `apps/api/tests/test_profile.py`.
  - Web libraries: `apps/web/src/lib/{profile,colorimetry,style,style-card,cutout-core,cutout.worker}.ts`.
  - Web components and route: `apps/web/src/components/style/{StyleTest,StyleResult,StyleEntry}.tsx`, `apps/web/src/app/estilo/page.tsx`.
  - Tests: `apps/web/e2e/style.spec.ts`.
  - Docs: `ADMIN_GUIDE.md`, `OVERNIGHT_REPORT.md`, `docs/screenshots/*`.
- Changed:
  - API: `rerank.py`, `main.py`, `schemas.py`, `storage.py`, `ml/describe.py`.
  - Web: `cutout.ts`, `storage.ts`, `api.ts`, `Header.tsx`, `LookView.tsx`, `SavedBoard.tsx`, `LostAndFound.tsx`, `landing/{Story,WeeklyOutfits,PerfumeFilm}.tsx`, `app/page.tsx`, `globals.css`, `e2e/mock-api.ts`.
  - Docs: README, `CLAUDE.md`, the two skills, `.env.example`.

## Tests and build
- `npm run check` (API tests, typecheck, lint with zero warnings, production build, Playwright): **99 API tests and 69 E2E tests pass** (5 new E2E: the style test end to end and persisted, skipping it, the palette badge on a look, *Para vos* outfits, the 404's exits; 5 new API tests: profile backup and colour-aware ranking).
- After the last CSS change (compositor-only hero), the motion, navigation and layout specs were run again: 46/46.

## Commits (all pushed to `main`)
- `682af4f` Rank search results by colour as well as look
- `d25376c` Cut out perfume photos in a worker, off the main thread
- `66d86eb` Style test with colour analysis, on an anonymous profile
- `de20b5a` Perfume film welcome: glowing bottles around the title
- the commit that adds this report: docs, the admin guide, screenshots, the test's scroll fix and the compositor-only hero

## Known issues and next steps
- **SerpApi key:** real shop results need `SERPAPI_API_KEY` and `DEMO_SEARCH=false` in `apps/api/.env`.
- **Low-end phones:** scrolling the hero costs ~37 ms of main-thread work per frame with a 4x CPU throttle (~9 ms on a laptop). Next: fewer animated layers in the hero on phones (glow filters, loops while scrolling).
- **Dev vs production speed:** `npm run dev` switches tabs in 0.5–1.1 s (debug React, on-demand compiling). Judge speed with `npm run preview`.
- **Licences before monetising:** YOLO (AGPL-3.0) and DeepFashion2 weights (non-commercial); see the README.
- **Ideas not built tonight:**
  - weekly outfit planner;
  - "cost per wear" in the closet;
  - price alerts on saved items (needs an own catalogue or affiliate feeds);
  - a palette generator from any scanned photo (the colour signature makes it easy now).

## How to run, administer and continue
```bash
npm run setup      # once
npm run dev        # API :8000 + web :3000 (your local photos and friends' boards show in dev only)
npm run preview    # production build: the real speed
npm run check      # before every commit
```
- Real search: put a free SerpApi key in `apps/api/.env` (`SERPAPI_API_KEY=...`, `DEMO_SEARCH=false`) and restart.
- Pinterest boards: `NEXT_PUBLIC_PINTEREST_BOARD` in `apps/web/.env.local` (comma-separated; also needed in the hosting's env vars when you publish).
- Anonymous users: see `ADMIN_GUIDE.md` (count, erase one visitor, clean up, backups).
- Continue: the conventions are in `CLAUDE.md` and `.claude/skills/` (design and motion); the roadmap is in the README.
