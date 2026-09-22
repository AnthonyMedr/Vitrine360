import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Eye,
  Globe,
  HardDrive,
  Inbox,
  LineChart,
  RefreshCw,
  RotateCcw,
  Trash2,
  Truck,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAllEntries, getOutboxStats, cleanupOutbox, clearOutbox, reprocessEntry } from "@/data/events/outbox";
import { getWebhookStatus } from "@/data/events/webhookClient";
import type { OutboxEntry } from "@/domain/types";
import { apiFetch } from "@/lib/api";
import type { LocalIntegrationOverview } from "@/lib/localCommerce";
import { toast } from "sonner";

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  sent: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  expired: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  expired: "Expirado",
};

interface RuntimeHealthResponse {
  ok: boolean;
  timestamp: string;
  env: string;
  app_base_url: string;
  providers: Record<
    "database" | "payment" | "freight" | "email" | "analytics" | "storage",
    { provider: string; ready: boolean }
  >;
}

interface ProviderRuntimeStatus {
  provider: string;
  mode: string;
  ready: boolean;
  request_timeout_ms: number;
  missing: string[];
}

interface PaymentProviderRuntimeStatus extends ProviderRuntimeStatus {
  webhook_ready: boolean;
  sandbox: boolean;
}

interface FreightProviderRuntimeStatus extends ProviderRuntimeStatus {
  sandbox: boolean;
  origin_zip_configured: boolean;
}

interface GoLiveReadinessResponse {
  go_live_ready: boolean;
  blockers: number;
  warnings: number;
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
  };
  next_steps: string[];
}

interface Phase1ReadinessResponse {
  ok: boolean;
  phase: string;
  blockers: number;
  warnings: number;
  checks: Array<{ status: "ok" | "warning" | "blocker"; key: string; message: string }>;
}

interface Phase2ReadinessResponse {
  phase2_ready: boolean;
  blockers: number;
  warnings: number;
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
  };
  next_steps: string[];
}

interface FiscalReadinessResponse {
  scope: "global" | "minimal-go-live";
  ready: boolean;
  blockers: number;
  warnings: number;
  metrics: {
    scoped_products: number;
    establishments: number;
    fiscal_profiles: number;
    pending_fiscal_profiles: number;
    ready_eligible_fiscal_profiles: number;
    inventory_lots: number;
    pending_catalog_items: number;
    fiscal_documents: number;
    pending_fiscal_documents: number;
    deferred_fiscal_documents: number;
    authorize_ready_fiscal_documents: number;
  };
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
  };
  next_steps: string[];
}

interface FiscalWorkboardResponse {
  scope: "global" | "minimal-go-live";
  generated_at: string;
  metrics: {
    scoped_products: number;
    pending_fiscal_profiles: number;
    ready_eligible_fiscal_profiles: number;
    pending_catalog_items: number;
    pending_fiscal_documents: number;
    deferred_fiscal_documents: number;
    authorize_ready_fiscal_documents: number;
    template_candidate_profiles: number;
    stale_pending_fiscal_documents: number;
    delivered_pending_fiscal_documents: number;
    cancelled_pending_fiscal_documents: number;
  };
  profiles: Array<{
    id: string;
    product_id: string;
    product_name: string;
    establishment_id: string;
    tax_rule_status: "pending" | "ready" | "review";
    missing_fields: string[];
    recommended_action: string;
    updated_at: string;
  }>;
  template_candidates: Array<{
    id: string;
    product_id: string;
    product_name: string;
    establishment_id: string;
    template_fields: string[];
    candidate_targets: number;
    recommended_action: string;
    updated_at: string;
  }>;
  staging: {
    pending_fields: Array<{ field: string; count: number }>;
    by_family: Array<{ family: string; count: number }>;
    by_category: Array<{ category: string; count: number }>;
    samples: Array<{
      id: string;
      normalized_name: string;
      category_name: string | null;
      suggested_family: string | null;
      fiscal_pending_fields: string[];
      enrichment_confidence: "high" | "medium" | "low" | null;
      publish_flag: boolean;
      recommended_action: string;
    }>;
  };
  documents: Array<{
    id: string;
    order_id: string | null;
    order_number: string | null;
    order_status: string | null;
    age_days: number;
    establishment_id: string;
    provider: "manual" | "nfeio" | "tecnospeed" | "erp";
    status_sefaz: "pending" | "authorized" | "rejected" | "cancelled";
    message: string | null;
    recommended_action: string;
    created_at: string;
  }>;
  deferred_documents: Array<{
    id: string;
    order_id: string | null;
    order_number: string | null;
    order_status: string | null;
    age_days: number;
    establishment_id: string;
    provider: "manual" | "nfeio" | "tecnospeed" | "erp";
    status_sefaz: "pending" | "authorized" | "rejected" | "cancelled";
    go_live_gate_status: "required" | "deferred";
    go_live_gate_note: string | null;
    message: string | null;
    recommended_action: string;
    created_at: string;
  }>;
  next_steps: string[];
}

interface FiscalRemediationResponse {
  remediation: {
    dry_run: boolean;
    changed: boolean;
    actions: Array<{
      type: "profile_synced_from_product" | "profile_marked_ready" | "staging_item_refreshed" | "fiscal_document_authorized";
      reference_id: string;
      detail: string;
    }>;
    metrics: {
      profiles_synced_from_product: number;
      profiles_marked_ready: number;
      staging_items_refreshed: number;
      fiscal_documents_authorized: number;
    };
    next_steps: string[];
  };
  readiness?: FiscalReadinessResponse;
  workboard?: FiscalWorkboardResponse;
}

interface FiscalDocumentRemediationResponse {
  remediation: {
    dry_run: boolean;
    changed: boolean;
    actions: Array<{
      type: "cancelled_order_document_deferred";
      reference_id: string;
      order_id: string;
      order_number: string;
      detail: string;
    }>;
    metrics: {
      cancelled_documents_deferred: number;
    };
    next_steps: string[];
  };
  readiness?: FiscalReadinessResponse;
  workboard?: FiscalWorkboardResponse;
}

interface SecurityReadinessResponse {
  ready: boolean;
  blockers: number;
  warnings: number;
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
  };
  next_steps: string[];
}

