import { expect, test } from "@playwright/test";
import { LOOK, PNG, closetBackup, matches, mockApi, nearbyCalls } from "./mock-api";

test("upload, pick a garment, see ranked results and save one to the board", async ({ page }) => {
  const searched = await mockApi(page);
  await page.goto("/scan");
  await expect(page.getByRole("heading", { name: "Mostranos el look" })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "look.png", mimeType: "image/png", buffer: PNG });
  await expect(page).toHaveURL(new RegExp(`/look/${LOOK.image_id}`));
  await expect(page.getByRole("heading", { level: 1, name: "Abrigo manga larga" })).toBeVisible();

  const results = page.getByRole("list", { name: "Resultados para Abrigo manga larga" });
  await expect(results.getByRole("article")).toHaveCount(12);
  // Ranked masonry: results 1 and 2 share the top row, left to right.
  const first = await results.getByRole("listitem").nth(0).boundingBox();
  const second = await results.getByRole("listitem").nth(1).boundingBox();
  expect(first?.y).toBe(second?.y);
  expect(second!.x).toBeGreaterThan(first!.x);

  await page.getByRole("button", { name: /Pantalón/ }).click();
  await expect(page).toHaveURL(/item=2222222222222222/);
  await expect(page.getByRole("heading", { level: 1, name: "Pantalón" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "pantalon 1", exact: true })).toBeVisible();
  expect(searched[0]).toBe("1111111111111111");
  expect(searched).toContain("2222222222222222");

  await page.getByRole("button", { name: "Guardar: pantalon 1", exact: true }).click();
  await expect(page.getByRole("link", { name: "Guardados (1)" })).toBeVisible();
  await page.getByRole("link", { name: "Guardados (1)" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Guardados" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "pantalon 1", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Quitar de guardados: pantalon 1", exact: true }).click();
  await expect(page.getByText("Todavía no guardaste nada.")).toBeVisible();
});

