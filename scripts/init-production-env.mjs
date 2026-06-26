import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const examplePath = path.join(rootDir, ".env.production.example");
const targetPath = path.join(rootDir, ".env.production");

if (!existsSync(examplePath)) {
  console.error(`[FAIL] Arquivo base ausente: ${examplePath}`);
  process.exit(1);
}

if (existsSync(targetPath)) {
  console.log(`[OK] Arquivo ja existe: ${targetPath}`);
  console.log("[INFO] Revise os valores reais antes de rodar os comandos de producao.");
  process.exit(0);
}

copyFileSync(examplePath, targetPath);
console.log(`[OK] Arquivo criado: ${targetPath}`);
console.log(
  "[INFO] Preencha dominio, credenciais, IA e bootstrap admin com valores reais antes de continuar.",
);
