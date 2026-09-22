import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { listCsvFiles, loadCatalogCurationRows } from "../scripts/catalog-curation-csv.ts";

test("catalog curation folder helpers list csv files and parse decisions", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "catalog-curation-"));
  try {
    writeFileSync(path.join(dir, "a.csv"), "product_id;decision;decision_notes\n1;approve;ok\n");
    writeFileSync(path.join(dir, "b.csv"), "product_id;decision;decision_notes\n2;quarantine;review\n");
    writeFileSync(path.join(dir, "README.md"), "# ignored\n");

    const files = listCsvFiles(dir);
    assert.equal(files.length, 2);

    const rows = loadCatalogCurationRows(files[0]!);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.product_id, "1");
    assert.equal(rows[0]?.decision, "approve");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
