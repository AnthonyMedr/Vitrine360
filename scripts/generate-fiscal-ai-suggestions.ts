import { initializeDb, readDb, writeDb } from "../server/db.ts";
import { generateFiscalAiSuggestion, getFiscalAiQueue } from "../server/fiscal-ai-assistant.ts";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function getScope() {
  const entry = process.argv.find((arg) => arg.startsWith("--scope="));
  return entry?.split("=")[1] === "global" ? "global" : "minimal-go-live";
}

async function main() {
  await initializeDb();
  const scope = getScope();
  const apply = hasFlag("--apply");
  const db = readDb();
  const queue = getFiscalAiQueue(db, { scope });
  const results = [];

  for (const item of queue.items) {
    const result = await generateFiscalAiSuggestion(db, {
      fiscalProfileId: item.profile.id,
      scope,
      actorId: "script-fiscal-ai",
      actorName: "Fiscal AI Suggestion Script",
      correlationId: `fiscal-ai-suggest-${Date.now()}`,
    });
    results.push(result.ok ? { ok: true, suggestion: result.suggestion } : result);
  }

  if (apply) writeDb(db);

  console.log(JSON.stringify({
    ok: true,
    dry_run: !apply,
    scope,
    generated: results.filter((entry) => entry.ok).length,
    results,
    next_steps: apply
      ? ["Revisar sugestoes no admin fiscal antes de aprovar."]
      : ["Dry-run executado. Rode com --apply para persistir sugestoes."],
  }, null, 2));
}

void main();
