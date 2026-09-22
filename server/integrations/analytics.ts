import crypto from "node:crypto";
import { appConfig } from "../config";
import { logError, logInfo } from "../logger";

type AnalyticsEventInput = {
  name: string;
  userId?: string | null;
  clientId?: string | null;
  params?: Record<string, string | number | boolean | null | undefined>;
};

function normalizeParams(params: AnalyticsEventInput["params"]) {
  if (!params) return {};
  return Object.fromEntries(Object.entries(params).filter(([, value]) => typeof value !== "undefined" && value !== null));
}

export async function trackServerEvent(input: AnalyticsEventInput) {
  if (appConfig.analyticsProvider !== "ga4" || !appConfig.ga4.measurementId || !appConfig.ga4.apiSecret) {
    if (appConfig.analyticsProvider !== "none") {
      logInfo({
        event: "analytics.logged_locally",
        module: "analytics",
        data: input as unknown as Record<string, unknown>,
      });
    }
    return { ok: false, provider: appConfig.analyticsProvider, skipped: true };
  }

  const clientId = input.clientId || crypto.randomUUID();
  const response = await fetch(
    `${appConfig.ga4.endpoint}?measurement_id=${encodeURIComponent(appConfig.ga4.measurementId)}&api_secret=${encodeURIComponent(appConfig.ga4.apiSecret)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        user_id: input.userId || undefined,
        events: [
          {
            name: input.name,
            params: {
              session_id: Date.now(),
              engagement_time_msec: 1,
              ...normalizeParams(input.params),
            },
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    logError({
      event: "analytics.send_failed",
      module: "analytics",
      data: { name: input.name, userId: input.userId || null },
    });
  }

  return {
    ok: response.ok,
    provider: "ga4",
    skipped: false,
  };
}
