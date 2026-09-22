import { Layout } from "@/components/layout/Layout";
import { STORE_INFO } from "@/constants/store";

type Section = {
  title: string;
  paragraphs?: string[];
  list?: string[];
};

const LAST_UPDATED = "4 de setembro de 2026";

const privacySections: Section[] = [
  {
    title: "1. Quem é o responsável pelos dados",
    paragraphs: [
      "Para os tratamentos descritos nesta Política, a controladora dos dados pessoais é:",
      `${STORE_INFO.company.legalName} — CNPJ: ${STORE_INFO.company.cnpj}`,
      STORE_INFO.address.full,
      `E-mail: ${STORE_INFO.email} · WhatsApp: ${STORE_INFO.whatsappDisplay}`,
    ],
  },
  {
    title: "2. Quais dados podemos coletar",
    paragraphs: ["Dependendo da sua interação com o site, podemos tratar informações como:"],
    list: [
      "nome",
      "telefone e WhatsApp",
      "e-mail, quando informado",
      "cidade e Estado",
      "produtos e categorias de interesse",
      "quantidades informadas",
      "informações enviadas em formulários ou mensagens",
      "dados relacionados à solicitação de orçamento",
      "endereço IP",
      "navegador e tipo de dispositivo",
      "páginas acessadas",
      "data e horário de acesso",
      "origem do acesso e parâmetros de campanha",
      "informações técnicas necessárias à segurança e ao funcionamento do site",
    ],
  },
  {
    title: "",
    paragraphs: [
      "Solicitamos que não sejam enviados dados pessoais sensíveis em campos de mensagem quando eles não forem necessários para o atendimento.",
    ],
  },
  {
    title: "3. Para que utilizamos seus dados",
    paragraphs: ["Os dados poderão ser utilizados para:"],
    list: [
      "responder solicitações de orçamento",
      "entrar em contato com o interessado",
      "prestar atendimento comercial",
      "identificar produtos e necessidades informadas pelo cliente",
      "organizar e acompanhar solicitações e oportunidades comerciais",
      "manter registros necessários do atendimento",
      "melhorar o funcionamento e a experiência do site",
      "gerar métricas de utilização, quando aplicável",
      "prevenir abusos, fraudes e incidentes de segurança",
      "cumprir obrigações legais ou regulatórias",
      "exercer ou defender direitos da GAMEL",
    ],
  },
  {
    title: "4. Bases legais",
    paragraphs: [
      "O tratamento será realizado de acordo com as hipóteses previstas na LGPD.",
      "Conforme a situação, poderão ser utilizadas bases legais como:",
    ],
    list: [
      "execução de contrato ou procedimentos preliminares relacionados a contrato, quando o próprio titular solicitar orçamento ou atendimento",
      "cumprimento de obrigação legal ou regulatória",
      "exercício regular de direitos",
      "legítimo interesse, quando aplicável e respeitados os direitos e expectativas do titular",
      "consentimento, quando a legislação exigir uma manifestação específica do usuário",
    ],
  },
  {
    title: "",
    paragraphs: ["O consentimento não será utilizado de forma genérica para justificar todo o tratamento realizado pelo site."],
  },
  {
    title: "5. Solicitações de orçamento",
    paragraphs: [
      "Os dados fornecidos em uma solicitação de orçamento serão utilizados para que a GAMEL possa analisar o interesse apresentado e dar continuidade ao atendimento comercial.",
      "O envio do formulário não representa automaticamente a conclusão de uma compra ou a formalização de um pedido.",
    ],
  },
  {
    title: "6. WhatsApp",
    paragraphs: [
      "O site poderá direcionar o usuário ao WhatsApp para continuidade do atendimento.",
      "Informações relacionadas ao produto ou à solicitação poderão ser incluídas na mensagem para facilitar a identificação do atendimento.",
      "Ao acessar o WhatsApp, o usuário também estará sujeito aos termos e políticas da própria plataforma.",
    ],
  },
  {
    title: "7. Compartilhamento de dados",
    paragraphs: ["A GAMEL poderá utilizar fornecedores e prestadores de serviços necessários para a operação do site e do atendimento, incluindo serviços de:"],
    list: ["hospedagem", "armazenamento", "infraestrutura", "comunicação", "e-mail", "análise de métricas", "suporte e manutenção", "segurança da informação"],
  },
  {
    title: "",
    paragraphs: [
      "O compartilhamento deverá ser limitado aos dados necessários para a finalidade correspondente.",
      "Dados também poderão ser compartilhados quando houver obrigação legal, ordem judicial, determinação de autoridade competente ou necessidade de exercício regular de direitos.",
    ],
  },
  {
    title: "8. Transferência internacional",
    paragraphs: [
      "Alguns fornecedores de tecnologia poderão utilizar infraestrutura localizada fora do Brasil.",
      "Quando houver transferência internacional de dados pessoais, deverão ser observados os requisitos da LGPD e da regulamentação aplicável da Autoridade Nacional de Proteção de Dados.",
    ],
  },
  {
    title: "9. Cookies e tecnologias semelhantes",
    paragraphs: [
      "O site poderá utilizar cookies necessários para funcionamento, segurança e estabilidade.",
      "Também poderão ser utilizados cookies ou tecnologias de análise para compreender a utilização do site e melhorar a experiência dos usuários.",
      "Quando determinada tecnologia depender de consentimento, ela deverá permanecer desativada até a manifestação do usuário.",
      "O visitante poderá rejeitar cookies não necessários e gerenciar suas preferências.",
      "A ANPD recomenda que cookies opcionais não sejam ativados por padrão e que existam opções claras para aceitar, rejeitar e gerenciar essas tecnologias.",
    ],
  },
  {
    title: "10. Por quanto tempo os dados são mantidos",
    paragraphs: [
      "Os dados pessoais serão mantidos somente pelo período necessário para atender às finalidades que justificaram sua coleta, cumprir obrigações legais, manter registros necessários ou exercer direitos.",
      "Quando não houver mais fundamento para a conservação, os dados poderão ser eliminados ou anonimizados, conforme aplicável.",
    ],
  },
  {
    title: "11. Segurança",
    paragraphs: ["A GAMEL adota medidas administrativas e técnicas adequadas para reduzir riscos de:"],
    list: ["acesso não autorizado", "alteração", "perda", "divulgação indevida", "destruição", "tratamento inadequado ou ilícito de dados pessoais"],
  },
  {
    title: "",
    paragraphs: ["Nenhum ambiente conectado à internet, entretanto, pode garantir segurança absoluta."],
  },
  {
    title: "12. Seus direitos",
    paragraphs: ["Nos termos da LGPD, o titular poderá, conforme aplicável:"],
    list: [
      "confirmar a existência de tratamento",
      "acessar seus dados",
      "solicitar correção de informações",
      "solicitar anonimização, bloqueio ou eliminação nos casos previstos em lei",
      "solicitar informações sobre compartilhamento",
      "solicitar portabilidade quando aplicável",
      "revogar consentimento",
      "solicitar eliminação de dados tratados com consentimento, quando cabível",
      "opor-se a tratamentos realizados em desconformidade com a legislação",
      "exercer os demais direitos previstos na LGPD",
    ],
  },
  {
    title: "",
    paragraphs: [
      "A ANPD também reconhece expressamente os direitos à informação, confirmação, acesso e correção, entre outros.",
      "Para proteger o próprio titular, a GAMEL poderá solicitar informações necessárias para confirmar a identidade de quem realizou a solicitação.",
    ],
  },
  {
    title: "13. Como exercer seus direitos",
    paragraphs: [
      "Solicitações relacionadas à privacidade e aos dados pessoais podem ser encaminhadas para:",
      `E-mail: ${STORE_INFO.email} · WhatsApp: ${STORE_INFO.whatsappDisplay}`,
    ],
  },
  {
    title: "14. Alterações desta Política",
    paragraphs: [
      "Esta Política poderá ser atualizada quando houver alterações nas funcionalidades do site, nas operações de tratamento de dados ou na legislação aplicável.",
      "A versão vigente estará sempre disponível nesta página, acompanhada da data da última atualização.",
    ],
  },
];

