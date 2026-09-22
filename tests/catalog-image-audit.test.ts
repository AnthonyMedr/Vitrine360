import assert from "node:assert/strict";
import { test } from "node:test";
import { auditCatalogImages } from "../src/lib/catalogImageAudit.ts";

test("catalog image audit flags missing image as critical", () => {
  const report = auditCatalogImages([
    {
      id: "prod-1",
      name: "Forro PVC Branco 200mm",
      slug: "forro-pvc-branco-200mm",
      category: { name: "PVC Amadeirado", slug: "pvc-amadeirado" },
      images: [],
      image_url: null,
      image_alt_text: "",
    },
  ]);

  assert.equal(report.summary.critical, 1);
  assert.equal(report.items[0]?.audit_status, "critical");
  assert.ok(report.items[0]?.issues.some((issue) => issue.code === "missing_image"));
});

test("catalog image audit flags duplicated generic image as suspect", () => {
  const report = auditCatalogImages([
    {
      id: "prod-2",
      name: "Chapa UV Calacata",
      slug: "chapa-uv-calacata",
      category: { name: "Chapas UV", slug: "placas-uv" },
      image_url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600",
      images: ["https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600"],
      image_alt_text: "Imagem de apoio",
    },
    {
      id: "prod-3",
      name: "Drywall ST 12,5mm",
      slug: "drywall-st-125mm",
      category: { name: "Drywall", slug: "drywall" },
      image_url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600",
      images: ["https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600"],
      image_alt_text: "Imagem de apoio",
    },
  ]);

  assert.ok(report.summary.suspect >= 2);
  assert.ok(report.items.every((item) => item.issues.some((issue) => issue.code === "duplicate_image")));
  assert.ok(report.items.every((item) => item.issues.some((issue) => issue.code === "generic_image")));
});

test("catalog image audit keeps coherent image metadata as ok", () => {
  const report = auditCatalogImages([
    {
      id: "prod-4",
      name: "Policarbonato Alveolar Transparente",
      slug: "policarbonato-alveolar-transparente",
      category: { name: "Policarbonato", slug: "policarbonato" },
      image_url: "/assets/policarbonato-alveolar-transparente.jpg",
      images: ["/assets/policarbonato-alveolar-transparente.jpg"],
      image_alt_text: "Policarbonato alveolar transparente para cobertura",
      image_review_status: "approved",
    },
  ]);

  assert.equal(report.summary.ok, 1);
  assert.equal(report.items[0]?.audit_status, "ok");
});

test("catalog image audit downgrades inactive placeholder backlog to manual review", () => {
  const report = auditCatalogImages([
    {
      id: "prod-5",
      is_active: false,
      status_product: "draft",
      availability: "sob_consulta",
      name: "Forro PVC Origem",
      slug: "forro-pvc-origem",
      category: { name: "Forros PVC", slug: "forros-pvc" },
      image_url: "/placeholder.svg",
      images: ["/placeholder.svg"],
      image_alt_text: "Imagem em revisao",
      image_review_status: "manual_review",
    },
  ]);

  assert.equal(report.summary.critical, 0);
  assert.notEqual(report.items[0]?.audit_status, "critical");
  assert.ok(report.items[0]?.issues.some((issue) => issue.code === "placeholder_image"));
});

test("catalog image audit respects explicit human override tags for duplicate and generic heuristics", () => {
  const report = auditCatalogImages([
    {
      id: "prod-6",
      is_active: true,
      name: "Ripado Interno WPC Carvalho 160mm x 2,90m",
      slug: "ripado-interno-wpc-carvalho",
      category: { name: "Ripados WPC", slug: "ripados-wpc" },
      image_url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600",
      images: ["https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600"],
      image_alt_text: "Imagem de apoio revisada",
      image_review_status: "approved",
      image_review_notes: "Aprovacao humana da familia [duplicate-ok] [generic-ok]",
    },
    {
      id: "prod-7",
      is_active: true,
      name: "Ripado Externo WPC Ipe 160mm x 2,90m",
      slug: "ripado-externo-wpc-ipe",
      category: { name: "Ripados WPC", slug: "ripados-wpc" },
      image_url: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600",
      images: ["https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600"],
      image_alt_text: "Imagem de apoio revisada",
      image_review_status: "approved",
      image_review_notes: "Aprovacao humana da familia [duplicate-ok] [generic-ok]",
    },
  ]);

  assert.ok(report.items.every((item) => item.issues.every((issue) => issue.code !== "duplicate_image")));
  assert.ok(report.items.every((item) => item.issues.every((issue) => issue.code !== "generic_image")));
  assert.equal(report.summary.human_override_total, 2);
  assert.equal(report.summary.duplicate_override, 2);
  assert.equal(report.summary.generic_override, 2);
});

test("catalog image audit parses assignment and due date into SLA status", () => {
  const report = auditCatalogImages([
    {
      id: "prod-8",
      is_active: true,
      name: "Forro PVC Freijo 200mm",
      slug: "forro-pvc-freijo-200mm",
      category: { name: "Forros PVC", slug: "forros-pvc" },
      image_url: "/placeholder.svg",
      images: ["/placeholder.svg"],
      image_alt_text: "Imagem em revisao",
      image_review_status: "manual_review",
      image_review_notes: "Fila operacional [assignee:Maria Silva] [due:2026-05-19]",
    },
  ]);

  assert.equal(report.items[0]?.review_assignee, "Maria Silva");
  assert.equal(report.items[0]?.review_due_date, "2026-05-19");
  assert.equal(report.items[0]?.review_sla_status, "overdue");
});
