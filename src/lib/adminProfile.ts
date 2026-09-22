import type { LocalUser } from "@/lib/localCommerce";

const PROFILE_ALIASES: Record<string, string> = {
  admin_master: "administrador",
  admin: "administrador",
  gestor_comercial: "comercial",
  atendimento_suporte: "comercial",
  operador_pedidos: "comercial",
  catalog_content: "catalogo_conteudo",
  marketing_content: "marketing",
  diretoria: "visualizacao_diretoria",
  executive_view: "visualizacao_diretoria",
};

export function resolveAdminProfileId(user: Pick<LocalUser, "role" | "user_metadata"> | null | undefined) {
  const raw = user?.user_metadata?.permission_profile_id || (user?.role === "admin" ? "administrador" : null);
  if (!raw) return null;
  return PROFILE_ALIASES[raw] || raw;
}

export type AdminPersona = "administrador" | "comercial" | "catalogo_conteudo" | "marketing" | "visualizacao_diretoria";

const KNOWN_PERSONAS: AdminPersona[] = ["administrador", "comercial", "catalogo_conteudo", "marketing", "visualizacao_diretoria"];

export function resolveAdminPersona(profileId: string | null): AdminPersona {
  if (profileId && (KNOWN_PERSONAS as string[]).includes(profileId)) return profileId as AdminPersona;
  return "administrador";
}