const termsSections: Section[] = [
  {
    title: "1. Finalidade do site",
    paragraphs: [`O site possui finalidade institucional e comercial e permite ao usuário:`],
    list: [
      "conhecer a GAMEL",
      "consultar produtos e categorias",
      "acessar informações do catálogo",
      "selecionar produtos de interesse",
      "solicitar orçamento",
      "entrar em contato com a equipe comercial",
      "iniciar atendimento por WhatsApp",
    ],
  },
  {
    title: "2. Orçamentos",
    paragraphs: ["O envio de uma solicitação de orçamento representa uma manifestação de interesse e não significa automaticamente:"],
    list: ["confirmação de compra", "reserva de produto ou estoque", "confirmação de preço", "pedido de venda", "contrato concluído", "obrigação de entrega"],
  },
  {
    title: "",
    paragraphs: [
      "A equipe comercial poderá entrar em contato para confirmar produtos, quantidades, disponibilidade, medidas, condições comerciais, prazos, frete e demais informações necessárias.",
      "As condições definitivas serão aquelas formalizadas posteriormente entre as partes.",
    ],
  },
  {
    title: "3. Informações dos produtos",
    paragraphs: [
      "A GAMEL busca manter as informações apresentadas no catálogo corretas e atualizadas.",
      "Determinadas características poderão precisar de confirmação comercial, especialmente:",
    ],
    list: ["dimensões", "acabamentos", "cores", "variações", "disponibilidade", "aplicações", "especificações"],
  },
  {
    title: "",
    paragraphs: ["Imagens podem apresentar diferenças de tonalidade ou aparência em razão de fotografia, iluminação, tela utilizada ou ambiente de visualização."],
  },
  {
    title: "4. Preços e condições comerciais",
    paragraphs: [
      "Salvo quando expressamente informado de outra forma, o site não conclui automaticamente vendas ou pagamentos.",
      "Preços, disponibilidade, frete, descontos, formas de pagamento, prazos e demais condições deverão ser confirmados com a equipe comercial.",
    ],
  },
  {
    title: "5. Uso adequado",
    paragraphs: ["O usuário não deverá utilizar o site para:"],
    list: [
      "atividades ilícitas",
      "tentativa de acesso não autorizado",
      "exploração de vulnerabilidades",
      "interferência proposital no funcionamento da plataforma",
      "envio de código malicioso",
      "automações abusivas",
      "fraude",
      "violação de direitos da GAMEL ou de terceiros",
    ],
  },
  {
    title: "6. Propriedade intelectual",
    paragraphs: [
      "Marcas, logotipos, textos, fotografias, imagens, catálogo, identidade visual e demais conteúdos disponibilizados no site são protegidos pela legislação aplicável e pertencem aos seus respectivos titulares.",
      "A disponibilização no site não autoriza reprodução, distribuição ou utilização comercial sem autorização quando esta for necessária.",
    ],
  },
  {
    title: "7. Serviços de terceiros",
    paragraphs: [
      "O site poderá conter integrações ou links para serviços de terceiros, como WhatsApp e serviços de mapas.",
      "Essas plataformas possuem suas próprias regras, termos e políticas de privacidade.",
    ],
  },
  {
    title: "8. Disponibilidade",
    paragraphs: [
      "A GAMEL poderá realizar atualizações, manutenções ou alterações no site.",
      "Eventuais indisponibilidades podem ocorrer em razão de manutenção, falhas técnicas, serviços de terceiros ou situações fora do controle razoável da empresa.",
    ],
  },
  {
    title: "9. Privacidade",
    paragraphs: ["O tratamento de dados pessoais relacionado à utilização do site é regido pela Política de Privacidade da GAMEL."],
  },
  {
    title: "10. Alterações destes Termos",
    paragraphs: [
      "Estes Termos poderão ser atualizados para refletir mudanças no site, nos serviços oferecidos ou na legislação.",
      "A versão vigente será disponibilizada nesta página com a respectiva data de atualização.",
    ],
  },
  {
    title: "11. Legislação aplicável",
    paragraphs: ["Estes Termos são regidos pela legislação brasileira, sem prejuízo dos direitos garantidos pela legislação de proteção ao consumidor quando aplicável."],
  },
  {
    title: "12. Contato",
    paragraphs: [
      `${STORE_INFO.company.legalName} — CNPJ: ${STORE_INFO.company.cnpj}`,
      `E-mail: ${STORE_INFO.email} · WhatsApp: ${STORE_INFO.whatsappDisplay}`,
    ],
  },
];

