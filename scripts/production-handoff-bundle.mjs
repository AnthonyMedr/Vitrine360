import { spawnSync } from "node:child_process";

const steps = [
  {
    label: "go-live:preflight",
    command: process.execPath,
    args: ["scripts/go-live-preflight.mjs"],
  },
  {
    label: "go-live:report",
    command: process.execPath,
    args: ["scripts/go-live-status-report.mjs"],
  },
  {
    label: "production:next",
    command: process.execPath,
    args: ["scripts/production-next-steps.mjs"],
  },
];

let hasFailure = false;

console.log("== Vitrine360 production handoff bundle ==");

for (const step of steps) {
  console.log(`\n>> Executando ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const output = [result.stdout || "", result.stderr || ""].filter(Boolean).join("\n").trim();
  if (output) console.log(output);

  if (result.status !== 0) {
    hasFailure = true;
    console.log(`>> ${step.label}: falhou`);
  } else {
    console.log(`>> ${step.label}: ok`);
  }
}

console.log("\nArquivos de saida esperados:");
console.log("- GO-LIVE-STATUS.md");
console.log("- PRODUCTION-NEXT-STEPS.md");

if (hasFailure) {
  console.error("\n[FAIL] Bundle concluido com bloqueios operacionais.");
  process.exit(1);
}

console.log("\n[OK] Bundle concluido sem bloqueios criticos.");
