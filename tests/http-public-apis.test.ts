import test from "node:test";
import assert from "node:assert/strict";
import { createTestServer } from "./http-server.ts";

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

test("public API status exposes national lookup providers and cache policy", async () => {
  const response = await fetch(`${baseUrl}/api/public-apis/status`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    ok: boolean;
    providers: { cep: string[]; cnpj: string[] };
    cache: { active_entries: number; address_ttl_ms: number; company_ttl_ms: number };
    request_timeout_ms: number;
    usage_policy: string;
  };

  assert.equal(payload.ok, true);
  assert.deepEqual(payload.providers.cep, ["viacep", "brasilapi"]);
  assert.deepEqual(payload.providers.cnpj, ["brasilapi"]);
  assert.equal(typeof payload.cache.active_entries, "number");
  assert.ok(payload.cache.address_ttl_ms > 0);
  assert.ok(payload.cache.company_ttl_ms > 0);
  assert.ok(payload.request_timeout_ms > 0);
  assert.match(payload.usage_policy, /cache/);
});
