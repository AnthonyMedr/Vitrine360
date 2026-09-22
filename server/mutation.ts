import { waitForPendingDbWrites } from "./db";

let writeTail = Promise.resolve();

export async function runSerializedMutation<T>(label: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = writeTail;
  let release!: () => void;
  writeTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    const result = await fn();
    await waitForPendingDbWrites();
    return result;
  } finally {
    release();
  }
}
