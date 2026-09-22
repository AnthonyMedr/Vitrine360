import crypto from "node:crypto";
import type express from "express";
import { appConfig, isProductionLike } from "./config";
import { logWarn } from "./logger";
import { incrementSecurityMetric } from "./observability";
import { getRedisClient, isRedisConfigured } from "./redis";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export const CONTENT_SECURITY_POLICY =
  "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' https://www.googletagmanager.com https://connect.facebook.net; connect-src 'self' https://www.google-analytics.com https://api.mercadopago.com https://sandbox.melhorenvio.com.br https://api.resend.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";

export function hasUnsafeInlineScriptCsp() {
  const scriptDirective = CONTENT_SECURITY_POLICY.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("script-src"));
  return scriptDirective?.includes("'unsafe-inline'") ?? false;
}

function getClientKey(req: express.Request) {
  const forwarded = req.header("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.ip || "unknown";
  return `${ip}:${req.path}`;
}

export function rateLimit(options: { windowMs: number; max: number; message: string }) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!appConfig.rateLimit.enabled) {
      next();
      return;
    }

    const key = getClientKey(req);
    if (isRedisConfigured()) {
      try {
        const redis = getRedisClient();
        if (redis.status === "wait") {
          await redis.connect();
        }

        const redisKey = `${appConfig.redis.rateLimitPrefix}:${key}`;
        const total = await redis.incr(redisKey);
        if (total === 1) {
          await redis.pexpire(redisKey, options.windowMs);
        }

        if (total > options.max) {
          incrementSecurityMetric("rate_limit_exceeded");
          logWarn({
            event: "security.rate_limit_exceeded",
            module: "security",
            requestId: res.locals.requestId ?? null,
            data: { provider: "redis", key, path: req.path, method: req.method },
          });
          res.status(429).json({ error: options.message });
          return;
        }

        next();
        return;
      } catch {
        // fallback local when Redis is unavailable
      }
    }

    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    if (bucket.count > options.max) {
      incrementSecurityMetric("rate_limit_exceeded");
      logWarn({
        event: "security.rate_limit_exceeded",
        module: "security",
        requestId: res.locals.requestId ?? null,
        data: { provider: "memory", key, path: req.path, method: req.method },
      });
      res.status(429).json({ error: options.message });
      return;
    }

    next();
  };
}

export function attachRequestContext(req: express.Request, res: express.Response, next: express.NextFunction) {
  const requestId = req.header("x-request-id") || crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  res.locals.requestId = requestId;
  next();
}

export function applySecurityHeaders(_req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!appConfig.securityHeadersEnabled) {
    next();
    return;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (isProductionLike()) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  next();
}
