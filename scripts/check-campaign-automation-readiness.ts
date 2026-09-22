import { existsSync, readFileSync } from "node:fs";

type Check = {
  id: string;
  ok: boolean;
  detail: string;
};

function read(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function has(path: string, pattern: RegExp | string) {
  const source = read(path);
  return typeof pattern === "string" ? source.includes(pattern) : pattern.test(source);
}

const requiredDocs = [
  "docs/marketing/DIAGNOSTICO_CAMPANHAS_TEMAS_DINAMICOS.md",
  "docs/marketing/PLANO_TECNICO_CAMPANHAS_AUTOMATICAS_TEMAS_DINAMICOS.md",
  "docs/marketing/CHECKLIST_PUBLICACAO_CAMPANHAS_AUTOMATICAS.md",
  "docs/ADMIN_MARKETING_GUIDE.md",
  "docs/CAMPAIGN_CALENDAR_GUIDE.md",
  "docs/CENTRAL_MARKETING_TEMAS_GESTAO_COMERCIAL.md",
];

const checks: Check[] = [
  ...requiredDocs.map((path) => ({
    id: `doc:${path}`,
    ok: existsSync(path),
    detail: existsSync(path) ? "Documento presente." : "Documento ausente.",
  })),
  {
    id: "model:campaign-theme-surfaces",
    ok:
      has("server/db.ts", "interface DbMarketingCampaign") &&
      has("server/db.ts", "interface DbEcommerceTheme") &&
      has("server/db.ts", "interface DbProductShowcase") &&
      has("server/db.ts", "MarketingLifecycleStatus") &&
      has("server/db.ts", '"fortnightly"') &&
      has("server/db.ts", '"product"') &&
      has("server/db.ts", '"b2b"'),
    detail: "Modelos de campanha, tema, vitrine e ciclo de vida.",
  },
  {
    id: "model:portuguese-type-aliases",
    ok:
      has("server/marketing-operations.ts", "normalizeCampaignType") &&
      has("server/marketing-operations.ts", "quinzenal") &&
      has("server/marketing-operations.ts", "produto") &&
      has("server/marketing-operations.ts", "empresas"),
    detail: "Aliases operacionais em portugues para tipos de campanha.",
  },
  {
    id: "calendar:june-2026-world-cup-sao-joao",
    ok:
      has("server/db.ts", "Junho da Reforma: Copa e Sao Joao") &&
      has("server/db.ts", "copa_do_mundo_mais_festas_juninas") &&
      has("docs/CAMPAIGN_CALENDAR_GUIDE.md", "Junho de 2026") &&
      has("docs/marketing/PLANO_TECNICO_CAMPANHAS_AUTOMATICAS_TEMAS_DINAMICOS.md", "Copa do Mundo") &&
      has("docs/marketing/PLANO_TECNICO_CAMPANHAS_AUTOMATICAS_TEMAS_DINAMICOS.md", "festas juninas"),
    detail: "Junho 2026 combina Copa do Mundo e Sao Joao/festas juninas.",
  },
  {
    id: "engine:active-period-priority",
    ok:
      has("server/marketing-operations.ts", "function isWithinPeriod") &&
      has("server/marketing-operations.ts", "export function isMarketingActive") &&
      has("server/marketing-operations.ts", 'item.status === "scheduled"') &&
      has("server/marketing-operations.ts", "campaign_surface_schedule_conflict") &&
      has("server/marketing-operations.ts", /sort\(\(a, b\) => b\.priority - a\.priority/),
    detail: "Resolucao automatica por periodo, status e prioridade.",
  },
  {
    id: "engine:surface-controls",
    ok:
      has("server/marketing-operations.ts", "getCampaignSurfaceControls") &&
      has("server/marketing-operations.ts", "top_bar_enabled") &&
      has("server/marketing-operations.ts", "home_showcase_order"),
    detail: "Superficies e ordem manual de vitrines controladas por campanha.",
  },
  {
    id: "engine:fallback",
    ok:
      has("server/marketing-operations.ts", 'mode: primaryCampaign ? "campaign" : "default"') &&
      has("server/marketing-operations.ts", "Sem campanha ativa"),
    detail: "Fallback institucional quando nao ha campanha ativa.",
  },
  {
    id: "api:public-active-campaign",
    ok:
      has("server/index.ts", "/api/public/campaigns/active") &&
      has("server/index.ts", "/api/admin/marketing/preview") &&
      has("src/hooks/useMarketing.ts", "/api/public/campaigns/active"),
    detail: "Endpoint publico e hook do storefront para campanha ativa.",
  },
  {
    id: "admin:marketing-preview-readiness",
    ok:
      has("src/pages/AdminMarketing.tsx", "Como o site esta se moldando a campanha") &&
      has("src/pages/AdminMarketing.tsx", "Superficies que a campanha controla") &&
      has("src/pages/AdminMarketing.tsx", "Tipo de campanha") &&
      has("src/pages/AdminMarketing.tsx", "B2B / empresas") &&
      has("src/pages/AdminMarketing.tsx", "Preview por data futura") &&
      has("src/pages/AdminMarketing.tsx", "Conflitos detectados") &&
      has("src/pages/AdminMarketing.tsx", "Painel de conflitos de campanha") &&
      has("src/pages/AdminMarketing.tsx", "/api/admin/marketing/campaign-readiness"),
    detail: "Admin possui preview, superficies e readiness de publicacao.",
  },
  {
    id: "storefront:home-dynamic",
    ok:
      has("src/components/marketing/CampaignTopBar.tsx", "usePublicMarketingState") &&
      has("src/components/marketing/CampaignHeroStrip.tsx", "site_experience.hero") &&
      has("src/components/home/FeaturedProducts.tsx", "site_experience.home_slots") &&
      has("src/components/home/CategoriesSection.tsx", "site_experience.category_focus"),
    detail: "Home publica consome top bar, hero, vitrines e categorias de campanha.",
  },
  {
    id: "storefront:landing",
    ok: has("src/pages/CampaignLanding.tsx", "/api/public/campaigns/") && has("src/pages/CampaignLanding.tsx", "trackMarketingEvent"),
    detail: "Landing publica de campanha com tracking.",
  },
  {
    id: "governance:audit",
    ok: has("server/marketing-operations.ts", "auditMarketingMutation") && has("server/marketing-operations.ts", "createAuditEvent"),
    detail: "Mutacoes de marketing possuem base de auditoria.",
  },
  {
    id: "tests:campaign-automation",
    ok:
      has("tests/marketing-operations.test.ts", "resolves highest priority active campaign") &&
      has("tests/marketing-operations.test.ts", "respects explicit campaign surface toggles") &&
      has("tests/http-marketing.test.ts", "/api/public/campaigns/active"),
    detail: "Testes cobrem prioridade, superficies e endpoint publico.",
  },
];

const blockers = checks.filter((check) => !check.ok);
const warnings = [
  "homologacao_visual_manual_com_marketing_pendente",
  "preview_por_data_futura_recomendado",
  "aprovacao_editorial_em_duas_etapas_recomendada",
  "fiscal_pagamento_frete_produtivos_seguem_bloqueados_externamente",
];

const report = {
  generated_at: new Date().toISOString(),
  CAMPAIGN_AUTOMATION_DOCUMENTED: requiredDocs.every((path) => existsSync(path)),
  CAMPAIGN_AUTOMATION_STRUCTURAL_READY: blockers.length === 0,
  CAMPAIGN_AUTOMATION_READY: blockers.length === 0 ? "PARCIAL_OPERACIONAL" : "BLOQUEADO_ESTRUTURAL",
  PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
  MAIN_BLOCKER: "fiscal_minimo_contador",
  NEXT_STEP: "HOMOLOGAR_CALENDARIO_COM_MARKETING+QA_VISUAL+FISCAL_CONTADOR+INTEGRACOES_REAIS",
  checks,
  blockers,
  warnings,
};

console.log(JSON.stringify(report, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}
