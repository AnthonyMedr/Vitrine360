import type { DatabaseShape, DbLead, DbOrder, DbQuote } from "./db";

type CommercialQueueItem = {
  id: string;
  type: "lead" | "quote" | "order" | "customer_case";
  label: string;
  customer_name: string;
  responsible_name: string | null;
  status: string;
  value: number | null;
  updated_at: string;
  recommended_action: string;
  href: string;
};

function isOpenLead(lead: DbLead) {
  return ["new", "contacted", "qualified"].includes(lead.stage);
}

function isOpenQuote(quote: DbQuote) {
  return ["draft", "sent", "approved"].includes(quote.status);
}

function isCommercialOrder(order: DbOrder) {
  return order.order_type === "assisted" || order.assisted_sale || order.order_origin === "showroom" || order.order_origin === "whatsapp";
}

function getQuoteAction(quote: DbQuote) {
  if (quote.status === "draft") return "Revisar itens, confirmar condicao comercial e enviar para o cliente.";
  if (quote.status === "sent") return "Fazer follow-up e converter o orcamento aprovado em pedido.";
  return "Validar pendencia comercial e atualizar o status.";
}

function getLeadAction(lead: DbLead) {
  if (lead.stage === "new") return "Assumir contato inicial e registrar proxima etapa.";
  if (lead.stage === "contacted") return "Qualificar necessidade, produto de interesse e prazo de compra.";
  if (lead.stage === "qualified") return "Montar venda assistida ou orcamento vinculado.";
  return "Revisar lead antes de arquivar ou converter.";
}

function getOrderAction(order: DbOrder) {
  if (order.payment_status === "pending" || order.status === "awaiting_payment") return "Confirmar pagamento ou enviar link de pagamento ao cliente.";
  if (order.status === "draft") return "Concluir dados de entrega e forma de pagamento para liberar o pedido.";
  if (order.status === "payment_approved" || order.status === "confirmed") return "Liberar separacao conforme regra operacional.";
  return "Acompanhar status e registrar observacao interna se houver excecao.";
}

