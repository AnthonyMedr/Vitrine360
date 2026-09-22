import { existsSync } from "node:fs";

import type { DatabaseShape } from "./db.ts";
import { getGoLiveReadinessReport } from "./go-live-readiness.ts";
import { getPhase1ReadinessReport } from "./phase1-readiness.ts";
import { getPhase2ReadinessReport } from "./phase2-readiness.ts";
import { getAdminFiscalReadiness } from "./read-models.ts";

export type OfficialRoadmapPhase = {
  phase: string;
  title: string;
  status: string;
  owner: string;
  blockers: string[];
  advancement_criteria: string[];
  deliverables: string[];
  risks: string[];
  next_step: string;
  document: string;
};

export type OfficialRoadmapStatus = {
  generated_at: string;
  ROADMAP_READY: boolean;
  ROADMAP_STATUS: "ATIVO";
  CURRENT_PHASE: "FASE_1_5";
  NEXT_PHASE: "FASE_2";
  PRODUCTION_OPEN: "BLOQUEADO_EXTERNO";
  MAIN_BLOCKER: string;
  FINAL_DECISION: "ROADMAP_OFICIAL_CRIADO";
  phases: OfficialRoadmapPhase[];
  required_documents: Array<{ path: string; exists: boolean }>;
  blockers: string[];
  warnings: string[];
};

const requiredDocuments = [
  "docs/roadmap/ROADMAP_OFICIAL_ECOMMERCE_LOJAO_DO_PVC.md",
  "docs/go-live/FASE_1_5_GOVERNANCA_PREPARACAO_PRODUCAO.md",
  "docs/go-live/CHECKLIST_PREPARACAO_PRODUCAO_ASSISTIDA.md",
  "docs/go-live/MATRIZ_RISCOS_PRODUCAO_ASSISTIDA.md",
  "docs/go-live/MATRIZ_RESPONSAVEIS_GO_LIVE.md",
  "docs/fiscal/PACOTE_FISCAL_CONTADOR_MIX_MINIMO.md",
  "docs/fiscal/CHECKLIST_FISCAL_MINIMO.md",
  "docs/fiscal/ORIENTACOES_PARA_VALIDACAO_CONTABIL.md",
  "docs/integrations/INTEGRACOES_REAIS_FASE_2.md",
  "docs/integrations/MERCADO_PAGO_HOMOLOGACAO.md",
  "docs/integrations/FRETE_REAL_HOMOLOGACAO.md",
  "docs/integrations/EMAIL_ANALYTICS_STORAGE_METRICAS.md",
  "docs/integrations/VARIAVEIS_AMBIENTE_HOMOLOGACAO_PRODUCAO.md",
  "docs/homologation/PLANO_HOMOLOGACAO_OPERACIONAL_PONTA_A_PONTA.md",
  "docs/go-live/PLANO_SOFT_LAUNCH_REGIONAL_ASSISTIDO.md",
  "docs/go-live/PLANO_GO_LIVE_ABERTO_REGIONAL.md",
  "docs/catalog/PLANO_EXPANSAO_CATALOGO_POS_SOFT_LAUNCH.md",
  "docs/catalog/CHECKLIST_CURADORIA_CATALOGO_ESCALA.md",
  "docs/admin/ROADMAP_CENTRAL_EXECUTIVA_ENTERPRISE.md",
  "docs/admin/MINI_ERP_COMPLETO_ROADMAP.md",
  "docs/crm/ROADMAP_CRM_BI_AUTOMACAO_IA.md",
  "docs/ai/PRINCIPIOS_IA_ASSISTIDA_ECOMMERCE.md",
  "docs/scale/ROADMAP_ESCALA_NACIONAL_OMNICHANNEL.md",
];

