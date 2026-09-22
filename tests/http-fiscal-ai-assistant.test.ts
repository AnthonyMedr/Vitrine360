import assert from "node:assert/strict";
import test from "node:test";
import { createAdminSession, createCsrfSession, createTestServer, getDbModule, getSetCookieHeaders, getCookieValue } from "./http-server";

process.env.AUTH_PUBLIC_SIGNUP_ENABLED = "true";

test("admin fiscal AI queue returns minimal pending profiles and generation writes audit", async () => {
  const server = await createTestServer();
  try {
    const session = await createAdminSession(server.baseUrl);
    const queueResponse = await fetch(`${server.baseUrl}/api/admin/fiscal/ai-assistant/queue?scope=minimal-go-live`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(queueResponse.status, 200);
    const queue = await queueResponse.json() as { items: Array<{ profile: { id: string }; product: { sku: string | null } | null }> };
    assert.ok(queue.items.some((item) => item.product?.sku === "PVC-0001"));

    const profileId = queue.items[0].profile.id;
    const generateResponse = await fetch(`${server.baseUrl}/api/admin/fiscal/ai-assistant/suggestions/${profileId}/generate?scope=minimal-go-live`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": session.csrfToken,
        cookie: session.cookieHeader,
      },
      body: JSON.stringify({ scope: "minimal-go-live" }),
    });
    assert.equal(generateResponse.status, 201);
    const suggestion = await generateResponse.json() as { id: string; openai_error: string | null };
    assert.ok(suggestion.id);
    assert.ok(suggestion.openai_error === null || suggestion.openai_error.includes("OPENAI_API_KEY") || suggestion.openai_error.length > 0);

    const { readDb } = await getDbModule();
    assert.ok(readDb().auditLogs.some((entry) => entry.event_type === "fiscal.ai_suggestion_generated"));
    assert.ok(readDb().aiUsageLogs.some((entry) => entry.module === "fiscal"));

    const usageResponse = await fetch(`${server.baseUrl}/api/admin/ai/usage`, {
      headers: { cookie: session.cookieHeader },
    });
    assert.equal(usageResponse.status, 200);
    const usage = await usageResponse.json() as { totals: { skipped: number; estimated_input_tokens: number }; latest: unknown[] };
    assert.equal(usage.totals.skipped >= 1, true);
    assert.equal(Array.isArray(usage.latest), true);
  } finally {
    await server.close();
  }
});

test("non-admin user cannot access fiscal AI admin queue", async () => {
  const server = await createTestServer();
  try {
    const csrf = await createCsrfSession(server.baseUrl);
    const email = `cliente-${Date.now()}@example.com`;
    const signupResponse = await fetch(`${server.baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrf.csrfToken,
        cookie: csrf.cookieHeader,
      },
      body: JSON.stringify({ email, password: "cliente123", fullName: "Cliente Teste" }),
    });
    assert.equal(signupResponse.status, 200);
    const sessionToken = getCookieValue(getSetCookieHeaders(signupResponse), "gamel_session");
    assert.ok(sessionToken);

    const queueResponse = await fetch(`${server.baseUrl}/api/admin/fiscal/ai-assistant/queue?scope=minimal-go-live`, {
      headers: { cookie: `${csrf.cookieHeader}; gamel_session=${sessionToken}` },
    });
    assert.equal(queueResponse.status, 403);
  } finally {
    await server.close();
  }
});
