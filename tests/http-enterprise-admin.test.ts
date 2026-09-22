import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createCsrfSession, createTestServer, getCookieValue, getDbModule, getSetCookieHeaders } from "./http-server.ts";

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

async function createApprovedOrder() {
  const csrf = await createCsrfSession(baseUrl);
  const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as Array<{ id: string }>;
  assert.ok(products.length > 0);

  const createResponse = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
      "idempotency-key": `enterprise-admin-${Date.now()}-${Math.random()}`,
    },
    body: JSON.stringify({
      customerName: "Cliente Enterprise QA",
      customerEmail: `enterprise-${Date.now()}@lojaopvc.com.br`,
      customerPhone: "87999990000",
      customerCpf: "12345678901",
      deliveryType: "pickup",
      paymentMethod: "pix",
      items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
    }),
  });
  assert.equal(createResponse.status, 200);
  const created = (await createResponse.json()) as { order: { id: string; tracking_token: string } };

  const approveResponse = await fetch(`${baseUrl}/api/orders/${created.order.id}/payment`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      action: "approve",
      trackingToken: created.order.tracking_token,
    }),
  });
  assert.equal(approveResponse.status, 200);
  return created.order;
}

async function createFreshAdminSession() {
  const csrf = await createCsrfSession(baseUrl);
  const signinResponse = await fetch(`${baseUrl}/api/auth/signin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrf.csrfToken,
      cookie: csrf.cookieHeader,
    },
    body: JSON.stringify({
      email: "admin@gamelmetal.com",
      password: "admin123",
    }),
  });
  assert.equal(signinResponse.status, 200);
  const sessionToken = getCookieValue(getSetCookieHeaders(signinResponse), "gamel_session");
  assert.ok(sessionToken);
  return {
    csrfToken: csrf.csrfToken,
    cookieHeader: `lojao_csrf=${csrf.csrfToken}; gamel_session=${sessionToken}`,
  };
}

test("executive action center consolidates actionable operational alerts", async () => {
  const admin = await createAdminSession(baseUrl);
  const createdOrder = await createApprovedOrder();

  const markStuckResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/mark-stuck`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      reason: "Cliente pediu validacao do endereco antes da separacao",
      waitingOn: "customer",
      nextAction: "Retomar contato e confirmar rua/numero.",
    }),
  });
  assert.equal(markStuckResponse.status, 200);

  const response = await fetch(`${baseUrl}/api/admin/executive/action-center`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    summary: { critical: number; external_blockers: number };
    items: Array<{ type: string; route: string; title: string; severity: string; waiting_badge?: string | null }>;
  };

  assert.ok(payload.summary.critical >= 1);
  assert.ok(payload.items.some((item) => item.type === "order" && item.route === `/admin/pedido/${createdOrder.id}` && item.severity === "CRITICO"));
  assert.ok(payload.items.some((item) => item.waiting_badge === "aguardando cliente"));
});

test("executive BI exposes management funnel and channel mix", async () => {
  const admin = await createAdminSession(baseUrl);
  await createApprovedOrder();

  const response = await fetch(`${baseUrl}/api/admin/executive/bi`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    summary: { orders_total: number; paid_orders: number; average_ticket: number; revenue_at_risk: number };
    periods: { last_30_days: { orders: number; revenue: number } };
    funnel: Array<{ key: string; orders: number; action: string }>;
    channel_mix: Array<{ key: string; orders: number; revenue: number }>;
    payment_mix: Array<{ key: string; orders: number; revenue: number }>;
    top_products: Array<{ product_id: string; revenue: number }>;
    category_mix: Array<{ key: string; revenue: number }>;
    owner_sla: Array<{ owner_role: string; total: number }>;
    executive_focus: { next_action: string; revenue_at_risk: number };
    management_notes: string[];
  };

  assert.ok(payload.summary.orders_total >= 1);
  assert.ok(payload.summary.paid_orders >= 1);
  assert.ok(payload.summary.average_ticket > 0);
  assert.ok(payload.periods.last_30_days.orders >= 1);
  assert.ok(payload.funnel.some((stage) => stage.key === "paid_waiting_operation" && stage.action.length > 0));
  assert.ok(payload.channel_mix.some((row) => row.orders >= 1));
  assert.ok(payload.payment_mix.some((row) => row.key === "pix"));
  assert.ok(payload.top_products.length >= 1);
  assert.ok(payload.category_mix.length >= 1);
  assert.ok(payload.owner_sla.length >= 1);
  assert.ok(payload.executive_focus.next_action.length > 0);
  assert.ok(payload.management_notes.length >= 1);
});

