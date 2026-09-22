import { existsSync, readFileSync } from "node:fs";

const requiredDocs = [
  "docs/benchmark/BENCHMARK_MERCADO_ECOMMERCE_BRASIL_2026.md",
  "docs/roadmap/PLANO_MELHOR_ECOMMERCE_BRASIL_LOJAO_PVC.md",
  "docs/reports/RELATORIO_BENCHMARK_MERCADO_ECOMMERCE_BRASIL_2026-05-25.md",
  "docs/roadmap/ROADMAP_OFICIAL_ECOMMERCE_LOJAO_DO_PVC.md",
  "docs/reports/RELATORIO_ROADMAP_OFICIAL_PROXIMAS_FASES.md",
];

const missing = requiredDocs.filter((path) => !existsSync(path));
const benchmark = existsSync(requiredDocs[0]) ? readFileSync(requiredDocs[0], "utf8") : "";
const plan = existsSync(requiredDocs[1]) ? readFileSync(requiredDocs[1], "utf8") : "";
const report = existsSync(requiredDocs[2]) ? readFileSync(requiredDocs[2], "utf8") : "";

const requiredSignals = [
  "BENCHMARK_MERCADO=CRIADO",
  "PRODUCAO_ABERTA=BLOQUEADO_EXTERNO",
  "FISCAL_CONTADOR+INTEGRACOES_REAIS",
];

const content = `${benchmark}\n${plan}\n${report}`;
const missingSignals = requiredSignals.filter((signal) => !content.includes(signal));
const ready = missing.length === 0 && missingSignals.length === 0;

const output = {
  MARKET_BENCHMARK_READY: ready,
  MARKET_BENCHMARK_STATUS: ready ? "CRIADO" : "INCOMPLETO",
  CURRENT_PHASE: "FASE_1_5",
  NEXT_PHASE: "FASE_2_FISCAL_INTEGRACOES",
  PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
  MAIN_BLOCKER: "fiscal_minimo_contador",
  missing_documents: missing,
  missing_signals: missingSignals,
  next_step: "FISCAL_CONTADOR+INTEGRACOES_REAIS+CHECKOUT_PERFORMANCE",
};

console.log(JSON.stringify(output, null, 2));

if (!ready) {
  process.exitCode = 1;
}
