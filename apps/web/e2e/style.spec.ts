import { expect, test, type Page } from "@playwright/test";
import { LOOK, mockApi, profileBackup } from "./mock-api";

// A finished test, as lib/profile.ts keeps it in this browser.
const winterProfile = {
  user: "0f8fad5b-d9cb-469f-a165-70867728950e",
  status: "done",
  // Three of the four menswear styles, so whatever the week, one of its looks is in them.
  style: { dress: "hombre", aesthetics: ["streetwear", "old-money", "casual"], lifestyle: [], goals: ["versatil"], budget: "medio" },
  color: { season: "invierno-frio", undertone: "frio", contrast: "alto", chroma: "brillante" },
  updated_at: Date.now(),
};

async function withProfile(page: Page, profile: object) {
  await page.addInitScript((value) => window.localStorage.setItem("vibear:profile", value), JSON.stringify(profile));
}

test("the style test: answers in a minute, a colour season, kept for the next visit", async ({ page }) => {
  await mockApi(page);
  await page.goto("/estilo");
  const options = () => page.getByRole("group").first();

  await options().getByRole("button", { name: "Mujer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "¿Qué estilos te gustan?" })).toBeVisible();
  await options().getByRole("button", { name: "Clean / minimal" }).click();
  await expect(options().getByRole("button", { name: "Clean / minimal" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Siguiente" }).click();
  // Every question can be skipped.
  await page.getByRole("button", { name: "Omitir pregunta" }).click();
  await page.getByRole("button", { name: "Omitir pregunta" }).click();
  await page.getByRole("button", { name: "Omitir pregunta" }).click();

  await expect(page.getByText("Tu colorimetría · 06 / 11")).toBeVisible();
  for (const name of ["Verdes u oliva", "Oro", "Me quemo un poco y después me bronceo", "Castaño", "Avellana o miel", "Media"]) {
    await options().getByRole("button", { name, exact: true }).click();
  }

  await expect(page.getByRole("heading", { level: 1, name: "Otoño suave" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Colores que te favorecen" }).getByRole("listitem")).toHaveCount(8);
  await expect(page.getByRole("list", { name: "Tus estilos" })).toContainText("Clean girl");

  // Backed up to the anonymous profile, and still there after a reload.
  await expect.poll(() => (profileBackup.color as { season?: string } | undefined)?.season).toBe("otono-suave");
  expect(profileBackup.user).toMatch(/^[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Otoño suave" })).toBeVisible();
});

test("the style test can be skipped, and is not offered as new again", async ({ page }) => {
  await mockApi(page);
  await page.goto("/estilo");
  await page.getByRole("button", { name: "Saltar el test" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => profileBackup.status).toBe("skipped");
});

test("after the test, a scanned garment says whether it suits your palette", async ({ page }) => {
  await mockApi(page);
  await withProfile(page, winterProfile);
  await page.goto(`/look/${LOOK.image_id}`);
  // The first garment is black: a winter colour.
  await expect(page.getByText("✓ Va con tu paleta")).toBeVisible();
});

test("after the test, the week's outfits in your style come first, marked for you", async ({ page }) => {
  await mockApi(page);
  await withProfile(page, winterProfile);
  await page.goto("/");
  const outfits = page.locator("#outfits");
  await outfits.scrollIntoViewIfNeeded();
  const first = outfits.getByRole("article").first();
  await expect(first).toContainText("Para vos");
  await expect(first).toContainText("Hombre");
});

test("the 404 leads everywhere, the style test first", async ({ page }) => {
  await page.goto("/una-pagina-que-no-existe");
  await expect(page.getByRole("link", { name: "Descubrí tu estilo" })).toHaveAttribute("href", "/estilo");
  const elsewhere = page.getByRole("navigation", { name: "Seguí por acá" });
  for (const name of ["Inicio", "Escanear", "Outfits de la semana", "Perfumería", "Probador", "Guardados"]) {
    await expect(elsewhere.getByRole("link", { name, exact: true })).toBeVisible();
  }
});
