import { loadFiscalClosePackRows } from "./fiscal-close-pack-file";

type ClosePackRow = {
  fiscal_profile_id: string;
  product_id: string;
  product_name?: string;
  manual_fill_template?: {
    ncm?: string;
    cst_icms_default?: string;
    csosn_default?: string;
    weight?: string;
  };
};

function getArg(flag: string) {
  const index = process.argv.findIndex((entry) => entry === flag || entry.startsWith(`${flag}=`));
  if (index === -1) return null;
  const current = process.argv[index];
  if (current.includes("=")) return current.split("=")[1] ?? null;
  return process.argv[index + 1] ?? null;
}

function getPositionalArg() {
  return process.argv.slice(2).find((entry) => !entry.startsWith("-")) ?? null;
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizePositiveNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const fileArg = getArg("--file") ?? getPositionalArg();
const { filePath, rows, format } = loadFiscalClosePackRows(fileArg ?? "docs/reports/fiscal-close-pack-minimal.json");

const errors: Array<{ fiscal_profile_id: string; product_id: string; product_name: string; reason: string }> = [];
let readyRows = 0;

for (const row of rows) {
  const template = row.manual_fill_template ?? {};
  const ncm = normalizeString(template.ncm);
  const cst = normalizeString(template.cst_icms_default);
  const csosn = normalizeString(template.csosn_default);
  const weight = normalizePositiveNumber(template.weight);

  const productName = row.product_id;

  if (!ncm && !cst && !csosn && !weight) continue;
  if (!ncm) {
    errors.push({ fiscal_profile_id: row.fiscal_profile_id, product_id: row.product_id, product_name: productName, reason: "NCM ausente." });
    continue;
  }
  if ((cst && csosn) || (!cst && !csosn)) {
    errors.push({
      fiscal_profile_id: row.fiscal_profile_id,
      product_id: row.product_id,
      product_name: productName,
      reason: "Preencha exatamente um entre CST ICMS e CSOSN.",
    });
    continue;
  }
  if (!weight) {
    errors.push({ fiscal_profile_id: row.fiscal_profile_id, product_id: row.product_id, product_name: productName, reason: "Peso positivo ausente." });
    continue;
  }
  readyRows += 1;
}

const result = {
  ok: errors.length === 0,
  filePath,
  format,
  rows: rows.length,
  readyRows,
  errors,
  next_steps:
    errors.length === 0
      ? readyRows > 0
        ? ["Arquivo valido para npm run fiscal:close-pack:apply."]
        : ["Arquivo consistente, mas ainda sem nenhuma linha preenchida para aplicacao."]
      : ["Corrigir os erros do arquivo e reexecutar a validacao antes de aplicar."],
};

console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
