import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createCsrfSession, createTestServer, getDbModule } from "./http-server.ts";

let baseUrl = "";
let closeServer: (() => Promise<void>) | null = null;

test.before(async () => {
  const server = await createTestServer();
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

test.after(async () => {
  await closeServer?.();
});

async function createQuoteRequest(marketingConsent = true) {
  const catalog = await fetch(`${baseUrl}/api/products?limit=1`);
  const products = (await catalog.json()) as Array<{ slug: string }>;
  assert.ok(products.length > 0);
  const csrf = await createCsrfSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrf.csrfToken, cookie: csrf.cookieHeader },
    body: JSON.stringify({
      customer: { name: "Cliente PDF Teste", whatsapp: "87999997777", cnpj: "12345678000199", city: "Garanhuns", state: "PE" },
      items: [{ productId: products[0].slug, productSlug: products[0].slug, quantity: 2 }],
      consent: true,
      marketingConsent,
      idempotencyKey: `pdf-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { request: { id: string; accessToken: string; protocol: string; marketingConsent: boolean } };
}

test("public quote request PDF requires the correct access token", async () => {
  const created = await createQuoteRequest(true);
  assert.ok(created.request.accessToken);
  assert.equal(created.request.marketingConsent, true);

  const wrongToken = await fetch(`${baseUrl}/api/quote-requests/${created.request.id}/pdf?token=wrong`);
  assert.equal(wrongToken.status, 404);

  const noToken = await fetch(`${baseUrl}/api/quote-requests/${created.request.id}/pdf`);
  assert.equal(noToken.status, 404);

  const correctToken = await fetch(`${baseUrl}/api/quote-requests/${created.request.id}/pdf?token=${created.request.accessToken}`);
  assert.equal(correctToken.status, 200);
  assert.equal(correctToken.headers.get("content-type"), "application/pdf");
  const buffer = Buffer.from(await correctToken.arrayBuffer());
  assert.equal(buffer.subarray(0, 5).toString("ascii"), "%PDF-");
});

test("public quote request PDF is available with the correct token even without marketing consent", async () => {
  const created = await createQuoteRequest(false);
  assert.equal(created.request.marketingConsent, false);

  const response = await fetch(`${baseUrl}/api/quote-requests/${created.request.id}/pdf?token=${created.request.accessToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
});

test("admin quote request PDF is gated by quote_request.read_detail permission", async () => {
  const created = await createQuoteRequest();
  const admin = await createAdminSession(baseUrl);
  const { readDb, writeDb } = await getDbModule();

  const db = readDb();
  const adminUser = db.users.find((entry) => entry.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id;

  try {
    const allowedResp = await fetch(`${baseUrl}/api/admin/quote-requests/${created.request.id}/pdf`, { headers: { cookie: admin.cookieHeader } });
    assert.equal(allowedResp.status, 200);
    assert.equal(allowedResp.headers.get("content-type"), "application/pdf");

    const deniedDb = readDb();
    const deniedAdmin = deniedDb.users.find((entry) => entry.id === "user-admin");
    assert.ok(deniedAdmin);
    deniedAdmin.user_metadata.permission_profile_id = "visualizacao_diretoria";
    writeDb(deniedDb);

    const deniedResp = await fetch(`${baseUrl}/api/admin/quote-requests/${created.request.id}/pdf`, { headers: { cookie: admin.cookieHeader } });
    assert.equal(deniedResp.status, 403);

    const noAuthResp = await fetch(`${baseUrl}/api/admin/quote-requests/${created.request.id}/pdf`);
    assert.equal(noAuthResp.status, 401);
  } finally {
    const resetDb = readDb();
    const resetAdmin = resetDb.users.find((entry) => entry.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
      writeDb(resetDb);
    }
  }
});
