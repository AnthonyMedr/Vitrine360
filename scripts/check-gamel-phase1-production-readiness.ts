import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Severity = "blocker" | "external_pending" | "warning";

type Issue = {
  id: string;
  severity: Severity;
  detail: string;
};

type StepResult = {
  id: string;
  command: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
};

type ProductionReadinessReport = {
  ok: boolean;
  assisted_homologation_ready: boolean;
  production_deploy_ready: boolean;
  generated_at: string;
  scope: string;
  ecommerce_future: string;
  env_source: string;
  metrics: {
    blockers: number;
    external_pending: number;
    warnings: number;
  };
  steps: StepResult[];
  issues: Issue[];
  next_steps: string[];
};

const requiredDocs = [
  "docs/gamel/README.md",
  "docs/gamel/GO_LIVE_ENV_CHECKLIST.md",
  "docs/gamel/ADMIN_TREINAMENTO_OPERACIONAL.md",
  "docs/gamel/HOMOLOGACAO_ASSISTIDA_FASE1.md",
  "docs/gamel/ROTEIRO_DEMO_CLIENTE_FASE1.md",
  "docs/gamel/USUARIOS_REAIS_PERMISSOES_FASE1.md",
  "docs/gamel/TESTES_FASE1_E_FUTURO.md",
];

const requiredEnv = [
  "APP_ENV",
  "APP_BASE_URL",
  "API_BASE_URL",
  "DATABASE_URL",
  "DB_PROVIDER",
  "REDIS_URL",
  "QUEUE_PROVIDER",
  "RESEND_API_KEY",
  "GA4_MEASUREMENT_ID",
  "STORAGE_BUCKET",
  "STORAGE_PUBLIC_BASE_URL",
  "STORE_WHATSAPP",
  "APP_SECRET",
  "AUTH_CSRF_SECRET",
  "CORS_ALLOWED_ORIGINS",
  "SECURE_COOKIES",
  "TRUST_PROXY",
];

const expectedFlags: Record<string, string> = {
  APP_ENV: "production",
  APP_BASE_URL: "https://www.gamelmetal.com",
  VITE_SITE_MODE: "quote",
  VITE_ECOMMERCE_ENABLED: "false",
  VITE_CART_ENABLED: "false",
  VITE_CHECKOUT_ENABLED: "false",
  VITE_PAYMENTS_ENABLED: "false",
  VITE_ORDER_TRACKING_ENABLED: "false",
  VITE_CUSTOMER_ACCOUNT_ENABLED: "false",
  VITE_QUOTE_ENABLED: "true",
  VITE_WHATSAPP_ENABLED: "true",
  PAYMENT_PROVIDER: "manual",
  FREIGHT_PROVIDER: "local-rules",
  ERP_PROVIDER: "none",
};

const activeAdminSources = [
  "src/components/admin/AdminWorkspaceShell.tsx",
  "src/pages/AdminTeamHome.tsx",
  "src/pages/AdminProductsWorkspace.tsx",
  "src/pages/AdminCatalogWorkspace.tsx",
  "src/pages/AdminMediaLibrary.tsx",
  "src/pages/AdminBannersShowcases.tsx",
  "src/pages/AdminOperations.tsx",
  "src/pages/AdminUsers.tsx",
  "src/pages/AdminGoLiveReadiness.tsx",
];

const publicSources = [
  "src/components/layout/Header.tsx",
  "src/components/layout/Footer.tsx",
  "src/pages/Index.tsx",
  "src/pages/Products.tsx",
  "src/pages/ProductDetail.tsx",
  "src/pages/Quote.tsx",
];

function read(relativePath: string) {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function readIfExists(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
}

function parseEnv(source: string) {
  const values = new Map<string, string>();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(line.slice(0, separatorIndex).trim(), value);
  }
  return values;
}

function isPlaceholder(value: string | undefined) {
  if (!value) return true;
  return /^__SET_/i.test(value) || /^troque-/i.test(value) || /\*\*\*/.test(value);
}

function getEnvSource() {
  for (const candidate of [".env.production.local", ".env.production.example", ".env"]) {
    if (existsSync(path.resolve(process.cwd(), candidate))) {
      return { file: candidate, values: parseEnv(read(candidate)) };
    }
  }
  return { file: "<nenhum>", values: new Map<string, string>() };
}

function runStep(id: string, command: string): StepResult {
  const startedAt = Date.now();
  const result = spawnSync(command, {
    cwd: process.cwd(),
    shell: true,
    stdio: "inherit",
    env: process.env,
  });
  return {
    id,
    command,
    ok: result.status === 0,
    status: result.status,
    durationMs: Date.now() - startedAt,
  };
}

const issues: Issue[] = [];
const envSource = getEnvSource();

for (const docPath of requiredDocs) {
  if (!existsSync(path.resolve(process.cwd(), docPath))) {
    issues.push({ id: `doc.missing.${docPath}`, severity: "blocker", detail: `Documento essencial ausente: ${docPath}.` });
  }
}

for (const key of requiredEnv) {
  const value = process.env[key] || envSource.values.get(key);
  if (isPlaceholder(value)) {
    issues.push({
      id: `env.pending.${key}`,
      severity: "external_pending",
      detail: `${key} precisa de valor real no ambiente de homologacao/producao. Fonte analisada: ${envSource.file}.`,
    });
  }
}

