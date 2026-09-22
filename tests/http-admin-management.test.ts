import test from "node:test";
import assert from "node:assert/strict";
import { createAdminSession, createTestServer, getDbModule } from "./http-server.ts";

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

test("admin management endpoints support daily operation, evidence and exports", async () => {
  const admin = await createAdminSession(baseUrl);

  const listResponse = await fetch(`${baseUrl}/api/admin/management/tasks`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as { tasks: Array<{ id: string; external_blocker: boolean; status: string }> };
  assert.ok(list.tasks.length >= 1);

  const externalTask = list.tasks.find((task) => task.external_blocker);
  assert.ok(externalTask);

  const blockedConclusionResponse = await fetch(`${baseUrl}/api/admin/management/tasks/${externalTask.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({ status: "concluido", evidence: "", evidence_url: "" }),
  });
  assert.equal(blockedConclusionResponse.status, 400);
  const blockedPayload = (await blockedConclusionResponse.json()) as { error?: string };
  assert.match(blockedPayload.error || "", /evidencia/i);

  const createResponse = await fetch(`${baseUrl}/api/admin/management/tasks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      title: "Validar rotina gerencial QA",
      description: "Tarefa manual criada para validar a Central Admin gerencial.",
      area: "Gestao",
      owner: "Gerente Ecommerce",
      status: "novo",
      severity: "medium",
      due_at: new Date(Date.now() + 86_400_000).toISOString(),
      evidence_required: true,
      evidence: "Abertura da rotina validada em teste HTTP.",
      evidence_url: "docs/reports/admin-management-http-evidence.md",
      recommended_action: "Registrar evidencia e acompanhar no Kanban.",
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { task: { id: string; source: string; evidence_url: string }; event: { event_type: string } };
  assert.ok(created.task.id.startsWith("manual-"));
  assert.equal(created.task.source, "manual");
  assert.equal(created.task.evidence_url, "docs/reports/admin-management-http-evidence.md");
  assert.equal(created.event.event_type, "created");

  const updateResponse = await fetch(`${baseUrl}/api/admin/management/tasks/${created.task.id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": admin.csrfToken,
      cookie: admin.cookieHeader,
    },
    body: JSON.stringify({
      status: "em_revisao",
      owner: "Admin Master",
      evidence: "Revisao operacional concluida no teste.",
      evidence_url: "docs/reports/admin-management-http-evidence-reviewed.md",
      note: "Validado por teste HTTP.",
    }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = (await updateResponse.json()) as { task: { id: string; status: string; owner: string; evidence_url: string } };
  assert.equal(updated.task.id, created.task.id);
  assert.equal(updated.task.status, "em_revisao");
  assert.equal(updated.task.owner, "Admin Master");
  assert.equal(updated.task.evidence_url, "docs/reports/admin-management-http-evidence-reviewed.md");

  const eventsResponse = await fetch(`${baseUrl}/api/admin/management/tasks/${created.task.id}/events`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(eventsResponse.status, 200);
  const events = (await eventsResponse.json()) as { events: Array<{ event_type: string; evidence_url?: string | null }> };
  assert.ok(events.events.length >= 2);
  assert.ok(events.events.some((event) => event.event_type === "created"));

  const reportsMarkdownResponse = await fetch(`${baseUrl}/api/admin/management/reports?format=md`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(reportsMarkdownResponse.status, 200);
  assert.match(reportsMarkdownResponse.headers.get("content-type") ?? "", /text\/markdown/);
  const markdown = await reportsMarkdownResponse.text();
  assert.match(markdown, /Relatorio Gerencial - Central Admin/);
  assert.match(markdown, /BLOQUEADO_EXTERNO/);
  assert.doesNotMatch(markdown, /ACCESS_TOKEN|SECRET_KEY|password_hash/i);

  const csvResponse = await fetch(`${baseUrl}/api/admin/management/tasks?format=csv`, {
    headers: { cookie: admin.cookieHeader },
  });
  assert.equal(csvResponse.status, 200);
  const csv = await csvResponse.text();
  assert.match(csv, /"evidence_url"/);
  assert.match(csv, /admin-management-http-evidence-reviewed/);

  const { readDb } = await getDbModule();
  const db = readDb();
  assert.ok(db.auditLogs.some((entry) => entry.event_type.startsWith("admin.management_task.") && entry.payload?.task_id === created.task.id));
});
