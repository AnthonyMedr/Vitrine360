import type { HomologationScenarioReport } from "./homologation-scenarios";

export type HomologationEvidenceStatus = "PENDING_EXECUTION" | "PASS" | "FAIL" | "BLOCKED_EXTERNAL";

export type HomologationEvidenceRow = {
  scenario_id: string;
  scenario_title: string;
  domain: string;
  evidence_item: string;
  status: HomologationEvidenceStatus;
  responsible: string;
  evidence_path: string;
  executed_at: string;
  notes: string;
  production_gate: "unchanged";
};

export type HomologationEvidencePack = {
  generated_at: string;
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  mode: "evidence_collection";
  scenarios_total: number;
  evidence_items_total: number;
  pending_items: number;
  rows: HomologationEvidenceRow[];
  next_steps: string[];
};

export function buildHomologationEvidencePack(report: HomologationScenarioReport): HomologationEvidencePack {
  const rows = report.scenarios.flatMap((scenario) =>
    scenario.evidence.map((evidenceItem) => ({
      scenario_id: scenario.id,
      scenario_title: scenario.title,
      domain: scenario.domain,
      evidence_item: evidenceItem,
      status: "PENDING_EXECUTION" as const,
      responsible: "",
      evidence_path: "",
      executed_at: "",
      notes: "",
      production_gate: "unchanged" as const,
    })),
  );

  return {
    generated_at: new Date().toISOString(),
    ok: report.ok && rows.length > 0,
    production_open: "BLOQUEADO_EXTERNO",
    mode: "evidence_collection",
    scenarios_total: report.scenarios.length,
    evidence_items_total: rows.length,
    pending_items: rows.length,
    rows,
    next_steps: [
      "Preencher responsavel, status, caminho da evidencia e observacoes apos cada ensaio.",
      "Usar PASS apenas com evidencia revisavel registrada.",
      "Usar FAIL para erro de sistema e BLOCKED_EXTERNAL para contador, provider ou credencial real.",
      "Nao liberar producao aberta a partir deste pacote sem gates fiscal, pagamento, frete e go-live.",
    ],
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

export function renderHomologationEvidenceCsv(pack: HomologationEvidencePack) {
  const header = [
    "scenario_id",
    "scenario_title",
    "domain",
    "evidence_item",
    "status",
    "responsible",
    "evidence_path",
    "executed_at",
    "notes",
    "production_gate",
  ];

  return [
    csvRow(header),
    ...pack.rows.map((row) =>
      csvRow([
        row.scenario_id,
        row.scenario_title,
        row.domain,
        row.evidence_item,
        row.status,
        row.responsible,
        row.evidence_path,
        row.executed_at,
        row.notes,
        row.production_gate,
      ]),
    ),
  ].join("\n") + "\n";
}

function markdownRow(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

export function renderHomologationEvidenceMarkdown(pack: HomologationEvidencePack) {
  const lines: string[] = [];
  lines.push("# Pacote De Evidencias De Homologacao Operacional");
  lines.push("");
  lines.push(`Gerado em: ${pack.generated_at}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(`- Template pronto: **${pack.ok ? "sim" : "nao"}**`);
  lines.push(`- Modo: \`${pack.mode}\``);
  lines.push(`- Producao aberta: \`${pack.production_open}\``);
  lines.push(`- Cenarios: ${pack.scenarios_total}`);
  lines.push(`- Evidencias esperadas: ${pack.evidence_items_total}`);
  lines.push(`- Evidencias pendentes: ${pack.pending_items}`);
  lines.push("");
  lines.push("## Evidencias");
  lines.push("");
  lines.push(markdownRow(["Cenario", "Dominio", "Evidencia", "Status", "Responsavel", "Arquivo"]));
  lines.push(markdownRow(["---", "---", "---", "---", "---", "---"]));
  for (const row of pack.rows) {
    lines.push(markdownRow([row.scenario_title, row.domain, row.evidence_item, row.status, row.responsible || "-", row.evidence_path || "-"]));
  }
  lines.push("");
  lines.push("## Proximos Passos");
  lines.push("");
  for (const step of pack.next_steps) lines.push(`- ${step}`);
  lines.push("");
  lines.push("Observacao: este pacote registra execucao e evidencia. Ele nao substitui contador, provider de pagamento, provider de frete, emissor fiscal ou decisao de go-live.");
  lines.push("");
  return lines.join("\n");
}