test("search my area by typing a place: shops of result brands first, with directions", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/look/${LOOK.image_id}`);
  await page.getByRole("button", { name: "Buscar en mi zona" }).click();
  await page.getByLabel("Barrio, dirección o link de Google Maps").fill("Palermo");
  await page.getByRole("button", { name: "Buscar locales" }).click();

  const shops = page.getByRole("list", { name: "Locales cercanos" });
  await expect(shops.getByRole("listitem")).toHaveCount(2);
  await expect(shops.getByRole("listitem").first()).toContainText("Marca de tus resultados");
  await expect(page.getByRole("link", { name: "Cómo llegar a Shop Test Palermo" })).toHaveAttribute(
    "href",
    /google\.com\/maps\/dir\/\?api=1&destination=-34\.589,-58\.43/,
  );
  expect(nearbyCalls.at(-1)).toEqual({ lat: "-34.5888", lng: "-58.4302", radius: "2000" });

  // Changing the radius searches the same place again.
  await page.getByRole("button", { name: "5 km" }).click();
  await expect.poll(() => nearbyCalls.at(-1)?.radius).toBe("5000");
});

test("search my area with the device location, and explain unknown places", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -34.6037, longitude: -58.3816 });
  await mockApi(page);
  await page.goto(`/look/${LOOK.image_id}`);
  await page.getByRole("button", { name: "Buscar en mi zona" }).click();
  await page.getByRole("button", { name: "Usar mi ubicación" }).click();
  await expect(page.getByRole("list", { name: "Locales cercanos" }).getByRole("listitem")).toHaveCount(2);
  expect(nearbyCalls.at(-1)).toMatchObject({ lat: "-34.6037", lng: "-58.3816" });

  await page.getByLabel("Barrio, dirección o link de Google Maps").fill("nowhere at all");
  await page.getByRole("button", { name: "Buscar locales" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No encontramos esa ubicación" })).toBeVisible();
});

test("a searched look shows up in the home page history", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/look/${LOOK.image_id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Abrigo manga larga" })).toBeVisible();
  await page.getByRole("link", { name: "Nueva búsqueda" }).click();
  await expect(page.getByRole("list", { name: "Tus looks recientes" }).getByRole("link")).toHaveCount(1);
});

test("search disabled: explains how to turn it on and offers a retry", async ({ page }) => {
  await mockApi(page, { search: 503 });
  await page.goto(`/look/${LOOK.image_id}`);
  // Next renders its own (empty) role="alert" route announcer, so filter by text.
  await expect(page.getByRole("alert").filter({ hasText: "La búsqueda está apagada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("demo mode is labelled as demo", async ({ page }) => {
  await mockApi(page, { mode: "demo" });
  await page.goto(`/look/${LOOK.image_id}`);
  await expect(page.getByRole("status").filter({ hasText: "Modo demo" })).toBeVisible();
});

test("no results gets an empty state, not a blank page", async ({ page }) => {
  await mockApi(page, { search: "empty" });
  await page.goto(`/look/${LOOK.image_id}`);
  await expect(page.getByText("No encontramos prendas que se parezcan de verdad.", { exact: false })).toBeVisible();
});

test("an unreadable image explains what to do", async ({ page }) => {
  await mockApi(page, { detect: 422 });
  await page.goto("/scan");
  await page.locator('input[type="file"]').setInputFiles({ name: "look.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("alert").filter({ hasText: "No pudimos leer esa imagen" })).toBeVisible();
});

test("an unknown look links back to a new search", async ({ page }) => {
  await mockApi(page);
  await page.goto("/look/ffffffffffffffff");
  await expect(page.getByText("Ese look ya no existe.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Nueva búsqueda" })).toBeVisible();
});

test("the closet is still there on the next visit", async ({ page, context }) => {
  await mockApi(page);
  await page.goto(`/look/${LOOK.image_id}`);
  await page.getByRole("button", { name: "Guardar: abrigo 1", exact: true }).click();
  await page.close();

  // Leave and come back in a new tab of the same browser.
  const again = await context.newPage();
  await mockApi(again);
  closetBackup.items = []; // prove it comes from the browser, not the backup
  await again.goto("/saved");
  await expect(again.getByRole("heading", { name: "abrigo 1", exact: true })).toBeVisible();
  await expect(again.getByText("01 producto")).toBeVisible();
});

test("the closet comes back after the browser wipes its storage (Safari's 7-day purge)", async ({ page }) => {
  await mockApi(page);
  await page.goto(`/look/${LOOK.image_id}`);
  await page.getByRole("button", { name: "Guardar: abrigo 1", exact: true }).click();
  // The change is backed up in the API (debounced).
  await expect.poll(() => closetBackup.items.map((item) => item.title)).toEqual(["abrigo 1"]);

  await page.evaluate(() => localStorage.clear());
  await page.goto("/saved");
  await expect(page.getByRole("heading", { name: "abrigo 1", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Guardados (1)" })).toBeVisible();
});

test("garments are named for what they are, with the brand the results agree on", async ({ page }) => {
  await mockApi(page);
  const [first, ...rest] = LOOK.items;
  const named = { ...LOOK, items: [{ ...first, name: "Buzo polo de corderito negro", kind: "Buzo polo" }, ...rest] };
  await page.route("**/api/v1/looks/*", (route) => route.fulfill({ json: named }));
  await page.route("**/api/v1/search", (route) =>
    route.fulfill({
      json: { crop_id: first.crop_id, cached: false, results: matches("buzo"), brand: { name: "Stüssy", count: 5, total: 12 } },
    }),
  );
  await page.goto(`/look/${LOOK.image_id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Buzo polo de corderito negro" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Buzo polo de corderito negro/ })).toBeVisible();
  await expect(page.getByText(/Marca probable:/)).toContainText("Stüssy · la mencionan 5 de 12 resultados");
});
