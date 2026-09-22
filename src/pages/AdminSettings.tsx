import { AdminModuleWorkspace } from "@/components/admin/AdminModuleWorkspace";

export default function AdminSettings() {
  return (
    <AdminModuleWorkspace
      eyebrow="Governanca"
      title="Configurações"
      description="Central dedicada para ambiente, providers, parametros operacionais, segurança e preparacao de produção."
      statusLabel="configurações auditaveis"
      metrics={[
        { label: "Ambiente", value: "Local/staging", tone: "neutral" },
        { label: "Providers", value: "Revisar", tone: "warn" },
        { label: "Segurança", value: "Ativa", tone: "ok" },
        { label: "Produção", value: "Bloqueada", tone: "danger" },
      ]}
      primaryLinks={[
        { label: "Integrações", route: "/admin/integracoes" },
        { label: "Segurança", route: "/admin/seguranca" },
        { label: "Go-live", route: "/admin/go-live" },
      ]}
      sections={[
        {
          title: "Rotinas de configuração",
          description: "ambiente, providers e gates",
          items: [
            { title: "Revisar providers", description: "Pagamento, frete, email, storage, banco, Redis e metricas devem ter status claro.", route: "/admin/integracoes", owner: "TI", tone: "warn" },
            { title: "Conferir hardening", description: "Cookies, webhooks, RBAC e auditoria precisam estar coerentes com o ambiente.", route: "/admin/seguranca", owner: "TI", tone: "warn" },
            { title: "Validar go-live", description: "Configurar ambiente não libera produção sem terceiros reais e evidencias.", route: "/admin/go-live", owner: "Gestao", tone: "danger" },
            { title: "Documentar mudancas", description: "Toda alteracao operacional deve ter registro e caminho de reversao.", route: "/admin/documentacao", owner: "Governanca", tone: "ok" },
          ],
        },
      ]}
      docsPath="docs/ENVIRONMENT_VARIABLES.md"
    />
  );
}
