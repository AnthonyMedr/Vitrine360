import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfSession, createTestServer, getCookieValue, getSetCookieHeaders } from "./http-server.ts";

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

test("auth signin sanitizes sensitive user fields", async () => {
  const response = await fetch(`${baseUrl}/api/auth/signin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "admin@gamelmetal.com",
      password: "admin123",
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { user?: Record<string, unknown>; token?: string };
  assert.ok(payload.token);
  assert.equal(payload.user?.password_hash, undefined);
  assert.equal(payload.user?.password_salt, undefined);
  assert.equal(payload.user?.session_token, undefined);
});

test("auth signin works with csrf cookie plus header and keeps session on /api/auth/me", async () => {
  const bootstrapResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(bootstrapResponse.status, 200);

  const bootstrapCookies = getSetCookieHeaders(bootstrapResponse);
  const csrfToken = getCookieValue(bootstrapCookies, "lojao_csrf");
  assert.ok(csrfToken);

  const signinResponse = await fetch(`${baseUrl}/api/auth/signin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: `lojao_csrf=${csrfToken}`,
    },
    body: JSON.stringify({
      email: "admin@gamelmetal.com",
      password: "admin123",
    }),
  });

  assert.equal(signinResponse.status, 200);
  const signinCookies = getSetCookieHeaders(signinResponse);
  const sessionToken = getCookieValue(signinCookies, "gamel_session");
  assert.ok(sessionToken);

  const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      cookie: `lojao_csrf=${csrfToken}; gamel_session=${sessionToken}`,
    },
  });
  assert.equal(meResponse.status, 200);

  const mePayload = (await meResponse.json()) as { user?: { email?: string; role?: string } };
  assert.equal(mePayload.user?.email, "admin@gamelmetal.com");
  assert.equal(mePayload.user?.role, "admin");
});

test("request otp stays neutral for unknown users", async () => {
  const bootstrapResponse = await fetch(`${baseUrl}/api/health`);
  const csrfToken = getCookieValue(getSetCookieHeaders(bootstrapResponse), "lojao_csrf");
  assert.ok(csrfToken);

  const response = await fetch(`${baseUrl}/api/auth/request-otp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: `lojao_csrf=${csrfToken}`,
    },
    body: JSON.stringify({
      email: "naoexiste@lojaopvc.com.br",
      purpose: "reset_password",
    }),
  });

  assert.equal(response.status, 200);
  const payload = (await response.json()) as { ok?: boolean; channel?: string; debug_code?: string };
  assert.equal(payload.ok, true);
  assert.equal(payload.channel, "email");
  assert.equal(payload.debug_code, undefined);
});

test("public signup is blocked by default for GAMEL phase 1", async () => {
  const csrf = await createCsrfSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      email: `public.signup.${Date.now()}@gamelmetal.com`,
      password: "cliente123",
      fullName: "Usuario Publico Bloqueado",
    }),
  });

  assert.equal(response.status, 403);
  const payload = (await response.json()) as { error?: string };
  assert.match(payload.error || "", /cadastro publico desativado/i);
});

test("auth signin rate limits repeated invalid attempts", async () => {
  const bootstrapResponse = await fetch(`${baseUrl}/api/health`);
  const csrfToken = getCookieValue(getSetCookieHeaders(bootstrapResponse), "lojao_csrf");
  assert.ok(csrfToken);

  const statuses: number[] = [];
  for (let index = 0; index < 12; index += 1) {
    const response = await fetch(`${baseUrl}/api/auth/signin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: `lojao_csrf=${csrfToken}`,
      },
      body: JSON.stringify({
        email: `tentativa-${index}@gamelmetal.com`,
        password: "senha-incorreta",
      }),
    });
    statuses.push(response.status);
  }

  assert.ok(statuses.includes(429), `Esperava rate limit 429 em alguma tentativa, recebeu: ${statuses.join(", ")}`);
});
