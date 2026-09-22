import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type StepKind = "internal" | "external-gate";

type Step = {
  id: string;
  label: string;
  command: string[];
  kind: StepKind;
  expectedBlockers?: string[];
};

type StepResult = {
  id: string;
  label: string;
  kind: StepKind;
  command: string;
  ok: boolean;
  expected_blocked: boolean;
  exit_code: number | null;
  duration_ms: number;
  summary: string;
  parsed?: unknown;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const steps: Step[] = [
  { id: "typecheck", label: "TypeScript typecheck", command: ["run", "typecheck"], kind: "internal" },
  { id: "lint", label: "ESLint", command: ["run", "lint"], kind: "internal" },
  { id: "test", label: "Suite automatizada isolada", command: ["run", "test"], kind: "internal" },
  { id: "build", label: "Build de producao", command: ["run", "build"], kind: "internal" },
  { id: "performance-budget", label: "Budget de performance", command: ["run", "performance:budget"], kind: "internal" },
  { id: "repo-hygiene", label: "Higiene do repositorio", command: ["run", "repo:hygiene:check"], kind: "internal" },
  { id: "phase1", label: "Fase 1 infra local", command: ["run", "phase1:check"], kind: "internal" },
  { id: "roadmap", label: "Roadmap oficial", command: ["run", "roadmap:check"], kind: "internal" },
  { id: "admin-usability", label: "Admin operacional", command: ["run", "admin:usability:check"], kind: "internal" },
  { id: "admin-control-center", label: "Central de controle Admin", command: ["run", "admin:control-center:check"], kind: "internal" },
  { id: "training", label: "Treinamento documentado", command: ["run", "training:check"], kind: "internal" },
  { id: "campaigns", label: "Campanhas automaticas", command: ["run", "campaigns:automation:check"], kind: "internal" },
  { id: "marketing", label: "Marketing readiness", command: ["run", "marketing:check"], kind: "internal" },
  { id: "homologation-scenarios", label: "Cenarios de homologacao", command: ["run", "homologation:scenarios"], kind: "internal" },
  { id: "homologation-evidence", label: "Pacote de evidencias de homologacao", command: ["run", "homologation:evidence:pack"], kind: "internal" },
  { id: "homologation-evidence-validate", label: "Validacao das evidencias de homologacao", command: ["run", "homologation:evidence:validate"], kind: "internal" },
  { id: "fiscal-pack", label: "Pacote fiscal minimo", command: ["run", "fiscal:close-pack:minimal"], kind: "internal" },
  {
    id: "fiscal-pack-validate",
    label: "Validacao do pacote fiscal minimo",
    command: ["run", "fiscal:close-pack:validate", "--", "docs/reports/fiscal-close-pack-minimal.csv"],
    kind: "internal",
  },
  {
    id: "fiscal-minimal",
    label: "Gate fiscal minimo",
    command: ["run", "fiscal:check:minimal"],
    kind: "external-gate",
    expectedBlockers: ["fiscal_profiles"],
  },
  {
    id: "phase2",
    label: "Gate Fase 2",
    command: ["run", "phase2:check"],
    kind: "external-gate",
    expectedBlockers: ["payment_provider", "mercadopago_access_token", "mercadopago_webhook_secret", "freight_provider"],
  },
  {
    id: "release",
    label: "Gate release",
    command: ["run", "release:check"],
    kind: "external-gate",
    expectedBlockers: ["payment", "freight", "fiscal"],
  },
  {
    id: "go-live",
    label: "Gate go-live",
    command: ["run", "go-live:check"],
    kind: "external-gate",
    expectedBlockers: ["payment_provider", "freight_provider"],
  },
  {
    id: "executive-status",
    label: "Status executivo",
    command: ["run", "status:executive"],
    kind: "external-gate",
    expectedBlockers: ["fiscal_minimo_contador"],
  },
];

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=").slice(1).join("=") || null;
  return process.argv[index + 1] ?? null;
}

function extractJson(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function collectBlockerText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return JSON.stringify(value).toLowerCase();
}

function isExpectedExternalBlock(step: Step, parsed: unknown, exitCode: number | null) {
  if (step.kind !== "external-gate") return false;
  if (exitCode === 0) return false;
  const blockerText = collectBlockerText(parsed);
  return (step.expectedBlockers ?? []).every((blocker) => blockerText.includes(blocker.toLowerCase()));
}

