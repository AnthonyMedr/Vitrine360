export const FEATURE_FLAGS = {
  siteMode: import.meta.env.VITE_SITE_MODE || "quote",
  ecommerce: import.meta.env.VITE_ECOMMERCE_ENABLED === "true",
  cart: import.meta.env.VITE_CART_ENABLED === "true",
  checkout: import.meta.env.VITE_CHECKOUT_ENABLED === "true",
  payments: import.meta.env.VITE_PAYMENTS_ENABLED === "true",
  stripe: import.meta.env.VITE_STRIPE_ENABLED === "true",
  orderTracking: import.meta.env.VITE_ORDER_TRACKING_ENABLED === "true",
  customerAccount: import.meta.env.VITE_CUSTOMER_ACCOUNT_ENABLED === "true",
  quote: import.meta.env.VITE_QUOTE_ENABLED !== "false",
  quoteCart: import.meta.env.VITE_QUOTE_CART_ENABLED !== "false",
  quoteCartProfile: import.meta.env.VITE_QUOTE_CART_PROFILE || "essential",
  publicPrices: import.meta.env.VITE_PUBLIC_PRICES_ENABLED === "true",
  whatsapp: import.meta.env.VITE_WHATSAPP_ENABLED !== "false",
  admin: import.meta.env.VITE_ADMIN_ENABLED !== "false",
  events: import.meta.env.VITE_EVENTS_ENABLED !== "false",
  webhook: import.meta.env.VITE_WEBHOOK_ENABLED === "true",
} as const;

export const isQuoteMode = FEATURE_FLAGS.siteMode === "quote";
