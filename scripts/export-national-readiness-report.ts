import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateRuntimeBackupPayload } from "../server/backup-operations";
import { appConfig } from "../server/config";
import { closeDbResources, initializeDb, readDb } from "../server/db";
import { getFreightCatalogReadinessReport } from "../server/freight-catalog-readiness";
import { getGoLiveReadinessReport } from "../server/go-live-readiness";
import { getOperationReadinessReport } from "../server/operation-readiness";
import { getPhase1ReadinessReport } from "../server/phase1-readiness";
import { getPhase2ReadinessReport } from "../server/phase2-readiness";
import { closePostgresPool } from "../server/postgres";
import { getPublicApiRuntimeStatus } from "../server/public-api-runtime";
import { getAdminFiscalReadiness } from "../server/read-models";
import { closeRedisClient } from "../server/redis";
import { getReleaseReadinessReport } from "../server/release-readiness";
import {
  getErpProviderStatus,
  getFiscalProviderStatus,
  getFreightProviderStatus,
  getIntegrationOverview,
  getPaymentProviderStatus,
} from "../server/runtime-overview";
import { getSecurityReadinessReport } from "../server/security-readiness";

const reportDir = path.resolve(process.cwd(), "docs/reports");
const latestBackupPath = path.resolve(reportDir, "runtime-backups/runtime-backup-latest.json");

type BackupReportStatus = {
  exists: boolean;
  path: string;
  valid: boolean;
  errors: string[];
};

export type NationalReadinessReportPayload = Awaited<ReturnType<typeof buildNationalReadinessReportPayload>>;

function isoStamp(value = new Date()) {
  return value.toISOString().replace(/[:.]/g, "-").slice(0, 16);
}

function status(value: boolean) {
  return value ? "PASS" : "BLOCKED";
}

function providerGoLiveStatus(block: "payment" | "freight" | "fiscal" | "erp", provider: string, ready: boolean) {
  if (block === "payment" && ["manual", "fake"].includes(provider)) return "BLOCKED_GO_LIVE";
  if (block === "freight" && ["local-rules", "fake"].includes(provider)) return "BLOCKED_GO_LIVE";
  if (block === "fiscal" && ["manual", "none", "fake"].includes(provider)) return "ASSISTED_ONLY";
  if (block === "erp" && ["none", "manual", "fake"].includes(provider)) return "ASSISTED_ONLY";
  return status(ready);
}

function providerPendingLabel(block: "payment" | "freight" | "fiscal" | "erp", provider: string, missing: string[]) {
  if (missing.length > 0) return missing.join(", ");
  if (block === "payment" && ["manual", "fake"].includes(provider)) return "Configurar gateway real e homologar webhook.";
  if (block === "freight" && ["local-rules", "fake"].includes(provider)) return "Configurar provider real e homologar cotacao.";
  if (block === "fiscal" && ["manual", "none", "fake"].includes(provider)) return "Fechamento fiscal real depende do contador/emissor.";
  if (block === "erp" && ["none", "manual", "fake"].includes(provider)) return "ERP externo nao obrigatorio para Fase 1; manter operacao assistida.";
  return "-";
}

function yesNo(value: boolean) {
  return value ? "sim" : "nao";
}

function list(items: string[]) {
  if (items.length === 0) return "- Nenhuma pendencia neste bloco.";
  return items.map((item) => `- ${item}`).join("\n");
}

function table(rows: Array<Array<string | number | boolean | null | undefined>>) {
  const normalized = rows.map((row) => row.map((cell) => String(cell ?? "-")));
  return normalized.map((row) => `| ${row.join(" | ")} |`).join("\n");
}

function collectCheckDetails(checks: Array<{ item?: string; key?: string; detail?: string; message?: string }>) {
  return checks.map((entry) => {
    const name = entry.item ?? entry.key ?? "check";
    return `${name}: ${entry.detail ?? entry.message ?? ""}`;
  });
}

function getBackupStatus(): BackupReportStatus {
  if (!fs.existsSync(latestBackupPath)) {
    return {
      exists: false,
      path: latestBackupPath,
      valid: false,
      errors: ["Backup runtime latest ainda nao foi gerado."],
    };
  }

  try {
    const payload = JSON.parse(fs.readFileSync(latestBackupPath, "utf8"));
    const validation = validateRuntimeBackupPayload(payload);
    return {
      exists: true,
      path: latestBackupPath,
      valid: validation.ok,
      errors: [...validation.blockers, ...validation.warnings],
    };
  } catch (error) {
    return {
      exists: true,
      path: latestBackupPath,
      valid: false,
      errors: [error instanceof Error ? error.message : "Falha ao ler backup runtime."],
    };
  }
}

