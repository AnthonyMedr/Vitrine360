import { rm } from "node:fs/promises";
import path from "node:path";

const distPath = path.resolve(process.cwd(), "dist");

try {
  await rm(distPath, { recursive: true, force: true });
} catch (error) {
  console.error(`Falha ao limpar dist: ${error.message}`);
  process.exit(1);
}
