import { expect, test } from "@playwright/test";
import { PNG, mockApi } from "./mock-api";

const photo = { name: "yo.png", mimeType: "image/png", buffer: PNG };

test("the fitting room: your photo, your garments cut out, tried on, moved, and still there tomorrow", async ({ page }) => {
  await mockApi(page);
  await page.goto("/outfits");
  await expect(page.getByRole("heading", { level: 1, name: "Armá tu outfit." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Outfits" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByLabel("Subí tu foto de cuerpo entero").setInputFiles(photo);
  await expect(page.getByRole("img", { name: "Tu foto" })).toBeVisible();

  // One outfit photo: the top and the trousers come out separately, and go straight on.
  await page.getByLabel("Sumar prendas").setInputFiles(photo);
  const wardrobe = page.getByRole("region", { name: "Tu ropero" });
  await expect(wardrobe.getByRole("button", { name: "Remera blanca", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(wardrobe.getByRole("button", { name: "Jean azul", exact: true })).toHaveAttribute("aria-pressed", "true");
  const top = page.getByRole("img", { name: "Llevás puesto: Remera blanca" });
  await expect(top).toBeVisible();
  await expect(page.getByRole("img", { name: "Llevás puesto: Jean azul" })).toBeVisible();

  // Fitted to the body: the top spans the shoulders, from just above them.
  const placed = await top.evaluate((el) => ({ left: parseFloat(el.style.left), width: parseFloat(el.style.width) }));
  expect(placed.left).toBeCloseTo(30, 0);
  expect(placed.width).toBeCloseTo(40, 0);

  // Select it, make it bigger, take the trousers off.
  await top.click();
  const before = placed.width;
  await page.getByRole("button", { name: "Agrandar" }).click();
  await expect.poll(() => top.evaluate((el) => parseFloat(el.style.width))).toBeGreaterThan(before);
  await wardrobe.getByRole("button", { name: "Jean azul", exact: true }).click();
  await expect(page.getByRole("img", { name: "Llevás puesto: Jean azul" })).toHaveCount(0);

  // Kept on this device.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole("img", { name: "Llevás puesto: Remera blanca" })).toBeVisible();
  await expect(wardrobe.getByRole("button", { name: "Jean azul", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("a photo that isn't a full body is explained, not ignored", async ({ page }) => {
  await mockApi(page);
  await page.route("**/api/v1/tryon/body", (route) => route.fulfill({ status: 422, json: { detail: "No full body found" } }));
  await page.goto("/outfits");
  await page.getByLabel("Subí tu foto de cuerpo entero").setInputFiles(photo);
  await expect(page.getByRole("alert").filter({ hasText: "cuerpo entero" })).toContainText("de pies a cabeza");
});
