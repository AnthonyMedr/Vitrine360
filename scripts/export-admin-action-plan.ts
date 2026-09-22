import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getCatalogStagingWorkboard, SOFT_LAUNCH_DEFERRED_SKUS } from "../server/catalog-staging.ts";
import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { getOperationReadinessReport } from "../server/operation-readiness.ts";
import { getPhase1ReadinessReport } from "../server/phase1-readiness.ts";
import { getPhase2ReadinessReport } from "../server/phase2-readiness.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { getReleaseReadinessReport } from "../server/release-readiness.ts";
import { getAdminFiscalReadiness } from "../server/read-models.ts";
import { closeRedisClient } from "../server/redis.ts";

type PendingType =
  | "PROGRAMAVEL"
  | "ADMIN_SITE"
  | "CONTADOR"
  | "CREDENCIAL"
  | "AMBIENTE"
  | "HOMOLOGACAO_MANUAL"
  | "BACKLOG_ESCALA";

type PendingSeverity = "CRITICO" | "ALTO" | "MEDIO" | "BAIXO";

type PendingItem = {
  area: string;
  pendencia: string;
  tipo: PendingType;
  severidade: PendingSeverity;
  responsavel: string;
  bloqueiaSoftLaunch: boolean;
  bloqueiaProducaoAberta: boolean;
  acao: string;
  evidencia: string;
};

function boolLabel(value: boolean) {
  return value ? "Sim" : "Nao";
}

function row(values: Array<string | number | boolean | null | undefined>) {
  return `| ${values.map((value) => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function section(title: string, items: PendingItem[]) {
  if (items.length === 0) {
    return [`## ${title}`, "", "Nenhuma pendencia nesta categoria.", ""].join("\n");
  }

  return [
    `## ${title}`,
    "",
    row(["Area", "Pendencia", "Severidade", "Responsavel", "Bloqueia soft launch", "Bloqueia producao aberta", "Acao", "Evidencia"]),
    row(["---", "---", "---", "---", "---", "---", "---", "---"]),
    ...items.map((item) =>
      row([
        item.area,
        item.pendencia,
        item.severidade,
        item.responsavel,
        boolLabel(item.bloqueiaSoftLaunch),
        boolLabel(item.bloqueiaProducaoAberta),
        item.acao,
        item.evidencia,
      ]),
    ),
    "",
  ].join("\n");
}