for (const [key, expected] of Object.entries(expectedFlags)) {
  const actual = process.env[key] || envSource.values.get(key);
  if (actual !== expected) {
    issues.push({ id: `flag.${key}`, severity: "blocker", detail: `${key} esperado=${expected}; atual=${actual ?? "<ausente>"}.` });
  }
}

const appSource = read("src/App.tsx");
const featureFlagSource = read("src/config/featureFlags.ts");
if (
  !/FutureEcommerce/.test(appSource)
  || !/cart:\s*import\.meta\.env\.VITE_CART_ENABLED\s*===\s*"true"/.test(featureFlagSource)
  || !/checkout:\s*import\.meta\.env\.VITE_CHECKOUT_ENABLED\s*===\s*"true"/.test(featureFlagSource)
) {
  issues.push({ id: "future_ecommerce.flags", severity: "blocker", detail: "Rotas futuras precisam continuar protegidas por feature flag/placeholder." });
}

const activeAdminText = activeAdminSources.map(readIfExists).join("\n");
const publicText = publicSources.map(readIfExists).join("\n");
const directPurchasePattern = /Comprar agora|Adicionar ao carrinho|Ir para o carrinho|Finalizar compra|checkout|pagamento online|pedido pago|frete automatico/i;

if (directPurchasePattern.test(activeAdminText)) {
  issues.push({ id: "admin.copy.ecommerce", severity: "blocker", detail: "Admin ativo ainda contem linguagem de compra direta/e-commerce completo." });
}

if (directPurchasePattern.test(publicText)) {
  issues.push({ id: "public.copy.ecommerce", severity: "blocker", detail: "Experiencia publica ainda contem CTA ou linguagem de compra direta." });
}

if (!/\/api\/quote-requests/.test(readIfExists("src/pages/Quote.tsx"))) {
  issues.push({ id: "quote.api", severity: "blocker", detail: "Formulario de orcamento precisa persistir solicitacao via API." });
}

const steps = [
  runStep("build", "npm run build"),
  runStep("test_phase1", "npm run test:phase1"),
  runStep("admin_menu_routes", "npm run admin:menu-routes:check"),
  runStep("admin_usability", "npm run admin:usability:check"),
  runStep("catalog_images", "npm run catalog:images:check"),
  runStep("gamel_phase1_go_live", "npm run gamel:phase1:go-live:check"),
];

for (const step of steps) {
  if (!step.ok) {
    issues.push({ id: `step.failed.${step.id}`, severity: "blocker", detail: `Comando falhou: ${step.command}.` });
  }
}

const blockerCount = issues.filter((issue) => issue.severity === "blocker").length;
const externalPendingCount = issues.filter((issue) => issue.severity === "external_pending").length;
const warningCount = issues.filter((issue) => issue.severity === "warning").length;
const report: ProductionReadinessReport = {
  ok: blockerCount === 0,
  assisted_homologation_ready: blockerCount === 0,
  production_deploy_ready: blockerCount === 0 && externalPendingCount === 0,
  generated_at: new Date().toISOString(),
  scope: "GAMEL Fase 1 - site institucional, catalogo inteligente, orcamento online e painel administrativo",
  ecommerce_future: "preservado_sem_ativacao",
  env_source: envSource.file,
  metrics: {
    blockers: blockerCount,
    external_pending: externalPendingCount,
    warnings: warningCount,
  },
  steps,
  issues,
  next_steps:
    blockerCount > 0
      ? ["Corrigir bloqueadores antes da homologacao assistida."]
      : externalPendingCount > 0
        ? ["Homologacao assistida liberada; preencher variaveis reais antes do deploy final."]
        : ["Ambiente pronto para deploy final apos aceite da homologacao assistida."],
};

const reportsDir = path.resolve(process.cwd(), "docs/reports");
mkdirSync(reportsDir, { recursive: true });
writeFileSync(path.join(reportsDir, "gamel-phase1-production-readiness-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(path.join(reportsDir, "gamel-phase1-production-readiness-latest.md"), renderMarkdown(report));

console.log(JSON.stringify({
  ok: report.ok,
  assisted_homologation_ready: report.assisted_homologation_ready,
  production_deploy_ready: report.production_deploy_ready,
  blockers: blockerCount,
  external_pending: externalPendingCount,
  warnings: warningCount,
  report_json: "docs/reports/gamel-phase1-production-readiness-latest.json",
  report_md: "docs/reports/gamel-phase1-production-readiness-latest.md",
}, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}

function renderMarkdown(report: ProductionReadinessReport) {
  return [
    "# GAMEL Fase 1 - Production Readiness",
    "",
    `Gerado em: ${report.generated_at}`,
    "",
    `Status homologacao assistida: ${report.assisted_homologation_ready ? "APTO" : "BLOQUEADO"}`,
    `Status deploy final: ${report.production_deploy_ready ? "APTO" : "PENDENTE DE VARIAVEIS/INFRA"}`,
    `Fonte de env analisada: ${report.env_source}`,
    "",
    "## Checks Executados",
    "",
    "| Check | Status | Duracao |",
    "| --- | --- | ---: |",
    ...report.steps.map((step) => `| ${step.id} | ${step.ok ? "OK" : "FALHOU"} | ${step.durationMs}ms |`),
    "",
    "## Issues",
    "",
    report.issues.length === 0 ? "- Nenhuma issue encontrada." : report.issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.id}: ${issue.detail}`).join("\n"),
    "",
    "## Proximos Passos",
    "",
    ...report.next_steps.map((step) => `- ${step}`),
    "",
  ].join("\n");
}
