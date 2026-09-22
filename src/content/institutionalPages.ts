import { STORE_INFO } from "@/constants/store";

type InstitutionalSlug =
  | "quem_somos"
  | "atendimento"
  | "rastreio"
  | "politica_entrega"
  | "politica_troca_devolucao"
  | "politica_privacidade"
  | "termos_uso";

const updatedAt = "2026-08-27";

const companyBlock = [
  `Fornecedor: ${STORE_INFO.company.legalName}`,
  `Nome fantasia: ${STORE_INFO.company.tradeName}`,
  `CNPJ: ${STORE_INFO.company.cnpj}`,
  `Inscricao estadual: ${STORE_INFO.company.stateRegistration}`,
  `Endereço: ${STORE_INFO.address.full}`,
  `E-mail: ${STORE_INFO.email}`,
  `Telefone: ${STORE_INFO.phone}`,
  `WhatsApp: ${STORE_INFO.whatsappDisplay}`,
].join("\n");

export const INSTITUTIONAL_PAGE_CONTENT: Record<InstitutionalSlug, { title: string; content: string; updatedAt: string }> = {
  quem_somos: {
    title: "Sobre a GAMEL",
    updatedAt,
    content: [
      "SOLUÇÕES QUE CONSTROEM O AMANHÃ",
      "",
      "Da matéria-prima às grandes possibilidades, a GAMEL atua ao lado de quem projeta, revende e transforma ambientes.",
      "",
      "Conectamos portfólio, apresentação e parceria comercial para gerar mais valor ao mercado.",
      "",
      "PROPÓSITO",
      "Inspiração para ambientes que fazem mais sentido.",
      "Acreditamos que os espaços têm o poder de melhorar a vida das pessoas. Por isso, levamos ao mercado soluções que unem estética, funcionalidade e bem-estar, contribuindo para ambientes mais modernos, acolhedores e duradouros.",
      "",
      "MISSÃO",
      "Fornecer revestimentos e soluções de acabamento com qualidade, variedade e atendimento especializado, gerando valor para nossos parceiros e para o mercado.",
      "",
      "VISÃO",
      "Ser reconhecida nacionalmente como a principal referência em importação, atacado e distribuição de revestimentos, pela solidez, inovação e parceria com nossos clientes.",
      "",
      "VALORES",
      "- Ética e transparência",
      "- Foco no cliente",
      "- Qualidade em tudo o que fazemos",
      "- Inovação constante",
      "- Parceria que gera resultados",
      "- Compromisso com um futuro melhor",
      "",
      companyBlock,
      "",
      `Horario de atendimento: ${STORE_INFO.hours.display}.`,
    ].join("\n"),
  },
  atendimento: {
    title: "Atendimento",
    updatedAt,
    content: [
      "Canais oficiais de atendimento:",
      `- WhatsApp: ${STORE_INFO.whatsappDisplay}`,
      `- Telefone: ${STORE_INFO.phone}`,
      `- E-mail: ${STORE_INFO.email}`,
      `- Endereço: ${STORE_INFO.address.full}`,
      "",
      "O atendimento cobre dúvidas sobre produtos, categorias, aplicações, medidas, disponibilidade sob consulta e solicitações de orçamento.",
    ].join("\n"),
  },
  rastreio: {
    title: "Rastreio indisponivel na Fase 1",
    updatedAt,
    content: "O rastreio automatico pertence a uma fase futura de e-commerce. Na Fase 1, acompanhe sua solicitação diretamente com a equipe comercial.",
  },
  politica_entrega: {
    title: "Política comercial e logistica",
    updatedAt,
    content: [
      "Na Fase 1, entrega, retirada, disponibilidade e prazo são confirmados pela equipe comercial antes de qualquer compromisso.",
      "",
      "Retirada em loja, entrega local, entrega regional e eventual envio por transportadora dependem de confirmação humana sobre produto, volume, peso, endereço, rota, embalagem e janela operacional.",
      "",
      "O site não calcula frete automaticamente e não conclui pedido online. Produtos sob consulta, volumosos, pesados, fracionados, por medida ou com corte podem exigir validação manual antes de qualquer separacao.",
      "",
      "Quando houver proposta comercial, as condições de entrega devem ser registradas pela equipe: modalidade, endereço, responsável pelo recebimento, custo de frete quando aplicavel, prazo estimado e observacoes de acesso.",
      "",
      "O prazo informado ao cliente passa a contar somente após confirmação comercial, disponibilidade do produto e liberacao operacional. Ausencia do recebedor, endereço incompleto, restricao de acesso, clima, indisponibilidade de transportadora ou forca maior podem exigir reagendamento.",
    ].join("\n"),
  },
  politica_troca_devolucao: {
    title: "Trocas e devolucoes",
    updatedAt,
    content: [
      "Trocas, devolucoes e garantias devem ser tratadas pelos canais oficiais, considerando nota, pedido, condição do produto, instalacao e regras legais aplicaveis.",
      "",
      "Em compras realizadas fora do estabelecimento comercial, o consumidor pode exercer arrependimento em até 7 dias corridos contados do recebimento, conforme o Codigo de Defesa do Consumidor. A solicitação deve ser feita pelo atendimento oficial para orientação de devolucao.",
      "",
      "A garantia legal para produtos duraveis considera prazo de 90 dias para vicios aparentes ou de facil constatacao, observadas as condições de uso, armazenamento, instalacao, corte, medida e conservacao.",
      "",
      "Produtos cortados, instalados, usados, sob medida, avariados por manuseio inadequado ou com divergencia de aplicação podem exigir análise técnica antes de troca, reembolso ou nova proposta comercial.",
      "",
      "Quando houver erro operacional comprovado, produto divergente ou avaria atribuida ao transporte, a tratativa será priorizada pelo atendimento. Fotos, descrição do problema, documento fiscal ou referencia comercial podem ser solicitados.",
    ].join("\n"),
  },
  politica_privacidade: {
    title: "Política de privacidade",
    updatedAt,
    content: [
      "Esta Política de Privacidade segue a LGPD e explica como a GAMEL trata dados pessoais enviados em formulários de contato e solicitação para atendimento comercial, resposta ao cliente, segurança e cumprimento de obrigações legais.",
      "",
      "Podem ser coletados nome, telefone, e-mail, cidade, produto de interesse, mensagem, página de origem, UTM, IP e informações técnicas do navegador.",
      "",
      "As finalidades incluem responder solicitações, organizar leads, acionar a equipe comercial, medir conversão, prevenir abuso, cumprir obrigações legais e melhorar a experiência do catálogo digital.",
      "",
      "Direitos do titular: confirmação de tratamento, acesso, correcao, anonimizacao, bloqueio, eliminacao quando cabivel, portabilidade quando regulamentada, informação sobre compartilhamento e revisão de decisoes automatizadas quando aplicavel.",
      "",
      "Dados podem ser compartilhados com provedores técnicos, hospedagem, atendimento, analytics, contabilidade, autoridades publicas quando exigido e parceiros estritamente necessarios para operar o canal digital.",
      "",
      `Canal de privacidade: ${STORE_INFO.email}.`,
    ].join("\n"),
  },
  termos_uso: {
    title: "Termos de uso",
    updatedAt,
    content: [
      "Ao usar o site, o visitante reconhece que o canal digital da Fase 1 e institucional, com catálogo e formulario de orçamento.",
      "",
      "Nenhuma informação publicada deve ser interpretada como confirmação automatica de preço, estoque, prazo, frete, pagamento ou pedido.",
      "",
      "As condições da oferta, quando existirem, dependem de confirmação comercial da equipe GAMEL, incluindo produto, quantidade, unidade, disponibilidade, validade da proposta, modalidade de entrega, frete, forma de pagamento e dados cadastrais.",
      "",
      "O visitante deve fornecer informações verdadeiras e atualizadas. Solicitações com dados inconsistentes, uso indevido, automação abusiva, tentativa de acesso não autorizado ou violacao de segurança podem ser recusadas e registradas para auditoria.",
      "",
      "Imagens e descrições do catálogo podem servir como referencia comercial. A equipe deve confirmar medidas, aplicação, acabamento, cor, modelo e compatibilidade antes de qualquer fechamento.",
      "",
      companyBlock,
    ].join("\n"),
  },
};

export const placeholderInstitutionalContent = new Set([
  "Regras comerciais e logisticas da Fase 1.",
  "Processo de trocas e devolucoes.",
  "Tratamento de dados e privacidade.",
  "Termos gerais do canal digital GAMEL.",
]);

export function isPlaceholderInstitutionalContent(content?: string | null) {
  if (!content) return true;
  return placeholderInstitutionalContent.has(content.trim());
}