export async function buildNationalReadinessReportPayload() {
  await initializeDb();
  const db = readDb();
  const generatedAt = new Date().toISOString();
  const activeProducts = db.products.filter((product) => product.is_active && product.status_product !== "inactive");
  const activeCategories = db.categories.filter((category) => category.is_active);

  const [
    phase1,
    release,
    integrationOverview,
  ] = await Promise.all([
    getPhase1ReadinessReport(),
    getReleaseReadinessReport(db),
    getIntegrationOverview(),
  ]);

  const freightCatalog = getFreightCatalogReadinessReport(db);
  const phase2 = getPhase2ReadinessReport();
  const security = getSecurityReadinessReport();
  const goLive = getGoLiveReadinessReport();
  const operations = getOperationReadinessReport(db);
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const publicApis = getPublicApiRuntimeStatus();
  const payment = getPaymentProviderStatus();
  const freight = getFreightProviderStatus();
  const fiscalProvider = getFiscalProviderStatus();
  const erp = getErpProviderStatus();
  const backup = getBackupStatus();

  const localBaseReady =
    freightCatalog.national_freight_ready
    && operations.ready
    && backup.valid
    && release.sections.operations.ready;

  return {
    generated_at: generatedAt,
    environment: {
      node_env: appConfig.env,
      app_base_url: appConfig.appBaseUrl,
      db_provider: appConfig.dbProvider,
      queue_provider: appConfig.queueProvider,
      homologation_only: appConfig.homologationOnly,
    },
    decision: {
      local_base_ready: localBaseReady,
      national_go_live_ready: release.ready && goLive.go_live_ready && phase2.phase2_ready,
      verdict: release.ready && goLive.go_live_ready && phase2.phase2_ready
        ? "GO tecnico liberado pelos gates atuais"
        : localBaseReady
          ? "Base local pronta; go-live nacional bloqueado por insumos reais"
          : "Base local ainda possui pendencias antes do go-live nacional",
    },
    catalog: {
      active_products: activeProducts.length,
      active_categories: activeCategories.length,
      category_names: activeCategories.map((category) => category.name).sort(),
    },
    freight_catalog: freightCatalog,
    public_apis: publicApis,
    providers: {
      payment,
      freight,
      fiscal: fiscalProvider,
      erp,
    },
    readiness: {
      phase1,
      phase2,
      security,
      fiscal,
      operations,
      release,
      go_live: goLive,
    },
    integration_overview: integrationOverview,
    backup,
    required_commands: [
      "npm run lint",
      "npm run typecheck",
      "npm test",
      "npm run build",
      "npm run backup:export:latest",
      "npm run backup:validate -- docs/reports/runtime-backups/runtime-backup-latest.json",
      "npm run freight:catalog:check",
      "npm run execution:plan",
    ],
  };
}

