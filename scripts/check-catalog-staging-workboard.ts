import { readDb } from "../server/db.ts";
import { getCatalogStagingWorkboard } from "../server/catalog-staging.ts";

const db = readDb();
const workboard = getCatalogStagingWorkboard(db);

console.log(JSON.stringify(workboard, null, 2));
