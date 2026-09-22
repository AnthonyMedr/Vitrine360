import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { closeDbResources, initializeDb, readDb } from "../server/db.ts";
import { getGoLiveReadinessReport } from "../server/go-live-readiness.ts";
import { getPhase2ReadinessReport } from "../server/phase2-readiness.ts";
import { closePostgresPool } from "../server/postgres.ts";
import { getReleaseReadinessReport } from "../server/release-readiness.ts";
import { getAdminFiscalReadiness } from "../server/read-models.ts";
import { closeRedisClient } from "../server/redis.ts";
import { getSecurityReadinessReport } from "../server/security-readiness.ts";

type ExternalOwner = "contador" | "infra" | "pagamentos" | "frete" | "marketing" | "operacao";

type ExternalInput = {
  area: string;
  owner: ExternalOwner;
  status: "BLOQUEADO_EXTERNO" | "AVISO_PRODUTIVO";
  item: string;
  required_input: string;
  validation: string;
  evidence: string;
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=")[1] ?? null;
  return process.argv[index + 1] ?? null;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function ownerForCheck(item: string): ExternalOwner {
  if (item.includes("payment") || item.includes("mercadopago")) return "pagamentos";
  if (item.includes("freight") || item.includes("melhor_envio") || item.includes("correios")) return "frete";
  if (item.includes("email") || item.includes("analytics")) return "marketing";
  if (item.includes("database") || item.includes("redis") || item.includes("queue") || item.includes("csrf") || item.includes("secure") || item.includes("metrics")) return "infra";
  return "operacao";
}

function externalInputFromCheck(area: string, item: string, detail: string, validation: string): ExternalInput {
  return {
    area,
    owner: ownerForCheck(item),
    status: "BLOQUEADO_EXTERNO",
    item,
    required_input: detail,
    validation,
    evidence: "Gate automatico reportou blocker; nao usar valor falso para liberar.",
  };
}

function buildMarkdown(report: Awaited<ReturnType<typeof buildReport>>) {
  const lines: string[] = [];
  lines.push("# Go-Live External Handoff");
  lines.push("");
  lines.push(`- Generated at: \`${report.generated_at}\``);
  lines.push(`- Decision: \`${report.decision}\``);
  lines.push(`- External blockers: \`${report.summary.external_blockers}\``);
  lines.push(`- Productive warnings: \`${report.summary.productive_warnings}\``);
  lines.push("");
  lines.push("## Required External Inputs");
  lines.push("");
  lines.push("| Area | Owner | Status | Item | Required input | Validation |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const input of report.external_inputs) {
    lines.push(
      `| ${input.area} | ${input.owner} | ${input.status} | \`${input.item}\` | ${input.required_input.replace(/\|/g, "\\|")} | \`${input.validation}\` |`,
    );
  }
  lines.push("");
  lines.push("## Fiscal Minimal Products");
  lines.push("");
  if (report.fiscal_pending_products.length === 0) {
    lines.push("Nenhum produto fiscal minimo pendente.");
  } else {
    lines.push("| SKU | Produto | Campos pendentes | Responsavel |");
    lines.push("| --- | --- | --- | --- |");
    for (const product of report.fiscal_pending_products) {
      lines.push(`| \`${product.sku}\` | ${product.product_name} | \`${product.missing_fields.join(", ")}\` | ${product.responsible} |`);
    }
  }
  lines.push("");
  lines.push("## Revalidation Commands");
  lines.push("");
  for (const command of report.command_sequence) lines.push(`- \`${command}\``);
  lines.push("");
  lines.push("## Guardrail");
  lines.push("");
  lines.push("Nao preencher NCM, tax_code, tokens, secrets, chaves de webhook ou dados fiscais por inferencia. O go-live so deve avancar com dado real validado.");
  lines.push("");
  return lines.join("\n");
}

async function buildReport() {
  await initializeDb();
  const db = readDb();
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const phase2 = getPhase2ReadinessReport();
  const goLive = getGoLiveReadinessReport();
  const security = getSecurityReadinessReport();
  const release = await getReleaseReadinessReport(db);

  const externalInputs: ExternalInput[] = [];

  for (const profile of fiscal.details.pending_fiscal_profiles) {
    externalInputs.push({
      area: "Fiscal",
      owner: "contador",
      status: "BLOQUEADO_EXTERNO",
      item: profile.sku ?? profile.fiscal_profile_id,
      required_input: `${profile.product_name}: preencher ${profile.missing_fields.join(", ")} com validacao contabil/fiscal.`,
      validation: "npm run fiscal:close-pack:validate -- docs/reports/fiscal-close-pack-minimal.csv && npm run fiscal:check:minimal",
      evidence: profile.go_live_impact,
    });
  }

  for (const check of phase2.checks.blockers) {
    externalInputs.push(externalInputFromCheck("Fase 2", check.item, check.detail, "npm run phase2:check && npm run smoke:phase2"));
  }

  for (const check of goLive.checks.blockers) {
    externalInputs.push(externalInputFromCheck("Go-live", check.item, check.detail, "npm run go-live:check"));
  }

  for (const check of goLive.checks.warnings) {
    externalInputs.push({
      area: "Go-live",
      owner: ownerForCheck(check.item),
      status: "AVISO_PRODUTIVO",
      item: check.item,
      required_input: check.detail,
      validation: "npm run go-live:check",
      evidence: "Warning produtivo; nao libera escala aberta sem decisao operacional.",
    });
  }

  const deduped = Array.from(
    new Map(externalInputs.map((input) => [`${input.area}:${input.item}:${input.status}`, input])).values(),
  );

  return {
    generated_at: new Date().toISOString(),
    decision: release.ready ? "GO_LIVE_LIBERAVEL_APOS_SMOKE_FINAL" : "GO_LIVE_BLOQUEADO_POR_INSUMOS_EXTERNOS",
    summary: {
      release_ready: release.ready,
      release_blockers: release.blockers,
      release_warnings: release.warnings,
      security_ready: security.ready,
      fiscal_ready: fiscal.ready,
      phase2_ready: phase2.phase2_ready,
      go_live_ready: goLive.go_live_ready,
      external_blockers: deduped.filter((input) => input.status === "BLOQUEADO_EXTERNO").length,
      productive_warnings: deduped.filter((input) => input.status === "AVISO_PRODUTIVO").length,
    },
    external_inputs: deduped,
    fiscal_pending_products: fiscal.details.pending_fiscal_profiles.map((profile) => ({
      fiscal_profile_id: profile.fiscal_profile_id,
      sku: profile.sku ?? "",
      product_name: profile.product_name,
      missing_fields: profile.missing_fields,
      responsible: profile.responsible,
    })),
    command_sequence: [
      "npm run fiscal:close-pack:minimal",
      "npm run fiscal:close-pack:validate -- docs/reports/fiscal-close-pack-minimal.csv",
      "npm run fiscal:check:minimal",
      "npm run phase1:validate",
      "npm run phase2:check",
      "npm run security:check",
      "npm run release:check",
      "npm run go-live:check",
      "npm run smoke:phase2",
    ],
  };
}

const outArg = getArg("--out");
const defaultBase = resolve("docs", "reports", "go-live-external-handoff-latest");
const basePath = resolve(outArg ?? defaultBase).replace(/\.(json|md|csv)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const csvPath = `${basePath}.csv`;

try {
  const report = await buildReport();
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(mdPath, `${buildMarkdown(report)}\n`, "utf8");
  writeFileSync(
    csvPath,
    [
      csvRow(["area", "owner", "status", "item", "required_input", "validation", "evidence"]),
      ...report.external_inputs.map((input) =>
        csvRow([input.area, input.owner, input.status, input.item, input.required_input, input.validation, input.evidence]),
      ),
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        jsonPath,
        mdPath,
        csvPath,
        decision: report.decision,
        summary: report.summary,
      },
      null,
      2,
    ),
  );
} finally {
  closeDbResources();
  await Promise.allSettled([closeRedisClient(), closePostgresPool()]);
}
