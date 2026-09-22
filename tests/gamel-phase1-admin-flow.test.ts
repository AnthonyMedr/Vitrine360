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

async function createQuoteRequest(input: { product: string; productSlug: string; category: string; message: string; whatsapp?: string }) {
  const { csrfToken, cookieHeader } = await createCsrfSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      customer: {
        name: `Cliente Fase 1 ${input.productSlug.slice(0, 8)}`,
        whatsapp: input.whatsapp ?? "87981818752",
        email: "fase1@gamelmetal.com",
        cnpj: "12345678000199",
        city: "Garanhuns",
        state: "PE",
      },
      items: [
        {
          productId: input.productSlug,
          quantity: 2,
          unit: "un",
          notes: input.category,
        },
      ],
      message: input.message,
      preference: "whatsapp",
      pageOrigin: `/produto/${input.productSlug}`,
      utm: { source: "phase1-test" },
      privacyPolicyVersion: "2026-07",
      consent: true,
      idempotencyKey: `phase1-${input.productSlug}-${input.whatsapp ?? "87981818752"}`,
    }),
  });
  assert.equal(response.status, 201);
  return response.json() as Promise<{ lead_ref: string; request: { id: string; protocol: string }; quote: { id: string; quote_number: string } }>;
}

function buildWhatsappMessage(input: { product: string; category: string; leadRef: string }) {
  return [
    "Ola, vim pelo site da GAMEL Metal e gostaria de solicitar um orcamento.",
    "",
    `Produto: ${input.product}`,
    `Categoria: ${input.category}`,
    "Quantidade aproximada: 2 unidades",
    "Nome: Cliente Fase 1",
    "Cidade: Garanhuns",
    "Mensagem: Atendimento comercial da Fase 1.",
    `Referencia: ${input.leadRef}`,
  ].join("\n");
}

test("phase 1 quote flow records approved, pending and cross-category product interests", async () => {
  const scenarios = [
    {
      product: "Chapas em PVC-UV — Genesis",
      productSlug: "chapas-em-pvc-uv-genesis",
      category: "Chapas UV",
      message: "Produto com imagem aprovada para atendimento comercial.",
    },
    {
      product: "Teto Vinílico Amazonas Oak",
      productSlug: "teto-vinilico-amazonas-oak",
      category: "Tetos Vinílicos",
      message: "Produto de familia visual recem revisada para atendimento comercial.",
    },
    {
      product: "Ripado LR001 — Noral",
      productSlug: "ripado-lr001-noral",
      category: "Ripados Internos",
      message: "Produto de categoria diferente para validar roteamento comercial.",
    },
  ];

  const admin = await createAdminSession(baseUrl);
  for (const scenario of scenarios) {
    const created = await createQuoteRequest(scenario);
    const whatsappMessage = buildWhatsappMessage({ product: scenario.product, category: scenario.category, leadRef: created.lead_ref });
    assert.match(whatsappMessage, /orcamento|atendimento comercial/i);
    assert.doesNotMatch(whatsappMessage, /carrinho|checkout|pagamento|pedido pago|compra online|frete automatico/i);

    const adminResponse = await fetch(`${baseUrl}/api/admin/quote-requests`, { headers: { cookie: admin.cookieHeader } });
    assert.equal(adminResponse.status, 200);
    const adminPayload = await adminResponse.json() as {
      requests: Array<{ request: { id: string; protocol: string; status: string }; quote: { id: string; quote_number: string }; items: Array<{ product_name_snapshot: string }> }>;
    };
    const request = adminPayload.requests.find((entry) => entry.quote.quote_number === created.lead_ref);
    assert.ok(request);
    assert.equal(request.items[0]?.product_name_snapshot, scenario.product);

    const statusResponse = await fetch(`${baseUrl}/api/admin/quote-requests/${request.request.id}/status`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({
        status: "contacted",
        note: `Observacao interna registrada para ${created.lead_ref}.`,
      }),
    });
    assert.equal(statusResponse.status, 200);
    const updated = await statusResponse.json() as { request: { status: string }; history: Array<{ note: string | null }> };
    assert.equal(updated.request.status, "contacted");
    assert.ok(updated.history.some((entry) => entry.note?.includes("Observacao interna")));

    const responsibleResponse = await fetch(`${baseUrl}/api/admin/quote-requests/${request.request.id}/responsible`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ responsible_name: "Atendimento Teste" }),
    });
    assert.equal(responsibleResponse.status, 200);

    const noteResponse = await fetch(`${baseUrl}/api/admin/quote-requests/${request.request.id}/notes`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ note: `Nota interna para ${created.lead_ref}.` }),
    });
    assert.equal(noteResponse.status, 201);

    const nextActionResponse = await fetch(`${baseUrl}/api/admin/quote-requests/${request.request.id}/next-action`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": admin.csrfToken,
        cookie: admin.cookieHeader,
      },
      body: JSON.stringify({ next_action: "Enviar retorno comercial pelo WhatsApp", next_action_due_at: "2026-07-23T09:00" }),
    });
    assert.equal(nextActionResponse.status, 200);

    const detailResponse = await fetch(`${baseUrl}/api/admin/quote-requests/${request.request.id}`, { headers: { cookie: admin.cookieHeader } });
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json() as {
      request: { responsible_name: string | null; consent_recorded_at: string | null; status: string; next_action: string | null };
      items: Array<{ product_name_snapshot: string; quantity: number }>;
      notes: Array<{ note: string }>;
      history: Array<{ to_status: string; actor_name: string }>;
    };
    assert.equal(detail.request.responsible_name, "Atendimento Teste");
    assert.equal(detail.request.next_action, "Enviar retorno comercial pelo WhatsApp");
    assert.ok(detail.request.consent_recorded_at);
    assert.ok(detail.items.some((item) => item.product_name_snapshot === scenario.product && item.quantity === 2));
    assert.ok(detail.notes.some((entry) => entry.note.includes("Nota interna")));
    assert.ok(detail.history.some((entry) => entry.to_status === "contacted" && entry.actor_name));
  }
});