interface OperationReadinessResponse {
  ready: boolean;
  blockers: number;
  warnings: number;
  metrics: {
    reconciliationCritical: number;
    paymentActionRequired: number;
    expeditionBacklog: number;
    expeditionAttention: number;
    ticketsStale: number;
    ticketsAttention: number;
    returnsStale: number;
    returnsAttention: number;
  };
  checks: {
    ok: Array<{ item: string; detail: string }>;
    warnings: Array<{ item: string; detail: string }>;
    blockers: Array<{ item: string; detail: string }>;
  };
  next_steps: string[];
}

interface ReleaseReadinessResponse {
  ready: boolean;
  blockers: number;
  warnings: number;
  sections: Record<
    "infra" | "security" | "payment" | "freight" | "fiscal" | "operations" | "go_live",
    {
      ready: boolean;
      blockers: number;
      warnings: number;
      summary: string;
    }
  >;
  next_steps: string[];
}

interface HomologationPackResponse {
  generated_at: string;
  decision: {
    local_base_ready: boolean;
    homologation_ready: boolean;
    go_live_ready: boolean;
  };
  environment: {
    app_env: string;
    app_base_url: string;
    api_base_url: string;
    homologation_only: boolean;
    db_provider: string;
    queue_provider: string;
    payment_provider: string;
    freight_provider: string;
  };
  env_requirements: Array<{
    phase: string;
    key: string;
    requiredFor: string;
    configured: boolean;
  }>;
  missing_env: Array<{
    phase: string;
    key: string;
    requiredFor: string;
    configured: boolean;
  }>;
  command_sequence: string[];
}

const providerMeta = {
  database: { label: "Banco", icon: Database },
  payment: { label: "Pagamento", icon: CreditCard },
  freight: { label: "Frete", icon: Truck },
  email: { label: "E-mail", icon: BellRing },
  analytics: { label: "Analytics", icon: LineChart },
  storage: { label: "Storage", icon: HardDrive },
} as const;

function formatMode(mode: string) {
  if (mode === "real") return "real";
  if (mode === "manual") return "manual";
  if (mode === "local") return "local";
  return "estrutural";
}

