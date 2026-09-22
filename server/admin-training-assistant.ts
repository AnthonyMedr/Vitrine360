export type AssistedTrainingStepStatus = "ready" | "requires_real_execution" | "external_blocked";

export type AssistedTrainingStep = {
  id: string;
  title: string;
  role: string;
  status: AssistedTrainingStepStatus;
  objective: string;
  admin_route: string;
  expected_evidence: string[];
  blocker: string | null;
};

export type AssistedTrainingPlan = {
  generated_at: string;
  ok: boolean;
  production_open: "BLOQUEADO_EXTERNO";
  training_operation_ready: "PLANEJADO";
  training_executed: false;
  steps_total: number;
  ready_steps: number;
  real_execution_pending: number;
  steps: AssistedTrainingStep[];
  next_steps: string[];
};

const steps: AssistedTrainingStep[] = [
  {
    id: "orders-spool",
    title: "Operar fila de pedidos pagos",
    role: "Operacao",
    status: "requires_real_execution",
    objective: "Treinar leitura de SLA, responsavel, travamento e proxima acao do pedido.",
    admin_route: "/admin/pedidos",
    expected_evidence: ["print_fila_pedidos", "pedido_teste_identificado", "responsavel_registrado"],
    blocker: "treinamento_real_ainda_nao_executado",
  },
  {
    id: "wms-picking",
    title: "Executar separacao WMS",
    role: "Expedicao",
    status: "requires_real_execution",
    objective: "Treinar criacao, inicio, conferencia e conclusao de tarefa de picking.",
    admin_route: "/admin/wms",
    expected_evidence: ["tarefa_picking_criada", "item_conferido", "fila_wms_atualizada"],
    blocker: "treinamento_real_ainda_nao_executado",
  },
  {
    id: "fiscal-minimal",
    title: "Identificar bloqueio fiscal minimo",
    role: "Fiscal / Contador",
    status: "external_blocked",
    objective: "Treinar decisao de nao inferir NCM/tax_code e manter close pack com contador.",
    admin_route: "/admin/fiscal-financeiro",
    expected_evidence: ["perfil_fiscal_pendente", "campos_ausentes", "encaminhamento_contador"],
    blocker: "fiscal_minimo_contador",
  },
  {
    id: "integrations-gates",
    title: "Reconhecer gates de providers",
    role: "Admin Master",
    status: "external_blocked",
    objective: "Treinar leitura de Mercado Pago, webhook e frete real sem promover provider fake.",
    admin_route: "/admin/integracoes",
    expected_evidence: ["provider_pendente", "bloqueio_externo_visivel", "sem_ativacao_produtiva"],
    blocker: "integracoes_reais_pendentes",
  },
  {
    id: "governance-decision",
    title: "Fechar decisao de rotina",
    role: "Gestao",
    status: "requires_real_execution",
    objective: "Treinar leitura da matriz de gates, auditoria e handoff antes de qualquer decisao.",
    admin_route: "/admin/governanca",
    expected_evidence: ["matriz_gates_revisada", "auditoria_consultada", "decisao_registrada"],
    blocker: "evidencias_de_participantes_pendentes",
  },
];

export function buildAssistedTrainingPlan(): AssistedTrainingPlan {
  const readySteps = steps.filter((step) => step.status === "ready").length;
  const realExecutionPending = steps.filter((step) => step.status === "requires_real_execution").length;

  return {
    generated_at: new Date().toISOString(),
    ok: steps.length > 0,
    production_open: "BLOQUEADO_EXTERNO",
    training_operation_ready: "PLANEJADO",
    training_executed: false,
    steps_total: steps.length,
    ready_steps: readySteps,
    real_execution_pending: realExecutionPending,
    steps,
    next_steps: [
      "Executar os passos no Admin com equipe real e evidencia por participante.",
      "Registrar prints, responsavel, data e observacao no pacote de evidencias.",
      "Manter fiscal, pagamento e frete como bloqueios externos ate validacao real.",
      "Nao marcar treinamento como concluido sem participantes e evidencias revisaveis.",
    ],
  };
}
