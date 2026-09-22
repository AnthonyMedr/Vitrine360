import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type ExternalBlocker = {
  source: string;
  item: string;
  detail: string;
};

type ClosureReport = {
  ok: boolean;
  programmable_scope: string;
  production_open: string;
  external_blockers: ExternalBlocker[];
};

type ResolutionItem = {
  area: "pagamento" | "frete" | "infra";
  item: string;
  status: "BLOQUEADO_EXTERNO";
  owner: string;
  required_env: string[];
  evidence_required: string[];
  validation_commands: string[];
  acceptance_criteria: string[];
  notes: string;
};

const closurePath = "docs/reports/programmable-final-closure-latest.json";

function readClosure(): ClosureReport {
  if (!existsSync(closurePath)) {
    throw new Error(`Relatorio de fechamento ausente: ${closurePath}. Execute npm run completion:final-closure.`);
  }
  return JSON.parse(readFileSync(closurePath, "utf8")) as ClosureReport;
}

const catalog: Record<string, ResolutionItem> = {
  payment_provider: {
    area: "pagamento",
    item: "payment_provider",
    status: "BLOQUEADO_EXTERNO",
    owner: "Admin Master + responsavel financeiro",
    required_env: ["PAYMENT_PROVIDER=mercadopago"],
    evidence_required: ["Print/registro da conta Mercado Pago homologada", "Registro de pagamento teste aprovado"],
    validation_commands: ["npm run integrations:check", "npm run go-live:check", "npm run smoke:phase2"],
    acceptance_criteria: ["PAYMENT_PROVIDER deixa de ser manual", "Pagamento teste aprovado e auditado"],
    notes: "Nao usar provider fake/manual para liberar producao aberta.",
  },
  mercadopago_access_token: {
    area: "pagamento",
    item: "mercadopago_access_token",
    status: "BLOQUEADO_EXTERNO",
    owner: "Responsavel financeiro com acesso Mercado Pago",
    required_env: ["MERCADOPAGO_ACCESS_TOKEN=__SET_SECRET__"],
    evidence_required: ["Token configurado no cofre/ambiente, sem expor valor em texto claro"],
    validation_commands: ["npm run integrations:check"],
    acceptance_criteria: ["Check mercadopago_access_token passa como ok", "Nenhum secret aparece em tela, log ou relatorio"],
    notes: "Valor real deve entrar apenas em secret manager ou .env local protegido.",
  },
  mercadopago_webhook_secret: {
    area: "pagamento",
    item: "mercadopago_webhook_secret",
    status: "BLOQUEADO_EXTERNO",
    owner: "Responsavel financeiro + tecnico",
    required_env: ["MERCADOPAGO_WEBHOOK_SECRET=__SET_SECRET__"],
    evidence_required: ["Webhook assinado testado com sucesso", "Registro de evento recebido e validado"],
    validation_commands: ["npm run integrations:check", "npm run smoke:phase2"],
    acceptance_criteria: ["Webhook invalido e rejeitado", "Webhook valido atualiza estado de pagamento"],
    notes: "Nao registrar segredo em docs, logs ou prints.",
  },
  mercadopago_webhook_url: {
    area: "pagamento",
    item: "mercadopago_webhook_url",
    status: "BLOQUEADO_EXTERNO",
    owner: "Responsavel tecnico de deploy",
    required_env: ["MERCADOPAGO_WEBHOOK_URL=https://seu-dominio/api/payments/webhook"],
    evidence_required: ["URL publica HTTPS configurada no Mercado Pago", "Evento real recebido em staging/producao"],
    validation_commands: ["npm run integrations:check", "npm run go-live:check"],
    acceptance_criteria: ["URL usa HTTPS", "Endpoint responde e valida assinatura"],
    notes: "A URL local/localhost nao atende go-live aberto.",
  },
  freight_provider: {
    area: "frete",
    item: "freight_provider",
    status: "BLOQUEADO_EXTERNO",
    owner: "Responsavel logistico + tecnico",
    required_env: ["FREIGHT_PROVIDER=melhor-envio|correios|frenet|frete-barato|cepcerto"],
    evidence_required: ["Provider escolhido homologado", "Cotacao teste com CEP real"],
    validation_commands: ["npm run integrations:check", "npm run freight:catalog:check", "npm run go-live:check"],
    acceptance_criteria: ["FREIGHT_PROVIDER deixa de ser local-rules/fake", "Cotacao nacional real retorna opcao valida"],
    notes: "Nao liberar checkout nacional com fallback local.",
  },
  freight_origin: {
    area: "frete",
    item: "freight_origin",
    status: "BLOQUEADO_EXTERNO",
    owner: "Responsavel logistico",
    required_env: ["FREIGHT_ORIGIN_CEP=__CEP_ORIGEM__", "MELHOR_ENVIO_ORIGIN_ZIP ou CORREIOS_ORIGIN_ZIP conforme provider"],
    evidence_required: ["CEP de origem validado pela operacao", "Politica de retirada/despacho definida"],
    validation_commands: ["npm run integrations:check", "npm run freight:catalog:check"],
    acceptance_criteria: ["Origem de frete reconhecida pelo check", "Produtos do escopo tem dimensoes/peso"],
    notes: "CEP deve ser da origem real de expedicao.",
  },
  freight_token: {
    area: "frete",
    item: "freight_token",
    status: "BLOQUEADO_EXTERNO",
    owner: "Responsavel logistico + tecnico",
    required_env: ["FREIGHT_API_KEY ou MELHOR_ENVIO_TOKEN ou CORREIOS_TOKEN ou FRENET_TOKEN"],
    evidence_required: ["Token configurado no cofre/ambiente", "Cotacao autenticada executada"],
    validation_commands: ["npm run integrations:check", "npm run go-live:check"],
    acceptance_criteria: ["Check freight_token passa como ok", "Cotacao real nao usa fallback local"],
    notes: "Nao expor token em relatorios.",
  },
};

