import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type RealInput = {
  area: string;
  owner: string;
  priority: "P0" | "P1";
  item: string;
  env_key: string;
  required_value: string;
  validation: string;
  notes: string;
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function markdownRow(values: unknown[]) {
  return `| ${values.map((value) => String(value ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
}

const generatedAt = new Date().toISOString();

const providedInputs = [
  { env_key: "STORE_WHATSAPP", value: "5587981818752", notes: "WhatsApp principal aplicado no site e nos links wa.me." },
  { env_key: "STORE_CONTACTS", value: "Telefones, e-mail, endereco, site e Instagram informados", notes: "Dados exibidos em Contato, Sobre, rodape e metadados." },
  { env_key: "BRAND_ASSETS_BASE", value: "/assets/brand/gamel-icon-* e /site.webmanifest", notes: "Kit oficial de icone transparente GAMEL aplicado: icone isolado, favicon.ico, tamanhos PWA e documentacao tecnica." },
  { env_key: "FISCAL_COMPANY_CNPJ", value: "64156323000151", notes: "CNPJ aplicado; IE/regime/canal LGPD ainda precisam de validacao fiscal." },
];

const inputs: RealInput[] = [
  {
    area: "Infra",
    owner: "DevOps",
    priority: "P0",
    item: "Postgres de producao",
    env_key: "DATABASE_URL",
    required_value: "URL real do banco Postgres gerenciado",
    validation: "npm run env:blueprints:check && npm run gamel:phase1:go-live:check",
    notes: "Nao usar SQLite em producao.",
  },
  {
    area: "Infra",
    owner: "DevOps",
    priority: "P0",
    item: "Redis de producao",
    env_key: "REDIS_URL",
    required_value: "URL real do Redis gerenciado",
    validation: "npm run env:blueprints:check && npm run gamel:phase1:go-live:check",
    notes: "Usado para fila/cache/rate limit.",
  },
  {
    area: "Seguranca",
    owner: "DevOps",
    priority: "P0",
    item: "Secret da aplicacao",
    env_key: "APP_SECRET",
    required_value: "Secret forte gerado fora do repositorio",
    validation: "npm run security:bootstrap ou scripts/bootstrap-production-env.ts",
    notes: "Nunca commitar valor real.",
  },
  {
    area: "Seguranca",
    owner: "DevOps",
    priority: "P0",
    item: "Secret CSRF",
    env_key: "AUTH_CSRF_SECRET",
    required_value: "Secret forte gerado fora do repositorio",
    validation: "npm run security:bootstrap ou scripts/bootstrap-production-env.ts",
    notes: "Cookie padrao da GAMEL: gamel_csrf.",
  },
  {
    area: "Marca/Catalogo",
    owner: "GAMEL/Marketing",
    priority: "P0",
    item: "Fotos reais e aprovacao visual",
    env_key: "REAL_PRODUCT_IMAGES",
    required_value: "Fotos institucionais/showroom, imagens reais por familia e aprovacao humana do uso das imagens",
    validation: "npm run qa:visual:pack && npm run qa:visual:screenshots",
    notes: "Logo/favicons basicos ja existem; imagens genericas devem ser substituidas por material aprovado quando disponivel.",
  },
  {
    area: "Legal/LGPD",
    owner: "GAMEL/Contabilidade",
    priority: "P0",
    item: "Dados fiscais e canal LGPD",
    env_key: "FISCAL_COMPANY_CNPJ",
    required_value: "IE, regime tributario, responsavel/canal LGPD e confirmacao contabil para uso do CNPJ informado",
    validation: "Revisao de /politicas e documentos legais",
    notes: "CNPJ e razao social ja foram informados; falta validacao fiscal completa.",
  },
  {
    area: "Email",
    owner: "Marketing/DevOps",
    priority: "P0",
    item: "Email transacional",
    env_key: "RESEND_API_KEY",
    required_value: "Chave real do provedor de email",
    validation: "Envio de teste de formulario/orcamento em homologacao",
    notes: "Reply-to padrao: comercial@gamelmetal.com.",
  },
  {
    area: "Analytics",
    owner: "Marketing",
    priority: "P1",
    item: "Google Analytics",
    env_key: "GA4_MEASUREMENT_ID",
    required_value: "ID GA4 da propriedade GAMEL",
    validation: "Realtime/DebugView do GA4",
    notes: "Nao bloqueia apresentacao, mas recomendado para go-live.",
  },
  {
    area: "Storage",
    owner: "DevOps",
    priority: "P1",
    item: "Storage/CDN de imagens",
    env_key: "STORAGE_BUCKET",
    required_value: "Bucket, regiao e credenciais reais",
    validation: "Upload/serving de uma imagem de teste",
    notes: "Pode iniciar localmente, mas producao deve usar storage gerenciado.",
  },
  {
    area: "Catalogo",
    owner: "GAMEL/Comercial",
    priority: "P0",
    item: "Catalogo validado",
    env_key: "CATALOG_APPROVAL",
    required_value: "Lista final de produtos, categorias, medidas, fotos e aplicacoes",
    validation: "Revisao em /produtos, /categoria/* e /produto/*",
    notes: "Preco/estoque continuam sob confirmacao comercial.",
  },
];

function buildMarkdown() {
  return [
    "# Dados Reais Necessarios - GAMEL Fase 1",
    "",
    `Gerado em: ${generatedAt}`,
    "",
    "Este arquivo lista os insumos externos que nao devem ser inventados por codigo. Sem estes dados, o projeto pode ficar tecnicamente pronto, mas nao deve ser tratado como publicacao final validada pela empresa.",
    "",
    "## Dados ja fornecidos e aplicados",
    "",
    markdownRow(["Chave/Artefato", "Valor", "Observacao"]),
    markdownRow(["---", "---", "---"]),
    ...providedInputs.map((input) => markdownRow([input.env_key, input.value, input.notes])),
    "",
    markdownRow(["Area", "Responsavel", "Prioridade", "Item", "Chave/Artefato", "Valor necessario", "Validacao"]),
    markdownRow(["---", "---", "---", "---", "---", "---", "---"]),
    ...inputs.map((input) =>
      markdownRow([input.area, input.owner, input.priority, input.item, input.env_key, input.required_value, input.validation]),
    ),
    "",
    "## Guardrail",
    "",
    "- Nao preencher CNPJ, telefone, endereco, chaves, fotos ou catalogo por inferencia.",
    "- E-commerce completo segue em stand by nesta fase.",
    "- Revalidar `npm run gamel:phase1:go-live:check` depois de preencher o ambiente real.",
    "",
  ].join("\n");
}

const basePath = resolve("docs/reports/gamel-real-inputs-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const csvPath = `${basePath}.csv`;

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify({ generated_at: generatedAt, provided_inputs: providedInputs, inputs }, null, 2)}\n`, "utf8");
writeFileSync(mdPath, buildMarkdown(), "utf8");
writeFileSync(
  csvPath,
  [
    csvRow(["area", "owner", "priority", "item", "env_key", "required_value", "validation", "notes"]),
    ...inputs.map((input) =>
      csvRow([input.area, input.owner, input.priority, input.item, input.env_key, input.required_value, input.validation, input.notes]),
    ),
  ].join("\n") + "\n",
  "utf8",
);

console.log(JSON.stringify({ ok: true, total: inputs.length, jsonPath, mdPath, csvPath }, null, 2));
