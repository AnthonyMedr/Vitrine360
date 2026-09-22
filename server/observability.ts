type RequestMetric = {
  count: number;
  errors: number;
  totalDurationMs: number;
  lastStatusCode: number;
};

const requestMetrics = new Map<string, RequestMetric>();
const businessCounters = new Map<string, number>();
const securityCounters = new Map<string, number>();

function increment(target: Map<string, number>, key: string, amount = 1) {
  target.set(key, (target.get(key) ?? 0) + amount);
}

export function recordHttpMetric(input: { method: string; path: string; statusCode: number; durationMs: number }) {
  const key = `${input.method.toUpperCase()} ${input.path}`;
  const current = requestMetrics.get(key) ?? {
    count: 0,
    errors: 0,
    totalDurationMs: 0,
    lastStatusCode: 0,
  };

  current.count += 1;
  current.totalDurationMs += Math.max(0, input.durationMs);
  current.lastStatusCode = input.statusCode;
  if (input.statusCode >= 400) {
    current.errors += 1;
  }

  requestMetrics.set(key, current);
}

export function incrementBusinessMetric(name: string, amount = 1) {
  increment(businessCounters, name, amount);
}

export function incrementSecurityMetric(name: string, amount = 1) {
  increment(securityCounters, name, amount);
}

export function getMetricsSnapshot() {
  return {
    http: [...requestMetrics.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([route, metric]) => ({
        route,
        count: metric.count,
        errors: metric.errors,
        avgDurationMs: metric.count > 0 ? Number((metric.totalDurationMs / metric.count).toFixed(2)) : 0,
        totalDurationMs: metric.totalDurationMs,
        lastStatusCode: metric.lastStatusCode,
      })),
    business: Object.fromEntries([...businessCounters.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
    security: Object.fromEntries([...securityCounters.entries()].sort((left, right) => left[0].localeCompare(right[0]))),
  };
}

export function renderPrometheusMetrics() {
  const lines: string[] = [];

  lines.push("# TYPE gamel_http_requests_total counter");
  for (const [route, metric] of [...requestMetrics.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const separatorIndex = route.indexOf(" ");
    const method = route.slice(0, separatorIndex);
    const path = route.slice(separatorIndex + 1);
    lines.push(`gamel_http_requests_total{method="${method}",path="${path}"} ${metric.count}`);
    lines.push(`gamel_http_request_errors_total{method="${method}",path="${path}"} ${metric.errors}`);
    lines.push(`gamel_http_request_duration_ms_sum{method="${method}",path="${path}"} ${metric.totalDurationMs}`);
  }

  lines.push("# TYPE gamel_business_events_total counter");
  for (const [name, value] of [...businessCounters.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    lines.push(`gamel_business_events_total{name="${name}"} ${value}`);
  }

  lines.push("# TYPE gamel_security_events_total counter");
  for (const [name, value] of [...securityCounters.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    lines.push(`gamel_security_events_total{name="${name}"} ${value}`);
  }

  return lines.join("\n");
}

export function resetMetricsForTests() {
  requestMetrics.clear();
  businessCounters.clear();
  securityCounters.clear();
}
