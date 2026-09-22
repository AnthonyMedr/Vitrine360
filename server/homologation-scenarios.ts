import type { DatabaseShape, DbProduct } from "./db";
import { getAdminFiscalReadiness } from "./read-models";

export type HomologationScenarioStatus = "ready" | "blocked";

export type HomologationScenario = {
  id: string;
  title: string;
  domain: "payment" | "freight" | "inventory" | "orders" | "fiscal";
  status: HomologationScenarioStatus;
  production_gate: "unchanged";
  objective: string;
  preconditions: string[];
  steps: string[];
  expected_result: string;
  blockers: string[];
  evidence: string[];
};

export type HomologationScenarioReport = {
  generated_at: string;
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  mode: "dry_run_training";
  scenarios_ready: number;
  scenarios_blocked: number;
  scenarios: HomologationScenario[];
  next_steps: string[];
};

function isActiveSellableProduct(product: DbProduct) {
  return Boolean(
    product.is_active
      && product.status_product !== "inactive"
      && Number(product.price ?? 0) > 0
      && Number(product.stock ?? 0) > 0,
  );
}

function hasAnyFreightShape(db: DatabaseShape) {
  return db.products.some((product) => product.is_active && (Number(product.weight ?? 0) > 0 || Number(product.weight_per_unit ?? 0) > 0));
}

function statusFromBlockers(blockers: string[]): HomologationScenarioStatus {
  return blockers.length === 0 ? "ready" : "blocked";
}

