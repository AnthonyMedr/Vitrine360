import { readFileSync } from "node:fs";

import type { HomologationEvidenceStatus } from "./homologation-evidence";

export type HomologationEvidenceValidationIssue = {
  row: number;
  scenario_id: string;
  field: string;
  message: string;
};

export type HomologationEvidenceValidationReport = {
  generated_at: string;
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  file_path: string;
  rows: number;
  completed_rows: number;
  pending_rows: number;
  blocked_external_rows: number;
  failed_rows: number;
  issues: HomologationEvidenceValidationIssue[];
  next_steps: string[];
};

const allowedStatuses = new Set<HomologationEvidenceStatus>(["PENDING_EXECUTION", "PASS", "FAIL", "BLOCKED_EXTERNAL"]);
const requiredColumns = ["scenario_id", "evidence_item", "status", "responsible", "evidence_path", "executed_at", "notes", "production_gate"];

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

export function parseHomologationEvidenceCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { header: [] as string[], rows: [] as Record<string, string>[] };
  const header = parseCsvLine(lines[0]!);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""]));
  });
  return { header, rows };
}

function hasText(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function validateHomologationEvidenceCsv(filePath: string, content = readFileSync(filePath, "utf8")): HomologationEvidenceValidationReport {
  const parsed = parseHomologationEvidenceCsv(content);
  const issues: HomologationEvidenceValidationIssue[] = [];

  for (const column of requiredColumns) {
    if (!parsed.header.includes(column)) {
      issues.push({ row: 0, scenario_id: "", field: column, message: "Coluna obrigatoria ausente." });
    }
  }

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const scenarioId = row.scenario_id ?? "";
    const status = row.status as HomologationEvidenceStatus;

    if (!allowedStatuses.has(status)) {
      issues.push({ row: rowNumber, scenario_id: scenarioId, field: "status", message: `Status invalido: ${row.status || "(vazio)"}.` });
    }

    if (row.production_gate !== "unchanged") {
      issues.push({ row: rowNumber, scenario_id: scenarioId, field: "production_gate", message: "production_gate deve permanecer unchanged." });
    }

    if (status === "PASS" || status === "FAIL") {
      for (const field of ["responsible", "evidence_path", "executed_at", "notes"]) {
        if (!hasText(row[field])) {
          issues.push({ row: rowNumber, scenario_id: scenarioId, field, message: `Campo obrigatorio quando status=${status}.` });
        }
      }
    }

    if (status === "BLOCKED_EXTERNAL" && !hasText(row.notes)) {
      issues.push({ row: rowNumber, scenario_id: scenarioId, field: "notes", message: "Informe o bloqueio externo nas observacoes." });
    }
  });

  const completedRows = parsed.rows.filter((row) => row.status === "PASS").length;
  const pendingRows = parsed.rows.filter((row) => row.status === "PENDING_EXECUTION").length;
  const blockedExternalRows = parsed.rows.filter((row) => row.status === "BLOCKED_EXTERNAL").length;
  const failedRows = parsed.rows.filter((row) => row.status === "FAIL").length;

  return {
    generated_at: new Date().toISOString(),
    ok: issues.length === 0,
    production_open: "BLOQUEADO_EXTERNO",
    file_path: filePath,
    rows: parsed.rows.length,
    completed_rows: completedRows,
    pending_rows: pendingRows,
    blocked_external_rows: blockedExternalRows,
    failed_rows: failedRows,
    issues,
    next_steps: [
      pendingRows > 0 ? "Executar evidencias pendentes com equipe real antes de homologacao operacional concluida." : "Todas as linhas foram classificadas.",
      "Manter production_gate=unchanged em todas as linhas.",
      "Nao converter BLOCKED_EXTERNAL em PASS sem contador, provider ou credencial real.",
    ],
  };
}

function markdownRow(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

export function renderHomologationEvidenceValidationMarkdown(report: HomologationEvidenceValidationReport) {
  const lines: string[] = [];
  lines.push("# Validacao Do CSV De Evidencias De Homologacao");
  lines.push("");
  lines.push(`Gerado em: ${report.generated_at}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(`- Status: **${report.ok ? "PASSOU" : "FALHOU"}**`);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push(`- Arquivo: \`${report.file_path}\``);
  lines.push(`- Linhas: ${report.rows}`);
  lines.push(`- PASS: ${report.completed_rows}`);
  lines.push(`- PENDING_EXECUTION: ${report.pending_rows}`);
  lines.push(`- BLOCKED_EXTERNAL: ${report.blocked_external_rows}`);
  lines.push(`- FAIL: ${report.failed_rows}`);
  lines.push("");
  lines.push("## Problemas");
  lines.push("");
  if (report.issues.length === 0) {
    lines.push("Nenhum problema estrutural encontrado.");
  } else {
    lines.push(markdownRow(["Linha", "Cenario", "Campo", "Mensagem"]));
    lines.push(markdownRow(["---:", "---", "---", "---"]));
    for (const issue of report.issues) {
      lines.push(markdownRow([issue.row, issue.scenario_id || "-", issue.field, issue.message]));
    }
  }
  lines.push("");
  lines.push("## Proximos Passos");
  lines.push("");
  for (const step of report.next_steps) lines.push(`- ${step}`);
  lines.push("");
  return lines.join("\n");
}
