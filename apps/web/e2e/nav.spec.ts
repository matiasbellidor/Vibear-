import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

const WINE = "rgb(107, 21, 35)";

test("three tabs, and the current one is a rounded wine pill", async ({ page }) => {
  await mockApi(page);
  await page.goto("/scan");
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link")).toHaveText([/Inicio/, /Escanear/, /Guardados/]);

  const current = nav.getByRole("link", { name: "Escanear" });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(current.locator("span").first()).toHaveCSS("background-color", WINE);
  // Fully rounded: the radius is at least half the pill's height.
  const pill = await current.locator("span").first().evaluate((el) => ({
    radius: parseFloat(getComputedStyle(el).borderTopLeftRadius),
    height: el.getBoundingClientRect().height,
  }));
  expect(pill.radius).toBeGreaterThanOrEqual(pill.height / 2);
  await expect(nav.getByRole("link", { name: "Inicio" }).locator("span").first()).not.toHaveCSS("background-color", WINE);

  await nav.getByRole("link", { name: "Inicio" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
});

test("on a phone only the current tab shows its name, and every tab keeps it for screen readers", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockApi(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByText("Inicio")).toBeVisible();
  await expect(nav.getByRole("link", { name: "Escanear" })).toBeVisible();
  await expect(nav.getByText("Escanear")).toHaveClass(/sr-only/);
});

test("switching tabs plays a view transition", async ({ page }) => {
  await mockApi(page);
  await page.goto("/scan");
  const nav = page.getByRole("navigation", { name: "Principal" });
  const sawTransition = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const start = performance.now();
        const check = () => {
          if (document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition")))
            resolve(true);
          else if (performance.now() - start > 4000) resolve(false);
          else requestAnimationFrame(check);
        };
        check();
      }),
  );
  await nav.getByRole("link", { name: "Guardados" }).click();
  expect(await sawTransition).toBe(true);
  await expect(page.getByRole("heading", { level: 1, name: "Guardados" })).toBeVisible();
});
