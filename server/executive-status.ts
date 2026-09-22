import type { DatabaseShape } from "./db.ts";
import { getGoLiveReadinessReport } from "./go-live-readiness.ts";
import { getPhase1ReadinessReport } from "./phase1-readiness.ts";
import { getPhase2ReadinessReport } from "./phase2-readiness.ts";
import { getReleaseReadinessReport } from "./release-readiness.ts";
import { getAdminFiscalReadiness } from "./read-models.ts";
import { getSecurityReadinessReport } from "./security-readiness.ts";

function decisionLabel(ready: boolean, blockedLabel: string) {
  return ready ? "PRONTO" : blockedLabel;
}

function summarizeBlockers(items: Array<{ item: string; detail: string }>, limit = 5) {
  return items.slice(0, limit).map((item) => `${item.item}: ${item.detail}`);
}

export async function buildExecutiveStatus(db: DatabaseShape) {
  const phase1 = await getPhase1ReadinessReport();
  const phase2 = getPhase2ReadinessReport();
  const security = getSecurityReadinessReport();
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const release = await getReleaseReadinessReport(db);
  const goLive = getGoLiveReadinessReport();

  const localReady = phase1.ok && security.ready && release.sections.operations.ready;
  const productionReady = release.ready && goLive.go_live_ready && phase2.phase2_ready && fiscal.ready;
  const blockers = [
    ...summarizeBlockers(phase1.checks.filter((check) => check.status === "blocker").map((check) => ({ item: check.key, detail: check.message }))),
    ...summarizeBlockers(phase2.checks.blockers),
    ...summarizeBlockers(fiscal.checks.blockers),
    ...summarizeBlockers(goLive.checks.blockers),
  ];

  return {
    ok: true,
    generated_at: new Date().toISOString(),
    phase_roadmap: [
      {
        phase: "Fase 1",
        label: "Base Local e Homologacao Interna",
        status: "CONCLUIDA",
        owner: "Tech Lead / Operacao",
        next_step: "Manter congelada e validada.",
      },
      {
        phase: "Fase 1.5",
        label: "Governanca e Preparacao de Producao",
        status: "EM_PREPARACAO",
        owner: "Tech Lead / Admin Master",
        next_step: "Concluir pacote fiscal, matriz de responsaveis, rollback e monitoramento.",
      },
      {
        phase: "Fase 2",
        label: "Fiscal + Integracoes Reais",
        status: fiscal.ready && phase2.phase2_ready ? "CONCLUIDA" : "PROXIMA_FASE_CRITICA",
        owner: "Contador / Admin Master / DevOps",
        next_step: fiscal.ready && phase2.phase2_ready
          ? "Executar homologacao operacional ponta a ponta."
          : "Validar NCM/tax_code com contador e configurar Mercado Pago, webhook e frete reais.",
      },
      {
        phase: "Fase 3",
        label: "Homologacao Operacional Ponta a Ponta",
        status: fiscal.ready && phase2.phase2_ready ? "PRONTA_PARA_EXECUTAR" : "AGUARDANDO_FISCAL_PAGAMENTO_FRETE",
        owner: "Operacao / QA",
        next_step: "Executar fluxo cliente, pagamento, frete, admin, WMS e suporte.",
      },
      {
        phase: "Fase 4",
        label: "Soft Launch Regional Assistido",
        status: productionReady ? "APTO_A_PLANEJAR" : "BLOQUEADO_ATE_HOMOLOGACAO",
        owner: "Direcao / Operacao",
        next_step: "Abrir apenas apos homologacao operacional aprovada.",
      },
      {
        phase: "Fase 5",
        label: "Go-Live Aberto Regional",
        status: productionReady ? "APTO_A_ABRIR" : "BLOQUEADO",
        owner: "Direcao",
        next_step: "Manter bloqueado ate fiscal, pagamento, frete e ambiente produtivo reais.",
      },
      {
        phase: "Fase 6",
        label: "Escala Comercial e Catalogo Amplo",
        status: "FUTURO",
        owner: "Direcao / Produto",
        next_step: "Executar somente apos soft launch validado.",
      },
      {
        phase: "Fase 7",
        label: "Mini ERP Completo / Central Executiva Enterprise",
        status: "FUTURO",
        owner: "Direcao / Administracao",
        next_step: "Priorizar apenas depois do soft launch regional estabilizado.",
      },
      {
        phase: "Fase 8",
        label: "CRM, BI, Automacao e IA Assistida",
        status: "FUTURO",
        owner: "Comercial / BI",
        next_step: "Planejar com aprovacao humana e auditoria depois da operacao estavel.",
      },
      {
        phase: "Fase 9",
        label: "Escala Nacional / Omnichannel / Integracoes Externas",
        status: "FUTURO",
        owner: "Direcao / Expansao",
        next_step: "Manter futura ate go-live regional validado.",
      },
    ],
    decisions: {
      local_homologation: decisionLabel(localReady, "BLOQUEADO"),
      phase1_infra: decisionLabel(phase1.ok, "BLOQUEADO"),
      production_open: decisionLabel(productionReady, "BLOQUEADO_EXTERNO"),
      national_go_live: decisionLabel(productionReady, "BLOQUEADO_EXTERNO"),
    },
    gates: {
      phase1: { ready: phase1.ok, blockers: phase1.blockers, warnings: phase1.warnings },
      phase2: { ready: phase2.phase2_ready, blockers: phase2.blockers, warnings: phase2.warnings },
      security: { ready: security.ready, blockers: security.blockers, warnings: security.warnings },
      fiscal_minimal: { ready: fiscal.ready, blockers: fiscal.blockers, warnings: fiscal.warnings },
      release: { ready: release.ready, blockers: release.blockers, warnings: release.warnings },
      go_live: { ready: goLive.go_live_ready, blockers: goLive.blockers, warnings: goLive.warnings },
    },
    main_blocker:
      fiscal.ready
        ? phase2.phase2_ready
          ? goLive.go_live_ready
            ? "nenhum"
            : "go_live"
          : "providers_reais"
        : "fiscal_minimo_contador",
    blockers_sample: blockers,
    next_commands: [
      "npm run fiscal:close-pack:minimal",
      "npm run fiscal:close-pack:validate -- docs/reports/fiscal-close-pack-minimal.csv",
      "npm run fiscal:check:minimal",
      "npm run phase2:check",
      "npm run release:check",
      "npm run go-live:check",
      "npm run go-live:handoff",
    ],
    next_step: "FISCAL_CONTADOR+INTEGRACOES_REAIS",
    final_decision: productionReady ? "PRONTO_PARA_PRODUCAO_ABERTA" : "PRONTO_PARA_DESTRAVAMENTO_CONTROLADO",
  };
}

export type ExecutiveStatus = Awaited<ReturnType<typeof buildExecutiveStatus>>;
