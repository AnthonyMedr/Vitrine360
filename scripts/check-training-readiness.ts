import { existsSync, readFileSync } from "node:fs";

const requiredDocs = [
  "docs/training/PLANO_TREINAMENTO_OPERACAO_ASSISTIDA.md",
  "docs/training/CHECKLIST_TREINAMENTO_POR_CARGO.md",
  "docs/training/REGISTRO_EVIDENCIAS_TREINAMENTO_OPERACAO_ASSISTIDA.md",
  "docs/admin/ROTINA_OPERACIONAL_USUARIO_COMUM.md",
  "docs/ops/PLAYBOOK_ABERTURA_FECHAMENTO_DIARIO_ECOMMERCE.md",
  "docs/go-live/PLANO_SOFT_LAUNCH_REGIONAL_ASSISTIDO.md",
  "docs/reports/RELATORIO_CONTINUIDADE_TREINAMENTO_OPERACAO_ASSISTIDA_2026-05-25.md",
  "docs/reports/RELATORIO_CONTINUIDADE_IMPLEMENTACAO_ECOMMERCE_2026-05-25.md",
];

const missingDocs = requiredDocs.filter((path) => !existsSync(path));
const content = requiredDocs
  .filter((path) => existsSync(path))
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

const requiredSignals = [
  "TRAINING_OPERATION_READY=PLANEJADO",
  "TRAINING_CHECKLIST_READY=true",
  "PRODUCAO_ABERTA=BLOQUEADO_EXTERNO",
  "TREINAMENTO_EQUIPE+FISCAL_CONTADOR+INTEGRACOES_REAIS",
  "EVIDENCE_TEMPLATE_READY",
  "CONTINUIDADE_IMPLEMENTACAO_DOCUMENTADA",
];

const missingSignals = requiredSignals.filter((signal) => !content.includes(signal));
const blockers = [
  ...missingDocs.map((path) => `documento_ausente:${path}`),
  ...missingSignals.map((signal) => `sinal_ausente:${signal}`),
];

const output = {
  TRAINING_READINESS_DOCUMENTED: blockers.length === 0,
  TRAINING_OPERATION_READY: false,
  PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
  CURRENT_PHASE: "FASE_1_5",
  NEXT_PHASE: "FASE_2_FISCAL_INTEGRACOES",
  blockers,
  warnings: [
    "treinamento_real_ainda_nao_executado",
    "evidencias_de_participantes_pendentes",
    "soft_launch_permanece_bloqueado_por_fiscal_e_integracoes_reais",
  ],
  next_step: "TREINAMENTO_EQUIPE+FISCAL_CONTADOR+INTEGRACOES_REAIS",
};

console.log(JSON.stringify(output, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}