function unique(items: PendingItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.area}:${item.pendencia}:${item.tipo}:${item.acao}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buildReport() {
  await initializeDb();
  const db = readDb();
  const generatedAt = new Date().toISOString();

  const fiscalMinimal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const fiscalGlobal = getAdminFiscalReadiness(db, { scope: "global" });
  const operations = getOperationReadinessReport(db);
  const catalogWorkboard = getCatalogStagingWorkboard(db);
  const phase1 = await getPhase1ReadinessReport();
  const phase2 = getPhase2ReadinessReport();
  const release = await getReleaseReadinessReport(db);

  const pending: PendingItem[] = [];

  for (const profile of fiscalMinimal.details.pending_fiscal_profiles) {
    pending.push({
      area: "Fiscal minimo",
      pendencia: `${profile.sku ?? profile.product_id} sem ${profile.missing_fields.join(", ")}`,
      tipo: "CONTADOR",
      severidade: "CRITICO",
      responsavel: "Contador/Fiscal",
      bloqueiaSoftLaunch: true,
      bloqueiaProducaoAberta: true,
      acao: "Preencher close pack fiscal com NCM e tax_code validados. Depois rodar fiscal:close-pack:validate/apply.",
      evidencia: profile.go_live_impact,
    });
  }

  if (fiscalGlobal.metrics.pending_fiscal_profiles > fiscalMinimal.metrics.pending_fiscal_profiles) {
    pending.push({
      area: "Fiscal global",
      pendencia: `${fiscalGlobal.metrics.pending_fiscal_profiles} perfis fiscais globais pendentes`,
      tipo: "CONTADOR",
      severidade: "ALTO",
      responsavel: "Contador/Fiscal",
      bloqueiaSoftLaunch: false,
      bloqueiaProducaoAberta: true,
      acao: "Fechar backlog fiscal antes de ampliar catalogo e vender fora do primeiro corte.",
      evidencia: `Fiscal global ready=${fiscalGlobal.ready}.`,
    });
  }

  if (catalogWorkboard.lanes.revisao_comercial > 0) {
    pending.push({
      area: "Catalogo staging",
      pendencia: `${catalogWorkboard.lanes.revisao_comercial} itens em revisao comercial`,
      tipo: "BACKLOG_ESCALA",
      severidade: "MEDIO",
      responsavel: "Catalogo/Comercial",
      bloqueiaSoftLaunch: false,
      bloqueiaProducaoAberta: false,
      acao: "Revisar nome, familia, categoria, preco, imagem e prioridade antes de ampliar o mix.",
      evidencia: `Total staging=${catalogWorkboard.total}.`,
    });
  }

  if (catalogWorkboard.lanes.fora_do_corte > 0) {
    pending.push({
      area: "Catalogo staging",
      pendencia: `${catalogWorkboard.lanes.fora_do_corte} itens fora do corte inicial`,
      tipo: "BACKLOG_ESCALA",
      severidade: "BAIXO",
      responsavel: "Catalogo",
      bloqueiaSoftLaunch: false,
      bloqueiaProducaoAberta: false,
      acao: "Manter fora do primeiro corte ate saneamento completo e decisao comercial.",
      evidencia: `SKUs diferidos fixos monitorados=${SOFT_LAUNCH_DEFERRED_SKUS.length}.`,
    });
  }

  if (operations.warnings > 0 || operations.blockers > 0) {
    for (const item of [...operations.checks.blockers, ...operations.checks.warnings]) {
      pending.push({
        area: "Operacao",
        pendencia: item.detail,
        tipo: "ADMIN_SITE",
        severidade: operations.blockers > 0 ? "CRITICO" : "ALTO",
        responsavel: "Operacao/Financeiro/Expedicao",
        bloqueiaSoftLaunch: operations.blockers > 0,
        bloqueiaProducaoAberta: true,
        acao: "Tratar no painel administrativo e reexecutar npm run operations:check.",
        evidencia: item.item,
      });
    }
  }

  for (const check of phase1.checks.filter((item) => item.status === "blocker")) {
    pending.push({
      area: "Ambiente",
      pendencia: check.message,
      tipo: "AMBIENTE",
      severidade: "ALTO",
      responsavel: "Administrador/DevOps",
      bloqueiaSoftLaunch: false,
      bloqueiaProducaoAberta: true,
      acao: "Configurar variavel/servico real em ambiente de staging/producao e reexecutar npm run phase1:check.",
      evidencia: check.key,
    });
  }

  for (const check of phase2.checks.blockers.filter((item) => !item.item.startsWith("phase1_"))) {
    const isCredential = /TOKEN|SECRET|URL|PROVIDER|PAYMENT|FREIGHT|MERCADOPAGO|CORREIOS|MELHOR/i.test(check.item);
    pending.push({
      area: "Integracoes",
      pendencia: check.detail,
      tipo: isCredential ? "CREDENCIAL" : "AMBIENTE",
      severidade: "ALTO",
      responsavel: "Administrador",
      bloqueiaSoftLaunch: false,
      bloqueiaProducaoAberta: true,
      acao: "Resolver pela area de Governanca/Integracoes, sem expor secrets completos, e reexecutar npm run phase2:check.",
      evidencia: check.item,
    });
  }

  if (!hasQaVisualScreenshotEvidence()) {
    pending.push({
      area: "QA visual mobile",
      pendencia: "Validacao visual real em dispositivo/screenshot ainda nao executada",
      tipo: "HOMOLOGACAO_MANUAL",
      severidade: "MEDIO",
      responsavel: "QA/Operacao",
      bloqueiaSoftLaunch: false,
      bloqueiaProducaoAberta: true,
      acao: "Executar npm run qa:visual:screenshots antes de trafego pago ou campanha forte.",
      evidencia: "qa:mobile:check cobre preflight estatico, nao screenshot real.",
    });
  }

  const normalizedPending = unique(pending);
  const programavelAgora = normalizedPending.filter((item) => item.tipo === "PROGRAMAVEL");
  const adminSite = normalizedPending.filter((item) => item.tipo === "ADMIN_SITE");
  const contador = normalizedPending.filter((item) => item.tipo === "CONTADOR");
  const credenciais = normalizedPending.filter((item) => item.tipo === "CREDENCIAL");
  const ambiente = normalizedPending.filter((item) => item.tipo === "AMBIENTE");
  const homologacaoManual = normalizedPending.filter((item) => item.tipo === "HOMOLOGACAO_MANUAL");
  const backlogEscala = normalizedPending.filter((item) => item.tipo === "BACKLOG_ESCALA");
  const actionablePending = normalizedPending.filter((item) => item.tipo !== "BACKLOG_ESCALA");

  const json = {
    generated_at: generatedAt,
    decision: {
      soft_launch_regional_assistido:
        fiscalMinimal.ready && operations.ready
          ? "liberavel_tecnicamente"
          : fiscalMinimal.ready
            ? "bloqueado_por_operacao"
            : "bloqueado_por_fiscal",
      producao_aberta: release.ready ? "liberavel" : "bloqueada",
      blocker_principal: fiscalMinimal.ready ? "ambiente_e_integracoes" : "fiscal_minimo",
    },
    metrics: {
      fiscal_minimal_pending_profiles: fiscalMinimal.metrics.pending_fiscal_profiles,
      fiscal_global_pending_profiles: fiscalGlobal.metrics.pending_fiscal_profiles,
      catalog_staging_total: catalogWorkboard.total,
      catalog_review_items: catalogWorkboard.lanes.revisao_comercial,
      catalog_hold_items: catalogWorkboard.lanes.fora_do_corte,
      operation_blockers: operations.blockers,
      operation_warnings: operations.warnings,
      phase1_blockers: phase1.blockers,
      phase2_blockers: phase2.blockers,
      release_blockers: release.blockers,
    },
    pending: actionablePending,
    backlog_escala: backlogEscala,
  };

  const markdown = [
    "# Pendencias Programaveis e Plano Operacional do Admin",
    "",
    `Gerado em: ${generatedAt}`,
    "",
    "## Veredito",
    "",
    `- Soft launch regional assistido: **${json.decision.soft_launch_regional_assistido}**.`,
    `- Producao aberta: **${json.decision.producao_aberta}**.`,
    `- Bloqueio principal: **${json.decision.blocker_principal}**.`,
    "",
    "## Indicadores",
    "",
    row(["Indicador", "Valor"]),
    row(["---", "---"]),
    row(["Perfis fiscais minimos pendentes", json.metrics.fiscal_minimal_pending_profiles]),
    row(["Perfis fiscais globais pendentes", json.metrics.fiscal_global_pending_profiles]),
    row(["Itens staging catalogo", json.metrics.catalog_staging_total]),
    row(["Itens em revisao comercial", json.metrics.catalog_review_items]),
    row(["Itens fora do corte", json.metrics.catalog_hold_items]),
    row(["Blockers operacionais", json.metrics.operation_blockers]),
    row(["Warnings operacionais", json.metrics.operation_warnings]),
    row(["Blockers phase1 ambiente", json.metrics.phase1_blockers]),
    row(["Blockers phase2 integracoes", json.metrics.phase2_blockers]),
    row(["Blockers release", json.metrics.release_blockers]),
    "",
    section("Possivel finalizar por programacao agora", programavelAgora),
    section("Possivel resolver pelo administrador no painel/site", adminSite),
    section("Depende do contador", contador),
    section("Depende de credenciais ou providers", credenciais),
    section("Depende de ambiente real", ambiente),
    section("Depende de homologacao manual", homologacaoManual),
    section("Backlog operacional de escala - nao bloqueia recorte atual", backlogEscala),
    "## Proxima sequencia recomendada",
    "",
    "1. Enviar o close pack fiscal ao contador e aplicar somente dados validados.",
    "2. No admin, manter os SKUs diferidos fora do primeiro corte e sanear staging por prioridade, sem tratar backlog de expansao como blocker do recorte atual.",
    "3. Configurar Postgres/Redis em staging e validar `npm run phase1:check`.",
    "4. Configurar Mercado Pago/frete nacional apenas com credenciais reais e validar `npm run phase2:check`.",
    "5. Executar QA visual mobile real antes de campanha forte ou trafego pago.",
    "6. Reexecutar `npm run release:check`, `npm run go-live:check` e smoke final antes da decisao.",
    "",
  ].join("\n");

  const stagingRows = [
    csvRow([
      "id",
      "sku_base",
      "source_name",
      "normalized_name",
      "category_name",
      "subcategory_name",
      "suggested_family",
      "review_status",
      "go_live_gate_status",
      "publish_flag",
      "suggested_price",
      "estimated_stock",
      "mapped_product_id",
      "fiscal_pending_fields",
      "enrichment_confidence",
      "recommended_action",
    ]),
    ...db.catalogStaging.map((item) => {
      const workboardItem =
        catalogWorkboard.first_cut_candidates.find((candidate) => candidate.id === item.id) ??
        catalogWorkboard.commercial_review_candidates.find((candidate) => candidate.id === item.id) ??
        catalogWorkboard.hold_candidates.find((candidate) => candidate.id === item.id);
      return csvRow([
        item.id,
        item.sku_base,
        item.source_name,
        item.normalized_name,
        item.category_name,
        item.subcategory_name,
        item.suggested_family,
        item.review_status,
        item.go_live_gate_status,
        item.publish_flag,
        item.suggested_price,
        item.estimated_stock,
        item.mapped_product_id,
        item.fiscal_pending_fields.join(";"),
        item.enrichment_confidence,
        workboardItem?.recommended_action ?? "fora-do-top72",
      ]);
    }),
  ].join("\n");

  return { json, markdown, stagingCsv: `${stagingRows}\n` };
}