export function buildHomologationScenarioReport(db: DatabaseShape): HomologationScenarioReport {
  const activeProduct = db.products.find(isActiveSellableProduct);
  const freightShapeExists = hasAnyFreightShape(db);
  const fiscalMinimal = getAdminFiscalReadiness(db, { scope: "minimal-go-live" });

  const paymentBaseBlockers = [
    ...(activeProduct ? [] : ["produto_ativo_com_preco_e_estoque_ausente"]),
  ];

  const scenarios: HomologationScenario[] = [
    {
      id: "payment-approved",
      title: "Pagamento manual aprovado",
      domain: "payment",
      status: statusFromBlockers(paymentBaseBlockers),
      production_gate: "unchanged",
      objective: "Treinar a passagem de pedido aguardando pagamento para pedido pago e pronto para acao operacional.",
      preconditions: [
        "Produto ativo com preco e estoque.",
        "Usuario financeiro/admin autenticado.",
        "Pagamento real continua em modo manual ate Mercado Pago ser homologado.",
      ],
      steps: [
        "Criar pedido de retirada ou entrega local com produto ativo.",
        "Iniciar pagamento pelo fluxo do pedido.",
        "No Admin, aprovar pagamento manual com referencia de homologacao.",
        "Conferir status payment_approved e fila operacional seguinte.",
      ],
      expected_result: "Pedido muda para payment_approved, pagamento fica approved e trilha de auditoria registra a acao humana.",
      blockers: paymentBaseBlockers,
      evidence: ["Print do pedido antes/depois", "Referencia manual usada", "Registro de auditoria"],
    },
    {
      id: "payment-rejected",
      title: "Pagamento recusado/cancelado",
      domain: "payment",
      status: statusFromBlockers(paymentBaseBlockers),
      production_gate: "unchanged",
      objective: "Treinar recusa sem liberar separacao, fiscal ou entrega.",
      preconditions: [
        "Produto ativo com preco e estoque.",
        "Pedido em pagamento iniciado ou pendente.",
      ],
      steps: [
        "Criar pedido de homologacao.",
        "Iniciar pagamento.",
        "Registrar recusa/cancelamento administrativo.",
        "Conferir que o pedido nao segue para separacao ou expedicao.",
      ],
      expected_result: "Pedido permanece fora da fila de separacao e atendimento consegue orientar o cliente.",
      blockers: paymentBaseBlockers,
      evidence: ["Status final do pedido", "Motivo de recusa", "Fila operacional sem liberacao indevida"],
    },
    {
      id: "freight-unavailable",
      title: "Frete externo indisponivel",
      domain: "freight",
      status: statusFromBlockers(freightShapeExists ? [] : ["produto_ativo_sem_peso_ou_dimensao_para_ensaio_logistico"]),
      production_gate: "unchanged",
      objective: "Treinar fallback para atendimento assistido quando provider real nao retorna cotacao.",
      preconditions: [
        "Produto ativo com peso ou dimensoes.",
        "CEP nacional fora da entrega local.",
        "Frete real ainda nao deve ser considerado homologado.",
      ],
      steps: [
        "Simular cotacao nacional com provider indisponivel.",
        "Confirmar mensagem de bloqueio/analise assistida.",
        "Registrar acao recomendada para atendimento.",
      ],
      expected_result: "Checkout nao promete prazo/preco falso e orienta atendimento assistido ou bloqueio controlado.",
      blockers: freightShapeExists ? [] : ["produto_ativo_sem_peso_ou_dimensao_para_ensaio_logistico"],
      evidence: ["CEP usado", "Resposta de cotacao", "Mensagem exibida ao operador/cliente"],
    },
    {
      id: "stock-shortage",
      title: "Ruptura de estoque",
      domain: "inventory",
      status: statusFromBlockers(activeProduct ? [] : ["produto_ativo_para_simular_ruptura_ausente"]),
      production_gate: "unchanged",
      objective: "Treinar bloqueio de pedido quando quantidade solicitada excede estoque disponivel.",
      preconditions: [
        "Produto ativo com estoque conhecido.",
        "Pedido de homologacao com quantidade maior que o estoque.",
      ],
      steps: [
        "Selecionar produto ativo.",
        "Solicitar quantidade acima do estoque.",
        "Conferir rejeicao ou envio para atendimento assistido.",
      ],
      expected_result: "Sistema impede promessa de entrega e preserva estoque operacional.",
      blockers: activeProduct ? [] : ["produto_ativo_para_simular_ruptura_ausente"],
      evidence: ["SKU usado", "Estoque original", "Quantidade solicitada", "Resposta do checkout"],
    },
    {
      id: "order-cancelled",
      title: "Cancelamento operacional",
      domain: "orders",
      status: statusFromBlockers(activeProduct ? [] : ["produto_ativo_para_criar_pedido_de_cancelamento_ausente"]),
      production_gate: "unchanged",
      objective: "Treinar cancelamento sem baixa indevida, expedicao ou promessa fiscal.",
      preconditions: [
        "Produto ativo para criar pedido de teste ou homologacao.",
        "Responsavel administrativo autenticado.",
      ],
      steps: [
        "Criar ou selecionar pedido ativo de homologacao.",
        "Registrar cancelamento com motivo operacional.",
        "Conferir fila, pagamento e atendimento apos cancelamento.",
      ],
      expected_result: "Pedido fica cancelled, operacao para o fluxo e atendimento possui motivo rastreavel.",
      blockers: activeProduct ? [] : ["produto_ativo_para_criar_pedido_de_cancelamento_ausente"],
      evidence: ["Pedido cancelado", "Motivo", "Auditoria", "Fila operacional atualizada"],
    },
    {
      id: "fiscal-blocked",
      title: "Bloqueio fiscal minimo",
      domain: "fiscal",
      status: statusFromBlockers(fiscalMinimal.metrics.pending_fiscal_profiles > 0 ? [] : ["sem_perfil_fiscal_pendente_para_ensaio_de_bloqueio"]),
      production_gate: "unchanged",
      objective: "Treinar a decisao correta quando SKU do mix minimo ainda nao tem NCM/tax_code do contador.",
      preconditions: [
        "Perfil fiscal pendente no mix minimo.",
        "Equipe fiscal/contador reconhece que dado nao pode ser inferido.",
      ],
      steps: [
        "Abrir fila fiscal minima.",
        "Selecionar perfil pendente.",
        "Conferir campos ausentes.",
        "Manter gate bloqueado ate close pack validado.",
      ],
      expected_result: "Produto permanece bloqueado para venda real e o pacote fiscal e enviado ao contador.",
      blockers: fiscalMinimal.metrics.pending_fiscal_profiles > 0 ? [] : ["sem_perfil_fiscal_pendente_para_ensaio_de_bloqueio"],
      evidence: ["Perfil fiscal", "Campos ausentes", "Close pack fiscal", "Responsavel contador"],
    },
  ];

  const scenariosReady = scenarios.filter((scenario) => scenario.status === "ready").length;
  const scenariosBlocked = scenarios.length - scenariosReady;

  return {
    generated_at: new Date().toISOString(),
    ok: scenariosBlocked === 0,
    production_open: "BLOQUEADO_EXTERNO",
    mode: "dry_run_training",
    scenarios_ready: scenariosReady,
    scenarios_blocked: scenariosBlocked,
    scenarios,
    next_steps: [
      "Executar os cenarios em ambiente local/homologacao com evidencias.",
      "Registrar prints, pedidos, motivos e responsaveis.",
      "Nao usar estes cenarios para liberar producao aberta.",
      "Reexecutar validate:continuity depois do ensaio operacional.",
    ],
  };
}
