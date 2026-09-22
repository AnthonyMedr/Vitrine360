import { initializeDb, readDb } from "../server/db.ts";
import { getAiUsageOverview } from "../server/ai-governance.ts";

await initializeDb();
console.log(JSON.stringify(getAiUsageOverview(readDb()), null, 2));
