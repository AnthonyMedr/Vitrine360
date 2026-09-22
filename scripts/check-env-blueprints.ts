import fs from "node:fs";
import path from "node:path";

type EnvBlueprint = {
  file: string;
  required: string[];
  expected: Record<string, string>;
};

function parseEnvFile(filePath: string) {
  const values = new Map<string, string>();
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    values.set(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim());
  }
  return values;
}

const blueprints: EnvBlueprint[] = [
  {
    file: ".env.example",
    required: ["APP_ENV", "DB_PROVIDER", "QUEUE_PROVIDER", "PAYMENT_PROVIDER", "FREIGHT_PROVIDER", "AUTH_CSRF_SECRET"],
    expected: {
      APP_ENV: "development",
      DB_PROVIDER: "sqlite",
      QUEUE_PROVIDER: "auto",
      PAYMENT_PROVIDER: "manual",
      FREIGHT_PROVIDER: "local-rules",
    },
  },
  {
    file: ".env.phase1.example",
    required: ["APP_ENV", "DB_PROVIDER", "DATABASE_URL", "QUEUE_PROVIDER", "REDIS_URL", "AUTH_CSRF_SECRET", "METRICS_TOKEN"],
    expected: {
      APP_ENV: "production",
      DB_PROVIDER: "postgres",
      QUEUE_PROVIDER: "redis",
      HOMOLOGATION_ONLY: "true",
    },
  },
  {
    file: ".env.phase2.example",
    required: [
      "APP_ENV",
      "DB_PROVIDER",
      "DATABASE_URL",
      "QUEUE_PROVIDER",
      "REDIS_URL",
      "PAYMENT_PROVIDER",
      "MERCADOPAGO_ACCESS_TOKEN",
      "MERCADOPAGO_WEBHOOK_SECRET",
      "FREIGHT_PROVIDER",
      "MELHOR_ENVIO_TOKEN",
      "MELHOR_ENVIO_ORIGIN_ZIP",
    ],
    expected: {
      APP_ENV: "production",
      DB_PROVIDER: "postgres",
      QUEUE_PROVIDER: "redis",
      PAYMENT_PROVIDER: "mercadopago",
      FREIGHT_PROVIDER: "melhor-envio",
      HOMOLOGATION_ONLY: "true",
    },
  },
  {
    file: ".env.staging.example",
    required: [
      "APP_ENV",
      "DB_PROVIDER",
      "DATABASE_URL",
      "QUEUE_PROVIDER",
      "REDIS_URL",
      "PAYMENT_PROVIDER",
      "FREIGHT_PROVIDER",
      "EMAIL_PROVIDER",
      "RESEND_API_KEY",
      "ANALYTICS_PROVIDER",
      "GA4_MEASUREMENT_ID",
      "STORAGE_PROVIDER",
      "STORAGE_BUCKET",
      "INTEGRATION_SECRETS_KEY",
      "VITE_SITE_MODE",
      "VITE_ECOMMERCE_ENABLED",
      "VITE_CHECKOUT_ENABLED",
      "VITE_QUOTE_ENABLED",
    ],
    expected: {
      APP_ENV: "production",
      DB_PROVIDER: "postgres",
      QUEUE_PROVIDER: "redis",
      PAYMENT_PROVIDER: "manual",
      FREIGHT_PROVIDER: "local-rules",
      EMAIL_PROVIDER: "resend",
      ANALYTICS_PROVIDER: "ga4",
      STORAGE_PROVIDER: "minio",
      HOMOLOGATION_ONLY: "true",
      VITE_SITE_MODE: "quote",
      VITE_ECOMMERCE_ENABLED: "false",
      VITE_CHECKOUT_ENABLED: "false",
      VITE_QUOTE_ENABLED: "true",
    },
  },
  {
    file: ".env.production.example",
    required: [
      "APP_ENV",
      "DB_PROVIDER",
      "DATABASE_URL",
      "QUEUE_PROVIDER",
      "REDIS_URL",
      "PAYMENT_PROVIDER",
      "FREIGHT_PROVIDER",
      "EMAIL_PROVIDER",
      "RESEND_API_KEY",
      "ANALYTICS_PROVIDER",
      "GA4_MEASUREMENT_ID",
      "STORAGE_PROVIDER",
      "STORAGE_BUCKET",
      "METRICS_TOKEN",
      "INTEGRATION_SECRETS_KEY",
      "VITE_SITE_MODE",
      "VITE_ECOMMERCE_ENABLED",
      "VITE_CART_ENABLED",
      "VITE_CHECKOUT_ENABLED",
      "VITE_PAYMENTS_ENABLED",
      "VITE_QUOTE_ENABLED",
    ],
    expected: {
      APP_ENV: "production",
      DB_PROVIDER: "postgres",
      QUEUE_PROVIDER: "redis",
      PAYMENT_PROVIDER: "manual",
      FREIGHT_PROVIDER: "local-rules",
      EMAIL_PROVIDER: "resend",
      ANALYTICS_PROVIDER: "ga4",
      STORAGE_PROVIDER: "minio",
      HOMOLOGATION_ONLY: "false",
      VITE_SITE_MODE: "quote",
      VITE_ECOMMERCE_ENABLED: "false",
      VITE_CART_ENABLED: "false",
      VITE_CHECKOUT_ENABLED: "false",
      VITE_PAYMENTS_ENABLED: "false",
      VITE_QUOTE_ENABLED: "true",
    },
  },
];

const issues: Array<{ file: string; severity: "blocker" | "warning"; detail: string }> = [];
const summary = blueprints.map((blueprint) => {
  const filePath = path.resolve(process.cwd(), blueprint.file);
  if (!fs.existsSync(filePath)) {
    issues.push({ file: blueprint.file, severity: "blocker", detail: "Arquivo de baseline ausente." });
    return { file: blueprint.file, ok: false, missing: blueprint.required, mismatches: [] as string[] };
  }

  const values = parseEnvFile(filePath);
  const missing = blueprint.required.filter((key) => !values.has(key));
  const mismatches = Object.entries(blueprint.expected)
    .filter(([key, value]) => values.get(key) !== value)
    .map(([key, value]) => `${key} esperado=${value} atual=${values.get(key) ?? "<ausente>"}`);

  if (missing.length > 0) {
    issues.push({
      file: blueprint.file,
      severity: "blocker",
      detail: `Variaveis obrigatorias ausentes: ${missing.join(", ")}.`,
    });
  }
  for (const mismatch of mismatches) {
    issues.push({
      file: blueprint.file,
      severity: "warning",
      detail: mismatch,
    });
  }

  return {
    file: blueprint.file,
    ok: missing.length === 0 && mismatches.length === 0,
    missing,
    mismatches,
  };
});

console.log(
  JSON.stringify(
    {
      ok: !issues.some((issue) => issue.severity === "blocker"),
      summary,
      issues,
      next_steps:
        issues.length === 0
          ? ["Baselines de ambiente estao consistentes para local, phase1, phase2, staging e production."]
          : [
              "Corrigir os arquivos .env*.example antes de homologacao forte.",
              "Reexecutar npm run env:blueprints:check apos ajustar as baselines.",
            ],
    },
    null,
    2,
  ),
);

if (issues.some((issue) => issue.severity === "blocker")) {
  process.exitCode = 1;
}
