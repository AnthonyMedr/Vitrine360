import test from "node:test";
import assert from "node:assert/strict";
import { enqueueJob, getQueueStats, registerQueueHandler } from "../server/async-jobs";

test("queue processes enqueued jobs", async () => {
  let processed = false;
  registerQueueHandler("test.handler", async () => {
    processed = true;
  });

  enqueueJob({
    id: `job-${Date.now()}`,
    queue: "integration",
    handler: "test.handler",
    payload: {},
    maxAttempts: 1,
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  const stats = getQueueStats();
  assert.equal(processed, true);
  assert.ok(stats.queues.integration.completed >= 1);
});
