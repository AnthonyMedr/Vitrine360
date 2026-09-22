import { initializeDb, readDb, writeDb } from "../server/db.ts";
import { refreshFiscalNcmCache } from "../server/fiscal-ai-assistant.ts";

async function main() {
  await initializeDb();
  const db = readDb();
  const result = await refreshFiscalNcmCache(db, {
    actorId: "script-fiscal-ncm-cache",
    actorName: "Fiscal NCM Cache Refresh Script",
    correlationId: `fiscal-ncm-cache-${Date.now()}`,
  });
  writeDb(db);
  console.log(JSON.stringify(result, null, 2));
}

void main();
