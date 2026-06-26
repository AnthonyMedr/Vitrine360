import { expect, test } from "@playwright/test";

async function gotoWithRetry(page: import("@playwright/test").Page, path: string, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await page.goto(path, { waitUntil: "load" });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isTransientIssue =
        message.includes("ERR_NO_BUFFER_SPACE") || message.includes("ERR_CONNECTION_REFUSED");
      if (!isTransientIssue || attempt === attempts) {
        throw error;
      }
      await page.waitForTimeout(600 * attempt);
    }
  }

  throw lastError;
}

test.describe("Smoke navegacao", () => {
  const assertions: Record<string, (page: import("@playwright/test").Page) => Promise<void>> = {
    "/": async (page) => {
      const hero = page.getByRole("heading", { level: 1 });
      await expect(hero).toBeVisible({ timeout: 15_000 });
      await expect(hero).toContainText(/sua loja/i);
      await expect(hero).toContainText(/digital/i);
      await expect(hero).toContainText(/qualquer tela/i);
    },
    "/catalogo": async (page) => {
      await expect(page.getByText(/IA Comercial Vitrine360/i)).toBeVisible();
    },
    "/ofertas": async (page) => {
      await expect(page.getByRole("heading", { name: /destaques da quinzena/i })).toBeVisible();
    },
    "/vitrine": async (page) => {
      await page.waitForLoadState("networkidle");
      await expect(page.getByLabel(/sair da vitrine/i)).toBeVisible({ timeout: 15_000 });
    },
  };

  for (const path of ["/", "/catalogo", "/ofertas", "/vitrine"]) {
    test(`carrega ${path}`, async ({ page }) => {
      const response = await gotoWithRetry(page, path);
      expect(response?.status() ?? 0).toBeLessThan(400);
      await page.waitForLoadState("networkidle");
      await assertions[path](page);
    });
  }
});
