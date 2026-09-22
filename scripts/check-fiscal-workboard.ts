import { initializeDb, readDb } from "../server/db";
import { getAdminFiscalWorkboard } from "../server/read-models";

await initializeDb();
const db = readDb();
const report = getAdminFiscalWorkboard(db);

console.log(JSON.stringify(report, null, 2));
