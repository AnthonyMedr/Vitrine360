import IORedis from "ioredis";
import { appConfig } from "./config";

let redis: IORedis | null = null;

export function isRedisConfigured() {
  return Boolean(appConfig.redis.url);
}

export function getRedisClient() {
  if (!appConfig.redis.url) {
    throw new Error("REDIS_URL nao configurada");
  }

  if (!redis) {
    redis = new IORedis(appConfig.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  return redis;
}

export async function checkRedisHealth() {
  if (!appConfig.redis.url) {
    return {
      provider: "redis",
      configured: false,
      ready: false,
      latencyMs: null,
      error: "REDIS_URL nao configurada",
    };
  }

  const startedAt = Date.now();
  try {
    const client = getRedisClient();
    if (client.status === "wait") {
      await client.connect();
    }
    const response = await client.ping();
    return {
      provider: "redis",
      configured: true,
      ready: response === "PONG",
      latencyMs: Date.now() - startedAt,
      error: response === "PONG" ? null : `redis_ping_unexpected:${response}`,
    };
  } catch (error) {
    return {
      provider: "redis",
      configured: true,
      ready: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "redis_healthcheck_failed",
    };
  }
}

export async function closeRedisClient() {
  if (!redis) return;
  const client = redis;
  redis = null;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}
