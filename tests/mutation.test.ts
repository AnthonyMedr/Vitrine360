import test from "node:test";
import assert from "node:assert/strict";
import { runSerializedMutation } from "../server/mutation";

test("runSerializedMutation serializes concurrent writes", async () => {
  const executionOrder: string[] = [];

  await Promise.all([
    runSerializedMutation("first", async () => {
      executionOrder.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 25));
      executionOrder.push("first:end");
    }),
    runSerializedMutation("second", async () => {
      executionOrder.push("second:start");
      executionOrder.push("second:end");
    }),
  ]);

  assert.deepEqual(executionOrder, ["first:start", "first:end", "second:start", "second:end"]);
});
