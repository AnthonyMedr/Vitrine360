import { existsSync, readFileSync } from "node:fs";

const requiredDocs = [
  "docs/benchmark/CHECKOUT_PERFORMANCE_EXCELENCIA_ECOMMERCE.md",
  "docs/catalog/PADRAO_PRODUTO_TECNICO_LOJAO_PVC.md",
  "docs/benchmark/BENCHMARK_MERCADO_ECOMMERCE_BRASIL_2026.md",
  "docs/roadmap/PLANO_MELHOR_ECOMMERCE_BRASIL_LOJAO_PVC.md",
];

const sourceFiles = [
  "src/pages/Cart.tsx",
  "src/pages/Checkout.tsx",
  "src/hooks/useShipping.ts",
  "src/hooks/useEventBus.ts",
  "src/hooks/useCartAbandonment.ts",
  "src/lib/checkout-validation.ts",
];

const missingDocs = requiredDocs.filter((path) => !existsSync(path));
const missingSources = sourceFiles.filter((path) => !existsSync(path));
const cart = existsSync("src/pages/Cart.tsx") ? readFileSync("src/pages/Cart.tsx", "utf8") : "";
const checkout = existsSync("src/pages/Checkout.tsx") ? readFileSync("src/pages/Checkout.tsx", "utf8") : "";
const shipping = existsSync("src/hooks/useShipping.ts") ? readFileSync("src/hooks/useShipping.ts", "utf8") : "";
const events = existsSync("src/hooks/useEventBus.ts") ? readFileSync("src/hooks/useEventBus.ts", "utf8") : "";
const abandonment = existsSync("src/hooks/useCartAbandonment.ts") ? readFileSync("src/hooks/useCartAbandonment.ts", "utf8") : "";
const validation = existsSync("src/lib/checkout-validation.ts") ? readFileSync("src/lib/checkout-validation.ts", "utf8") : "";

const checks = [
  { key: "guest_checkout", ok: checkout.includes("getCustomerProfile") && checkout.includes("customer") },
  { key: "checkout_steps", ok: checkout.includes("checkoutSteps") && checkout.includes("Confirmacao") },
  { key: "shipping_before_payment", ok: cart.includes("calculateShipping") && checkout.includes("calculateShipping") },
  { key: "cart_total_visibility", ok: cart.includes("finalTotal") && checkout.includes("totalPrice + shippingCost - discount") },
  { key: "policy_acceptance", ok: checkout.includes("acceptPolicies") },
  { key: "cart_abandonment_event", ok: abandonment.includes("cart.abandoned") },
  { key: "checkout_started_event", ok: events.includes("checkout.started") },
  { key: "shipping_assisted_state", ok: shipping.includes("underAnalysis") || checkout.includes("shippingUnderAnalysis") },
  { key: "backend_validation", ok: validation.includes("validateCheckout") },
];

const blockers = [
  ...missingDocs.map((path) => `documento_ausente:${path}`),
  ...missingSources.map((path) => `fonte_ausente:${path}`),
  ...checks.filter((check) => !check.ok).map((check) => `check_ausente:${check.key}`),
];

const warnings = [
  "pagamento_real_pendente",
  "frete_real_pendente",
  "core_web_vitals_pendente_em_ambiente_real",
  "produto_tecnico_mix_minimo_ainda_depende_de_fiscal_contador",
];

const output = {
  CHECKOUT_EXCELLENCE_DOCUMENTED: missingDocs.length === 0,
  CHECKOUT_EXCELLENCE_STRUCTURAL_READY: blockers.length === 0,
  CHECKOUT_EXCELLENCE_READY: false,
  PRODUCTION_OPEN: "BLOQUEADO_EXTERNO",
  MAIN_BLOCKER: "fiscal_minimo_contador",
  checks,
  blockers,
  warnings,
  next_step: "FISCAL_CONTADOR+INTEGRACOES_REAIS+CHECKOUT_PERFORMANCE",
};

console.log(JSON.stringify(output, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}
