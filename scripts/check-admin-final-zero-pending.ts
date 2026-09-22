import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

type Check = {
  id: string;
  ok: boolean;
  detail: string;
};

function readText(path: string) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function readJson(path: string) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function hashFile(path: string) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function includesAll(content: string, patterns: RegExp[]) {
  return patterns.every((pattern) => pattern.test(content));
}

const finalDelivery = readJson("docs/reports/final-delivery-latest.json");
const adminComplete = readJson("docs/reports/admin-enterprise-complete-latest.json");
const manifest = readJson("docs/reports/admin-enterprise-manifest-latest.json");
const manifestArtifacts = Array.isArray(manifest?.artifacts) ? (manifest.artifacts as Record<string, unknown>[]) : [];
const driftedArtifacts = manifestArtifacts.filter((artifact) => {
  const path = String(artifact.path ?? "");
  const expected = String(artifact.sha256 ?? "");
  return !path || !expected || hashFile(path) !== expected;
}).length;
const evolutionDoc = readText("docs/admin/RELATORIO_EVOLUCAO_CENTRAL_ADMIN_ENTERPRISE.md");
const planDoc = readText("docs/admin/PLANO_EXECUCAO_CENTRAL_ADMIN_ENTERPRISE.md");
const phaseDoc = readText("docs/admin/EXECUCAO_FASE_A_FASE_CENTRAL_ADMIN.md");
const adoptionPack = readJson("docs/reports/admin-operational-adoption-pack-latest.json");
const adoptionDoc = readText("docs/admin/PLANO_ADOCAO_OPERACIONAL_ADMIN.md");

const checks: Check[] = [
  {
    id: "final_delivery_ok",
    ok:
      finalDelivery?.ok === true &&
      finalDelivery.programmable_scope === "CONCLUIDO" &&
      finalDelivery.production_open === "BLOQUEADO_EXTERNO",
    detail: "Entrega final precisa estar ok, concluida e com producao aberta bloqueada por externo.",
  },
  {
    id: "admin_complete_ok",
    ok: adminComplete?.ok === true && Array.isArray(adminComplete.steps) && adminComplete.steps.length === 6,
    detail: "Conclusao oficial do Admin precisa estar ok com seis etapas executadas.",
  },
  {
    id: "manifest_without_drift",
    ok: manifest?.ok === true && manifest.production_open === "BLOQUEADO_EXTERNO" && manifestArtifacts.length > 0 && driftedArtifacts === 0,
    detail: "Manifesto precisa estar verificado sem drift e com producao aberta bloqueada.",
  },
  {
    id: "evolution_doc_zero_programmable_pending",
    ok: includesAll(evolutionDoc, [/Pendencias Programaveis/, /Nenhuma pendencia programavel restante/, /Veredito programavel: tudo que depende apenas de codigo/]),
    detail: "Relatorio de evolucao precisa declarar zero pendencias programaveis.",
  },
  {
    id: "plan_doc_zero_programmable_pending",
    ok: includesAll(planDoc, [/Resultado Programavel Final/, /Pendencias programaveis restantes: `0`/, /npm run final:delivery/]),
    detail: "Plano precisa registrar resultado programavel final e comando oficial.",
  },
  {
    id: "phase_doc_zero_programmable_pending",
    ok: includesAll(phaseDoc, [/Status Final Programavel/, /Pendencias programaveis restantes: `0`/, /production_open=BLOQUEADO_EXTERNO/]),
    detail: "Execucao fase a fase precisa registrar status final programavel.",
  },
  {
    id: "adoption_pack_preserves_external_execution",
    ok:
      adoptionPack?.ok === true &&
      adoptionPack.programmable_pending === 0 &&
      adoptionPack.production_open === "BLOQUEADO_EXTERNO" &&
      includesAll(adoptionDoc, [/Treinamento Assistido/, /Homologacao Operacional/, /BLOQUEADO_EXTERNO/]),
    detail: "Pacote de adocao precisa estar ok, com pendencia programavel zero e execucao real preservada.",
  },
];

const failed = checks.filter((check) => !check.ok);
const report = {
  generated_at: new Date().toISOString(),
  ok: failed.length === 0,
  programmable_pending: failed.length === 0 ? 0 : failed.length,
  production_open: "BLOQUEADO_EXTERNO",
  checks,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
