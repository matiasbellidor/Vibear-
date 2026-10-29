import { expect, test, type Page } from "@playwright/test";
import { LOOK, matches, mockApi } from "./mock-api";

const WIDTHS = [360, 768, 1024, 1440];

const ROUTES: { name: string; path: string; ready: (page: Page) => Promise<void> }[] = [
  {
    name: "landing",
    path: "/",
    ready: (page) => expect(page.getByRole("heading", { level: 1, name: "Lo viste. Encontralo." })).toBeVisible(),
  },
  {
    name: "scan",
    path: "/scan",
    ready: (page) => expect(page.getByRole("list", { name: "Tus looks recientes" })).toBeVisible(),
  },
  {
    name: "credits",
    path: "/creditos",
    ready: (page) => expect(page.getByRole("heading", { level: 1, name: "Créditos" })).toBeVisible(),
  },
  {
    name: "look",
    path: `/look/${LOOK.image_id}`,
    ready: (page) => expect(page.getByRole("article").first()).toBeVisible(),
  },
  {
    name: "saved",
    path: "/saved",
    ready: (page) => expect(page.getByRole("article").first()).toBeVisible(),
  },
];

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`${route.name} has no horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page);
      // Seed per-browser state so every screen renders with content.
      await page.addInitScript(
        ({ look, saved }) => {
          localStorage.setItem(
            "vibear:recent",
            JSON.stringify([{ image_id: look.image_id, width: look.width, height: look.height, count: 2, at: 1 }]),
          );
          localStorage.setItem("vibear:saved", JSON.stringify(saved.map((m) => ({ ...m, savedAt: 1 }))));
        },
        { look: LOOK, saved: matches("guardado", 6) },
      );

      await page.goto(route.path);
      await route.ready(page);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);

      await page.screenshot({ path: testInfo.outputPath(`${route.name}-${width}.png`), fullPage: true });
    });
  }
}
