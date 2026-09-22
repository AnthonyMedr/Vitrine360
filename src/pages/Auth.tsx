import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Mail, MessageCircle, ShieldCheck, Users } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { STORE_INFO, WHATSAPP_MESSAGES, getWhatsAppUrl } from "@/constants/store";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MIN_MESSAGE = `Senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres`;

const signInSchema = z.object({
  email: z.string().email("E-mail invalido"),
  password: z.string().min(1, "Senha e obrigatoria"),
});

const forgotPasswordRequestSchema = z.object({
  email: z.string().email("E-mail invalido"),
});

const resetPasswordSchema = z
  .object({
    email: z.string().email("E-mail invalido"),
    code: z.string().length(6, "Informe o codigo de 6 digitos"),
    password: z.string().min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE),
    confirmPassword: z.string().min(6, "Confirme a nova senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

const benefits = [
  { icon: ShieldCheck, title: "Acesso seguro", text: "Entre no painel com perfil e permissões definidos para a operação." },
  { icon: Users, title: "Equipe GAMEL", text: "Comercial, catálogo, marketing e diretoria usam as mesmas rotinas simples no dia a dia." },
  { icon: MessageCircle, title: "Atendimento comercial", text: "Orçamentos e leads seguem para registro e acompanhamento da equipe." },
];

type AuthMode = "signin" | "forgot";
type ForgotStep = "request" | "reset";

interface OtpResponse {
  ok: boolean;
  expires_in_minutes: number;
  debug_code?: string;
}

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("request");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    code: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const isLogin = mode === "signin";
  const isForgotPassword = mode === "forgot";

  useEffect(() => {
    if (isAuthenticated) {
      navigate(user?.role === "admin" ? "/admin" : "/", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setForgotStep("request");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setDebugCode(null);
    setErrors({});
    setFormData((prev) => ({
      ...prev,
      name: "",
      password: "",
      code: "",
      confirmPassword: "",
    }));
  };

  const collectErrors = (issues: z.ZodIssue[]) => {
    const fieldErrors: Record<string, string> = {};
    issues.forEach((issue) => {
      if (issue.path[0]) {
        fieldErrors[issue.path[0] as string] = issue.message;
      }
    });
    setErrors(fieldErrors);
  };

  const requestResetCode = async () => {
    const parsed = forgotPasswordRequestSchema.safeParse({ email: formData.email });
    if (!parsed.success) {
      collectErrors(parsed.error.issues);
      return;
    }

    const response = await apiFetch<OtpResponse>("/api/auth/request-otp", {
      method: "POST",
      body: JSON.stringify({
        email: formData.email,
        purpose: "reset_password",
      }),
    });

    setForgotStep("reset");
    setDebugCode(response.debug_code || null);
    toast.success(`Codigo enviado por e-mail. Validade: ${response.expires_in_minutes} minutos.`);
  };

  const resetPassword = async () => {
    const parsed = resetPasswordSchema.safeParse({
      email: formData.email,
      code: formData.code,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
    });

    if (!parsed.success) {
      collectErrors(parsed.error.issues);
      return;
    }

    await apiFetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        email: formData.email,
        code: formData.code,
        password: formData.password,
      }),
    });

    toast.success("Senha redefinida com sucesso. Entre com a nova senha.");
    setMode("signin");
    setForgotStep("request");
    setDebugCode(null);
    setErrors({});
    setFormData((prev) => ({
      ...prev,
      password: "",
      code: "",
      confirmPassword: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      if (isForgotPassword) {
        if (forgotStep === "request") {
          await requestResetCode();
        } else {
          await resetPassword();
        }
      } else if (isLogin) {
        const result = signInSchema.safeParse(formData);
        if (!result.success) {
          collectErrors(result.error.issues);
          setIsLoading(false);
          return;
        }

        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("E-mail ou senha incorretos");
          } else {
            toast.error(error.message);
          }
          setIsLoading(false);
          return;
        }

        toast.success("Login realizado com sucesso.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message.split(" [")[0] : "Ocorreu um erro. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.18),transparent_28%),linear-gradient(180deg,hsl(var(--muted)/0.45),hsl(var(--background))_60%)] p-4 md:p-6">
      <div className="shell-home">
        <div className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Voltar para o site
          </Link>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2rem] gradient-dark p-7 text-secondary-foreground shadow-card md:p-10"
          >
            <Link to="/" className="inline-flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/6" aria-hidden="true">
                <img src="/assets/brand/gamel-icone-512.png" alt="" className="scale-[1.45]" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold">{STORE_INFO.name}</h1>
                <p className="text-sm text-secondary-foreground/68">{STORE_INFO.tagline}</p>
              </div>
            </Link>

            <div className="mt-10 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-secondary-foreground/55">Acesso GAMEL</p>
              <h2 className="mt-4 font-display text-4xl font-bold leading-[0.95] md:text-5xl">
                {isLogin ? "Entre para operar catálogo, orçamentos e leads." : "Recupere sua senha e volte ao painel."}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-secondary-foreground/78">
                Use este acesso para administrar produtos, imagens, banners, solicitações de orçamento, leads e a operação diária da loja.
              </p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {benefits.map((benefit) => (
                <div key={benefit.title} className="rounded-[1.5rem] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                  <benefit.icon className="h-5 w-5 text-accent" />
                  <h3 className="mt-4 font-display text-lg font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-secondary-foreground/72">{benefit.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild variant="whatsapp" size="lg">
                <a href={getWhatsAppUrl(WHATSAPP_MESSAGES.contact)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" />
                  Falar com a GAMEL
                </a>
              </Button>
              <p className="text-sm text-secondary-foreground/68">
                Atendimento comercial: <span className="font-semibold text-secondary-foreground">{STORE_INFO.phone}</span>
              </p>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="surface-panel rounded-[2rem] px-6 py-6 md:px-8 md:py-8"
          >
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  {isLogin ? "Acesso administrativo" : "Recuperacao"}
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold">
                  {isLogin ? "Entrar" : forgotStep === "request" ? "Recuperar senha" : "Definir nova senha"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isLogin
                    ? "Acesse o painel comercial e as rotinas administrativas da loja. Usuários são criados pelo administrador."
                    : forgotStep === "request"
                        ? "Informe seu e-mail para receber um codigo de redefinicao."
                        : "Digite o codigo recebido e defina a nova senha da sua conta."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isLogin ? (
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="rounded-full border px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                  >
                    Entrar
                  </button>
                ) : null}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">E-mail</Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" name="email" type="email" placeholder="seu@email.com" className="h-11 pl-10" value={formData.email} onChange={handleChange} />
                </div>
                {errors.email ? <p className="mt-1 text-xs text-destructive">{errors.email}</p> : null}
              </div>

              {!isForgotPassword ? (
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua senha"
                      className="h-11 pl-10 pr-10"
                      value={formData.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password ? <p className="mt-1 text-xs text-destructive">{errors.password}</p> : null}
                </div>
              ) : null}

              {isForgotPassword && forgotStep === "reset" ? (
                <>
                  <div>
                    <Label htmlFor="code">Codigo de segurança</Label>
                    <div className="relative mt-1.5">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="code"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Digite o codigo de 6 digitos"
                        className="h-11 pl-10"
                        value={formData.code}
                        onChange={handleChange}
                      />
                    </div>
                    {errors.code ? <p className="mt-1 text-xs text-destructive">{errors.code}</p> : null}
                  </div>

                  <div>
                    <Label htmlFor="password">Nova senha</Label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite a nova senha"
                        className="h-11 pl-10 pr-10"
                        value={formData.password}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password ? <p className="mt-1 text-xs text-destructive">{errors.password}</p> : null}
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repita a nova senha"
                        className="h-11 pl-10 pr-10"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword ? <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p> : null}
                  </div>
                </>
              ) : null}

              {isForgotPassword ? (
                <div className="rounded-[1.25rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,239,229,0.6))] p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{forgotStep === "request" ? "Como funciona" : "Codigo enviado"}</p>
                  <p className="mt-2">
                    {forgotStep === "request"
                      ? "Enviaremos um codigo de segurança para o e-mail informado. Depois disso, você define a nova senha nesta mesma tela."
                      : "Use o codigo recebido por e-mail para redefinir a senha. Se precisar, você pode solicitar um novo codigo."}
                  </p>
                  {import.meta.env.DEV && debugCode ? (
                    <p className="mt-3 rounded-lg bg-background px-3 py-2 font-mono text-xs text-foreground">Codigo de teste local: {debugCode}</p>
                  ) : null}
                </div>
              ) : null}

              <Button type="submit" className="mt-2 w-full" size="lg" disabled={isLoading}>
                {isLoading
                  ? "Processando..."
                  : isLogin
                    ? "Entrar agora"
                    : forgotStep === "request"
                        ? "Enviar codigo"
                        : "Salvar nova senha"}
              </Button>

              {isLogin ? (
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="w-full text-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Esqueci minha senha
                </button>
              ) : null}

              {isForgotPassword && forgotStep === "reset" ? (
                <button
                  type="button"
                  onClick={() => {
                    setForgotStep("request");
                    setDebugCode(null);
                    setErrors({});
                    setFormData((prev) => ({ ...prev, code: "", password: "", confirmPassword: "" }));
                  }}
                  className="w-full text-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Solicitar outro codigo
                </button>
              ) : null}

              {isForgotPassword ? (
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="w-full text-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Voltar ao login
                </button>
              ) : null}
            </form>

            <div className="mt-8 rounded-[1.25rem] border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,239,229,0.6))] p-4 text-sm">
              <p className="font-medium text-foreground">O que este acesso libera</p>
              <div className="mt-3 grid gap-2 text-muted-foreground sm:grid-cols-2">
                <p>Gerencie catálogo, produtos e imagens.</p>
                <p>Acompanhe orçamentos e leads recebidos.</p>
                <p>Revise banners, vitrines e chamadas do site.</p>
                <p>Valide usuários e permissões da equipe.</p>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Ao continuar, você concorda com nossos{" "}
              <Link to="/politicas" className="underline hover:text-foreground">
                Termos de Uso
              </Link>{" "}
              e{" "}
              <Link to="/politicas" className="underline hover:text-foreground">
                Politica de Privacidade
              </Link>
              .
            </p>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
