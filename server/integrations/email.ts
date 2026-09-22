import { appConfig } from "../config";
import { logError, logInfo } from "../logger";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
  idempotencyKey?: string;
}

export interface EmailResult {
  ok: boolean;
  provider: string;
  id?: string;
  error?: string | null;
}

function normalizeRecipients(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (appConfig.emailProvider === "resend" && appConfig.resend.apiKey) {
    const response = await fetch(`${appConfig.resend.baseUrl.replace(/\/$/, "")}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appConfig.resend.apiKey}`,
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: appConfig.resend.from,
        reply_to: appConfig.resend.replyTo,
        to: normalizeRecipients(message.to),
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: message.tags,
      }),
    });

    const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok) {
      logError({
        event: "email.send_failed",
        module: "email",
        data: { provider: "resend", to: normalizeRecipients(message.to), subject: message.subject },
        error: data?.message || `Falha ao enviar email [${response.status}]`,
      });
      return {
        ok: false,
        provider: "resend",
        error: data?.message || `Falha ao enviar email [${response.status}]`,
      };
    }

    return {
      ok: true,
      provider: "resend",
      id: data?.id,
    };
  }

  logInfo({
    event: "email.logged_locally",
    module: "email",
    data: {
      provider: appConfig.emailProvider,
      to: normalizeRecipients(message.to),
      subject: message.subject,
      tags: message.tags,
    },
  });

  return {
    ok: true,
    provider: "log",
    id: `log-${Date.now()}`,
  };
}

export function buildOtpEmail(code: string, purpose: "signin" | "reauth" | "reset_password") {
  const label =
    purpose === "reset_password"
      ? "Redefinicao de senha"
      : purpose === "reauth"
        ? "Confirmacao de seguranca"
        : "Acesso por codigo";
  return {
    subject: `${label} - GAMEL`,
    html: `<p>Seu codigo e <strong>${code}</strong>.</p><p>Ele expira em ${appConfig.auth.otpMinutes} minutos.</p>`,
    text: `Seu codigo e ${code}. Ele expira em ${appConfig.auth.otpMinutes} minutos.`,
  };
}

export function buildOrderEmail(orderNumber: string, total: number) {
  return {
    subject: `Pedido ${orderNumber} recebido`,
    html: `<p>Recebemos seu pedido <strong>${orderNumber}</strong>.</p><p>Total: R$ ${total.toFixed(2).replace(".", ",")}.</p>`,
    text: `Recebemos seu pedido ${orderNumber}. Total: R$ ${total.toFixed(2).replace(".", ",")}.`,
  };
}

export function buildWelcomeEmail(name: string) {
  return {
    subject: "Conta criada na GAMEL",
    html: `<p>Olá, ${name}.</p><p>Sua conta foi criada com sucesso. Agora voce pode acompanhar pedidos, salvar enderecos e acelerar novas compras.</p>`,
    text: `Ola, ${name}. Sua conta foi criada com sucesso na GAMEL.`,
  };
}