function daysSince(dateIso: string) {
  const time = new Date(dateIso).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function sellerKey(name: string | null | undefined) {
  return name?.trim() || "Sem vendedor";
}

function sortByUpdatedAtDesc<T extends { updated_at: string }>(items: T[]) {
  return [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getCommercialErpCockpit(db: DatabaseShape) {
  const commercialOrders = db.orders.filter(isCommercialOrder);
  const openLeads = db.leads.filter(isOpenLead);
  const openQuotes = db.quotes.filter(isOpenQuote);
  const awaitingPaymentOrders = commercialOrders.filter(
    (order) => order.payment_status === "pending" || order.status === "awaiting_payment" || order.status === "draft",
  );
  const activeCustomers = new Set(
    db.orders
      .filter((order) => order.customer_email)
      .map((order) => String(order.customer_email).trim().toLowerCase()),
  );

  const sellerMap = new Map<string, { seller_name: string; orders: number; quotes: number; leads: number; revenue: number; awaiting_payment: number }>();
  const ensureSeller = (name: string | null | undefined) => {
    const key = sellerKey(name);
    const current = sellerMap.get(key);
    if (current) return current;
    const created = { seller_name: key, orders: 0, quotes: 0, leads: 0, revenue: 0, awaiting_payment: 0 };
    sellerMap.set(key, created);
    return created;
  };

  commercialOrders.forEach((order) => {
    const seller = ensureSeller(order.seller_name);
    seller.orders += 1;
    seller.revenue += Number(order.total || 0);
    if (order.payment_status === "pending" || order.status === "awaiting_payment") seller.awaiting_payment += 1;
  });
  db.quotes.forEach((quote) => {
    ensureSeller(quote.seller_name).quotes += 1;
  });
  db.leads.forEach((lead) => {
    ensureSeller(lead.responsible_name).leads += 1;
  });

  const queues: CommercialQueueItem[] = [
    ...sortByUpdatedAtDesc(openLeads).slice(0, 12).map((lead) => ({
      id: lead.id,
      type: "lead" as const,
      label: `Lead ${lead.stage}`,
      customer_name: lead.name,
      responsible_name: lead.responsible_name,
      status: lead.stage,
      value: null,
      updated_at: lead.updated_at,
      recommended_action: getLeadAction(lead),
      href: "/admin/clientes-suporte",
    })),
    ...sortByUpdatedAtDesc(openQuotes).slice(0, 12).map((quote) => ({
      id: quote.id,
      type: "quote" as const,
      label: `Orcamento ${quote.quote_number}`,
      customer_name: quote.customer_name,
      responsible_name: quote.seller_name,
      status: quote.status,
      value: Number(quote.total || 0),
      updated_at: quote.updated_at,
      recommended_action: getQuoteAction(quote),
      href: "/admin/operacao",
    })),
    ...sortByUpdatedAtDesc(awaitingPaymentOrders).slice(0, 12).map((order) => ({
      id: order.id,
      type: "order" as const,
      label: `Pedido ${order.order_number}`,
      customer_name: order.customer_name,
      responsible_name: order.seller_name,
      status: `${order.status}/${order.payment_status}`,
      value: Number(order.total || 0),
      updated_at: order.updated_at,
      recommended_action: getOrderAction(order),
      href: `/admin/pedido/${order.id}`,
    })),
  ].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 18);

  const staleItems = queues.filter((item) => daysSince(item.updated_at) >= 2);
  const assistedStarted = db.auditLogs.filter((entry) => entry.event_type === "assisted_sale.started").length;
  const assistedCreated = commercialOrders.filter((order) => order.assisted_sale || order.order_type === "assisted").length;
  const revenue = commercialOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  return {
    generated_at: new Date().toISOString(),
    role_model: {
      supported_roles: ["admin_master", "gerente_ecommerce", "gestor_comercial", "vendedor", "consultor", "atendimento_suporte", "caixa_financeiro"],
      sale_authorization: "Venda interna exige usuario autenticado, permissao operacional e auditoria por evento.",
      ai_policy: "IA pode sugerir abordagem, resumo e produtos; nao aprova desconto, fiscal, pagamento ou liberacao de pedido.",
    },
    metrics: {
      assisted_started: assistedStarted,
      assisted_orders: assistedCreated,
      assisted_conversion_rate: assistedStarted > 0 ? Math.round((assistedCreated / assistedStarted) * 1000) / 10 : 0,
      commercial_orders: commercialOrders.length,
      commercial_revenue: revenue,
      average_ticket: commercialOrders.length > 0 ? Math.round((revenue / commercialOrders.length) * 100) / 100 : 0,
      open_leads: openLeads.length,
      open_quotes: openQuotes.length,
      awaiting_payment_orders: awaitingPaymentOrders.length,
      active_customers: activeCustomers.size,
      stale_queue_items: staleItems.length,
      sellers: db.sellers.length,
    },
    queues: {
      action_required: queues,
      stale_items: staleItems.slice(0, 10),
      leads: sortByUpdatedAtDesc(openLeads).slice(0, 10),
      quotes: sortByUpdatedAtDesc(openQuotes).slice(0, 10),
      awaiting_payment_orders: sortByUpdatedAtDesc(awaitingPaymentOrders).slice(0, 10),
    },
    seller_performance: [...sellerMap.values()]
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || b.quotes - a.quotes)
      .slice(0, 12),
    controls: [
      {
        key: "assisted_sale",
        status: "implemented",
        label: "Venda assistida",
        href: "/admin/venda-assistida",
        required_access: "orders.limited",
      },
      {
        key: "quotes",
        status: "implemented",
        label: "Orcamentos com conversao em pedido",
        href: "/admin/operacao",
        required_access: "orders.limited",
      },
      {
        key: "crm",
        status: "implemented",
        label: "CRM operacional de clientes, leads e suporte",
        href: "/admin/clientes-suporte",
        required_access: "customers.view",
      },
      {
        key: "approval_engine",
        status: "next",
        label: "Motor formal de aprovacao para desconto, margem baixa e venda sem estoque",
        href: "/admin/governanca",
        required_access: "orders.full",
      },
    ],
    next_steps: [
      "Usar /admin/venda-assistida para vendas internas com vendedor identificado.",
      "Priorizar a fila action_required antes de abrir trafego novo.",
      "Manter descontos, fiscal e pagamentos sob permissao e auditoria.",
      "Implementar motor formal de aprovacao para excecoes comerciais antes de producao aberta.",
    ],
  };
}
