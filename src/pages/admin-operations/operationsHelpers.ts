import type { AdminQuoteRequest } from "./types";

export const openStatuses = new Set(["new", "novo", "pending", "pendente", "draft", "open", "aberto", "em_atendimento"]);
export const closedStatuses = new Set(["converted", "won", "closed", "cancelled", "cancelado", "perdido", "concluido"]);
export const leadStatusOptions = [
  { value: "new", label: "Novo" },
  { value: "contacted", label: "Em atendimento" },
  { value: "contacted", label: "Respondido" },
  { value: "qualified", label: "Em negociação" },
  { value: "converted", label: "Fechado" },
  { value: "lost", label: "Perdido" },
  { value: "lost", label: "Arquivado" },
];

export function describeRequest(request: AdminQuoteRequest) {
  const item = request.items[0];
  const product = item?.product_name || request.lead?.product_interest || "Produto sob consulta";
  const quantity = item?.quantity ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "quantidade a confirmar";
  const city = extractNoteField(request.quote.notes, "Cidade");
  return `${product} - ${quantity}${city ? ` - ${city}` : ""}`;
}

export function extractNoteField(notes: string | null | undefined, label: string) {
  return notes?.match(new RegExp(`${label}: ([^\\n]+)`))?.[1]?.trim() || "";
}

export function isOpenStatus(value?: string | null) {
  const normalized = String(value || "new").trim().toLowerCase();
  if (closedStatuses.has(normalized)) return false;
  return openStatuses.has(normalized) || !normalized;
}

export function labelStatus(value?: string | null) {
  return String(value || "novo").replace(/_/g, " ");
}

export function labelLeadStatus(value?: string | null) {
  const normalized = String(value || "new").trim().toLowerCase();
  if (normalized === "new" || normalized === "novo" || normalized === "draft") return "Novo";
  if (normalized === "contacted" || normalized === "em_atendimento") return "Em atendimento";
  if (normalized === "qualified") return "Em negociação";
  if (normalized === "converted" || normalized === "won" || normalized === "closed") return "Fechado";
  if (normalized === "lost" || normalized === "cancelled") return "Perdido";
  return labelStatus(value);
}

export function formatContact(phone?: string | null, email?: string | null) {
  return [phone, email].filter(Boolean).join(" / ") || "contato a confirmar";
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "sem data";
  return date.toLocaleDateString("pt-BR");
}
