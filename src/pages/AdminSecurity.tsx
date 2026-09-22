import { AdminModuleWorkspace } from "@/components/admin/AdminModuleWorkspace";

export default function AdminSecurity() {
  return (
    <AdminModuleWorkspace
      eyebrow="Governanca"
      title="Segurança"
      description="Painel dedicado para hardening, RBAC, auditoria, cookies seguros, CSP, webhooks e acoes criticas."
      statusLabel="segurança operacional com warning de ambiente"
      metrics={[
        { label: "RBAC", value: "Ativo", tone: "ok" },
        { label: "Auditoria", value: "Ativa", tone: "ok" },
        { label: "Secure cookies", value: "Revisar env", tone: "warn" },
        { label: "Secrets", value: "Mascaradas", tone: "ok" },
      ]}
      primaryLinks={[
        { label: "Governanca", route: "/admin/governanca" },
        { label: "Usuários e perfis", route: "/admin/usuarios" },
        { label: "Auditoria", route: "/admin/audit-logs" },
      ]}
      sections={[
        {
          title: "Rotinas de segurança",
          description: "acesso, logs e hardening",
          items: [
            { title: "Simular perfil RBAC", description: "Validar visibilidade por cargo antes de alterar usuário real.", route: "/admin/rbac-simulador", owner: "Admin Master", tone: "ok" },
            { title: "Revisar auditoria", description: "Acoes criticas devem ficar rastreaveis.", route: "/admin/audit-logs", owner: "Governanca", tone: "ok" },
            { title: "Ajustar cookies seguros", description: "Ativar `SECURE_COOKIES` em ambiente HTTPS de produção.", route: "/admin/configuracoes", owner: "TI", tone: "warn" },
            { title: "Revisar integrações", description: "Secrets não devem aparecer em tela ou logs.", route: "/admin/integracoes", owner: "TI", tone: "ok" },
          ],
        },
      ]}
      docsPath="docs/SECURITY_GUIDE.md"
    />
  );
}
