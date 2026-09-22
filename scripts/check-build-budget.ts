import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

type AssetBudget = {
  name: string;
  matcher: (file: string) => boolean;
  maxKb: number;
  warnKb: number;
  optionalWhenMissing?: boolean;
};

const distAssetsDir = path.resolve(process.cwd(), "dist", "assets");
const distIndexPath = path.resolve(process.cwd(), "dist", "index.html");
const budgets: AssetBudget[] = [
  { name: "admin-route", matcher: (file) => /^Admin-.*\.js$/.test(file), maxKb: 380, warnKb: 300, optionalWhenMissing: true },
  { name: "radix-vendor", matcher: (file) => /^radix(?:-|[A-Z]).*\.js$/.test(file), maxKb: 360, warnKb: 300 },
  { name: "react-vendor", matcher: (file) => /^react-.*\.js$/.test(file), maxKb: 260, warnKb: 220 },
  { name: "radix-chunk-max", matcher: (file) => /^radix(?:-|[A-Z]).*\.js$/.test(file), maxKb: 180, warnKb: 140 },
];

function kb(bytes: number) {
  return Math.round((bytes / 1024) * 100) / 100;
}

const issues: Array<{ item: string; severity: "blocker" | "warning"; detail: string }> = [];

if (!existsSync(distAssetsDir)) {
  issues.push({
    item: "dist.assets",
    severity: "blocker",
    detail: "Diretorio dist/assets ausente. Execute npm run build antes do budget.",
  });
} else {
  const assets = readdirSync(distAssetsDir)
    .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
    .map((file) => {
      const filePath = path.join(distAssetsDir, file);
      return { file, sizeKb: kb(statSync(filePath).size) };
    })
    .sort((a, b) => b.sizeKb - a.sizeKb);

  for (const budget of budgets) {
    const matches = assets.filter((asset) => budget.matcher(asset.file));
    if (matches.length === 0) {
      if (budget.optionalWhenMissing) continue;
      issues.push({ item: budget.name, severity: "warning", detail: "Chunk esperado nao encontrado no build." });
      continue;
    }
    if (budget.name === "radix-chunk-max") {
      const largestMatch = matches.reduce((largest, asset) => (asset.sizeKb > largest.sizeKb ? asset : largest), matches[0]!);
      if (largestMatch.sizeKb > budget.maxKb) {
        issues.push({
          item: budget.name,
          severity: "blocker",
          detail: `Maior chunk Radix excedido: ${largestMatch.file} com ${largestMatch.sizeKb} KiB > ${budget.maxKb} KiB.`,
        });
      } else if (largestMatch.sizeKb > budget.warnKb) {
        issues.push({
          item: budget.name,
          severity: "warning",
          detail: `Maior chunk Radix em atencao: ${largestMatch.file} com ${largestMatch.sizeKb} KiB > ${budget.warnKb} KiB.`,
        });
      }
      continue;
    }
    const totalKb = matches.reduce((sum, asset) => sum + asset.sizeKb, 0);
    if (totalKb > budget.maxKb) {
      issues.push({
        item: budget.name,
        severity: "blocker",
        detail: `Budget excedido: ${totalKb} KiB > ${budget.maxKb} KiB.`,
      });
    } else if (totalKb > budget.warnKb) {
      issues.push({
        item: budget.name,
        severity: "warning",
        detail: `Budget em zona de atencao: ${totalKb} KiB > ${budget.warnKb} KiB.`,
      });
    }
  }

  const totalJsKb = assets.filter((asset) => asset.file.endsWith(".js")).reduce((sum, asset) => sum + asset.sizeKb, 0);
  const indexHtml = existsSync(distIndexPath) ? readFileSync(distIndexPath, "utf8") : "";
  const entryJsFiles = [...indexHtml.matchAll(/src="\/assets\/([^"]+\.js)"/g)].map((match) => match[1]);
  const entryJsKb = assets.filter((asset) => entryJsFiles.includes(asset.file)).reduce((sum, asset) => sum + asset.sizeKb, 0);

  if (entryJsKb > 420) {
    issues.push({ item: "entry-js", severity: "blocker", detail: `JS inicial excedido: ${entryJsKb} KiB > 420 KiB.` });
  } else if (entryJsKb > 300) {
    issues.push({ item: "entry-js", severity: "warning", detail: `JS inicial em zona de atencao: ${entryJsKb} KiB > 300 KiB.` });
  }

  console.log(
    JSON.stringify(
      {
        ok: !issues.some((issue) => issue.severity === "blocker"),
        total_js_kb: totalJsKb,
        entry_js_kb: entryJsKb,
        entry_js_files: entryJsFiles,
        largest_assets: assets.slice(0, 12),
        issues,
        next_steps:
          issues.length === 0
            ? ["Manter budget apos cada refatoracao de Admin/catalogo."]
            : ["Priorizar modularizacao de Admin e reduzir chunks lazy que aparecem em zona de atencao."],
      },
      null,
      2,
    ),
  );
}

if (issues.some((issue) => issue.severity === "blocker")) {
  process.exitCode = 1;
}