test("executive report exports markdown for daily management routine", async () => {
  const admin = await createAdminSession(baseUrl);
  await createApprovedOrder();

  const response = await fetch(`${baseUrl}/api/admin/executive/report?format=md`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const markdown = await response.text();

  assert.match(markdown, /Relatorio executivo da Central Admin/);
  assert.match(markdown, /Decisao rapida/);
  assert.match(markdown, /Funil operacional/);
  assert.match(markdown, /Acoes prioritarias/);
});

test("executive routine exposes daily management checkpoints", async () => {
  const admin = await createAdminSession(baseUrl);
  await createApprovedOrder();

  const response = await fetch(`${baseUrl}/api/admin/executive/routine`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    daily_focus: { title: string; action: string; route: string };
    checkpoints: Array<{ key: string; label: string; when: string; owner: string; status: string; actions: string[] }>;
  };

  assert.ok(payload.daily_focus.title.length > 0);
  assert.ok(payload.daily_focus.action.length > 0);
  assert.ok(payload.daily_focus.route.startsWith("/admin/"));
  assert.ok(payload.checkpoints.some((checkpoint) => checkpoint.key === "opening" && checkpoint.actions.length >= 1));
  assert.ok(payload.checkpoints.some((checkpoint) => checkpoint.key === "pre_go_live" && checkpoint.owner.length > 0));
});

test("executive campaign cockpit summarizes active campaign state", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/executive/campaign-cockpit`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    active_campaign: null | { id: string; name: string; linked_products: number; linked_categories: number };
    metrics: { total_events: number; views: number; orders: number };
    surfaces: Array<{ key: string; ready: boolean; detail: string }>;
    risks: Array<{ severity: string; title: string }>;
    next_actions: string[];
  };

  assert.ok(payload.metrics.total_events >= 0);
  assert.ok(payload.surfaces.some((surface) => surface.key === "hero"));
  assert.ok(payload.next_actions.length >= 0);
  if (payload.active_campaign) {
    assert.ok(payload.active_campaign.id.length > 0);
    assert.ok(payload.active_campaign.name.length > 0);
    assert.ok(payload.active_campaign.linked_products >= 0);
  }
});

test("executive actions export csv for management follow-up", async () => {
  const admin = await createAdminSession(baseUrl);
  await createApprovedOrder();

  const response = await fetch(`${baseUrl}/api/admin/executive/actions.csv`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
  const csv = await response.text();

  assert.match(csv, /"id";"type";"domain";"severity";"title";"responsible";"status";"external";"overdue";"next_action";"route"/);
  assert.match(csv, /\/admin\//);
});

test("admin control center exports live management handoff formats", async () => {
  const admin = await createAdminSession(baseUrl);

  const jsonResponse = await fetch(`${baseUrl}/api/admin/governance/control-center/export`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(jsonResponse.status, 200);
  const json = (await jsonResponse.json()) as {
    production_open: string;
    internal_management_ready: boolean;
    actions: Array<{ id: string; status: string; route: string }>;
  };
  assert.equal(json.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(json.internal_management_ready, true);
  assert.ok(json.actions.some((action) => action.id === "fiscal-provider" && action.status === "blocked_external"));

  const markdownResponse = await fetch(`${baseUrl}/api/admin/governance/control-center/export?format=md`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(markdownResponse.status, 200);
  assert.match(markdownResponse.headers.get("content-type") ?? "", /text\/markdown/);
  const markdown = await markdownResponse.text();
  assert.match(markdown, /Central De Controle Administrativo/);
  assert.match(markdown, /BLOQUEADO_EXTERNO/);

  const csvResponse = await fetch(`${baseUrl}/api/admin/governance/control-center/export?format=csv`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get("content-type") ?? "", /text\/csv/);
  const csv = await csvResponse.text();
  assert.match(csv, /^"id","label","status","priority","owner","route","evidence","note"/);
  assert.match(csv, /"payment-freight-providers"/);
});

test("admin programmatic completion exposes final programmable closure", async () => {
  const admin = await createAdminSession(baseUrl);

  const response = await fetch(`${baseUrl}/api/admin/governance/programmatic-completion`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    production_open: string;
    programmable_scope_complete: boolean;
    checks: Array<{ id: string; ok: boolean }>;
  };
  assert.equal(payload.production_open, "BLOQUEADO_EXTERNO");
  assert.equal(payload.programmable_scope_complete, true);
  assert.ok(payload.checks.some((item) => item.id === "control-freshness" && item.ok));

  const markdownResponse = await fetch(`${baseUrl}/api/admin/governance/programmatic-completion/export?format=md`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(markdownResponse.status, 200);
  assert.match(markdownResponse.headers.get("content-type") ?? "", /text\/markdown/);
  const markdown = await markdownResponse.text();
  assert.match(markdown, /Fechamento Programavel Do Ecommerce/);
  assert.match(markdown, /BLOQUEADO_EXTERNO/);
});

test("executive decision board consolidates go-live gates and 24h priorities", async () => {
  const admin = await createAdminSession(baseUrl);
  await createApprovedOrder();

  const response = await fetch(`${baseUrl}/api/admin/executive/decision-board`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    verdict: { status: string; label: string; next_action: string };
    scorecard: { blockers: number; warnings: number; revenue_at_risk: number; active_orders: number };
    gates: Array<{ key: string; status: string; blockers: number; warnings: number }>;
    operational_signals: { queue_provider: string; database_provider: string; pending_jobs: number; failed_jobs: number };
    next_24h: Array<{ title: string; route: string; action: string }>;
    next_72h: Array<{ title: string; route: string }>;
  };

  assert.ok(payload.verdict.label.length > 0);
  assert.ok(payload.verdict.next_action.length > 0);
  assert.ok(payload.scorecard.active_orders >= 1);
  assert.ok(payload.scorecard.blockers >= 0);
  assert.ok(payload.gates.some((gate) => gate.key === "go_live"));
  assert.ok(payload.gates.some((gate) => gate.key === "security"));
  assert.ok(payload.operational_signals.queue_provider.length > 0);
  assert.ok(payload.operational_signals.database_provider.length > 0);
  assert.ok(payload.next_24h.length >= 0);
  assert.ok(payload.next_72h.length >= 0);
});

test("executive briefing exports automatic meeting minutes", async () => {
  const admin = await createAdminSession(baseUrl);
  await createApprovedOrder();

  const jsonResponse = await fetch(`${baseUrl}/api/admin/executive/briefing`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(jsonResponse.status, 200);
  const payload = (await jsonResponse.json()) as {
    verdict: { label: string };
    meeting_agenda: Array<{ title: string; owner: string; next_action: string }>;
    handoff: Array<{ window: string; title: string; route: string }>;
    risks: Array<{ area: string; severity: string }>;
    markdown: string;
  };

  assert.ok(payload.verdict.label.length > 0);
  assert.ok(payload.meeting_agenda.some((item) => item.title === "Decisao de abertura"));
  assert.ok(payload.markdown.includes("Ata executiva automatica"));

  const markdownResponse = await fetch(`${baseUrl}/api/admin/executive/briefing?format=md`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(markdownResponse.status, 200);
  assert.match(markdownResponse.headers.get("content-type") ?? "", /text\/markdown/);
  const markdown = await markdownResponse.text();
  assert.match(markdown, /Ata executiva automatica/);
  assert.match(markdown, /Handoff 24h\/72h/);
});

test("executive responsibility matrix groups actions by accountable owner", async () => {
  const admin = await createAdminSession(baseUrl);
  await createApprovedOrder();

  const response = await fetch(`${baseUrl}/api/admin/executive/responsibility-matrix`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    summary: { owners: number; actions_total: number; owners_with_overdue: number };
    owners: Array<{
      owner_role: string;
      owner_label: string;
      total_actions: number;
      operation_total: number;
      top_actions: Array<{ title: string; route: string; next_action: string }>;
    }>;
  };

  assert.ok(payload.summary.owners >= 1);
  assert.ok(payload.summary.actions_total >= 0);
  assert.ok(payload.summary.owners_with_overdue >= 0);
  assert.ok(payload.owners.some((owner) => owner.owner_role.length > 0 && owner.owner_label.length > 0));
  assert.ok(payload.owners.some((owner) => owner.operation_total >= 1 || owner.total_actions >= 1));
});

test("order operation state supports assign owner, resolve stuck and advance stage", async () => {
  const admin = await createAdminSession(baseUrl);
  const createdOrder = await createApprovedOrder();

  const stateResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/operation-state`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(stateResponse.status, 200);
  const initialState = (await stateResponse.json()) as { current_stage: string };
  assert.equal(initialState.current_stage, "payment_approved");

  const assignResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/assign-owner`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ ownerUserId: "user-admin", note: "Gerente assume o pedido." }),
  });
  assert.equal(assignResponse.status, 200);
  const assigned = (await assignResponse.json()) as { current_owner_user_id: string; current_owner_name?: string | null };
  assert.equal(assigned.current_owner_user_id, "user-admin");

  const markStuckResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/mark-stuck`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ reason: "Aguardando retorno do contador", waitingOn: "accountant" }),
  });
  assert.equal(markStuckResponse.status, 200);
  const stuck = (await markStuckResponse.json()) as { is_stuck: boolean; current_stage: string; waiting_badge?: string | null };
  assert.equal(stuck.is_stuck, true);
  assert.equal(stuck.current_stage, "waiting_provider");

  const resolveResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/resolve-stuck`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ nextStage: "fiscal_review", note: "Contador liberou a classificacao local." }),
  });
  assert.equal(resolveResponse.status, 200);
  const resolved = (await resolveResponse.json()) as { is_stuck: boolean; current_stage: string };
  assert.equal(resolved.is_stuck, false);
  assert.equal(resolved.current_stage, "fiscal_review");

  const advanceResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/advance-stage`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ nextStage: "confirmed", note: "Pedido liberado para processamento." }),
  });
  assert.equal(advanceResponse.status, 200);
  const advanced = (await advanceResponse.json()) as { status: string; operation_state: { current_stage: string } };
  assert.equal(advanced.status, "confirmed");
  assert.equal(advanced.operation_state.current_stage, "confirmed");
});

