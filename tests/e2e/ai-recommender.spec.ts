import { expect, test } from "@playwright/test";

test.describe("Recomendador IA (Catalogo)", () => {
  test("preenche cenario e exibe recomendacoes", async ({ page }) => {
    await page.goto("/catalogo");
    await page.waitForLoadState("networkidle");
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toBeVisible({ timeout: 15_000 });
    await expect(hero).toContainText(/solucoes visuais/i);
    await page.waitForTimeout(1200);

    const section = page.getByTestId("ai-recommender-section");

    await expect(section).toBeVisible({ timeout: 30_000 });
    await section.scrollIntoViewIfNeeded();

    const input = section.getByPlaceholder(/reforma de cozinha/i);
    await expect(input).toBeVisible();
    await input.click();
    await input.clear();
    await input.pressSequentially("Quero forrar o teto de uma sala comercial de 30m2", {
      delay: 20,
    });
    await expect(input).toHaveValue(/sala comercial/i);

    const submit = section.getByRole("button", { name: /recomendar/i });
    await expect.poll(async () => submit.isEnabled(), { timeout: 10_000 }).toBe(true);
    await submit.click();

    await expect(section.getByText(/Analise:/i)).toBeVisible({ timeout: 45_000 });

    const cards = section.locator("article");
    await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  });

  test("aceita atalho de exemplo", async ({ page }) => {
    await page.goto("/catalogo");
    await page.waitForLoadState("networkidle");
    const hero = page.getByRole("heading", { level: 1 });
    await expect(hero).toBeVisible({ timeout: 15_000 });
    await expect(hero).toContainText(/solucoes visuais/i);
    await page.waitForTimeout(800);

    const section = page.getByTestId("ai-recommender-section");

    await expect(section).toBeVisible({ timeout: 30_000 });

    const shortcut = section.getByRole("button", { name: /Vou reformar o banheiro/i });
    await shortcut.scrollIntoViewIfNeeded();
    await shortcut.click();

    const input = section.getByPlaceholder(/reforma de cozinha/i);
    if (!(await input.inputValue())) {
      await shortcut.click();
    }
    await expect.poll(async () => input.inputValue(), { timeout: 10_000 }).toMatch(/banheiro/i);
    await expect(section.getByRole("button", { name: /recomendar/i })).toBeEnabled();
  });
});
