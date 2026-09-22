import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { validateHomologationEvidenceCsv, type HomologationEvidenceValidationReport } from "./homologation-evidence-validation";

export type AdminHomologationEvidenceStatus = HomologationEvidenceValidationReport & {
  source_exists: boolean;
  completion_percent: number;
  internal_ready: boolean;
  real_execution_required: boolean;
};

export function getAdminHomologationEvidenceStatus(filePath = "docs/reports/homologation-evidence-pack-latest.csv"): AdminHomologationEvidenceStatus {
  const absolutePath = resolve(filePath);
  const sourceExists = existsSync(absolutePath);
  const base = sourceExists
    ? validateHomologationEvidenceCsv(absolutePath)
    : {
        generated_at: new Date().toISOString(),
        ok: false,
        production_open: "BLOQUEADO_EXTERNO" as const,
        file_path: absolutePath,
        rows: 0,
        completed_rows: 0,
        pending_rows: 0,
        blocked_external_rows: 0,
        failed_rows: 0,
        issues: [{ row: 0, scenario_id: "", field: "file_path", message: "Arquivo de evidencias nao encontrado." }],
        next_steps: ["Gerar o pacote com npm run homologation:evidence:pack."],
      };

  return {
    ...base,
    source_exists: sourceExists,
    completion_percent: base.rows > 0 ? Math.round((base.completed_rows / base.rows) * 100) : 0,
    internal_ready: base.ok,
    real_execution_required: !sourceExists || base.pending_rows > 0 || base.completed_rows < base.rows,
  };
}
