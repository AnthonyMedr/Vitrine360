import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogIn } from "lucide-react";
import { brandConfig } from "@/config/brand";
import {
  DEFAULT_BOOTSTRAP_TOKEN,
  DEFAULT_DEV_ADMIN_EMAIL,
  matchesLocalAdminCredentials,
} from "@/lib/admin-bootstrap.shared";
import { loginAdmin } from "@/lib/admin-auth.functions";
import { storeAdminSession } from "@/lib/admin-session";
import { enableDevAdminBypass, getDevAdminEmail, isDevAdminBypassAvailable } from "@/lib/dev-admin";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
});

function AdminLogin() {
  const router = useRouter();
  const loginFn = useServerFn(loginAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function isLocalHostRuntime() {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    return host === "127.0.0.1" || host === "localhost";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      if (isLocalHostRuntime() && matchesLocalAdminCredentials(email, password)) {
        storeAdminSession({
          token: DEFAULT_BOOTSTRAP_TOKEN,
          email: DEFAULT_DEV_ADMIN_EMAIL,
        });
        window.location.assign("/admin");
        return;
      }

      const session = await loginFn({ data: { email, password } });
      storeAdminSession({ token: session.token, email: session.email });
      if (typeof window !== "undefined") {
        window.location.assign("/admin");
        return;
      }
      router.navigate({ to: "/admin" });
    } catch (error) {
      setMsg((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="border border-border bg-card p-8 text-card-foreground shadow-pop">
        <span className="inline-flex bg-action px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-action-foreground">
          {brandConfig.defaultStoreName}
        </span>
        <h1 className="mt-4 font-display text-5xl">Acessar painel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entre com a credencial administrativa definida para a implantacao do Vitrine360.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full border border-border bg-surface px-4 py-3 outline-none focus:border-action"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider">Senha</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full border border-border bg-surface px-4 py-3 outline-none focus:border-action"
            />
          </label>
          {msg && <p className="text-sm text-destructive">{msg}</p>}
          <div className="border border-border bg-surface p-3 text-xs text-muted-foreground">
            Use a credencial homologada do ambiente final. Em producao, o acesso depende do
            bootstrap administrativo configurado no servidor.
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 bg-action py-3 font-black text-action-foreground shadow-card hover:brightness-110 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Entrar
          </button>
        </form>
        {isDevAdminBypassAvailable() && (
          <button
            onClick={() => {
              enableDevAdminBypass();
              setMsg(`Modo local habilitado para ${getDevAdminEmail()}.`);
              router.navigate({ to: "/admin" });
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-border py-3 font-bold hover:bg-highlight"
          >
            Entrar em modo local
          </button>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">{brandConfig.signature}</p>
      </div>
    </div>
  );
}
