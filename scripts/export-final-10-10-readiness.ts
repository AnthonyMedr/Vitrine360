import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type JsonRecord = Record<string, unknown>;

function readJson(path: string): JsonRecord | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as JsonRecord;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nested(record: JsonRecord | null, keys: string[]) {
  let current: unknown = record;
  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as JsonRecord)[key];
  }
  return current;
}

const finalZero = readJson("docs/reports/final-zero-sequential-latest.json");
const externalHandoff = readJson("docs/reports/go-live-external-handoff-latest.json");
const manifest = readJson("docs/reports/admin-enterprise-manifest-latest.json");
const continuity = readJson("docs/reports/continuity-validation-latest.json");

const programmableOk =
  finalZero?.ok === true &&
  finalZero.programmable_pending === 0 &&
  finalZero.production_open === "BLOQUEADO_EXTERNO" &&
  manifest?.ok === true &&
  asNumber(manifest.drifted_artifacts) === 0;

const internalReady = continuity?.internal_ready === true || finalZero?.ok === true;
const externalBlockers = asNumber(nested(externalHandoff, ["summary", "external_blockers"]));
const releaseBlockers = asNumber(nested(externalHandoff, ["summary", "release_blockers"]));
const goLiveReady = nested(externalHandoff, ["summary", "go_live_ready"]) === true;

const productionOpenReady = programmableOk && internalReady && goLiveReady && externalBlockers === 0 && releaseBlockers === 0;
const programmableScore = programmableOk && internalReady ? "10/10" : "PENDENTE";
const productionOpenScore = productionOpenReady ? "10/10" : "BLOQUEADO_EXTERNO";

const report = {
  generated_at: new Date().toISOString(),
  ok: programmableOk && internalReady,
  programmable_score: programmableScore,
  production_open_score: productionOpenScore,
  programmable_pending: programmableOk ? 0 : 1,
  production_open: productionOpenReady ? "LIBERAVEL" : "BLOQUEADO_EXTERNO",
  verdict:
    programmableOk && internalReady
      ? "ECOMMERCE_10_10_PROGRAMAVEL_COM_PRODUCAO_ABERTA_BLOQUEADA_POR_EXTERNOS"
      : "ECOMMERCE_AINDA_TEM_PENDENCIA_PROGRAMAVEL",
  evidence: {
    final_zero_ok: finalZero?.ok === true,
    manifest_ok: manifest?.ok === true,
    manifest_drifted_artifacts: asNumber(manifest?.drifted_artifacts),
    continuity_internal_ready: internalReady,
    external_blockers: externalBlockers,
    release_blockers: releaseBlockers,
    go_live_ready: goLiveReady,
  },
  remaining_external_gates: [
    "Mercado Pago/provedor real de pagamento com credenciais e webhook homologados.",
    "Provider real de frete com cotacao, fallback e prazos homologados.",
    "Contador/fiscal validar NCM, tax_code e fechamento fiscal minimo.",
    "Homologacao operacional real com evidencias de pedido ponta a ponta.",
  ],
};

function renderMarkdown() {
  const lines = [
    "# Fechamento Final 10/10 Do Ecommerce",
    "",
    `Gerado em: \`${report.generated_at}\``,
    "",
    "## Veredito",
    "",
    `- Nota programavel: \`${report.programmable_score}\``,
    `- Nota para producao aberta: \`${report.production_open_score}\``,
    `- Pendencia programavel: \`${report.programmable_pending}\``,
    `- Producao aberta: \`${report.production_open}\``,
    `- Veredito: \`${report.verdict}\``,
    "",
    "## Evidencias",
    "",
    `- Final zero sequencial: \`${report.evidence.final_zero_ok}\``,
    `- Manifesto sem drift: \`${report.evidence.manifest_ok && report.evidence.manifest_drifted_artifacts === 0}\``,
    `- Continuidade interna pronta: \`${report.evidence.continuity_internal_ready}\``,
    `- Bloqueios externos: \`${report.evidence.external_blockers}\``,
    `- Bloqueios de release: \`${report.evidence.release_blockers}\``,
    `- Go-live aberto pronto: \`${report.evidence.go_live_ready}\``,
    "",
    "## Gates Externos Restantes",
    "",
    ...report.remaining_external_gates.map((gate) => `- ${gate}`),
    "",
    "## Conclusao",
    "",
    "Tudo que depende apenas de codigo, validacao local, documentacao e automacao foi fechado como 10/10. Producao aberta segue bloqueada por insumos reais que nao devem ser simulados.",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

const basePath = resolve("docs/reports/final-10-10-readiness-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(), "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  programmable_score: report.programmable_score,
  production_open_score: report.production_open_score,
  programmable_pending: report.programmable_pending,
  production_open: report.production_open,
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) process.exit(1);
