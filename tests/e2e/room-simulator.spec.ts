import { test, expect } from "@playwright/test";

test.describe("Simulador de Ambientes", () => {
  test("simula uma cozinha estilo moderno e mostra conceito + itens", async ({ page }) => {
    test.skip(
      test.info().project.name === "webkit-mobile",
      "Fluxo do simulador com IA validado em desktop; mobile segue coberto por smoke responsivo.",
    );

    await page.goto("/catalogo");
    await page.waitForLoadState("networkidle");
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toBeVisible({ timeout: 15_000 });
    await expect(hero).toContainText(/solucoes visuais/i);
    await page.waitForTimeout(1200);
    const section = page.getByTestId("room-simulator-section");
    await expect(section).toBeVisible({ timeout: 30_000 });
    await section.scrollIntoViewIfNeeded();

    const submit = section.getByRole("button", { name: /Simular ambiente/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(section.getByText(/Conceito/i)).toBeVisible({ timeout: 60_000 });
    // Espera por pelo menos um item retornado pelo simulador
    await expect(section.getByText(/Papel:/i).first()).toBeVisible({ timeout: 60_000 });
  });
});
