import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type DeliveryStep = {
  id: string;
  label: string;
  command: string[];
};

type DeliveryResult = DeliveryStep & {
  ok: boolean;
  exit_code: number | null;
  parsed: Record<string, unknown> | null;
  summary: string;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const steps: DeliveryStep[] = [
  { id: "programmable_closure", label: "Fechamento programavel consolidado", command: ["run", "completion:final-closure"] },
  { id: "external_blockers_pack", label: "Pacote de bloqueios externos", command: ["run", "external:blockers:pack"] },
];

function extractJson(output: string) {
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(output.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarize(parsed: Record<string, unknown> | null) {
  if (!parsed) return "sem_json";
  return [
    typeof parsed.ok !== "undefined" ? `ok=${String(parsed.ok)}` : null,
    typeof parsed.programmable_scope !== "undefined" ? `programmable_scope=${String(parsed.programmable_scope)}` : null,
    typeof parsed.production_open !== "undefined" ? `production_open=${String(parsed.production_open)}` : null,
    typeof parsed.external_blockers !== "undefined" ? `external_blockers=${String(parsed.external_blockers)}` : null,
    typeof parsed.items !== "undefined" ? `items=${String(parsed.items)}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

function runStep(step: DeliveryStep): DeliveryResult {
  const result = spawnSync(npmCommand, step.command, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, NODE_NO_WARNINGS: process.env.NODE_NO_WARNINGS ?? "1" },
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const parsed = extractJson(stdout);
  const ok = result.status === 0;

  if (!ok) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }

  return {
    ...step,
    ok,
    exit_code: result.status,
    parsed,
    summary: summarize(parsed),
  };
}

function readJson(path: string) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function renderMarkdown(report: ReturnType<typeof buildReport>) {
  const lines: string[] = [];
  lines.push("# Entrega Final Programavel");
  lines.push("");
  lines.push(`- Gerado em: \`${report.generated_at}\``);
  lines.push(`- OK: \`${report.ok}\``);
  lines.push(`- Escopo programavel: \`${report.programmable_scope}\``);
  lines.push(`- Producao aberta: \`${report.production_open}\``);
  lines.push("");
  lines.push("## Etapas");
  lines.push("");
  lines.push("| Etapa | Resultado | Resumo |");
  lines.push("| --- | --- | --- |");
  for (const step of report.steps) {
    lines.push(`| ${step.label} | \`${step.ok}\` | ${step.summary.replace(/\|/g, "/")} |`);
  }
  lines.push("");
  lines.push("## Artefatos");
  lines.push("");
  for (const artifact of report.artifacts) {
    lines.push(`- \`${artifact}\``);
  }
  lines.push("");
  lines.push("## Veredito");
  lines.push("");
  lines.push("Entrega programavel finalizada. As proximas acoes dependem de credenciais, homologacoes e evidencias reais.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildReport(results: DeliveryResult[]) {
  const closure = readJson("docs/reports/programmable-final-closure-latest.json");
  const pack = readJson("docs/reports/external-blocker-resolution-pack-latest.json");
  const artifacts = [
    "docs/reports/final-delivery-latest.json",
    "docs/reports/final-delivery-latest.md",
    "docs/reports/programmable-final-closure-latest.json",
    "docs/reports/programmable-final-closure-latest.md",
    "docs/reports/external-blocker-resolution-pack-latest.json",
    "docs/reports/external-blocker-resolution-pack-latest.md",
    "docs/reports/external-blocker-resolution-pack-latest.csv",
    "docs/reports/external-blocker-resolution-pack-latest.env.example",
  ];

  return {
    generated_at: new Date().toISOString(),
    ok: results.every((step) => step.ok) && closure?.ok === true && pack?.ok === true,
    programmable_scope: String(closure?.programmable_scope ?? "DESCONHECIDO"),
    production_open: String(closure?.production_open ?? pack?.production_open ?? "BLOQUEADO_EXTERNO"),
    steps: results,
    artifacts,
  };
}

const results: DeliveryResult[] = [];
for (const step of steps) {
  console.log(`[final-delivery] ${step.label}`);
  const result = runStep(step);
  results.push(result);
  console.log(`[final-delivery] ${step.label}: ${result.ok ? "OK" : "FALHOU"} - ${result.summary}`);
  if (!result.ok) break;
}

const report = buildReport(results);
const basePath = resolve("docs/reports/final-delivery-latest");
const jsonPath = `${basePath}.json`;
const mdPath = `${basePath}.md`;

mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(mdPath, renderMarkdown(report), "utf8");

console.log(
  JSON.stringify(
    {
      ok: report.ok,
      programmable_scope: report.programmable_scope,
      production_open: report.production_open,
      steps: results.length,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);

if (!report.ok) process.exit(1);
