import type { DatabaseShape } from "./db";
import { appConfig } from "./config";
import { getGoLiveReadinessReport } from "./go-live-readiness";
import { getOperationReadinessReport } from "./operation-readiness";
import { checkPostgresHealth, isPostgresConfigured } from "./postgres";
import { getAdminFiscalReadiness } from "./read-models";
import { checkRedisHealth, isRedisConfigured } from "./redis";
import { getFreightProviderStatus, getPaymentProviderStatus } from "./runtime-overview";
import { getSecurityReadinessReport } from "./security-readiness";

type ReleaseSection = {
  ready: boolean;
  blockers: number;
  warnings: number;
  summary: string;
};

export type ReleaseReadinessReport = {
  ready: boolean;
  blockers: number;
  warnings: number;
  sections: {
    infra: ReleaseSection;
    security: ReleaseSection;
    payment: ReleaseSection;
    freight: ReleaseSection;
    fiscal: ReleaseSection;
    operations: ReleaseSection;
    go_live: ReleaseSection;
  };
  next_steps: string[];
};

function buildProviderSection(options: {
  ready: boolean;
  blockers: number;
  warnings?: number;
  summaryReady: string;
  summaryBlocked: string;
}) {
  return {
    ready: options.ready,
    blockers: options.blockers,
    warnings: options.warnings ?? 0,
    summary: options.ready ? options.summaryReady : options.summaryBlocked,
  } satisfies ReleaseSection;
}