test("catalog profile cannot assign operational owner or advance sensitive stage", async () => {
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const adminUser = db.users.find((user) => user.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id ?? "admin_master";
  adminUser.user_metadata.permission_profile_id = "catalog_content";
  dbModule.writeDb(db);
  await dbModule.waitForPendingDbWrites();

  try {
    const catalogSession = await createFreshAdminSession();
    const createdOrder = await createApprovedOrder();

    const assignResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/assign-owner`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": catalogSession.csrfToken,
        cookie: catalogSession.cookieHeader,
      },
      body: JSON.stringify({ ownerUserId: "user-admin" }),
    });
    assert.equal(assignResponse.status, 403);

    const advanceResponse = await fetch(`${baseUrl}/api/admin/orders/${createdOrder.id}/advance-stage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": catalogSession.csrfToken,
        cookie: catalogSession.cookieHeader,
      },
      body: JSON.stringify({ nextStage: "confirmed" }),
    });
    assert.equal(advanceResponse.status, 403);
  } finally {
    const resetDb = dbModule.readDb();
    const resetAdmin = resetDb.users.find((user) => user.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
    }
    dbModule.writeDb(resetDb);
    await dbModule.waitForPendingDbWrites();
  }
});

test("my workspace adapts queues and title to the authenticated profile", async () => {
  const dbModule = await getDbModule();
  const db = dbModule.readDb();
  const adminUser = db.users.find((user) => user.id === "user-admin");
  assert.ok(adminUser);
  const originalProfile = adminUser.user_metadata.permission_profile_id ?? "admin_master";
  adminUser.user_metadata.permission_profile_id = "cashier_finance";
  dbModule.writeDb(db);
  await dbModule.waitForPendingDbWrites();

  try {
    const cashierSession = await createFreshAdminSession();
    const response = await fetch(`${baseUrl}/api/admin/my-workspace`, {
      headers: { cookie: cashierSession.cookieHeader },
    });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { profile: { slug: string }; title: string; shortcuts: Array<{ href: string }> };
    assert.equal(payload.profile.slug, "caixa_financeiro");
    assert.match(payload.title, /Caixa e Financeiro/i);
    assert.ok(payload.shortcuts.some((shortcut) => shortcut.href === "/admin/fiscal-financeiro"));
  } finally {
    const resetDb = dbModule.readDb();
    const resetAdmin = resetDb.users.find((user) => user.id === "user-admin");
    if (resetAdmin) {
      resetAdmin.user_metadata.permission_profile_id = originalProfile;
    }
    dbModule.writeDb(resetDb);
    await dbModule.waitForPendingDbWrites();
  }
});
