import { initializeDb, readDb } from "../server/db.ts";
import { getFiscalAiQueue } from "../server/fiscal-ai-assistant.ts";

function getScope() {
  const entry = process.argv.find((arg) => arg.startsWith("--scope="));
  return entry?.split("=")[1] === "global" ? "global" : "minimal-go-live";
}

async function main() {
  await initializeDb();
  console.log(JSON.stringify(getFiscalAiQueue(readDb(), { scope: getScope() }), null, 2));
}

void main();
