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

test("shipping quote keeps local delivery available for configured zones", async () => {
  const response = await fetch(`${baseUrl}/api/shipping/quote?cep=55295000&subtotal=300`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    underAnalysis: boolean;
    regionLabel: string;
    options: Array<{ id: string; deliveryType: string; coverage?: string; price: number }>;
    nationalCoverage?: { requested: boolean; mode: string };
  };

  assert.equal(payload.underAnalysis, false);
  assert.match(payload.regionLabel, /Garanhuns\/PE/);
  assert.equal(payload.nationalCoverage?.requested, false);
  assert.ok(payload.options.some((option) => option.deliveryType === "delivery" && option.coverage === "local" && option.price === 18));
});

test("shipping quote blocks national delivery until a real freight provider returns options", async () => {
  const response = await fetch(`${baseUrl}/api/shipping/quote?cep=01001000&subtotal=300`);
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    underAnalysis: boolean;
    regionLabel: string;
    message: string;
    options: Array<{ id: string; deliveryType: string; coverage?: string }>;
    nationalCoverage?: { requested: boolean; ready: boolean; mode: string; missing: string[] };
  };

  assert.equal(payload.underAnalysis, true);
  assert.equal(payload.regionLabel, "Brasil - CEP 01001000");
  assert.match(payload.message, /Entrega nacional solicitada/);
  assert.equal(payload.nationalCoverage?.requested, true);
  assert.equal(payload.nationalCoverage?.ready, false);
  assert.equal(payload.nationalCoverage?.mode, "provider_required");
  assert.ok(payload.nationalCoverage?.missing.includes("FREIGHT_PROVIDER=melhor-envio"));
  assert.equal(payload.options.some((option) => option.deliveryType === "delivery"), false);
  assert.ok(payload.options.some((option) => option.deliveryType === "pickup" && option.coverage === "pickup"));
});