export async function buildOfficialRoadmapStatus(db: DatabaseShape): Promise<OfficialRoadmapStatus> {
  const phase1 = await getPhase1ReadinessReport();
  const phase2 = getPhase2ReadinessReport();
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const goLive = getGoLiveReadinessReport();
  const missingDocuments = requiredDocuments.map((path) => ({ path, exists: existsSync(path) }));
  const docsMissing = missingDocuments.filter((doc) => !doc.exists).map((doc) => doc.path);
  const mainBlocker = fiscal.ready ? phase2.phase2_ready ? goLive.go_live_ready ? "nenhum" : "go_live" : "providers_reais" : "fiscal_minimo_contador";

  const phases: OfficialRoadmapPhase[] = [
    {
      phase: "Fase 1",
      title: "Base Local e Homologacao Interna",
      status: phase1.ok ? "CONCLUIDA" : "REVISAR",
      owner: "Tech Lead / Operacao",
      blockers: phase1.ok ? [] : ["phase1_infra"],
      advancement_criteria: ["PostgreSQL e Redis validados", "testes, build e smoke local aprovados"],
      deliverables: ["app local", "admin", "checkout local", "backup", "handoff"],
      risks: ["Reabrir escopo sem criterio"],
      next_step: "Manter congelada; corrigir apenas bugs, documentacao e estabilidade.",
      document: "docs/reports/ecommerce-status-latest.md",
    },
    {
      phase: "Fase 1.5",
      title: "Governanca e Preparacao para Producao Assistida",
      status: "EXECUTAR_AGORA",
      owner: "Admin Master / Tech Lead",
      blockers: [],
      advancement_criteria: ["Roadmap oficial ativo", "matriz de riscos", "responsaveis", "pacote fiscal", "checklists de integracao"],
      deliverables: ["governanca", "rollback", "monitoramento", "politica de congelamento"],
      risks: ["Crescimento desorganizado", "pular para go-live aberto"],
      next_step: "Preparar fiscal e integracoes reais sem liberar producao aberta.",
      document: "docs/go-live/FASE_1_5_GOVERNANCA_PREPARACAO_PRODUCAO.md",
    },
    {
      phase: "Fase 2",
      title: "Fiscal + Integracoes Reais",
      status: fiscal.ready && phase2.phase2_ready ? "CONCLUIDA" : "PROXIMA_FASE_CRITICA",
      owner: "Contador / Admin Master / DevOps",
      blockers: [
        ...(fiscal.ready ? [] : ["fiscal_minimo_contador"]),
        ...(phase2.phase2_ready ? [] : ["mercado_pago_frete_real"]),
      ],
      advancement_criteria: ["NCM/tax_code validados", "Mercado Pago homologado", "frete real homologado"],
      deliverables: ["close pack fiscal aplicado", "webhook assinado", "cotacao real"],
      risks: ["token falso", "fiscal presumido", "provider em fallback"],
      next_step: "Enviar pacote ao contador e configurar Mercado Pago/frete reais em ambiente seguro.",
      document: "docs/integrations/INTEGRACOES_REAIS_FASE_2.md",
    },
    {
      phase: "Fase 3",
      title: "Homologacao Operacional Ponta a Ponta",
      status: fiscal.ready && phase2.phase2_ready ? "PRONTA_PARA_EXECUTAR" : "AGUARDANDO_FISCAL_PAGAMENTO_FRETE",
      owner: "QA / Operacao",
      blockers: fiscal.ready && phase2.phase2_ready ? [] : ["fase2_incompleta"],
      advancement_criteria: ["compra completa", "pagamento aprovado/recusado", "frete", "admin", "WMS", "backup/restore"],
      deliverables: ["evidencias de homologacao", "lista de excecoes testadas"],
      risks: ["soft launch sem ensaio real"],
      next_step: "Executar apenas apos Fase 2 fiscal + integracoes reais.",
      document: "docs/homologation/PLANO_HOMOLOGACAO_OPERACIONAL_PONTA_A_PONTA.md",
    },
    {
      phase: "Fase 4",
      title: "Soft Launch Regional Assistido",
      status: "BLOQUEADA_ATE_HOMOLOGACAO",
      owner: "Direcao / Operacao",
      blockers: ["homologacao_operacional_pendente"],
      advancement_criteria: ["gates verdes", "equipe treinada", "baixo volume", "monitoramento diario"],
      deliverables: ["relatorio diario", "rotina de pausa", "suporte ativo"],
      risks: ["volume antes de estabilidade"],
      next_step: "Preparar corte inicial, mas nao publicar sem homologacao.",
      document: "docs/go-live/PLANO_SOFT_LAUNCH_REGIONAL_ASSISTIDO.md",
    },
    {
      phase: "Fase 5",
      title: "Go-Live Aberto Regional",
      status: "BLOQUEADA",
      owner: "Direcao",
      blockers: ["soft_launch_nao_validado"],
      advancement_criteria: ["soft launch aprovado", "HTTPS", "pagamento/frete/fiscal reais", "suporte e contingencia"],
      deliverables: ["producao regional liberada", "campanhas moderadas", "monitoramento ativo"],
      risks: ["abrir regiao sem estabilidade"],
      next_step: "Aguardar soft launch validado.",
      document: "docs/go-live/PLANO_GO_LIVE_ABERTO_REGIONAL.md",
    },
    {
      phase: "Fase 6",
      title: "Escala Comercial e Catalogo Amplo",
      status: "FUTURA",
      owner: "Comercial / Catalogo",
      blockers: ["go_live_regional_pendente"],
      advancement_criteria: ["go-live regional estavel", "curadoria por lotes", "fiscal/frete por SKU"],
      deliverables: ["catalogo ampliado com controle", "campanhas sazonais", "SEO"],
      risks: ["637 itens sem curadoria em massa"],
      next_step: "Planejar lotes, sem publicar staging em massa.",
      document: "docs/catalog/PLANO_EXPANSAO_CATALOGO_POS_SOFT_LAUNCH.md",
    },
    {
      phase: "Fase 7",
      title: "Mini ERP Completo / Central Executiva Enterprise",
      status: "FUTURA",
      owner: "Produto / Admin Master",
      blockers: ["operacao_real_nao_estabilizada"],
      advancement_criteria: ["soft launch/go-live estabilizados", "necessidades administrativas reais priorizadas"],
      deliverables: ["compras", "fornecedores", "financeiro avancado", "margens", "metas"],
      risks: ["complexidade antes de venda real"],
      next_step: "Manter como evolucao administrativa pos-soft launch.",
      document: "docs/admin/ROADMAP_CENTRAL_EXECUTIVA_ENTERPRISE.md",
    },
    {
      phase: "Fase 8",
      title: "CRM, BI, Automacao e IA Assistida",
      status: "FUTURA",
      owner: "Marketing / Dados",
      blockers: ["base_operacional_insuficiente"],
      advancement_criteria: ["dados reais suficientes", "consentimento", "governanca de IA"],
      deliverables: ["CRM", "BI", "segmentacao", "automacoes", "IA auditada"],
      risks: ["automacao sem governanca"],
      next_step: "Planejar depois da operacao estabilizada.",
      document: "docs/crm/ROADMAP_CRM_BI_AUTOMACAO_IA.md",
    },
    {
      phase: "Fase 9",
      title: "Escala Nacional / Omnichannel / Integracoes Externas",
      status: "FUTURA",
      owner: "Direcao / Operacao / DevOps",
      blockers: ["go_live_regional_nao_validado"],
      advancement_criteria: ["regional validado", "logistica nacional", "ERP/marketplaces quando necessario"],
      deliverables: ["omnichannel", "marketplaces", "transportadoras avancadas", "B2B nacional"],
      risks: ["escala nacional sem base regional"],
      next_step: "Manter futuro ate go-live regional comprovado.",
      document: "docs/scale/ROADMAP_ESCALA_NACIONAL_OMNICHANNEL.md",
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    ROADMAP_READY: docsMissing.length === 0 && phase1.ok,
    ROADMAP_STATUS: "ATIVO",
    CURRENT_PHASE: "FASE_1_5",
    NEXT_PHASE: "FASE_2",
    PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
    MAIN_BLOCKER: mainBlocker,
    FINAL_DECISION: "ROADMAP_OFICIAL_CRIADO",
    phases,
    required_documents: missingDocuments,
    blockers: [
      ...docsMissing.map((path) => `documento_ausente:${path}`),
      ...(phase1.ok ? [] : ["fase1_nao_concluida"]),
    ],
    warnings: [
      ...(fiscal.ready ? [] : ["fiscal_minimo_contador"]),
      ...(phase2.phase2_ready ? [] : ["integracoes_reais_pendentes"]),
      ...(goLive.go_live_ready ? [] : ["go_live_bloqueado_externo"]),
    ],
  };
}