function SectionBlock({ section }: { section: Section }) {
  return (
    <article className={section.title ? "rounded-lg border border-border/80 bg-white p-5 shadow-sm" : "px-1"}>
      {section.title ? <h3 className="font-display text-2xl">{section.title}</h3> : null}
      {section.paragraphs?.map((paragraph, index) => (
        <p key={index} className={`text-sm leading-7 text-muted-foreground ${section.title || index > 0 ? "mt-2" : ""}`}>
          {paragraph}
        </p>
      ))}
      {section.list ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-7 text-muted-foreground">
          {section.list.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function Policies() {
  return (
    <Layout>
      <main className="shell-reading py-12">
        <section className="rounded-lg bg-[#050505] p-6 text-white md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6417]">LGPD e termos</p>
          <h1 className="mt-3 font-display text-5xl">Política de privacidade e Termos de uso</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/68">
            A {STORE_INFO.company.legalName}, inscrita no CNPJ nº {STORE_INFO.company.cnpj}, respeita a sua privacidade e está comprometida com a proteção
            dos dados pessoais tratados por meio do site {STORE_INFO.domain}.
          </p>
        </section>

        <section id="privacidade" className="mt-10">
          <h2 className="font-display text-4xl">Política de Privacidade</h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Esta Política explica quais dados podem ser coletados, por que são utilizados, com quem podem ser compartilhados e quais são os seus direitos
            nos termos da Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD).
          </p>
          <div className="mt-4 grid gap-4">
            {privacySections.map((section, index) => (
              <SectionBlock key={`${section.title}-${index}`} section={section} />
            ))}
          </div>
        </section>

        <section id="termos" className="mt-10">
          <h2 className="font-display text-4xl">Termos de Uso</h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Última atualização: {LAST_UPDATED}</p>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            Estes Termos estabelecem as condições de utilização do site {STORE_INFO.domain}, mantido pela {STORE_INFO.company.legalName} — {STORE_INFO.name}.
          </p>
          <div className="mt-4 grid gap-4">
            {termsSections.map((section, index) => (
              <SectionBlock key={`${section.title}-${index}`} section={section} />
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-5">
          <h2 className="font-display text-3xl">Contato de privacidade</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Canal comercial e privacidade: {STORE_INFO.email}, WhatsApp {STORE_INFO.whatsappDisplay}, telefones {STORE_INFO.phone}. Razão social: {STORE_INFO.company.legalName}, CNPJ {STORE_INFO.company.cnpj}, endereço {STORE_INFO.address.full}.
          </p>
        </section>
      </main>
    </Layout>
  );
}
