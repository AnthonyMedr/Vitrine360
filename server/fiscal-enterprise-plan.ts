import { appConfig } from "./config";
import type { DatabaseShape } from "./db";
import { getAdminFiscalReadiness, getAdminFiscalWorkboard } from "./read-models";

export type FiscalEnterprisePhaseStatus = "blocked" | "partial" | "ready";
export type FiscalEnterpriseDependencyType = "contador" | "ambiente" | "credencial" | "programacao" | "operacao";

export type FiscalEnterprisePhase = {
  id: string;
  name: string;
  status: FiscalEnterprisePhaseStatus;
  objective: string;
  blockers: string[];
  dependencies: Array<{
    type: FiscalEnterpriseDependencyType;
    item: string;
    responsible: string;
  }>;
  executable_now: string[];
  commands: string[];
  acceptance_criteria: string[];
};

export type FiscalEnterprisePlan = {
  generated_at: string;
  verdict: {
    fiscal_minimal: FiscalEnterprisePhaseStatus;
    regional_soft_launch: "blocked_by_fiscal" | "eligible_controlled";
    national_operation: "not_ready" | "partial" | "ready";
    marketplace: "not_ready" | "partial" | "ready";
    black_friday: "not_ready" | "partial" | "ready";
  };
  scores: {
    fiscal_minimal: number;
    fiscal_global: number;
    issuer: number;
    interstate: number;
    marketplace: number;
    erp_sped: number;
    contingency: number;
    overall: number;
  };
  metrics: {
    minimal_pending_profiles: number;
    global_pending_profiles: number;
    staging_pending_items: number;
    pending_fiscal_documents: number;
    fiscal_provider_ready: boolean;
    erp_sync_enabled: boolean;
    company_cnpj_configured: boolean;
  };
  phases: FiscalEnterprisePhase[];
  next_actions: string[];
};

function scoreByCompletion(total: number, pending: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((total - pending) / total) * 100)));
}

function isFiscalProviderReady() {
  return appConfig.fiscalProvider !== "manual" && Boolean(appConfig.fiscal.apiUrl && appConfig.fiscal.apiToken && appConfig.fiscal.companyCnpj);
}

function isErpReady() {
  return appConfig.erpProvider !== "none" && appConfig.erp.syncEnabled && Boolean(appConfig.erp.apiUrl && appConfig.erp.apiToken);
}

function blockedIf(condition: boolean, message: string) {
  return condition ? [message] : [];
}

