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

test.describe("Totem e Vitrine - validacao operacional simulada", () => {
  test("totem navega categoria > produto e mantem QR Code contido em 1920x1080", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "validacao dedicada para viewport operacional desktop",
    );

    await page.setViewportSize({ width: 1920, height: 1080 });
    await gotoWithRetry(page, "/totem");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /totem interativo|toque na sua categoria/i }),
    ).toBeVisible();

    const firstCategory = page
      .locator("main button")
      .filter({ hasText: /ripados|forros pvc|chapas uv|tetos laminados/i })
      .first();
    await firstCategory.click();

    const productName = page
      .getByText(/Ripado Interno Nogueira|Forro PVC Branco Neve|Chapa UV Nero Premium/i)
      .first();
    await expect(productName).toBeVisible();
    await productName.click();

    await expect(
      page.getByRole("heading", {
        name: /ripado interno nogueira|forro pvc branco neve|chapa uv nero premium/i,
      }),
    ).toBeVisible();
    const qr = page.getByLabel(/continue no celular/i);
    await expect(qr).toBeVisible();

    const box = await qr.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(220);
    expect(box!.height).toBeLessThanOrEqual(220);
  });

  test("vitrine renderiza bem em 1920x1080 e 1080x1920 simulados", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "validacao dedicada para viewport operacional desktop",
    );

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1080, height: 1920 },
    ]) {
      await page.setViewportSize(viewport);
      await gotoWithRetry(page, "/vitrine");
      await page.waitForLoadState("networkidle");

      await expect(page.getByLabel(/sair da vitrine/i)).toBeVisible();
      await expect(page.locator("h2").first()).toBeVisible();

      const indicatorCount = await page.locator("span.h-1\\.5").count();
      expect(indicatorCount).toBeGreaterThan(1);

      const qr = page.getByLabel(/falar no whatsapp/i);
      if (await qr.count()) {
        const box = await qr.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeLessThanOrEqual(240);
        expect(box!.height).toBeLessThanOrEqual(240);
      }

      const overflow = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      expect(overflow.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(overflow.height).toBeLessThanOrEqual(viewport.height + 1);
    }
  });
});
