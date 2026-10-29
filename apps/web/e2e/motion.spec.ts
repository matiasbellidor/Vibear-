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
  await expect(page.getByRole("list").filter({ hasText: "Subí una captura" })).toContainText("Elegí la prenda");

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

test("reduced motion: nothing animates and the explainer shows its final state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("heading", { name: "Cómo funciona" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  const card = page.locator(".x-card").first();
  await expect(card).toHaveCSS("opacity", "1");
});

test("a visitor without a screenshot can try an example", async ({ page }) => {
  await mockApi(page);
  await page.goto("/scan");
  await page.getByRole("button", { name: "Probar con el ejemplo 1" }).click();
  await expect(page).toHaveURL(/\/look\//);
});

test("photo credits list every landing photo", async ({ page }) => {
  await page.goto("/creditos");
  await expect(page.getByRole("listitem")).toHaveCount(26);
});