function summarize(step: Step, parsed: unknown, stdout: string, stderr: string) {
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    const pairs = [
      ["ready", record.ready],
      ["ok", record.ok],
      ["ROADMAP_READY", record.ROADMAP_READY],
      ["phase2_ready", record.phase2_ready],
      ["go_live_ready", record.go_live_ready],
      ["blockers", record.blockers],
      ["warnings", record.warnings],
      ["MAIN_BLOCKER", record.MAIN_BLOCKER],
      ["main_blocker", record.main_blocker],
      ["next_step", record.next_step],
      ["NEXT_STEP", record.NEXT_STEP],
    ].filter(([, value]) => typeof value !== "undefined");
    if (pairs.length > 0) {
      return pairs
        .map(([key, value]) => `${key}=${Array.isArray(value) ? value.length : String(value)}`)
        .join("; ");
    }
  }

  if (step.id === "test") {
    const tests = stdout.match(/# tests (\d+)/)?.[1];
    const pass = stdout.match(/# pass (\d+)/)?.[1];
    const fail = stdout.match(/# fail (\d+)/)?.[1];
    const duration = stdout.match(/# duration_ms ([\d.]+)/)?.[1];
    return `tests=${tests ?? "?"}; pass=${pass ?? "?"}; fail=${fail ?? "?"}; duration_ms=${duration ?? "?"}`;
  }

  if (step.id === "build") {
    const builtIn = stdout.match(/built in ([\d.]+s)/i)?.[1];
    return builtIn ? `build concluido em ${builtIn}` : "build concluido";
  }

  if (step.kind === "internal") {
    return "comando interno concluido";
  }

  const combined = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return combined.slice(-3).join(" | ") || `${step.label} executado.`;
}

function runStep(step: Step): StepResult {
  const started = Date.now();
  const child = spawnSync(npmCommand, step.command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: process.env,
  });
  const duration = Date.now() - started;
  const stdout = child.stdout ?? "";
  const stderr = child.stderr ?? "";
  const parsed = extractJson(stdout);
  const exitCode = child.status;
  const expectedBlocked = isExpectedExternalBlock(step, parsed, exitCode);
  const ok = exitCode === 0 || expectedBlocked;

  return {
    id: step.id,
    label: step.label,
    kind: step.kind,
    command: `${npmCommand} ${step.command.join(" ")}`,
    ok,
    expected_blocked: expectedBlocked,
    exit_code: exitCode,
    duration_ms: duration,
    summary: child.error ? `erro ao iniciar comando: ${child.error.message}` : summarize(step, parsed, stdout, stderr),
    parsed: parsed ?? undefined,
  };
}

function row(values: Array<string | number | boolean>) {
  return `| ${values.map((value) => String(value).replace(/\|/g, "\\|")).join(" | ")} |`;
}

function renderMarkdown(report: {
  generated_at: string;
  ok: boolean;
  internal_ready: boolean;
  external_gates_expected_blocked: boolean;
  duration_ms: number;
  results: StepResult[];
}) {
  const lines: string[] = [];
  lines.push("# Relatorio De Validacao De Continuidade");
  lines.push("");
  lines.push(`Gerado em: ${report.generated_at}`);
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push(`- Status geral: **${report.ok ? "PASSOU" : "FALHOU"}**`);
  lines.push(`- Interno pronto: **${report.internal_ready ? "sim" : "nao"}**`);
  lines.push(`- Gates externos bloqueados como esperado: **${report.external_gates_expected_blocked ? "sim" : "nao"}**`);
  lines.push(`- Duracao: ${Math.round(report.duration_ms / 1000)}s`);
  lines.push("");
  lines.push("## Etapas");
  lines.push("");
  lines.push(row(["Etapa", "Tipo", "Resultado", "Tempo", "Resumo"]));
  lines.push(row(["---", "---", "---", "---:", "---"]));
  for (const result of report.results) {
    const status = result.ok ? result.expected_blocked ? "bloqueio externo esperado" : "ok" : "falhou";
    lines.push(row([result.label, result.kind, status, `${Math.round(result.duration_ms / 1000)}s`, result.summary]));
  }
  lines.push("");
  lines.push("## Proximas Acoes");
  lines.push("");
  lines.push("- Corrigir qualquer etapa interna marcada como `falhou` antes de novo desenvolvimento.");
  lines.push("- Manter fiscal, pagamento e frete como bloqueios externos ate existirem contador/provider/credenciais reais.");
  lines.push("- Reexecutar `npm run validate:continuity` antes de checkpoint, handoff ou decisao de soft launch.");
  lines.push("");
  return lines.join("\n");
}

const outArg = getArg("--out");
const basePath = resolve(outArg ?? "docs/reports/continuity-validation-latest").replace(/\.(json|md)$/i, "");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;
const started = Date.now();
const results = steps.map(runStep);
const internalReady = results.filter((result) => result.kind === "internal").every((result) => result.ok && !result.expected_blocked);
const externalResults = results.filter((result) => result.kind === "external-gate");
const externalGatesExpectedBlocked = externalResults.every((result) => result.ok);
const report = {
  generated_at: new Date().toISOString(),
  ok: internalReady && externalGatesExpectedBlocked,
  internal_ready: internalReady,
  external_gates_expected_blocked: externalGatesExpectedBlocked,
  duration_ms: Date.now() - started,
  results,
  files: {
    json: jsonPath,
    markdown: mdPath,
  },
};

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, `${renderMarkdown(report)}\n`, "utf8");

console.log(JSON.stringify({
  ok: report.ok,
  internal_ready: report.internal_ready,
  external_gates_expected_blocked: report.external_gates_expected_blocked,
  duration_seconds: Math.round(report.duration_ms / 1000),
  jsonPath,
  mdPath,
}, null, 2));

if (!report.ok) {
  process.exitCode = 1;
}
