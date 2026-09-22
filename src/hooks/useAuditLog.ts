import { apiFetch } from "@/lib/api";

interface AuditLogEntry {
  orderId?: string;
  eventType: string;
  correlationId?: string;
  sourceChannel?: "web" | "store" | "whatsapp" | "instagram" | "integration";
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export function useAuditLog() {
  const logEvent = async (entry: AuditLogEntry) => {
    await apiFetch("/api/audit", {
      method: "POST",
      body: JSON.stringify(entry),
    });
  };

  const getOrderLogs = async (orderId: string) => apiFetch(`/api/audit/orders/${orderId}`);

  return { logEvent, getOrderLogs };
}