export async function getReleaseReadinessReport(db: DatabaseShape): Promise<ReleaseReadinessReport> {
  const goLive = getGoLiveReadinessReport();
  const security = getSecurityReadinessReport();
  const fiscal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });
  const operations = getOperationReadinessReport(db);
  const paymentStatus = getPaymentProviderStatus();
  const freightStatus = getFreightProviderStatus();

  let infraBlockers = 0;
  let infraWarnings = 0;

  if (appConfig.dbProvider !== "postgres") infraBlockers += 1;
  if (!isPostgresConfigured()) {
    infraBlockers += 1;
  } else {
    const postgresHealth = await checkPostgresHealth();
    if (!postgresHealth.ready) infraBlockers += 1;
  }

  if (appConfig.queueProvider !== "redis") infraBlockers += 1;
  if (!isRedisConfigured()) {
    infraBlockers += 1;
  } else {
    const redisHealth = await checkRedisHealth();
    if (!redisHealth.ready) infraBlockers += 1;
  }

  if (!appConfig.metricsToken) infraWarnings += 1;

  const paymentBlockers =
    (appConfig.paymentProvider !== "mercadopago" ? 1 : 0) + paymentStatus.missing.length;
  const realFreightProvider = ["melhor-envio", "correios", "frenet", "frete-barato", "fretebarato", "cepcerto"].includes(appConfig.freightProvider);
  const freightBlockers =
    (!realFreightProvider ? 1 : 0) + freightStatus.missing.length;

  const sections = {
    infra: {
      ready: infraBlockers === 0,
      blockers: infraBlockers,
      warnings: infraWarnings,
      summary:
        infraBlockers === 0
          ? "PostgreSQL e Redis estao prontos para homologacao controlada."
          : "Infra ainda depende de Postgres/Redis reais ou de healthcheck valido.",
    },
    security: {
      ready: security.ready,
      blockers: security.blockers,
      warnings: security.warnings,
      summary: security.ready
        ? "Hardening critico sem bloqueador aberto."
        : "Seguranca ainda possui bloqueador de ambiente para producao.",
    },
    payment: buildProviderSection({
      ready: paymentBlockers === 0,
      blockers: paymentBlockers,
      summaryReady: "Gateway Mercado Pago pronto para homologacao real.",
      summaryBlocked: "Pagamento real ainda depende de provider e segredos validos.",
    }),
    freight: buildProviderSection({
      ready: freightBlockers === 0,
      blockers: freightBlockers,
      summaryReady: "Frete real pronto para cotacao externa homologada.",
      summaryBlocked: "Frete real ainda depende de provider e configuracao operacional.",
    }),
    fiscal: {
      ready: fiscal.ready,
      blockers: fiscal.blockers,
      warnings: fiscal.warnings,
      summary: fiscal.ready
        ? "Mix minimo validado sem bloqueio fiscal para a operacao assistida."
        : "Fiscal do mix minimo ainda possui backlog impedindo readiness final.",
    },
    operations: {
      ready: operations.ready,
      blockers: operations.blockers,
      warnings: operations.warnings,
      summary: operations.ready
        ? "Operacao sem bloqueio critico no estado atual."
        : "Operacao ainda possui backlog critico de conciliacao ou atendimento.",
    },
    go_live: {
      ready: goLive.go_live_ready,
      blockers: goLive.blockers,
      warnings: goLive.warnings,
      summary: goLive.go_live_ready
        ? "Gate de go-live sem bloqueador local."
        : "Gate de go-live ainda bloqueia a publicacao controlada.",
    },
  } satisfies ReleaseReadinessReport["sections"];

  const blockers =
    sections.infra.blockers +
    sections.security.blockers +
    sections.payment.blockers +
    sections.freight.blockers +
    sections.fiscal.blockers +
    sections.operations.blockers;
  const warnings =
    sections.infra.warnings +
    sections.security.warnings +
    sections.payment.warnings +
    sections.freight.warnings +
    sections.fiscal.warnings +
    sections.operations.warnings;

  const next_steps = Array.from(
    new Set([
      ...(sections.infra.ready
        ? []
        : [
            "Fechar Postgres e Redis reais antes da homologacao final.",
            "Reexecutar npm run phase1:check depois da virada de runtime.",
          ]),
      ...(sections.security.ready
        ? []
        : [
            "Corrigir segredo CSRF e hardening de cookies antes do go-live.",
            "Reexecutar npm run security:check.",
          ]),
      ...(sections.payment.ready
        ? []
        : [
            "Configurar Mercado Pago real e validar webhook assinado.",
            "Reexecutar npm run phase2:check e npm run smoke:phase2.",
          ]),
      ...(sections.freight.ready
        ? []
        : [
            "Configurar Melhor Envio, Correios ou provider real equivalente e validar a cotacao externa.",
            "Reexecutar npm run phase2:check e npm run smoke:phase2.",
          ]),
      ...(sections.fiscal.ready
        ? []
        : fiscal.metrics.pending_catalog_items > 0 || fiscal.metrics.pending_fiscal_documents > 0
        ? [
            "Resolver backlog fiscal do mix minimo validado em perfis, staging e documentos.",
            "Reexecutar npm run fiscal:check -- --scope=minimal-go-live.",
          ]
        : [
            `Fechar os ${fiscal.metrics.pending_fiscal_profiles} perfis fiscais restantes do mix minimo validado.`,
            "Gerar, validar e aplicar o close pack fiscal antes de reexecutar o gate minimo.",
          ]),
      ...(sections.operations.ready
        ? sections.operations.warnings > 0
          ? [
              "Tratar os warnings operacionais restantes antes da virada final.",
              "Reexecutar npm run operations:check apos a tratativa do backlog de pagamentos aguardando acao.",
            ]
          : []
        : [
            "Resolver conciliacao critica e tratativas operacionais pendentes.",
            "Reexecutar npm run operations:check.",
          ]),
      ...(sections.go_live.ready
        ? ["Rodar smoke final e iniciar janela assistida de go-live."]
        : [
            "Resolver warnings de providers auxiliares, observabilidade e cookies antes da publicacao assistida.",
            "Reexecutar npm run go-live:check antes da decisao final de publicacao.",
          ]),
    ]),
  ).slice(0, 8);

  return {
    ready: blockers === 0,
    blockers,
    warnings,
    sections,
    next_steps,
  };
}