function buildResolutionItems(blockers: ExternalBlocker[]) {
  const seen = new Set<string>();
  const items: ResolutionItem[] = [];
  for (const blocker of blockers) {
    const template = catalog[blocker.item];
    if (!template || seen.has(template.item)) continue;
    seen.add(template.item);
    items.push(template);
  }
  return items;
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function renderCsv(items: ResolutionItem[]) {
  const header = ["area", "item", "status", "owner", "required_env", "validation_commands", "acceptance_criteria", "notes"];
  const rows = items.map((item) => [
    item.area,
    item.item,
    item.status,
    item.owner,
    item.required_env.join(" | "),
    item.validation_commands.join(" && "),
    item.acceptance_criteria.join(" | "),
    item.notes,
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push("# Pacote De Resolucao Dos Bloqueios Externos");
  lines.push("");
  lines.push(`- Gerado em: \`${report.generated_at}\``);
  lines.push(`- Escopo programavel: \`${report.programmable_scope}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push(`- Itens externos gerenciaveis: \`${report.items.length}\``);
  lines.push("");
  lines.push("## Itens");
  lines.push("");
  for (const item of report.items) {
    lines.push(`### ${item.area} - ${item.item}`);
    lines.push("");
    lines.push(`- Status: \`${item.status}\``);
    lines.push(`- Responsavel: ${item.owner}`);
    lines.push(`- Variaveis: ${item.required_env.map((entry) => `\`${entry}\``).join(", ")}`);
    lines.push(`- Evidencias: ${item.evidence_required.join("; ")}`);
    lines.push(`- Validar com: ${item.validation_commands.map((entry) => `\`${entry}\``).join(", ")}`);
    lines.push(`- Aceite: ${item.acceptance_criteria.join("; ")}`);
    lines.push(`- Nota: ${item.notes}`);
    lines.push("");
  }
  lines.push("## Ordem Recomendada");
  lines.push("");
  lines.push("1. Configurar Mercado Pago real e webhook HTTPS.");
  lines.push("2. Configurar provider de frete real, origem e token.");
  lines.push("3. Reexecutar `npm run integrations:check`.");
  lines.push("4. Reexecutar `npm run go-live:check`.");
  lines.push("5. Registrar evidencias reais antes de pedir liberacao executiva.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderEnvChecklist(items: ResolutionItem[]) {
  const lines = [
    "# Checklist de variaveis reais - nao preencher com secrets neste arquivo",
    "PAYMENT_PROVIDER=mercadopago",
    "MERCADOPAGO_ACCESS_TOKEN=__SET_SECRET_IN_ENV__",
    "MERCADOPAGO_WEBHOOK_SECRET=__SET_SECRET_IN_ENV__",
    "MERCADOPAGO_WEBHOOK_URL=https://seu-dominio/api/payments/webhook",
    "FREIGHT_PROVIDER=melhor-envio",
    "FREIGHT_ORIGIN_CEP=__SET_ORIGIN_ZIP__",
    "MELHOR_ENVIO_TOKEN=__SET_SECRET_IN_ENV__",
    "SECURE_COOKIES=true",
    "METRICS_TOKEN=__SET_SECRET_IN_ENV__",
    "",
    "# Itens cobertos",
    ...items.map((item) => `# - ${item.item}`),
    "",
  ];
  return lines.join("\n");
}

function buildReport() {
  const closure = readClosure();
  const items = buildResolutionItems(closure.external_blockers);
  return {
    generated_at: new Date().toISOString(),
    ok: closure.ok === true && closure.programmable_scope === "CONCLUIDO" && closure.production_open === "BLOQUEADO_EXTERNO",
    programmable_scope: closure.programmable_scope,
    production_open: closure.production_open,
    source_report: closurePath,
    items,
    validation_sequence: ["npm run integrations:check", "npm run go-live:check", "npm run completion:final-closure"],
  };
}

const basePath = resolve("docs/reports/external-blocker-resolution-pack-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const csvPath = `${basePath}.csv`;
const envPath = `${basePath}.env.example`;
const report = buildReport();

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");
writeFileSync(csvPath, renderCsv(report.items), "utf8");
writeFileSync(envPath, renderEnvChecklist(report.items), "utf8");

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      production_open: report.production_open,
      items: report.items.length,
      jsonPath,
      mdPath,
      csvPath,
      envPath,
    },
    null,
    2,
  ),
);

if (!report.ok) process.exit(1);
