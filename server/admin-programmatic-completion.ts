import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type ProgrammaticCompletionCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type AdminProgrammaticCompletion = {
  generated_at: string;
  ok: boolean;
  programmable_scope_complete: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  source_exists: boolean;
  failed_checks: string[];
  checks: ProgrammaticCompletionCheck[];
  files?: { json: string; markdown: string };
};

const defaultJsonPath = "docs/reports/programmatic-completion-latest.json";
const defaultMarkdownPath = "docs/reports/programmatic-completion-latest.md";

function fallbackCompletion(): AdminProgrammaticCompletion {
  return {
    generated_at: new Date().toISOString(),
    ok: false,
    programmable_scope_complete: false,
    production_open: "BLOQUEADO_EXTERNO",
    source_exists: false,
    failed_checks: ["programmatic-completion-report"],
    checks: [
      {
        id: "programmatic-completion-report",
        label: "Fechamento programavel",
        ok: false,
        detail: "Gerar com npm run completion:programmable:check.",
      },
    ],
  };
}

export function getAdminProgrammaticCompletion(filePath = defaultJsonPath): AdminProgrammaticCompletion {
  const absolute = resolve(filePath);
  if (!existsSync(absolute)) return fallbackCompletion();

  try {
    const report = JSON.parse(readFileSync(absolute, "utf8")) as Omit<AdminProgrammaticCompletion, "source_exists" | "failed_checks"> & {
      source_exists?: boolean;
      failed_checks?: string[];
    };
    const checks = Array.isArray(report.checks) ? report.checks : [];
    return {
      ...report,
      production_open: "BLOQUEADO_EXTERNO",
      source_exists: true,
      failed_checks: checks.filter((item) => !item.ok).map((item) => item.id),
      checks,
    };
  } catch {
    return {
      ...fallbackCompletion(),
      source_exists: true,
      failed_checks: ["programmatic-completion-json"],
      checks: [
        {
          id: "programmatic-completion-json",
          label: "Leitura do fechamento",
          ok: false,
          detail: "JSON de fechamento programavel invalido.",
        },
      ],
    };
  }
}

export function renderAdminProgrammaticCompletionMarkdown(filePath = defaultMarkdownPath) {
  const absolute = resolve(filePath);
  if (existsSync(absolute)) return readFileSync(absolute, "utf8");

  const report = fallbackCompletion();
  return [
    "# Fechamento Programavel Do Ecommerce",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    "## Veredito",
    "",
    "- Status: **REVISAR**",
    "- Escopo programavel completo: **nao**",
    "- Producao aberta: `BLOQUEADO_EXTERNO`",
    "",
    "## Checks",
    "",
    "| Check | Resultado | Detalhe |",
    "| --- | --- | --- |",
    `| ${report.checks[0].label} | falhou | ${report.checks[0].detail} |`,
    "",
  ].join("\n");
}
