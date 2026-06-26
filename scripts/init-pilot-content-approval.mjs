import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const examplePath = path.join(rootDir, "PILOTO-CONTENT-APPROVED.example.json");
const targetPath = path.join(rootDir, "PILOTO-CONTENT-APPROVED.json");

if (!existsSync(examplePath)) {
  console.error(`[FAIL] Arquivo base ausente: ${examplePath}`);
  process.exit(1);
}

if (existsSync(targetPath)) {
  console.log(`[OK] Arquivo ja existe: ${targetPath}`);
  console.log("[INFO] Revise os valores aprovados pelo cliente antes de aplicar.");
  process.exit(0);
}

copyFileSync(examplePath, targetPath);
console.log(`[OK] Arquivo criado: ${targetPath}`);
console.log(
  "[INFO] Preencha o conteudo homologado do cliente e depois rode `npm run pilot:content:apply`.",
);
