type LogLevel = "info" | "warn" | "error";

type LogPayload = {
  event: string;
  message?: string;
  requestId?: string | null;
  correlationId?: string | null;
  module?: string;
  data?: Record<string, unknown>;
  error?: unknown;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function write(level: LogLevel, payload: LogPayload) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    event: payload.event,
    message: payload.message ?? null,
    requestId: payload.requestId ?? null,
    correlationId: payload.correlationId ?? null,
    module: payload.module ?? "api",
    data: payload.data ?? null,
    error: typeof payload.error === "undefined" ? null : serializeError(payload.error),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(payload: LogPayload) {
  write("info", payload);
}

export function logWarn(payload: LogPayload) {
  write("warn", payload);
}

export function logError(payload: LogPayload) {
  write("error", payload);
}