test("public quote request deduplicates quick repeated submissions safely", async () => {
  const scenario = {
    product: "Chapas em PVC-UV — Genesis",
    productSlug: "chapas-em-pvc-uv-genesis",
    category: "Chapas UV",
    message: "Cliente clicou duas vezes no envio do orcamento.",
    whatsapp: "87981819999",
  };

  const first = await createQuoteRequest(scenario);
  const { csrfToken, cookieHeader } = await createCsrfSession(baseUrl);
  const duplicateResponse = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      customer: {
        name: `Cliente Fase 1 ${scenario.productSlug.slice(0, 8)}`,
        whatsapp: scenario.whatsapp,
        email: "fase1@gamelmetal.com",
        cnpj: "12345678000199",
        city: "Garanhuns",
        state: "PE",
      },
      items: [{ productId: scenario.productSlug, quantity: 2, unit: "un", notes: scenario.category }],
      message: scenario.message,
      preference: "whatsapp",
      pageOrigin: `/produto/${scenario.productSlug}`,
      utm: { source: "phase1-test" },
      privacyPolicyVersion: "2026-07",
      consent: true,
      idempotencyKey: `phase1-${scenario.productSlug}-${scenario.whatsapp}`,
    }),
  });

  assert.equal(duplicateResponse.status, 200);
  const duplicate = await duplicateResponse.json() as { lead_ref: string; duplicate?: boolean };
  assert.equal(duplicate.lead_ref, first.lead_ref);
  assert.equal(duplicate.duplicate, true);
});

test("public quote request rejects unsafe payloads before creating lead", async () => {
  const { csrfToken, cookieHeader } = await createCsrfSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      customer: { name: "Cliente Teste", whatsapp: "87981818752", city: "Garanhuns" },
      items: [{ productId: "chapas-em-pvc-uv-genesis", quantity: 1 }],
      message: "<script>alert('xss')</script>",
      pageOrigin: "/orcamento",
      preference: "whatsapp",
      consent: true,
      idempotencyKey: "unsafe-payload-test",
    }),
  });

  assert.equal(response.status, 400);
  const payload = await response.json() as { error?: string };
  assert.match(payload.error || "", /revise/i);
});

test("public quote request requires uf and consent", async () => {
  const { csrfToken, cookieHeader } = await createCsrfSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      customer: { name: "Cliente Teste", whatsapp: "87981818752", city: "Garanhuns", state: "" },
      items: [{ productId: "chapas-em-pvc-uv-genesis", quantity: 1 }],
      message: "Quero atendimento comercial.",
      pageOrigin: "/orcamento",
      preference: "whatsapp",
      consent: false,
      idempotencyKey: "missing-consent-and-uf",
    }),
  });

  assert.equal(response.status, 400);
  const payload = await response.json() as { error?: string };
  assert.match(payload.error || "", /uf|consentimento/i);
});

test("public quote request rejects invalid product variants", async () => {
  const { csrfToken, cookieHeader } = await createCsrfSession(baseUrl);
  const response = await fetch(`${baseUrl}/api/quote-requests`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      customer: { name: "Cliente Teste", whatsapp: "87981818752", cnpj: "12345678000199", city: "Garanhuns", state: "PE" },
      items: [{ productId: "chapas-em-pvc-uv-genesis", productVariantId: "var-inexistente", quantity: 1 }],
      message: "Quero atendimento comercial.",
      pageOrigin: "/orcamento",
      preference: "whatsapp",
      consent: true,
      idempotencyKey: "invalid-variant-test",
    }),
  });

  assert.equal(response.status, 400);
  const payload = await response.json() as { error?: string };
  assert.match(payload.error || "", /variac/i);
});

test("public quote request rejects inactive or draft products server-side", async () => {
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const candidate = db.products.find((item) => item.slug === "chapas-em-pvc-uv-genesis");
  assert.ok(candidate);
  const previous = { is_active: candidate.is_active, status_product: candidate.status_product };
  candidate.is_active = true;
  candidate.status_product = "draft";
  dbModule.writeDb(db);
  await dbModule.waitForPendingDbWrites();

  try {
    const { csrfToken, cookieHeader } = await createCsrfSession(baseUrl);
    const response = await fetch(`${baseUrl}/api/quote-requests`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        customer: { name: "Cliente Teste", whatsapp: "87981818752", cnpj: "12345678000199", city: "Garanhuns", state: "PE" },
        items: [{ productId: candidate.id, quantity: 1 }],
        message: "Quero atendimento comercial.",
        pageOrigin: "/orcamento",
        preference: "whatsapp",
        consent: true,
        idempotencyKey: "inactive-product-test",
      }),
    });

    assert.equal(response.status, 400);
    const payload = await response.json() as { error?: string };
    assert.match(payload.error || "", /produto|disponivel/i);
  } finally {
    const restoreDb = dbModule.readDb();
    const restoreCandidate = restoreDb.products.find((item) => item.id === candidate.id);
    assert.ok(restoreCandidate);
    restoreCandidate.is_active = previous.is_active;
    restoreCandidate.status_product = previous.status_product;
    dbModule.writeDb(restoreDb);
    await dbModule.waitForPendingDbWrites();
  }
});
