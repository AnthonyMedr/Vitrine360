import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadFiscalClosePackRows } from "../scripts/fiscal-close-pack-file";

test("loadFiscalClosePackRows parses csv close pack rows", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "close-pack-csv-"));
  const filePath = join(tempDir, "close-pack.csv");

  try {
    writeFileSync(
      filePath,
      [
        "fiscal_profile_id,product_id,product_name,manual_fill_ncm,manual_fill_cst_icms_default,manual_fill_csosn_default,manual_fill_weight,manual_fill_tax_rule_status,manual_fill_note",
        'fiscal-1,1,"Forro PVC Branco Gelo 200mm x 6m",39181000,00,,2.5,review,"Preenchido via CSV"',
      ].join("\n"),
      "utf8",
    );

    const result = loadFiscalClosePackRows(filePath);
    assert.equal(result.format, "csv");
    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0], {
      fiscal_profile_id: "fiscal-1",
      product_id: "1",
      manual_fill_template: {
        ncm: "39181000",
        cst_icms_default: "00",
        csosn_default: "",
        weight: "2.5",
        tax_rule_status: "review",
        note: "Preenchido via CSV",
      },
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("loadFiscalClosePackRows rejects xlsx close pack rows", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "close-pack-xlsx-"));
  const filePath = join(tempDir, "close-pack.xlsx");

  try {
    writeFileSync(filePath, "disabled", "utf8");
    assert.throws(
      () => loadFiscalClosePackRows(filePath),
      /XLSX fiscal close pack import is disabled for security/,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