export function renderNationalReadinessMarkdown(payload: NationalReadinessReportPayload) {
  const releaseSections = Object.entries(payload.readiness.release.sections).map(([name, section]) => [
    name,
    status(section.ready),
    section.blockers,
    section.warnings,
    section.summary,
  ]);

  const providerRows = [
    [
      "Pagamento",
      payload.providers.payment.provider,
      providerGoLiveStatus("payment", payload.providers.payment.provider, payload.providers.payment.ready),
      providerPendingLabel("payment", payload.providers.payment.provider, payload.providers.payment.missing),
    ],
    [
      "Frete",
      payload.providers.freight.provider,
      providerGoLiveStatus("freight", payload.providers.freight.provider, payload.providers.freight.ready),
      providerPendingLabel("freight", payload.providers.freight.provider, payload.providers.freight.missing),
    ],
    [
      "Fiscal",
      payload.providers.fiscal.provider,
      providerGoLiveStatus("fiscal", payload.providers.fiscal.provider, payload.providers.fiscal.ready),
      providerPendingLabel("fiscal", payload.providers.fiscal.provider, payload.providers.fiscal.missing),
    ],
    [
      "ERP",
      payload.providers.erp.provider,
      providerGoLiveStatus("erp", payload.providers.erp.provider, payload.providers.erp.ready),
      providerPendingLabel("erp", payload.providers.erp.provider, payload.providers.erp.missing),
    ],
  ];

  const pendingItems = [
    ...collectCheckDetails(payload.readiness.phase1.checks.filter((check) => check.status === "blocker")),
    ...payload.readiness.phase2.checks.blockers.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.security.checks.blockers.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.fiscal.checks.blockers.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.operations.checks.blockers.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.go_live.checks.blockers.map((check) => `${check.item}: ${check.detail}`),
  ];

  const warnings = [
    ...collectCheckDetails(payload.readiness.phase1.checks.filter((check) => check.status === "warning")),
    ...payload.readiness.phase2.checks.warnings.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.security.checks.warnings.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.fiscal.checks.warnings.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.operations.checks.warnings.map((check) => `${check.item}: ${check.detail}`),
    ...payload.readiness.go_live.checks.warnings.map((check) => `${check.item}: ${check.detail}`),
    ...payload.freight_catalog.warnings.slice(0, 20).map((item) => `${item.sku ?? item.id}: ${item.name} (${item.warnings.join(", ")})`),
  ];

  return `# Super relatorio nacional do ecommerce

Gerado em: ${payload.generated_at}

## Decisao executiva

- Veredito: ${payload.decision.verdict}
- Base local pronta: ${yesNo(payload.decision.local_base_ready)}
- Go-live nacional pronto: ${yesNo(payload.decision.national_go_live_ready)}
- Ambiente: ${payload.environment.node_env}
- App base URL: ${payload.environment.app_base_url}
- Banco/fila: ${payload.environment.db_provider} / ${payload.environment.queue_provider}
- Homologation only: ${yesNo(payload.environment.homologation_only)}

## Escopo nacional implementado

${table([
    ["Indicador", "Valor"],
    ["Produtos ativos", payload.catalog.active_products],
    ["Categorias ativas", payload.catalog.active_categories],
    ["Produtos prontos para frete nacional", payload.freight_catalog.summary.ready_products],
    ["Produtos bloqueados para frete nacional", payload.freight_catalog.summary.blocked_products],
    ["Produtos com warnings logisticos", payload.freight_catalog.summary.warning_products],
  ])}

Categorias ativas:
${list(payload.catalog.category_names)}

## APIs publicas

${table([
    ["API", "Status", "Provedores", "Cache"],
    ["CEP", "PASS", payload.public_apis.providers.cep.join(", "), `${payload.public_apis.cache.address_ttl_ms} ms`],
    ["CNPJ", "PASS", payload.public_apis.providers.cnpj.join(", "), `${payload.public_apis.cache.company_ttl_ms} ms`],
  ])}

Politica: ${payload.public_apis.usage_policy}

## Provedores reais

${table([
    ["Bloco", "Provider", "Status", "Pendencias"],
    ...providerRows,
  ])}

## Gates de release

${table([
    ["Gate", "Status", "Blockers", "Warnings", "Resumo"],
    ...releaseSections,
  ])}

## Frete nacional

${table([
    ["Indicador", "Valor"],
    ["Catalogo nacional pronto", status(payload.freight_catalog.national_freight_ready)],
    ["Produtos ativos analisados", payload.freight_catalog.summary.total_active_products],
    ["Sem peso", payload.freight_catalog.summary.missing_weight],
    ["Sem dimensoes", payload.freight_catalog.summary.missing_dimensions],
    ["Quote-only ou entrega sob analise", payload.freight_catalog.summary.quote_only],
  ])}

Proximos passos de frete:
${list(payload.freight_catalog.next_steps)}

## Fiscal e operacao

${table([
    ["Bloco", "Status", "Blockers", "Warnings"],
    ["Fiscal minimo", status(payload.readiness.fiscal.ready), payload.readiness.fiscal.blockers, payload.readiness.fiscal.warnings],
    ["Operacao", status(payload.readiness.operations.ready), payload.readiness.operations.blockers, payload.readiness.operations.warnings],
    ["Seguranca", status(payload.readiness.security.ready), payload.readiness.security.blockers, payload.readiness.security.warnings],
    ["Fase 1 infra", status(payload.readiness.phase1.ok), payload.readiness.phase1.blockers, payload.readiness.phase1.warnings],
    ["Fase 2 providers", status(payload.readiness.phase2.phase2_ready), payload.readiness.phase2.blockers, payload.readiness.phase2.warnings],
    ["Go-live", status(payload.readiness.go_live.go_live_ready), payload.readiness.go_live.blockers, payload.readiness.go_live.warnings],
  ])}

## Backup runtime

${table([
    ["Arquivo", "Existe", "Valido", "Erros"],
    [payload.backup.path, yesNo(payload.backup.exists), yesNo(payload.backup.valid), payload.backup.errors.join("; ") || "-"],
  ])}

## Pendencias bloqueadoras

${list(Array.from(new Set(pendingItems)))}

## Warnings e validacoes antes do go-live

${list(Array.from(new Set(warnings)))}

## Comandos finais recomendados

${list(payload.required_commands)}

## Ordem de fechamento

1. Aplicar variaveis reais de Postgres, Redis, Mercado Pago, Melhor Envio e segredo CSRF.
2. Fechar o pacote fiscal minimo com dados reais da empresa e perfis fiscais definitivos.
3. Rodar ${"`npm run execution:plan`"} e tratar qualquer falha obrigatoria.
4. Rodar homologacao ponta a ponta com pagamento, webhook, frete nacional e emissao fiscal.
5. Reexecutar ${"`npm run release:check`"} e ${"`npm run go-live:check`"} como gates finais.
`;
}

async function main() {
  const payload = await buildNationalReadinessReportPayload();
  const markdown = renderNationalReadinessMarkdown(payload);
  const stamp = isoStamp();
  const timestampedMarkdownPath = path.resolve(reportDir, `national-readiness-report-${stamp}.md`);
  const latestMarkdownPath = path.resolve(reportDir, "national-readiness-report-latest.md");
  const latestJsonPath = path.resolve(reportDir, "national-readiness-report-latest.json");

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(timestampedMarkdownPath, markdown, "utf8");
  fs.writeFileSync(latestMarkdownPath, markdown, "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Relatorio nacional gerado: ${timestampedMarkdownPath}`);
  console.log(`Ultima versao Markdown: ${latestMarkdownPath}`);
  console.log(`Ultima versao JSON: ${latestJsonPath}`);
  console.log(`Veredito: ${payload.decision.verdict}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      closeDbResources();
      await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
    });
}
