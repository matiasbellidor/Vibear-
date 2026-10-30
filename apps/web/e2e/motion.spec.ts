import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./mock-api";

// Infinite loops are what pausing and reduced motion must stop (see .claude/skills/vibear-motion).
const runningLoops = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((a) => a.playState === "running" && (a.effect as KeyframeEffect).target?.closest(".motion-loop")).length,
  );

test("the landing tells the story and ends in a button to the scanner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Lo viste. Encontralo." })).toBeVisible();
  for (const name of ["El problema", "Todo lo que ves se puede buscar.", "Cómo funciona", "Para qué sirve", "¿Qué viste hoy?"]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeAttached();
  }
  await expect(page.getByRole("list").filter({ hasText: "Subí una captura" })).toContainText("Detectamos cada prenda");

  const finalCta = page.getByRole("link", { name: "Empezá a escanear" }).last();
  await finalCta.scrollIntoViewIfNeeded();
  await finalCta.click();
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByRole("heading", { level: 1, name: "Escaneá un look" })).toBeVisible();
});

test("loops run, and the pause button stops them (and is remembered)", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => runningLoops(page)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Pausar movimiento" }).click();
  await expect.poll(() => runningLoops(page)).toBe(0);
  await expect(page.getByRole("button", { name: "Reanudar movimiento" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Reanudar movimiento" })).toBeVisible();
  await expect.poll(() => runningLoops(page)).toBe(0);
});

test("reduced motion: nothing animates and the scroll story shows its final state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("heading", { name: "Cómo funciona" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  // Static column: headline, photo with its garment boxes and readouts, and the three steps.
  await expect(page.locator(".story-box").first()).toHaveCSS("opacity", "1");
  await expect(page.locator(".story-chip").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Lo viste. Encontralo." })).toBeVisible();
});

test("the hero names the networks where you find the clothes", async ({ page }) => {
  await page.goto("/");
  for (const name of ["Pinterest", "Instagram", "TikTok"]) {
    await expect(page.getByRole("img", { name, exact: true })).toBeVisible();
  }
});

test("scrolling drives the story: the headline leaves and the readouts appear", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const intro = page.locator(".story-intro");
  await expect(intro).toHaveCSS("opacity", "1");
  // Scroll most of the way through the story's sticky stage.
  const height = await page.locator(".story").evaluate((el) => el.getBoundingClientRect().height);
  await page.mouse.wheel(0, height * 0.75);
  await expect.poll(() => intro.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(0.05);
  await expect.poll(() => page.locator(".story-chip").first().evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.95);
});

test("the pin wall moves on its own and slows down under the mouse", async ({ page }) => {
  await page.goto("/");
  const wall = page.locator(".marquee");
  const loop = (key: "playState" | "playbackRate") => wall.evaluate((el, key) => el.getAnimations()[0]?.[key], key);
  await wall.hover();
  await expect.poll(() => loop("playState")).toBe("running");
  await expect.poll(() => loop("playbackRate")).toBeLessThan(1);
  await page.mouse.move(0, 0);
  await expect.poll(() => loop("playbackRate")).toBe(1);
});

test("a visitor without a screenshot can try an example", async ({ page }) => {
  await mockApi(page);
  await page.goto("/scan");
  await page.getByRole("button", { name: "Probar con el ejemplo 1" }).click();
  await expect(page).toHaveURL(/\/look\//);
});

test("photo credits list every landing photo, with a link to its source", async ({ page }) => {
  await page.goto("/creditos");
  const items = page.getByRole("main").getByRole("listitem");
  expect(await items.count()).toBeGreaterThanOrEqual(25);
  await expect(items.first().getByRole("link")).toHaveAttribute("href", /^https:\/\/commons\.wikimedia\.org\//);
});
