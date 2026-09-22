import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfSession, createTestServer } from "./http-server.ts";

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

test("malformed JSON body returns a clean JSON error, not an Express HTML stack trace", async () => {
  const csrf = await createCsrfSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrf.csrfToken, cookie: csrf.cookieHeader },
    body: '{"customer": invalid json here!!',
  });
  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = (await response.json()) as { error: string };
  assert.ok(body.error);
  assert.doesNotMatch(body.error, /node_modules|at JSON\.parse|SyntaxError/);
});

test("oversized request body returns a clean JSON 413, not an Express HTML stack trace", async () => {
  const csrf = await createCsrfSession(baseUrl);
  const oversizedPayload = JSON.stringify({
    customer: { name: "A".repeat(6 * 1024 * 1024), whatsapp: "87999990000", city: "X", state: "PE" },
    items: [{ productId: "x", productSlug: "x", quantity: 1 }],
    consent: true,
    idempotencyKey: `huge-${Date.now()}`,
  });
  const response = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": csrf.csrfToken, cookie: csrf.cookieHeader },
    body: oversizedPayload,
  });
  assert.equal(response.status, 413);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
  const body = (await response.json()) as { error: string };
  assert.ok(body.error);
  assert.doesNotMatch(body.error, /node_modules|raw-body|PayloadTooLargeError/);
});