export function IntegrationStatus() {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, sent: 0, failed: 0, expired: 0 });
  const [selectedEntry, setSelectedEntry] = useState<OutboxEntry | null>(null);
  const [overview, setOverview] = useState<LocalIntegrationOverview | null>(null);
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealthResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentProviderRuntimeStatus | null>(null);
  const [freightStatus, setFreightStatus] = useState<FreightProviderRuntimeStatus | null>(null);
  const [phase1Readiness, setPhase1Readiness] = useState<Phase1ReadinessResponse | null>(null);
  const [phase2Readiness, setPhase2Readiness] = useState<Phase2ReadinessResponse | null>(null);
  const [goLiveReadiness, setGoLiveReadiness] = useState<GoLiveReadinessResponse | null>(null);
  const [fiscalReadiness, setFiscalReadiness] = useState<FiscalReadinessResponse | null>(null);
  const [fiscalMinimalReadiness, setFiscalMinimalReadiness] = useState<FiscalReadinessResponse | null>(null);
  const [fiscalWorkboard, setFiscalWorkboard] = useState<FiscalWorkboardResponse | null>(null);
  const [fiscalMinimalWorkboard, setFiscalMinimalWorkboard] = useState<FiscalWorkboardResponse | null>(null);
  const [fiscalRemediationPreview, setFiscalRemediationPreview] = useState<FiscalRemediationResponse["remediation"] | null>(null);
  const [runningFiscalRemediation, setRunningFiscalRemediation] = useState(false);
  const [fiscalDocumentRemediationPreview, setFiscalDocumentRemediationPreview] =
    useState<FiscalDocumentRemediationResponse["remediation"] | null>(null);
  const [runningFiscalDocumentRemediation, setRunningFiscalDocumentRemediation] = useState(false);
  const [runningFiscalProfileSync, setRunningFiscalProfileSync] = useState(false);
  const [runningFiscalProfileReady, setRunningFiscalProfileReady] = useState(false);
  const [runningFiscalDocumentAuthorize, setRunningFiscalDocumentAuthorize] = useState(false);
  const [securityReadiness, setSecurityReadiness] = useState<SecurityReadinessResponse | null>(null);
  const [operationReadiness, setOperationReadiness] = useState<OperationReadinessResponse | null>(null);
  const [releaseReadiness, setReleaseReadiness] = useState<ReleaseReadinessResponse | null>(null);
  const [homologationPack, setHomologationPack] = useState<HomologationPackResponse | null>(null);

  const refreshLocal = useCallback(() => {
    setEntries(getAllEntries());
    setStats(getOutboxStats());
  }, []);

  const refreshRemote = useCallback(async () => {
    try {
      const [
        overviewData,
        healthData,
        paymentData,
        freightData,
        phase1Data,
        phase2Data,
        goLiveData,
        fiscalData,
        fiscalMinimalData,
        fiscalWorkboardData,
        fiscalMinimalWorkboardData,
        securityData,
        operationData,
        releaseData,
        homologationPackData,
      ] = await Promise.allSettled([
        apiFetch<LocalIntegrationOverview>("/api/admin/integrations/overview"),
        apiFetch<RuntimeHealthResponse>("/api/health/detailed"),
        apiFetch<PaymentProviderRuntimeStatus>("/api/payment-provider/status"),
        apiFetch<FreightProviderRuntimeStatus>("/api/freight-provider/status"),
        apiFetch<Phase1ReadinessResponse>("/api/admin/phase1/readiness"),
        apiFetch<Phase2ReadinessResponse>("/api/admin/phase2/readiness"),
        apiFetch<GoLiveReadinessResponse>("/api/admin/go-live/readiness"),
        apiFetch<FiscalReadinessResponse>("/api/admin/fiscal/readiness"),
        apiFetch<FiscalReadinessResponse>("/api/admin/fiscal/readiness?scope=minimal-go-live"),
        apiFetch<FiscalWorkboardResponse>("/api/admin/fiscal/workboard"),
        apiFetch<FiscalWorkboardResponse>("/api/admin/fiscal/workboard?scope=minimal-go-live"),
        apiFetch<SecurityReadinessResponse>("/api/admin/security/readiness"),
        apiFetch<OperationReadinessResponse>("/api/admin/operations/readiness"),
        apiFetch<ReleaseReadinessResponse>("/api/admin/release/readiness"),
        apiFetch<HomologationPackResponse>("/api/admin/homologation/pack"),
      ]);

      setOverview(overviewData.status === "fulfilled" ? overviewData.value : null);
      setRuntimeHealth(healthData.status === "fulfilled" ? healthData.value : null);
      setPaymentStatus(paymentData.status === "fulfilled" ? paymentData.value : null);
      setFreightStatus(freightData.status === "fulfilled" ? freightData.value : null);
      setPhase1Readiness(phase1Data.status === "fulfilled" ? phase1Data.value : null);
      setPhase2Readiness(phase2Data.status === "fulfilled" ? phase2Data.value : null);
      setGoLiveReadiness(goLiveData.status === "fulfilled" ? goLiveData.value : null);
      setFiscalReadiness(fiscalData.status === "fulfilled" ? fiscalData.value : null);
      setFiscalMinimalReadiness(fiscalMinimalData.status === "fulfilled" ? fiscalMinimalData.value : null);
      setFiscalWorkboard(fiscalWorkboardData.status === "fulfilled" ? fiscalWorkboardData.value : null);
      setFiscalMinimalWorkboard(fiscalMinimalWorkboardData.status === "fulfilled" ? fiscalMinimalWorkboardData.value : null);
      setSecurityReadiness(securityData.status === "fulfilled" ? securityData.value : null);
      setOperationReadiness(operationData.status === "fulfilled" ? operationData.value : null);
      setReleaseReadiness(releaseData.status === "fulfilled" ? releaseData.value : null);
      setHomologationPack(homologationPackData.status === "fulfilled" ? homologationPackData.value : null);
    } catch {
      setOverview(null);
      setRuntimeHealth(null);
      setPaymentStatus(null);
      setFreightStatus(null);
      setPhase1Readiness(null);
      setPhase2Readiness(null);
      setGoLiveReadiness(null);
      setFiscalReadiness(null);
      setFiscalMinimalReadiness(null);
      setFiscalWorkboard(null);
      setFiscalMinimalWorkboard(null);
      setSecurityReadiness(null);
      setOperationReadiness(null);
      setReleaseReadiness(null);
      setHomologationPack(null);
    }
  }, []);

  useEffect(() => {
    refreshLocal();
    void refreshRemote();
    const interval = setInterval(() => {
      refreshLocal();
      void refreshRemote();
    }, 10_000);
    return () => clearInterval(interval);
  }, [refreshLocal, refreshRemote]);

  const webhook = getWebhookStatus();
  const readyProviders = runtimeHealth ? Object.values(runtimeHealth.providers).filter((item) => item.ready).length : 0;
  const totalProviders = runtimeHealth ? Object.keys(runtimeHealth.providers).length : 0;

  const handleCleanup = () => {
    cleanupOutbox();
    refreshLocal();
  };

  const handleClear = () => {
    if (confirm("Tem certeza que deseja limpar todos os eventos do outbox?")) {
      clearOutbox();
      refreshLocal();
    }
  };

  const previewFiscalRemediation = useCallback(async () => {
    setRunningFiscalRemediation(true);
    try {
      const payload = await apiFetch<FiscalRemediationResponse>("/api/admin/fiscal/remediation");
      setFiscalRemediationPreview(payload.remediation);
      toast.success(
        payload.remediation.actions.length > 0
          ? `${payload.remediation.actions.length} acoes fiscais seguras identificadas`
          : "Nenhuma remediacao fiscal segura disponível no estado atual",
      );
    } catch {
      toast.error("Falha ao carregar a previa da remediacao fiscal");
    } finally {
      setRunningFiscalRemediation(false);
    }
  }, []);

  const applyFiscalRemediation = useCallback(async () => {
    setRunningFiscalRemediation(true);
    try {
      const payload = await apiFetch<FiscalRemediationResponse>("/api/admin/fiscal/remediation", {
        method: "POST",
      });
      setFiscalRemediationPreview(payload.remediation);
      if (payload.readiness) setFiscalReadiness(payload.readiness);
      if (payload.workboard) setFiscalWorkboard(payload.workboard);
      await refreshRemote();
      toast.success(
        payload.remediation.changed
          ? `${payload.remediation.actions.length} acoes fiscais aplicadas com segurança`
          : "Nenhuma remediacao fiscal segura foi aplicada",
      );
    } catch {
      toast.error("Falha ao aplicar a remediacao fiscal");
    } finally {
      setRunningFiscalRemediation(false);
    }
  }, [refreshRemote]);

  const previewFiscalDocumentRemediation = useCallback(async () => {
    setRunningFiscalDocumentRemediation(true);
    try {
      const payload = await apiFetch<FiscalDocumentRemediationResponse>("/api/admin/fiscal/documents/remediation");
      setFiscalDocumentRemediationPreview(payload.remediation);
      toast.success(
        payload.remediation.actions.length > 0
          ? `${payload.remediation.actions.length} documentos cancelados podem sair do gate`
          : "Nenhum documento cancelado elegivel para remediacao segura",
      );
    } catch {
      toast.error("Falha ao carregar a previa da remediacao de documentos fiscais");
    } finally {
      setRunningFiscalDocumentRemediation(false);
    }
  }, []);

  const applyFiscalDocumentRemediation = useCallback(async () => {
    setRunningFiscalDocumentRemediation(true);
    try {
      const payload = await apiFetch<FiscalDocumentRemediationResponse>("/api/admin/fiscal/documents/remediation", {
        method: "POST",
      });
      setFiscalDocumentRemediationPreview(payload.remediation);
      if (payload.readiness) setFiscalMinimalReadiness(payload.readiness);
      if (payload.workboard) setFiscalMinimalWorkboard(payload.workboard);
      await refreshRemote();
      toast.success(
        payload.remediation.changed
          ? `${payload.remediation.actions.length} documentos cancelados retirados do gate`
          : "Nenhuma remediacao segura de documentos foi aplicada",
      );
    } catch {
      toast.error("Falha ao aplicar a remediacao de documentos fiscais");
    } finally {
      setRunningFiscalDocumentRemediation(false);
    }
  }, [refreshRemote]);

  const runFiscalProfilesSync = useCallback(async () => {
    setRunningFiscalProfileSync(true);
    try {
      const payload = await apiFetch<{ changed: number; unchanged: number; processed: number }>("/api/admin/fiscal/profiles/actions/sync-from-products", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshRemote();
      toast.success(
        payload.changed > 0
          ? `${payload.changed} perfis fiscais sincronizados em lote`
          : payload.processed > 0
            ? `Nenhum perfil precisou de ajuste automatico (${payload.unchanged} sem mudanca)`
            : "Nenhum perfil pendente elegivel para sincronizacao",
      );
    } catch {
      toast.error("Falha ao sincronizar perfis fiscais em lote");
    } finally {
      setRunningFiscalProfileSync(false);
    }
  }, [refreshRemote]);

  const runFiscalProfilesReady = useCallback(async () => {
    setRunningFiscalProfileReady(true);
    try {
      const payload = await apiFetch<{ changed: number; unchanged: number; processed: number }>("/api/admin/fiscal/profiles/actions/mark-ready-eligible", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshRemote();
      toast.success(
        payload.changed > 0
          ? `${payload.changed} perfis completos foram promovidos para pronto`
          : payload.processed > 0
            ? `Nenhum perfil elegivel estava completo (${payload.unchanged} ainda incompletos)`
            : "Nenhum perfil pendente elegivel para promoção",
      );
    } catch {
      toast.error("Falha ao promover perfis fiscais elegiveis");
    } finally {
      setRunningFiscalProfileReady(false);
    }
  }, [refreshRemote]);

  const runFiscalDocumentsAuthorize = useCallback(async () => {
    setRunningFiscalDocumentAuthorize(true);
    try {
      const payload = await apiFetch<{ changed: number; unchanged: number; processed: number }>("/api/admin/fiscal/documents/actions/authorize-ready", {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshRemote();
      toast.success(
        payload.changed > 0
          ? `${payload.changed} documentos fiscais autorizados em lote`
          : payload.processed > 0
            ? `Nenhum documento elegivel estava completo (${payload.unchanged} ainda pendentes)`
            : "Nenhum documento pendente elegivel para autorizacao",
      );
    } catch {
      toast.error("Falha ao autorizar documentos fiscais em lote");
    } finally {
      setRunningFiscalDocumentAuthorize(false);
    }
  }, [refreshRemote]);

  return (
    <div className="space-y-6">
      <div className="rounded-[1.9rem] gradient-dark px-6 py-6 text-secondary-foreground shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow text-secondary-foreground/60">Integracoes e readiness</p>
            <h2 className="mt-3 font-display text-2xl font-bold md:text-3xl">Estado de release, providers e backlog operacional.</h2>
            <p className="mt-3 text-sm leading-7 text-secondary-foreground/76">
              Esta area concentra runtime, providers, gates de release, fiscal e remediacoes para reduzir leitura espalhada e acelerar a decisao operacional.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-3 text-sm backdrop-blur-sm">
              <p className="font-semibold">Providers</p>
              <p className="mt-1 text-secondary-foreground/70">{runtimeHealth ? `${readyProviders}/${totalProviders} prontos` : "Sem leitura"}</p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-3 text-sm backdrop-blur-sm">
              <p className="font-semibold">Outbox</p>
              <p className="mt-1 text-secondary-foreground/70">{stats.pending} pendentes e {stats.failed} falhos.</p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-3 text-sm backdrop-blur-sm">
              <p className="font-semibold">Release</p>
              <p className="mt-1 text-secondary-foreground/70">{releaseReadiness ? `${releaseReadiness.blockers} blockers` : "Sem leitura"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-panel rounded-[1.6rem] px-6 py-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Webhook OmniGrow</p>
              <p className="mt-1 text-lg font-semibold">{webhook.configured ? "Configurado" : "Desativado"}</p>
            </div>
            {webhook.configured ? <Wifi className="h-8 w-8 text-green-500" /> : <WifiOff className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>URL: {webhook.url || "Não configurada"}</p>
            <p>Assinatura: {webhook.signed ? "Ativa" : "Somente backend"}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="surface-panel rounded-[1.6rem] px-6 py-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Eventos no Outbox</p>
              <p className="mt-1 text-3xl font-bold">{stats.total}</p>
            </div>
            <Inbox className="h-8 w-8 text-primary" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.pending > 0 ? (
              <Badge variant="outline" className="border-yellow-300 text-yellow-600">
                {stats.pending} pendentes
              </Badge>
            ) : null}
            {stats.sent > 0 ? (
              <Badge variant="outline" className="border-green-300 text-green-600">
                {stats.sent} enviados
              </Badge>
            ) : null}
            {stats.failed > 0 ? (
              <Badge variant="outline" className="border-red-300 text-red-600">
                {stats.failed} falharam
              </Badge>
            ) : null}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="surface-panel rounded-[1.6rem] px-6 py-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Runtime</p>
              <p className="mt-1 text-lg font-semibold">{runtimeHealth ? runtimeHealth.env : "Sem leitura"}</p>
            </div>
            <Globe className={`h-8 w-8 ${runtimeHealth ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>Base URL: {runtimeHealth?.app_base_url || "Não disponível"}</p>
            <p>Atualizado em: {runtimeHealth ? new Date(runtimeHealth.timestamp).toLocaleString("pt-BR") : "-"}</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="surface-panel rounded-[1.6rem] px-6 py-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Providers prontos</p>
              <p className="mt-1 text-lg font-semibold">{runtimeHealth ? `${readyProviders}/${totalProviders}` : "Sem dados"}</p>
            </div>
            <Activity className={`h-8 w-8 ${runtimeHealth && readyProviders === totalProviders ? "text-green-500" : "text-amber-500"}`} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            O codigo ja suporta os providers finais; aqui fica visivel o que esta pronto ou ainda depende de credenciais.
          </p>
        </motion.div>
      </div>

      {runtimeHealth ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(runtimeHealth.providers).map(([key, provider]) => {
            const typedKey = key as keyof typeof providerMeta;
            const Icon = providerMeta[typedKey].icon;
            return (
              <div key={key} className="surface-panel rounded-[1.35rem] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`rounded-xl p-2 ${provider.ready ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{providerMeta[typedKey].label}</p>
                      <p className="mt-1 text-lg font-semibold">{provider.provider}</p>
                    </div>
                  </div>
                  <Badge variant={provider.ready ? "default" : "outline"}>{provider.ready ? "pronto" : "pendente"}</Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {provider.ready ? "Configurado para operação nesta camada." : "Codigo implantado, faltam credenciais ou ambiente."}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      {phase1Readiness || phase2Readiness ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {phase1Readiness ? (
            <div className="surface-panel rounded-[1.35rem] px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Fase 1 - Infra critica</p>
                  <p className="mt-1 text-lg font-semibold">
                    {phase1Readiness.ok ? "Cutover pronta para homologacao final" : "Cutover bloqueada por ambiente"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={phase1Readiness.ok ? "default" : "destructive"}>{phase1Readiness.blockers} blockers</Badge>
                  <Badge variant="outline">{phase1Readiness.warnings} warnings</Badge>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {phase1Readiness.checks.map((entry) => (
                  <div key={entry.key} className="flex items-start gap-2">
                    {entry.status === "ok" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" />
                    ) : entry.status === "warning" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    )}
                    <span>{entry.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {phase2Readiness ? (
            <div className="surface-panel rounded-[1.35rem] px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Fase 2 - Integracoes reais</p>
                  <p className="mt-1 text-lg font-semibold">
                    {phase2Readiness.phase2_ready ? "Providers prontos para homologacao real" : "Integrações ainda bloqueadas por configuração"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={phase2Readiness.phase2_ready ? "default" : "destructive"}>{phase2Readiness.blockers} blockers</Badge>
                  <Badge variant="outline">{phase2Readiness.warnings} warnings</Badge>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {phase2Readiness.checks.blockers.map((entry) => (
                  <div key={entry.item} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <span>{entry.detail}</span>
                  </div>
                ))}
                {phase2Readiness.checks.warnings.map((entry) => (
                  <div key={entry.item} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <span>{entry.detail}</span>
                  </div>
                ))}
                {phase2Readiness.checks.ok.slice(0, 2).map((entry) => (
                  <div key={entry.item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" />
                    <span>{entry.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {releaseReadiness ? (
        <div className="surface-panel rounded-[1.35rem] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Readiness consolidada</p>
              <p className="mt-1 text-lg font-semibold">
                {releaseReadiness.ready ? "Frentes internas prontas para homologacao final" : "Frentes internas ainda bloqueadas"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={releaseReadiness.ready ? "default" : "destructive"}>{releaseReadiness.blockers} blockers</Badge>
              <Badge variant="outline">{releaseReadiness.warnings} warnings</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(releaseReadiness.sections).map(([key, section]) => (
              <div key={key} className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, " ")}</p>
                    <p className="mt-2 text-sm font-semibold">{section.ready ? "pronto" : "pendente"}</p>
                  </div>
                  <Badge variant={section.ready ? "default" : "outline"}>
                    {section.blockers > 0 ? `${section.blockers} blockers` : `${section.warnings} warnings`}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{section.summary}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proximos passos consolidados</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {releaseReadiness.next_steps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <RefreshCw className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {homologationPack ? (
        <div className="surface-panel rounded-[1.35rem] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Pacote de homologacao nacional</p>
              <p className="mt-1 text-lg font-semibold">
                {homologationPack.decision.go_live_ready ? "Go-live pronto pelos gates atuais" : "Go-live aguardando insumos reais"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Atualizado em {new Date(homologationPack.generated_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={homologationPack.decision.local_base_ready ? "default" : "destructive"}>base local</Badge>
              <Badge variant={homologationPack.decision.homologation_ready ? "default" : "outline"}>homologacao</Badge>
              <Badge variant={homologationPack.decision.go_live_ready ? "default" : "destructive"}>go-live</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Variaveis pendentes</p>
              {homologationPack.missing_env.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {homologationPack.missing_env.slice(0, 10).map((entry) => (
                    <div key={`${entry.phase}-${entry.key}`} className="rounded-xl border bg-background/80 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-xs font-semibold">{entry.key}</p>
                        <Badge variant="outline" className="text-[10px]">{entry.phase}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.requiredFor}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Todas as variaveis obrigatorias do pacote estao configuradas.</p>
              )}
              {homologationPack.missing_env.length > 10 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mais {homologationPack.missing_env.length - 10} variaveis pendentes no pacote completo.
                </p>
              ) : null}
            </div>

            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sequencia de homologacao</p>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                {homologationPack.command_sequence.slice(0, 7).map((command, index) => (
                  <li key={command} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <code className="break-all rounded bg-background/80 px-1.5 py-0.5 text-xs">{command}</code>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Banco</p>
              <p className="mt-1 text-sm font-semibold">{homologationPack.environment.db_provider}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Fila</p>
              <p className="mt-1 text-sm font-semibold">{homologationPack.environment.queue_provider}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagamento</p>
              <p className="mt-1 text-sm font-semibold">{homologationPack.environment.payment_provider}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Frete</p>
              <p className="mt-1 text-sm font-semibold">{homologationPack.environment.freight_provider}</p>
            </div>
          </div>
        </div>
      ) : null}

      {overview?.items?.length ? (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {overview.items.map((item) => (
            <div key={item.key} className="surface-panel rounded-[1.35rem] px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold">{item.connected ? "Conectado" : "Operação local"}</p>
                </div>
                <Badge variant={item.connected ? "default" : "outline"}>{formatMode(item.mode)}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{item.status}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant={item.fallback_ready ? "default" : "secondary"}>{item.fallback_ready ? "Fallback pronto" : "Sem fallback"}</Badge>
                {item.last_error ? <Badge variant="destructive">{item.last_error}</Badge> : <Badge variant="outline">Sem erro ativo</Badge>}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {paymentStatus || freightStatus ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {paymentStatus ? (
            <div className="surface-panel rounded-[1.35rem] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Gateway de pagamento</p>
                  <p className="mt-1 text-lg font-semibold">{paymentStatus.provider}</p>
                </div>
                <Badge variant={paymentStatus.ready ? "default" : "outline"}>{paymentStatus.ready ? "pronto" : "pendente"}</Badge>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>Modo: {formatMode(paymentStatus.mode)}</p>
                <p>Webhook: {paymentStatus.webhook_ready ? "assinado" : "pendente"}</p>
                <p>Timeout: {paymentStatus.request_timeout_ms} ms</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {paymentStatus.missing.length > 0 ? paymentStatus.missing.map((item) => (
                  <Badge key={item} variant="destructive">{item}</Badge>
                )) : <Badge variant="outline">Sem bloqueio local</Badge>}
              </div>
            </div>
          ) : null}

          {freightStatus ? (
            <div className="surface-panel rounded-[1.35rem] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Provider de frete</p>
                  <p className="mt-1 text-lg font-semibold">{freightStatus.provider}</p>
                </div>
                <Badge variant={freightStatus.ready ? "default" : "outline"}>{freightStatus.ready ? "pronto" : "pendente"}</Badge>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>Modo: {formatMode(freightStatus.mode)}</p>
                <p>Sandbox: {freightStatus.sandbox ? "ativo" : "desativado"}</p>
                <p>CEP origem: {freightStatus.origin_zip_configured ? "configurado" : "pendente"}</p>
                <p>Timeout: {freightStatus.request_timeout_ms} ms</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {freightStatus.missing.length > 0 ? freightStatus.missing.map((item) => (
                  <Badge key={item} variant="destructive">{item}</Badge>
                )) : <Badge variant="outline">Sem bloqueio local</Badge>}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {goLiveReadiness ? (
        <div className="surface-panel rounded-[1.35rem] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Gate de go-live</p>
              <p className="mt-1 text-lg font-semibold">
                {goLiveReadiness.go_live_ready ? "Liberado para homologacao final" : "Bloqueado para produção"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={goLiveReadiness.go_live_ready ? "default" : "destructive"}>
                {goLiveReadiness.blockers} blockers
              </Badge>
              <Badge variant="outline">{goLiveReadiness.warnings} warnings</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">OK</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {goLiveReadiness.checks.ok.slice(0, 4).map((entry) => (
                  <li key={entry.item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-500" />
                    <span>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warnings</p>
              {goLiveReadiness.checks.warnings.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {goLiveReadiness.checks.warnings.map((entry) => (
                    <li key={entry.item} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                      <span>{entry.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum warning ativo.</p>
              )}
            </div>

            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blockers</p>
              {goLiveReadiness.checks.blockers.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {goLiveReadiness.checks.blockers.map((entry) => (
                    <li key={entry.item} className="flex items-start gap-2">
                      <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                      <span>{entry.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Sem blocker local no gate atual.</p>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proximos passos</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {goLiveReadiness.next_steps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <RefreshCw className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {fiscalReadiness ? (
        <div className="surface-panel rounded-[1.35rem] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Readiness fiscal</p>
              <p className="mt-1 text-lg font-semibold">
                {fiscalReadiness.ready ? "Saneamento fiscal interno pronto" : "Pendencias fiscais ativas"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={fiscalReadiness.ready ? "default" : "destructive"}>{fiscalReadiness.blockers} blockers</Badge>
              <Badge variant="outline">{fiscalReadiness.warnings} warnings</Badge>
              {fiscalMinimalReadiness ? (
                <Badge variant={fiscalMinimalReadiness.ready ? "default" : "secondary"}>
                  Mix minimo: {fiscalMinimalReadiness.blockers} blockers
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfis fiscais</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalReadiness.metrics.pending_fiscal_profiles}</p>
              <p className="mt-1 text-xs text-muted-foreground">pendentes de fechamento</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfis prontos para promover</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalReadiness?.metrics.ready_eligible_fiscal_profiles ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">elegiveis para virar ready sem ajuste manual extra</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Staging fiscal</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalReadiness.metrics.pending_catalog_items}</p>
              <p className="mt-1 text-xs text-muted-foreground">itens bloqueados para publicacao</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Documentos</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalReadiness.metrics.pending_fiscal_documents}</p>
              <p className="mt-1 text-xs text-muted-foreground">aguardando tratativa</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Mix minimo validado</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalReadiness?.metrics.scoped_products ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">produtos no recorte de go-live</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Estabelecimentos</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalReadiness.metrics.establishments}</p>
              <p className="mt-1 text-xs text-muted-foreground">base fiscal vinculada</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Docs fora do corte</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalReadiness?.metrics.deferred_fiscal_documents ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">pendencias historicas acompanhadas fora do gate minimo</p>
            </div>
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Docs prontos para autorizar</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalReadiness?.metrics.authorize_ready_fiscal_documents ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">pendentes com dados completos para autorizacao em lote</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Blockers fiscais</p>
              {fiscalReadiness.checks.blockers.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {fiscalReadiness.checks.blockers.map((entry) => (
                    <li key={entry.item} className="flex items-start gap-2">
                      <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                      <span>{entry.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Sem bloqueio fiscal local no estado atual.</p>
              )}
            </div>

            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proximos passos fiscais</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {(fiscalMinimalReadiness?.next_steps ?? fiscalReadiness.next_steps).map((step) => (
                  <li key={step} className="flex items-start gap-2">
                    <RefreshCw className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {fiscalWorkboard ? (
        <div className="surface-panel rounded-[1.35rem] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Workboard fiscal acionavel</p>
              <p className="mt-1 text-lg font-semibold">Fila priorizada para saneamento interno</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Atualizado em</p>
              <p className="mt-1 font-medium text-foreground">{new Date(fiscalWorkboard.generated_at).toLocaleString("pt-BR")}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={runningFiscalRemediation} onClick={() => void previewFiscalRemediation()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Prever remediacao fiscal
            </Button>
            <Button
              size="sm"
              disabled={runningFiscalRemediation || !fiscalRemediationPreview?.actions.length}
              onClick={() => void applyFiscalRemediation()}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Aplicar remediacao segura
            </Button>
            <Button variant="outline" size="sm" disabled={runningFiscalProfileSync} onClick={() => void runFiscalProfilesSync()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {runningFiscalProfileSync ? "Sincronizando..." : "Sincronizar perfis"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={runningFiscalProfileReady || !fiscalMinimalReadiness?.metrics.ready_eligible_fiscal_profiles}
              onClick={() => void runFiscalProfilesReady()}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {runningFiscalProfileReady ? "Promovendo..." : "Promover perfis prontos"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={runningFiscalDocumentAuthorize || !fiscalMinimalReadiness?.metrics.authorize_ready_fiscal_documents}
              onClick={() => void runFiscalDocumentsAuthorize()}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {runningFiscalDocumentAuthorize ? "Autorizando..." : "Autorizar documentos prontos"}
            </Button>
            <Button variant="outline" size="sm" disabled={runningFiscalDocumentRemediation} onClick={() => void previewFiscalDocumentRemediation()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Prever docs cancelados
            </Button>
            <Button
              size="sm"
              disabled={runningFiscalDocumentRemediation || !fiscalDocumentRemediationPreview?.actions.length}
              onClick={() => void applyFiscalDocumentRemediation()}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Retirar cancelados do gate
            </Button>
          </div>

          {fiscalRemediationPreview ? (
            <div className="mt-4 rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview da remediacao fiscal</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fiscalRemediationPreview.actions.length > 0
                      ? "Apenas acoes seguras e baseadas em dado ja existente aparecem aqui."
                      : "Nenhuma acao segura encontrada no snapshot atual."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{fiscalRemediationPreview.metrics.profiles_synced_from_product} perfis sincronizados</Badge>
                  <Badge variant="outline">{fiscalRemediationPreview.metrics.profiles_marked_ready} perfis prontos</Badge>
                  <Badge variant="outline">{fiscalRemediationPreview.metrics.staging_items_refreshed} itens recalculados</Badge>
                  <Badge variant="outline">{fiscalRemediationPreview.metrics.fiscal_documents_authorized} documentos autorizados</Badge>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {fiscalRemediationPreview.actions.length > 0 ? (
                  fiscalRemediationPreview.actions.slice(0, 8).map((action) => (
                    <div key={`${action.type}-${action.reference_id}`} className="rounded-xl border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{action.type}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
                        </div>
                        <Badge variant="outline">{action.reference_id}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">O backlog fiscal atual ainda exige preenchimento manual e tratativa humana.</p>
                )}
              </div>
            </div>
          ) : null}

          {fiscalDocumentRemediationPreview ? (
            <div className="mt-4 rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview da remediacao de documentos</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fiscalDocumentRemediationPreview.actions.length > 0
                      ? "Somente documentos pendentes ligados a pedidos cancelados entram nessa remediacao."
                      : "Nenhum documento cancelado elegivel para sair do gate no snapshot atual."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{fiscalDocumentRemediationPreview.metrics.cancelled_documents_deferred} docs cancelados diferidos</Badge>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {fiscalDocumentRemediationPreview.actions.length > 0 ? (
                  fiscalDocumentRemediationPreview.actions.slice(0, 8).map((action) => (
                    <div key={`${action.type}-${action.reference_id}`} className="rounded-xl border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{action.order_number}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{action.detail}</p>
                        </div>
                        <Badge variant="outline">{action.reference_id}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Os documentos restantes ainda dependem de tratativa manual do corte minimo.</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfis pendentes</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalWorkboard.metrics.pending_fiscal_profiles}</p>
              <p className="mt-1 text-xs text-muted-foreground">itens aguardando fechamento fiscal</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfis elegiveis para ready</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalWorkboard?.metrics.ready_eligible_fiscal_profiles ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">completos o suficiente para promocao segura</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Modelos fiscais sugeridos</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalWorkboard?.metrics.template_candidate_profiles ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">perfis que ja podem acelerar os pendentes semelhantes</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Staging bloqueado</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalWorkboard.metrics.pending_catalog_items}</p>
              <p className="mt-1 text-xs text-muted-foreground">cadastros impedidos de publicar</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Documentos pendentes</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalWorkboard.metrics.pending_fiscal_documents}</p>
              <p className="mt-1 text-xs text-muted-foreground">emissao ou retorno fiscal ainda aberto</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Documentos fora do corte</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalWorkboard?.metrics.deferred_fiscal_documents ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">historico fiscal retirado do gate do primeiro go-live</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Documentos prontos para autorizar</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalWorkboard?.metrics.authorize_ready_fiscal_documents ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">pendentes com numero, serie, chave e CFOP completos</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Docs fiscais antigos</p>
              <p className="mt-2 text-2xl font-semibold">{fiscalMinimalWorkboard?.metrics.stale_pending_fiscal_documents ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">pendentes ha 3 dias ou mais dentro do corte</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Perfis prioritarios</p>
              <div className="mt-3 space-y-3">
                {fiscalWorkboard.profiles.length > 0 ? (
                  fiscalWorkboard.profiles.slice(0, 5).map((profile) => (
                    <div key={profile.id} className="rounded-xl border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{profile.product_name}</p>
                          <p className="text-xs text-muted-foreground">{profile.establishment_id}</p>
                        </div>
                        <Badge variant="outline">{profile.tax_rule_status}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.missing_fields.map((field) => (
                          <Badge key={`${profile.id}-${field}`} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{profile.recommended_action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum perfil fiscal pendente no recorte atual.</p>
                )}
              </div>
            </div>

            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Modelos fiscais recomendados</p>
              <div className="mt-3 space-y-3">
                {fiscalMinimalWorkboard?.template_candidates.length ? (
                  fiscalMinimalWorkboard.template_candidates.slice(0, 5).map((template) => (
                    <div key={template.id} className="rounded-xl border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{template.product_name}</p>
                          <p className="text-xs text-muted-foreground">{template.establishment_id}</p>
                        </div>
                        <Badge variant="outline">{template.candidate_targets} alvo(s)</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {template.template_fields.map((field) => (
                          <Badge key={`${template.id}-${field}`} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{template.recommended_action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum modelo fiscal sugerido no recorte atual.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campos mais faltantes</p>
              <div className="mt-3 space-y-3">
                {fiscalWorkboard.staging.pending_fields.length > 0 ? (
                  fiscalWorkboard.staging.pending_fields.slice(0, 6).map((field) => (
                    <div key={field.field} className="flex items-center justify-between rounded-xl border bg-background/80 px-3 py-2">
                      <span className="text-sm">{field.field}</span>
                      <Badge variant="outline">{field.count}</Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem campos pendentes no staging.</p>
                )}
              </div>

              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Amostra do staging</p>
              <div className="mt-3 space-y-3">
                {fiscalWorkboard.staging.samples.length > 0 ? (
                  fiscalWorkboard.staging.samples.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-xl border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.normalized_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.category_name || "Sem categoria"} · {item.suggested_family || "Sem familia"}
                          </p>
                        </div>
                        <Badge variant={item.publish_flag ? "default" : "outline"}>{item.publish_flag ? "publicavel" : "bloqueado"}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.fiscal_pending_fields.map((field) => (
                          <Badge key={`${item.id}-${field}`} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{item.recommended_action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem itens pendentes no staging fiscal.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documentos fiscais pendentes</p>
              <div className="mt-3 space-y-3">
                {fiscalWorkboard.documents.length > 0 ? (
                  fiscalWorkboard.documents.slice(0, 5).map((document) => (
                    <div key={document.id} className="rounded-xl border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{document.order_number ? `Pedido #${document.order_number}` : document.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {document.provider} · {new Date(document.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Badge variant="outline">{document.status_sefaz}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">{document.order_status || "sem status"}</Badge>
                        <Badge variant="outline" className="text-xs">{document.age_days}d</Badge>
                      </div>
                      {document.message ? <p className="mt-2 text-xs text-muted-foreground">{document.message}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">{document.recommended_action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem documentos fiscais pendentes.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documentos fora do primeiro corte</p>
              <div className="mt-3 space-y-3">
                {fiscalMinimalWorkboard?.deferred_documents.length ? (
                  fiscalMinimalWorkboard.deferred_documents.slice(0, 5).map((document) => (
                    <div key={document.id} className="rounded-xl border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{document.order_number ? `Pedido #${document.order_number}` : document.id}</p>
                          <p className="text-xs text-muted-foreground">
                            {document.provider} · {new Date(document.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <Badge variant="secondary">fora do corte</Badge>
                      </div>
                      {document.go_live_gate_note ? <p className="mt-2 text-xs text-muted-foreground">{document.go_live_gate_note}</p> : null}
                      <p className="mt-2 text-xs text-muted-foreground">{document.recommended_action}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum documento historico retirado do gate minimo ate agora.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(246,239,229,0.48))] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sequencia recomendada</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {fiscalWorkboard.next_steps.map((step) => (
                <li key={step} className="flex items-start gap-2">
                  <RefreshCw className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {securityReadiness ? (
        <div className="surface-panel rounded-[1.35rem] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Readiness de seguranca</p>
              <p className="mt-1 text-lg font-semibold">
                {securityReadiness.ready ? "Sem blocker critico de hardening" : "Blockers criticos de segurança ativos"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={securityReadiness.ready ? "default" : "destructive"}>{securityReadiness.blockers} blockers</Badge>
              <Badge variant="outline">{securityReadiness.warnings} warnings</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Warnings e riscos</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {securityReadiness.checks.warnings.map((entry) => (
                  <li key={entry.item} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <span>{entry.detail}</span>
                  </li>
                ))}
                {securityReadiness.checks.blockers.map((entry) => (
                  <li key={entry.item} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <span>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[1.1rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,239,229,0.5))] p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proximos passos de hardening</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {securityReadiness.next_steps.map((step) => (
                  <li key={step} className="flex items-start gap-2">
                    <RefreshCw className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {operationReadiness ? (
        <div className="surface-panel rounded-[1.35rem] px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Readiness operacional</p>
              <p className="mt-1 text-lg font-semibold">
                {operationReadiness.ready ? "Sem bloqueio operacional critico" : "Bloqueios operacionais ativos"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={operationReadiness.ready ? "default" : "destructive"}>{operationReadiness.blockers} blockers</Badge>
              <Badge variant="outline">{operationReadiness.warnings} warnings</Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Conciliacao critica</p>
              <p className="mt-2 text-2xl font-semibold">{operationReadiness.metrics.reconciliationCritical}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pagamento parado</p>
              <p className="mt-2 text-2xl font-semibold">{operationReadiness.metrics.paymentActionRequired}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Expedicao critica</p>
              <p className="mt-2 text-2xl font-semibold">{operationReadiness.metrics.expeditionAttention}</p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pos-venda critico</p>
              <p className="mt-2 text-2xl font-semibold">
                {operationReadiness.metrics.ticketsAttention + operationReadiness.metrics.returnsAttention}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alertas operacionais</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {operationReadiness.checks.blockers.map((entry) => (
                  <li key={entry.item} className="flex items-start gap-2">
                    <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                    <span>{entry.detail}</span>
                  </li>
                ))}
                {operationReadiness.checks.warnings.map((entry) => (
                  <li key={entry.item} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    <span>{entry.detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proximos passos operacionais</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {operationReadiness.next_steps.map((step) => (
                  <li key={step} className="flex items-start gap-2">
                    <RefreshCw className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refreshLocal();
            void refreshRemote();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
        <Button variant="outline" size="sm" onClick={handleCleanup}>
          <Clock className="mr-2 h-4 w-4" />
          Limpar expirados
        </Button>
        <Button variant="destructive" size="sm" onClick={handleClear}>
          <Trash2 className="mr-2 h-4 w-4" />
          Limpar tudo
        </Button>
      </div>

      <div className="surface-panel rounded-[1.35rem] px-5 py-5">
        <div className="border-b p-4">
          <h2 className="font-display text-lg font-semibold">Eventos Recentes</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum evento registrado ainda. Navegue pelo site para gerar eventos.
                </TableCell>
              </TableRow>
            ) : (
              entries.slice(0, 50).map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {entry.event.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusIcons[entry.status]}
                      <span className="text-sm">{statusLabels[entry.status]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(entry.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-sm">
                    {entry.attempts}/{entry.max_attempts}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {entry.status === "failed" || entry.status === "expired" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reprocessar"
                          onClick={() => {
                            reprocessEntry(entry.id);
                            refreshLocal();
                          }}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedEntry(entry)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Detalhes do Evento</DialogTitle>
                          </DialogHeader>
                          {selectedEntry ? (
                            <div className="space-y-3 text-sm">
                              <div>
                                <span className="font-medium">ID:</span>{" "}
                                <code className="rounded bg-muted px-1 text-xs">{selectedEntry.event.event_id}</code>
                              </div>
                              <div>
                                <span className="font-medium">Tipo:</span>{" "}
                                <Badge variant="outline">{selectedEntry.event.event_type}</Badge>
                              </div>
                              <div>
                                <span className="font-medium">Correlation ID:</span>{" "}
                                <code className="rounded bg-muted px-1 text-xs">{selectedEntry.event.correlation_id}</code>
                              </div>
                              <div>
                                <span className="font-medium">Ocorrido em:</span>{" "}
                                {new Date(selectedEntry.event.occurred_at).toLocaleString("pt-BR")}
                              </div>
                              {selectedEntry.error ? (
                                <div>
                                  <span className="font-medium text-destructive">Erro:</span> {selectedEntry.error}
                                </div>
                              ) : null}
                              <div>
                                <span className="font-medium">Payload:</span>
                                <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
                                  {JSON.stringify(selectedEntry.event.payload, null, 2)}
                                </pre>
                              </div>
                            </div>
                          ) : null}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="mb-2 font-medium">Variaveis de ambiente principais para ativacao em producao:</p>
        <ul className="space-y-1 font-mono text-xs">
          <li>DATABASE_URL=postgres://...</li>
          <li>PAYMENT_PROVIDER=mercadopago</li>
          <li>MERCADOPAGO_ACCESS_TOKEN=...</li>
          <li>FREIGHT_PROVIDER=melhor-envio</li>
          <li>MELHOR_ENVIO_TOKEN=...</li>
          <li>EMAIL_PROVIDER=resend</li>
          <li>RESEND_API_KEY=...</li>
          <li>ANALYTICS_PROVIDER=ga4</li>
          <li>GA4_API_SECRET=...</li>
          <li>VITE_OMNIGROW_WEBHOOK_ENABLED=true</li>
          <li>VITE_OMNIGROW_WEBHOOK_URL=https://...</li>
          <li>Assinaturas de webhook devem ser geradas no backend, nunca em variaveis VITE_*</li>
        </ul>
      </div>
    </div>
  );
}