function hasQaVisualScreenshotEvidence() {
  const required = [
    "home-mobile.png",
    "products-mobile.png",
    "product-mobile.png",
    "cart-mobile.png",
    "checkout-mobile.png",
    "order-confirmed-mobile.png",
    "tracking-mobile.png",
    "contact-mobile.png",
    "admin-dashboard-desktop.png",
    "admin-readiness-tablet.png",
  ];
  return required.every((fileName) => existsSync(resolve("docs", "reports", "qa-visual-screenshots", fileName)));
}

async function main() {
  const outArg = process.argv.find((arg) => arg.startsWith("--out="));
  const outPath = resolve(outArg?.split("=")[1] ?? "docs/reports/PENDENCIAS_PROGRAMAVEIS_E_PLANO_ADMIN.md");
  const jsonPath = outPath.replace(/\.md$/i, ".json");
  const stagingCsvPath = outPath.replace(/\.md$/i, "-catalogo-staging.csv");
  const result = await buildReport();

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, result.markdown, "utf8");
  writeFileSync(jsonPath, `${JSON.stringify(result.json, null, 2)}\n`, "utf8");
  writeFileSync(stagingCsvPath, result.stagingCsv, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        markdown_path: outPath,
        json_path: jsonPath,
        staging_csv_path: stagingCsvPath,
        pending_total: result.json.pending.length,
        programmatic_now: result.json.pending.filter((item) => item.tipo === "PROGRAMAVEL").length,
        admin_site: result.json.pending.filter((item) => item.tipo === "ADMIN_SITE").length,
        backlog_escala: result.json.backlog_escala.length,
        external: result.json.pending.filter((item) => item.tipo !== "PROGRAMAVEL" && item.tipo !== "ADMIN_SITE").length,
        decision: result.json.decision,
      },
      null,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    closeDbResources();
    await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
  });
