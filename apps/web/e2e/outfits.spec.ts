import { expect, test } from "@playwright/test";
import { mockApi } from "./mock-api";

test("the week's outfits: three for women, three for men, every garment with places to buy it", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  const section = page.locator("#outfits");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("heading", { level: 2, name: "Outfits de la semana." })).toBeVisible();

  const outfits = section.getByRole("article");
  await expect(outfits).toHaveCount(6);
  await expect(section.getByRole("article", { name: /de mujer$/ })).toHaveCount(3);
  await expect(section.getByRole("article", { name: /de hombre$/ })).toHaveCount(3);

  const first = outfits.first();
  const links = first.getByRole("link");
  expect(await links.count()).toBeGreaterThanOrEqual(3);
  const hrefs = await links.evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.some((href) => href.startsWith("https://listado.mercadolibre.com.ar/"))).toBe(true);
  expect(hrefs.some((href) => href.startsWith("https://www.zara.com/ar/es/search?searchTerm="))).toBe(true);
  expect(hrefs.some((href) => href.startsWith("https://www.google.com.ar/search?tbm=shop&gl=ar&"))).toBe(true);
  // Argentina only: every shop link is an Argentine site.
  expect(hrefs.every((href) => /^https:\/\/[^/]+\.ar\/|^https:\/\/www\.zara\.com\/ar\/es\//.test(href))).toBe(true);
  await expect(links.first()).toHaveAttribute("target", "_blank");
});

test("the perfumery: real bottles, the featured one shop by shop, a catalogue with prices, WhatsApp", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.locator("#perfumeria").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Potenciá tu outfit con una fragancia." })).toBeVisible();

  const prices = page.getByRole("list", { name: "Precios por tienda" });
  await expect(prices.getByRole("listitem")).toHaveCount(3);
  await expect(prices.getByRole("listitem").first()).toContainText("Perfumería A");
  await expect(prices.getByRole("listitem").first()).toContainText("Mejor precio");
  await expect(prices.getByRole("listitem").first()).toContainText("480.000");

  // The catalogue: every perfume with its photo, price and where; out of stock says so.
  const catalogue = page.getByRole("list", { name: "Catálogo de fragancias" });
  await expect(catalogue.getByRole("article")).toHaveCount(4);
  const naxos = catalogue.getByRole("article", { name: "Naxos" });
  await expect(naxos).toContainText("$ 630.000");
  await expect(naxos).toContainText("en Neve");
  await expect(naxos.getByRole("img", { name: "Naxos de Xerjoff" })).toBeVisible();
  await expect(naxos.getByRole("link", { name: /Comprar/ })).toHaveAttribute("href", "https://neve.test/naxos");
  const ask = await naxos.getByRole("link", { name: "Consultar Naxos por WhatsApp" }).getAttribute("href");
  expect(decodeURIComponent(ask!.split("text=")[1])).toContain("Naxos de Xerjoff");
  await expect(catalogue.getByRole("article", { name: "Kirke" })).toContainText("Sin stock");

  const whatsapp = page.getByRole("link", { name: /Hablá con el proveedor/ });
  const href = await whatsapp.getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/5491168300606\?text=/);
  await expect(whatsapp).toHaveAttribute("rel", /noopener/);
});

test("a lost page turns into a look for how you want to feel", async ({ page }) => {
  await page.goto("/esta-pagina-no-existe");
  await expect(page.getByRole("heading", { level: 1, name: /Esta página se perdió/ })).toBeVisible();

  const moods = page.getByRole("group", { name: "Cómo te querés sentir" });
  await moods.getByRole("button", { name: "Elegante" }).click();
  await expect(moods.getByRole("button", { name: "Elegante" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Pocas piezas, bien elegidas.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Escanear un look" })).toHaveAttribute("href", "/scan");
});
