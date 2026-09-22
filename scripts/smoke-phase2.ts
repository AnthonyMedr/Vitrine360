import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { Server } from "node:http";
import { appConfig } from "../server/config.ts";

type ShippingQuoteResponse = {
  options: Array<{
    id: string;
    name: string;
    price: number;
    deliveryType: "pickup" | "delivery";
    provider?: string;
  }>;
};

type OrderCreationPayload = {
  order: {
    id: string;
    tracking_token: string;
  };
};

type PaymentIntentPayload = {
  paymentIntent: {
    provider: string;
    mode: string;
    status: string;
    checkoutUrl?: string;
  };
};

function getSetCookieHeaders(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function getCookieValue(setCookieHeaders: string[], cookieName: string) {
  const cookieHeader = setCookieHeaders.find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookieHeader) return null;
  return cookieHeader.split(";")[0]?.slice(cookieName.length + 1) ?? null;
}

function assertPhase2Config() {
  const blockers: string[] = [];
  if (appConfig.dbProvider !== "postgres") blockers.push("DB_PROVIDER=postgres");
  if (!appConfig.databaseUrl) blockers.push("DATABASE_URL");
  if (appConfig.queueProvider !== "redis") blockers.push("QUEUE_PROVIDER=redis");
  if (!appConfig.redis.url) blockers.push("REDIS_URL");
  if (appConfig.paymentProvider !== "mercadopago") blockers.push("PAYMENT_PROVIDER=mercadopago");
  if (!appConfig.mercadopago.accessToken) blockers.push("MERCADOPAGO_ACCESS_TOKEN");
  if (!appConfig.mercadopago.webhookSecret) blockers.push("MERCADOPAGO_WEBHOOK_SECRET");
  if (!appConfig.mercadopago.successUrl) blockers.push("PAYMENT_SUCCESS_URL");
  if (!appConfig.mercadopago.failureUrl) blockers.push("PAYMENT_FAILURE_URL");
  if (!appConfig.mercadopago.pendingUrl) blockers.push("PAYMENT_PENDING_URL");
  if (appConfig.freightProvider !== "melhor-envio") blockers.push("FREIGHT_PROVIDER=melhor-envio");
  if (!appConfig.melhorEnvio.token) blockers.push("MELHOR_ENVIO_TOKEN");
  if (!appConfig.melhorEnvio.originZipCode) blockers.push("MELHOR_ENVIO_ORIGIN_ZIP");
  if (!["sandbox", "production"].includes(appConfig.melhorEnvio.env)) blockers.push("MELHOR_ENVIO_ENV=sandbox|production");

  if (blockers.length > 0) {
    throw new Error(`Fase 2 ainda nao pronta para smoke real. Pendencias: ${blockers.join(", ")}`);
  }
}

async function main() {
  assertPhase2Config();

  const smokeDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lojao-smoke-phase2-"));
  process.env.DATA_DIR = smokeDataDir;
  const { startServer, stopServer } = await import("../server/index.ts");
  const server = (await startServer(0)) as Server;

  try {
    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Nao foi possivel resolver a porta do smoke da fase 2");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const paymentStatusResponse = await fetch(`${baseUrl}/api/payment-provider/status`);
    if (!paymentStatusResponse.ok) {
      throw new Error(`Falha ao consultar status do pagamento: ${paymentStatusResponse.status}`);
    }
    const paymentStatus = (await paymentStatusResponse.json()) as { ready: boolean; provider: string; webhook_ready: boolean };
    if (!paymentStatus.ready || paymentStatus.provider !== "mercadopago" || !paymentStatus.webhook_ready) {
      throw new Error("Provider de pagamento nao esta pronto para a smoke da fase 2");
    }

    const freightStatusResponse = await fetch(`${baseUrl}/api/freight-provider/status`);
    if (!freightStatusResponse.ok) {
      throw new Error(`Falha ao consultar status do frete: ${freightStatusResponse.status}`);
    }
    const freightStatus = (await freightStatusResponse.json()) as { ready: boolean; provider: string; origin_zip_configured: boolean };
    if (!freightStatus.ready || freightStatus.provider !== "melhor-envio" || !freightStatus.origin_zip_configured) {
      throw new Error("Provider de frete nao esta pronto para a smoke da fase 2");
    }

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health falhou com status ${healthResponse.status}`);
    }

    const csrfToken = getCookieValue(getSetCookieHeaders(healthResponse), "lojao_csrf");
    if (!csrfToken) {
      throw new Error("Token CSRF nao retornado na smoke da fase 2");
    }

    const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
    if (!productsResponse.ok) {
      throw new Error(`Falha ao consultar produtos: ${productsResponse.status}`);
    }
    const products = (await productsResponse.json()) as Array<{ id: string; price: number }>;
    if (products.length === 0) {
      throw new Error("Smoke da fase 2 sem produto publico");
    }

    const shippingResponse = await fetch(
      `${baseUrl}/api/shipping/quote?cep=55295000&subtotal=${products[0].price}&items=${encodeURIComponent(JSON.stringify([{ productId: products[0].id, quantity: 1 }]))}`,
    );
    if (!shippingResponse.ok) {
      throw new Error(`Falha ao cotar frete externo: ${shippingResponse.status}`);
    }
    const shippingPayload = (await shippingResponse.json()) as ShippingQuoteResponse;
    if (!shippingPayload.options.some((option) => option.provider === "melhor-envio")) {
      throw new Error("Smoke da fase 2 sem opcao externa do Melhor Envio");
    }

    const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        "idempotency-key": `smoke-phase2-${Date.now()}`,
        cookie: `lojao_csrf=${csrfToken}`,
      },
      body: JSON.stringify({
        customerName: "Smoke Phase 2 QA",
        customerEmail: "smoke.phase2@lojaopvc.com.br",
        customerPhone: "87999990000",
        customerCpf: "12345678901",
        deliveryType: "pickup",
        paymentMethod: "pix",
        items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
      }),
    });
    if (!createOrderResponse.ok) {
      throw new Error(`Falha ao criar pedido na smoke da fase 2: ${createOrderResponse.status}`);
    }
    const createdOrder = (await createOrderResponse.json()) as OrderCreationPayload;
    if (!createdOrder.order?.id || !createdOrder.order?.tracking_token) {
      throw new Error("Pedido invalido retornado na smoke da fase 2");
    }

    const paymentResponse = await fetch(`${baseUrl}/api/orders/${createdOrder.order.id}/payment`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: `lojao_csrf=${csrfToken}`,
      },
      body: JSON.stringify({
        action: "initiate",
        trackingToken: createdOrder.order.tracking_token,
      }),
    });
    if (!paymentResponse.ok) {
      throw new Error(`Falha ao iniciar pagamento provider: ${paymentResponse.status}`);
    }
    const paymentPayload = (await paymentResponse.json()) as PaymentIntentPayload;
    if (paymentPayload.paymentIntent.provider !== "mercadopago" || paymentPayload.paymentIntent.mode !== "provider") {
      throw new Error("Intent de pagamento nao retornou provider real");
    }
    if (!paymentPayload.paymentIntent.checkoutUrl) {
      throw new Error("Intent de pagamento real sem checkoutUrl");
    }

    console.log("Smoke da fase 2 concluida com sucesso.");
  } finally {
    await stopServer(server);
    if (fs.existsSync(smokeDataDir)) {
      fs.rmSync(smokeDataDir, { recursive: true, force: true });
    }
  }
}

void main().catch((error) => {
  console.error("[smoke-phase2] Falha:", error);
  process.exitCode = 1;
});