export function buildFiscalEnterprisePlan(db: DatabaseShape): FiscalEnterprisePlan {
  const minimal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const global = getAdminFiscalReadiness(db, { scope: "global" });
  const workboard = getAdminFiscalWorkboard(db, { scope: "global" });
  const fiscalProviderReady = isFiscalProviderReady();
  const erpReady = isErpReady();
  const defaultSeller = db.establishments.find((entry) => entry.is_default_seller) ?? null;
  const companyCnpjConfigured = Boolean(appConfig.fiscal.companyCnpj || (defaultSeller?.cnpj && !/^0{2}\./.test(defaultSeller.cnpj)));

  const fiscalMinimalScore = scoreByCompletion(minimal.metrics.fiscal_profiles, minimal.metrics.pending_fiscal_profiles);
  const fiscalGlobalScore = scoreByCompletion(global.metrics.fiscal_profiles, global.metrics.pending_fiscal_profiles);
  const issuerScore = fiscalProviderReady ? 75 : db.fiscalDocuments.length > 0 ? 25 : 10;
  const erpScore = erpReady ? 70 : 10;
  const interstateScore = global.ready && fiscalProviderReady ? 40 : 5;
  const marketplaceScore = erpReady && fiscalProviderReady ? 35 : 5;
  const contingencyScore = appConfig.queueProvider === "redis" && appConfig.redis.url && fiscalProviderReady ? 35 : 5;
  const overall = Math.round(
    fiscalMinimalScore * 0.2 +
      fiscalGlobalScore * 0.2 +
      issuerScore * 0.15 +
      interstateScore * 0.15 +
      marketplaceScore * 0.1 +
      erpScore * 0.1 +
      contingencyScore * 0.1,
  );

  const phase0Blockers = [
    ...blockedIf(!minimal.ready, `${minimal.metrics.pending_fiscal_profiles} perfil(is) fiscais minimos pendentes.`),
    ...blockedIf(minimal.metrics.pending_fiscal_documents > 0, `${minimal.metrics.pending_fiscal_documents} documento(s) fiscal(is) pendente(s) no recorte minimo.`),
  ];

  const phase1Blockers = [
    ...blockedIf(!global.ready, `${global.metrics.pending_fiscal_profiles} perfil(is) fiscais globais pendentes.`),
    ...blockedIf(global.metrics.pending_catalog_items > 0, `${global.metrics.pending_catalog_items} item(ns) de staging fiscal/comercial pendentes.`),
  ];

  const phase2Blockers = [
    ...blockedIf(!companyCnpjConfigured, "CNPJ fiscal real nao configurado/confirmado."),
    ...blockedIf(!defaultSeller?.state_registration, "Inscricao estadual do seller padrao nao confirmada."),
    ...blockedIf(!defaultSeller?.tax_regime, "Regime tributario nao confirmado."),
  ];

  const phase3Blockers = [
    ...blockedIf(!fiscalProviderReady, "Emissor fiscal real nao homologado/configurado."),
    ...blockedIf(appConfig.fiscalProvider === "manual", "FISCAL_PROVIDER permanece manual."),
  ];

  const phase4Blockers = [
    ...blockedIf(!global.ready, "Cadastro fiscal global ainda nao esta completo."),
    ...blockedIf(!fiscalProviderReady, "Motor/emissor fiscal real ausente para validar operacoes interestaduais."),
  ];

  const phase5Blockers = [
    ...blockedIf(!erpReady, "ERP/SPED nao configurado para sincronizacao fiscal."),
    ...blockedIf(!fiscalProviderReady, "Emissor fiscal real ainda nao integrado ao fechamento."),
  ];

  const phase6Blockers = [
    ...blockedIf(!erpReady, "Marketplace exige ERP/conciliacao fiscal e financeira."),
    ...blockedIf(!fiscalProviderReady, "Marketplace exige emissao fiscal automatizada homologada."),
  ];

  const phase7Blockers = [
    ...blockedIf(appConfig.queueProvider !== "redis" || !appConfig.redis.url, "Fila fiscal distribuida/Redis nao configurada."),
    ...blockedIf(!fiscalProviderReady, "Fila fiscal de alto volume depende de emissao fiscal automatizada homologada."),
    ...blockedIf(!erpReady, "ERP/conciliacao nao pronto para alto volume."),
  ];

  const phases: FiscalEnterprisePhase[] = [
    {
      id: "fase-0",
      name: "Bloqueio imediato: fiscal minimo",
      status: phase0Blockers.length === 0 ? "ready" : "blocked",
      objective: "Liberar somente o mix minimo para pedido real regional assistido.",
      blockers: phase0Blockers,
      dependencies: [{ type: "contador", item: "NCM e tax_code dos 6 SKUs minimos", responsible: "Contador/Fiscal" }],
      executable_now: ["Validar close pack fiscal", "Aplicar close pack fiscal somente se preenchido e validado", "Reexecutar gate minimo"],
      commands: [
        "npm run fiscal:close-pack:validate -- docs/reports/fiscal-close-pack-minimal.csv",
        "npm run fiscal:close-pack:apply -- docs/reports/fiscal-close-pack-minimal.csv",
        "npm run fiscal:check:minimal",
      ],
      acceptance_criteria: ["Fiscal minimo sem blockers", "Nenhum documento fiscal pendente no recorte minimo"],
    },
    {
      id: "fase-1",
      name: "Fiscal global do catalogo",
      status: phase1Blockers.length === 0 ? "ready" : "blocked",
      objective: "Completar perfis fiscais globais antes de ampliar catalogo e regioes.",
      blockers: phase1Blockers,
      dependencies: [
        { type: "contador", item: "NCM, CST/CSOSN, CFOP, origem e CEST quando aplicavel", responsible: "Contador/Fiscal" },
        { type: "operacao", item: "Peso/dimensoes e imagens reais do staging", responsible: "Catalogo/Logistica" },
      ],
      executable_now: ["Usar workboard e staging CSV para priorizar familias", "Manter itens bloqueados fora da publicacao"],
      commands: ["npm run fiscal:workboard", "npm run catalog:workboard", "npm run fiscal:check"],
      acceptance_criteria: ["0 perfis fiscais globais pendentes", "Staging sem blockers para lote selecionado"],
    },
    {
      id: "fase-2",
      name: "Estrutura empresarial fiscal",
      status: phase2Blockers.length === 0 ? "partial" : "blocked",
      objective: "Parametrizar entidade fiscal real antes da emissao automatica.",
      blockers: phase2Blockers,
      dependencies: [
        { type: "contador", item: "CNPJ, IE, regime, CNAE, serie e numeracao", responsible: "Dono/Contador" },
        { type: "credencial", item: "Certificado digital", responsible: "Administrador/Fiscal" },
      ],
      executable_now: ["Conferir variaveis FISCAL_*", "Documentar dados empresariais obrigatorios"],
      commands: ["npm run fiscal:enterprise:plan"],
      acceptance_criteria: ["CNPJ/IE/regime/certificado confirmados", "Ambiente fiscal homologacao definido"],
    },
    {
      id: "fase-3",
      name: "Emissao fiscal real",
      status: phase3Blockers.length === 0 ? "partial" : "blocked",
      objective: "Substituir controle manual por emissor NF-e/NFC-e homologado.",
      blockers: phase3Blockers,
      dependencies: [
        { type: "credencial", item: "FISCAL_PROVIDER, FISCAL_API_URL, FISCAL_API_TOKEN, FISCAL_COMPANY_CNPJ", responsible: "Administrador/DevOps" },
        { type: "programacao", item: "Adapter do emissor fiscal real", responsible: "Engenharia" },
      ],
      executable_now: ["Manter interface manual e auditoria", "Preparar adapter sem credenciais reais"],
      commands: ["npm run fiscal:enterprise:plan", "npm run smoke:release"],
      acceptance_criteria: ["NF-e homologada", "XML/DANFE armazenados", "Rejeicoes tratadas com retry"],
    },
    {
      id: "fase-4",
      name: "Motor tributario nacional",
      status: phase4Blockers.length === 0 ? "partial" : "blocked",
      objective: "Suportar venda interestadual com regras por UF e operacao.",
      blockers: phase4Blockers,
      dependencies: [
        { type: "contador", item: "Matriz UF/NCM/CEST/DIFAL/FCP/ST/GNRE", responsible: "Contador/Tributarista" },
        { type: "programacao", item: "Motor de regras versionado e testado", responsible: "Engenharia" },
      ],
      executable_now: ["Documentar matriz de regras esperada", "Bloquear nacional ate homologacao"],
      commands: ["npm run fiscal:check", "npm run freight:catalog:check"],
      acceptance_criteria: ["Regras por UF homologadas", "Pedidos interestaduais com XML autorizado em homologacao"],
    },
    {
      id: "fase-5",
      name: "ERP, SPED e fechamento",
      status: phase5Blockers.length === 0 ? "partial" : "blocked",
      objective: "Conciliar pedido, pagamento, estoque, XML e contabilidade.",
      blockers: phase5Blockers,
      dependencies: [
        { type: "credencial", item: "ERP_PROVIDER, ERP_API_URL, ERP_API_TOKEN", responsible: "Administrador/DevOps" },
        { type: "contador", item: "Layout e calendario de obrigações", responsible: "Contador" },
      ],
      executable_now: ["Manter exports e auditoria", "Definir contrato de integracao ERP"],
      commands: ["npm run fiscal:enterprise:plan", "npm run operations:check"],
      acceptance_criteria: ["Fechamento fiscal mensal reconciliado", "SPED/contabilidade recebem dados consistentes"],
    },
    {
      id: "fase-6",
      name: "Marketplace fiscal",
      status: phase6Blockers.length === 0 ? "partial" : "blocked",
      objective: "Preparar canais marketplace com split, comissao, devolucao e conciliacao.",
      blockers: phase6Blockers,
      dependencies: [
        { type: "credencial", item: "Credenciais dos marketplaces", responsible: "Administrador" },
        { type: "operacao", item: "Política de comissao/frete/devolucao por canal", responsible: "Comercial/Fiscal" },
      ],
      executable_now: ["Manter marketplace fora de escopo de go-live", "Documentar contrato fiscal por canal"],
      commands: ["npm run fiscal:enterprise:plan"],
      acceptance_criteria: ["Pedido marketplace conciliado com NF, pagamento e comissao"],
    },
    {
      id: "fase-7",
      name: "Black Friday fiscal",
      status: phase7Blockers.length === 0 ? "partial" : "blocked",
      objective: "Operar alto volume sem travar NF-e, estoque e expedicao.",
      blockers: phase7Blockers,
      dependencies: [
        { type: "ambiente", item: "Redis/fila distribuida e observabilidade", responsible: "DevOps" },
        { type: "programacao", item: "Retry, DLQ, contingencia fiscal e dashboards", responsible: "Engenharia" },
      ],
      executable_now: ["Manter plano de war room", "Bloquear campanha massiva ate infraestrutura real"],
      commands: ["npm run fiscal:enterprise:plan", "npm run phase1:check", "npm run phase2:check"],
      acceptance_criteria: ["Fila fiscal testada em carga", "Contingencia SEFAZ validada", "0 expedicoes sem NF autorizada"],
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    verdict: {
      fiscal_minimal: minimal.ready ? "ready" : "blocked",
      regional_soft_launch: minimal.ready ? "eligible_controlled" : "blocked_by_fiscal",
      national_operation: global.ready && fiscalProviderReady ? "partial" : "not_ready",
      marketplace: fiscalProviderReady && erpReady ? "partial" : "not_ready",
      black_friday: fiscalProviderReady && erpReady && appConfig.queueProvider === "redis" && Boolean(appConfig.redis.url) ? "partial" : "not_ready",
    },
    scores: {
      fiscal_minimal: fiscalMinimalScore,
      fiscal_global: fiscalGlobalScore,
      issuer: issuerScore,
      interstate: interstateScore,
      marketplace: marketplaceScore,
      erp_sped: erpScore,
      contingency: contingencyScore,
      overall,
    },
    metrics: {
      minimal_pending_profiles: minimal.metrics.pending_fiscal_profiles,
      global_pending_profiles: global.metrics.pending_fiscal_profiles,
      staging_pending_items: workboard.metrics.pending_catalog_items,
      pending_fiscal_documents: global.metrics.pending_fiscal_documents,
      fiscal_provider_ready: fiscalProviderReady,
      erp_sync_enabled: erpReady,
      company_cnpj_configured: companyCnpjConfigured,
    },
    phases,
    next_actions: [
      "Fechar fiscal minimo com contador antes do primeiro pedido real.",
      "Manter catalogo amplo e marketplaces fora do go-live ate fiscal global e emissao real estarem homologados.",
      "Configurar emissor fiscal e ERP apenas com credenciais reais.",
      "Validar fila/Redis e contingencia antes de campanhas de alto volume.",
    ],
  };
}
