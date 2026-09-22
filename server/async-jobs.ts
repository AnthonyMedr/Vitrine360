import { Queue, Worker } from "bullmq";
import { appConfig } from "./config";
import { logError, logInfo, logWarn } from "./logger";
import { isRedisConfigured, getRedisClient } from "./redis";

type QueueName = "email" | "analytics" | "integration";
type QueueProvider = "memory" | "redis";
type JobStatus = "queued" | "processing" | "completed" | "failed" | "dead_letter";

type AsyncJob = {
  id: string;
  queue: QueueName;
  handler: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type QueueHandler = (payload: Record<string, unknown>) => Promise<void>;
type QueueCounters = { queued: number; processing: number; completed: number; failed: number };

const queueNames: QueueName[] = ["email", "analytics", "integration"];
const handlers = new Map<string, QueueHandler>();
const processing = new Set<QueueName>();

const memoryQueues = new Map<QueueName, AsyncJob[]>(queueNames.map((name) => [name, []]));
const memoryDeadLetters: AsyncJob[] = [];

const redisQueues = new Map<QueueName, Queue>();
const redisWorkers = new Map<QueueName, Worker>();
const statsByQueue = new Map<QueueName, QueueCounters>(
  queueNames.map((name) => [name, { queued: 0, processing: 0, completed: 0, failed: 0 }]),
);
let deadLetterCount = 0;

function resolveQueueProvider(): QueueProvider {
  if (appConfig.queueProvider === "memory") return "memory";
  if (appConfig.queueProvider === "redis") return "redis";
  return isRedisConfigured() ? "redis" : "memory";
}

function getCounters(queueName: QueueName) {
  const counters = statsByQueue.get(queueName);
  if (!counters) {
    const next = { queued: 0, processing: 0, completed: 0, failed: 0 };
    statsByQueue.set(queueName, next);
    return next;
  }
  return counters;
}

function nextMemoryJob(queueName: QueueName) {
  const queue = memoryQueues.get(queueName) ?? [];
  const now = Date.now();
  return queue.find((entry) => entry.status === "queued" && entry.availableAt <= now) ?? null;
}

async function processMemoryQueue(queueName: QueueName) {
  if (processing.has(queueName)) return;
  processing.add(queueName);

  try {
    while (true) {
      const job = nextMemoryJob(queueName);
      if (!job) break;

      const handler = handlers.get(job.handler);
      if (!handler) {
        job.status = "dead_letter";
        job.lastError = `handler_not_found:${job.handler}`;
        job.updatedAt = new Date().toISOString();
        memoryDeadLetters.unshift({ ...job });
        deadLetterCount += 1;
        getCounters(queueName).failed += 1;
        logError({
          event: "queue.handler_missing",
          module: "queue",
          data: { provider: "memory", queue: queueName, jobId: job.id, handler: job.handler },
        });
        continue;
      }

      job.status = "processing";
      job.attempts += 1;
      job.updatedAt = new Date().toISOString();
      const counters = getCounters(queueName);
      counters.queued = Math.max(0, counters.queued - 1);
      counters.processing += 1;

      try {
        await handler(job.payload);
        job.status = "completed";
        job.updatedAt = new Date().toISOString();
        counters.processing = Math.max(0, counters.processing - 1);
        counters.completed += 1;
        logInfo({
          event: "queue.job_completed",
          module: "queue",
          data: { provider: "memory", queue: queueName, jobId: job.id, attempts: job.attempts, handler: job.handler },
        });
      } catch (error) {
        counters.processing = Math.max(0, counters.processing - 1);
        job.lastError = error instanceof Error ? error.message : "unknown_queue_error";
        job.updatedAt = new Date().toISOString();

        if (job.attempts >= job.maxAttempts) {
          job.status = "dead_letter";
          memoryDeadLetters.unshift({ ...job });
          deadLetterCount += 1;
          counters.failed += 1;
          logError({
            event: "queue.job_dead_letter",
            module: "queue",
            error,
            data: { provider: "memory", queue: queueName, jobId: job.id, attempts: job.attempts, handler: job.handler },
          });
          continue;
        }

        job.status = "queued";
        job.availableAt = Date.now() + Math.min(30_000, 1_000 * 2 ** (job.attempts - 1));
        counters.queued += 1;
        logWarn({
          event: "queue.job_retry_scheduled",
          module: "queue",
          data: {
            provider: "memory",
            queue: queueName,
            jobId: job.id,
            attempts: job.attempts,
            nextRunAt: new Date(job.availableAt).toISOString(),
            handler: job.handler,
          },
        });
      }
    }
  } finally {
    processing.delete(queueName);
  }
}

function triggerMemoryQueue(queueName: QueueName) {
  setTimeout(() => {
    void processMemoryQueue(queueName);
  }, 0);
}

function ensureRedisQueue(queueName: QueueName) {
  const existing = redisQueues.get(queueName);
  if (existing) return existing;

  const connection = getRedisClient();
  const queue = new Queue(queueName, {
    connection,
    prefix: appConfig.redis.queuePrefix,
    defaultJobOptions: {
      removeOnComplete: 250,
      removeOnFail: 500,
    },
  });

  const worker = new Worker(
    queueName,
    async (job) => {
      const handler = handlers.get(job.name);
      if (!handler) {
        throw new Error(`handler_not_found:${job.name}`);
      }
      await handler(job.data as Record<string, unknown>);
    },
    {
      connection,
      prefix: appConfig.redis.queuePrefix,
      concurrency: 1,
    },
  );

  worker.on("active", () => {
    const counters = getCounters(queueName);
    counters.queued = Math.max(0, counters.queued - 1);
    counters.processing += 1;
  });

  worker.on("completed", (job) => {
    const counters = getCounters(queueName);
    counters.processing = Math.max(0, counters.processing - 1);
    counters.completed += 1;
    logInfo({
      event: "queue.job_completed",
      module: "queue",
      data: { provider: "redis", queue: queueName, jobId: job.id, attempts: job.attemptsMade + 1, handler: job.name },
    });
  });

  worker.on("failed", (job, error) => {
    const counters = getCounters(queueName);
    counters.processing = Math.max(0, counters.processing - 1);

    const maxAttempts = job?.opts.attempts ?? 1;
    if ((job?.attemptsMade ?? 0) >= maxAttempts) {
      counters.failed += 1;
      deadLetterCount += 1;
      logError({
        event: "queue.job_dead_letter",
        module: "queue",
        error,
        data: { provider: "redis", queue: queueName, jobId: job?.id ?? null, attempts: job?.attemptsMade ?? null, handler: job?.name ?? null },
      });
      return;
    }

    counters.queued += 1;
    logWarn({
      event: "queue.job_retry_scheduled",
      module: "queue",
      data: {
        provider: "redis",
        queue: queueName,
        jobId: job?.id ?? null,
        attempts: job?.attemptsMade ?? null,
        handler: job?.name ?? null,
      },
      error,
    });
  });

  worker.on("error", (error) => {
    logError({
      event: "queue.worker_error",
      module: "queue",
      error,
      data: { provider: "redis", queue: queueName },
    });
  });

  redisQueues.set(queueName, queue);
  redisWorkers.set(queueName, worker);
  return queue;
}

export function registerQueueHandler(name: string, handler: QueueHandler) {
  handlers.set(name, handler);
}

export function enqueueJob(input: {
  id: string;
  queue: QueueName;
  handler: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}) {
  const provider = resolveQueueProvider();
  const counters = getCounters(input.queue);
  counters.queued += 1;

  if (provider === "redis") {
    const queue = ensureRedisQueue(input.queue);
    void queue
      .add(input.handler, input.payload, {
        jobId: input.id,
        attempts: input.maxAttempts ?? 3,
        backoff: {
          type: "exponential",
          delay: 1_000,
        },
      })
      .catch((error) => {
        counters.queued = Math.max(0, counters.queued - 1);
        counters.failed += 1;
        logError({
          event: "queue.enqueue_failed",
          module: "queue",
          error,
          data: { provider, queue: input.queue, jobId: input.id, handler: input.handler },
        });
      });

    logInfo({
      event: "queue.job_enqueued",
      module: "queue",
      data: { provider, queue: input.queue, jobId: input.id, handler: input.handler },
    });
    return;
  }

  const now = new Date().toISOString();
  const job: AsyncJob = {
    id: input.id,
    queue: input.queue,
    handler: input.handler,
    payload: input.payload,
    status: "queued",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    availableAt: Date.now(),
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  memoryQueues.get(input.queue)?.unshift(job);
  logInfo({
    event: "queue.job_enqueued",
    module: "queue",
    data: { provider, queue: input.queue, jobId: input.id, handler: input.handler },
  });
  triggerMemoryQueue(input.queue);
}

export function getQueueStats() {
  return {
    provider: resolveQueueProvider(),
    queues: Object.fromEntries(queueNames.map((name) => [name, { ...getCounters(name) }])),
    deadLetter: deadLetterCount,
  };
}

export async function closeQueueResources() {
  const workers = [...redisWorkers.values()];
  const queues = [...redisQueues.values()];

  redisWorkers.clear();
  redisQueues.clear();

  await Promise.allSettled(workers.map((worker) => worker.close()));
  await Promise.allSettled(queues.map((queue) => queue.close()));
}
