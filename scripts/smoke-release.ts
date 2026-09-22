import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { Server } from "node:http";

type OrderCreationPayload = {
  duplicated: boolean;
  order: {
    id: string;
    tracking_token: string;
  };
};

type PaymentInitiationPayload = {
  paymentIntent: {
    status: string;
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

async function main() {
  const smokeDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "lojao-smoke-release-"));
  process.env.DATA_DIR = smokeDataDir;
  const { startServer, stopServer } = await import("../server/index.ts");
  const server = (await startServer(0)) as Server;

  try {
    if (!server.listening) {
      await once(server, "listening");
    }

    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Nao foi possivel resolver a porta do smoke release");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/api/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health falhou com status ${healthResponse.status}`);
    }

    const readinessResponse = await fetch(`${baseUrl}/api/health/readiness`);
    if (!readinessResponse.ok) {
      throw new Error(`Readiness falhou com status ${readinessResponse.status}`);
    }

    const csrfToken = getCookieValue(getSetCookieHeaders(healthResponse), "lojao_csrf");
    if (!csrfToken) {
      throw new Error("Token CSRF nao retornado no smoke");
    }

    const adminSigninResponse = await fetch(`${baseUrl}/api/auth/signin`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        cookie: `lojao_csrf=${csrfToken}`,
      },
      body: JSON.stringify({
        email: "admin@gamelmetal.com",
        password: "admin123",
      }),
    });
    if (!adminSigninResponse.ok) {
      throw new Error(`Falha ao autenticar admin no smoke: ${adminSigninResponse.status}`);
    }

    const sessionToken = getCookieValue(getSetCookieHeaders(adminSigninResponse), "gamel_session");
    if (!sessionToken) {
      throw new Error("Sessao admin nao retornada no smoke");
    }

    const adminCookieHeader = `lojao_csrf=${csrfToken}; gamel_session=${sessionToken}`;

    const adminProductsResponse = await fetch(`${baseUrl}/api/admin/products`, {
      headers: { cookie: adminCookieHeader },
    });
    if (!adminProductsResponse.ok) {
      throw new Error(`Falha ao consultar produtos admin: ${adminProductsResponse.status}`);
    }

    const permissionsResponse = await fetch(`${baseUrl}/api/admin/permissions/overview`, {
      headers: { cookie: adminCookieHeader },
    });
    if (!permissionsResponse.ok) {
      throw new Error(`Falha ao consultar perfis de permissao: ${permissionsResponse.status}`);
    }

    const productsResponse = await fetch(`${baseUrl}/api/products?limit=1`);
    if (!productsResponse.ok) {
      throw new Error(`Falha ao consultar catalogo publico: ${productsResponse.status}`);
    }
    const products = (await productsResponse.json()) as Array<{ id: string }>;
    if (products.length === 0) {
      throw new Error("Smoke release sem produto publico para validar checkout");
    }

    const idempotencyKey = `smoke-release-${Date.now()}`;

    const createOrderResponse = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        "idempotency-key": idempotencyKey,
        cookie: `lojao_csrf=${csrfToken}`,
      },
      body: JSON.stringify({
        customerName: "Smoke Release QA",
        customerEmail: "smoke.release@lojaopvc.com.br",
        customerPhone: "87999990000",
        customerCpf: "12345678901",
        deliveryType: "pickup",
        paymentMethod: "pix",
        items: [{ productId: products[0].id, quantity: 1, areaDesiredM2: 1 }],
      }),
    });
    if (!createOrderResponse.ok) {
      throw new Error(`Falha ao criar pedido no smoke: ${createOrderResponse.status}`);
    }
    const createdOrder = (await createOrderResponse.json()) as OrderCreationPayload;
    if (createdOrder.duplicated || !createdOrder.order?.id || !createdOrder.order?.tracking_token) {
      throw new Error("Pedido invalido retornado no smoke release");
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
      throw new Error(`Falha ao iniciar pagamento no smoke: ${paymentResponse.status}`);
    }

    const paymentPayload = (await paymentResponse.json()) as PaymentInitiationPayload;
    if (!paymentPayload.paymentIntent?.status) {
      throw new Error("Intent de pagamento invalida no smoke release");
    }

    const trackResponse = await fetch(`${baseUrl}/api/orders/track/${createdOrder.order.tracking_token}`);
    if (!trackResponse.ok) {
      throw new Error(`Falha ao rastrear pedido no smoke: ${trackResponse.status}`);
    }

    console.log("Smoke release concluido com sucesso.");
  } finally {
    await stopServer(server);
    if (fs.existsSync(smokeDataDir)) {
      fs.rmSync(smokeDataDir, { recursive: true, force: true });
    }
  }
}

void main().catch((error) => {
  console.error("[smoke-release] Falha:", error);
  process.exitCode = 1;
});
