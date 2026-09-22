/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "@/hooks/useProducts";

export const QUOTE_CART_STORAGE_KEY = "gamel_quote_cart_v1";
const MAX_QUOTE_CART_ITEMS = 30;
const MAX_QUOTE_ITEM_QUANTITY = 99999;
const QUOTE_CART_STORAGE_VERSION = 1;

export type QuoteCartItem = {
  id: string;
  productId: string;
  productSlug: string;
  productName: string;
  sku: string | null;
  imageUrl: string | null;
  categoryName: string | null;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
  unit: string | null;
  notes: string | null;
};

type QuoteCartContextValue = {
  items: QuoteCartItem[];
  totalItems: number;
  addProduct: (product: Product, options?: { quantity?: number; variantId?: string | null; notes?: string | null }) => void;
  updateItem: (id: string, patch: Partial<Pick<QuoteCartItem, "quantity" | "unit" | "notes" | "variantId" | "variantLabel">>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  hasProduct: (productId: string) => boolean;
};

const QuoteCartContext = createContext<QuoteCartContextValue | undefined>(undefined);

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;
  return Math.min(quantity, MAX_QUOTE_ITEM_QUANTITY);
}

function sanitizeStoredItem(value: unknown): QuoteCartItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<QuoteCartItem>;
  const productId = String(item.productId || "").trim();
  const productName = String(item.productName || "").trim();
  if (!productId || !productName) return null;
  return {
    id: String(item.id || `${productId}:${item.variantId || "default"}`),
    productId,
    productSlug: String(item.productSlug || productId),
    productName,
    sku: item.sku ? String(item.sku) : null,
    imageUrl: item.imageUrl ? String(item.imageUrl) : null,
    categoryName: item.categoryName ? String(item.categoryName) : null,
    variantId: item.variantId ? String(item.variantId) : null,
    variantLabel: item.variantLabel ? String(item.variantLabel) : null,
    quantity: normalizeQuantity(item.quantity),
    unit: item.unit ? String(item.unit) : null,
    notes: item.notes ? String(item.notes).slice(0, 500) : null,
  };
}

function readInitialItems() {
  try {
    const raw = localStorage.getItem(QUOTE_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const rawItems = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [];
    return rawItems.map(sanitizeStoredItem).filter(Boolean).slice(0, MAX_QUOTE_CART_ITEMS) as QuoteCartItem[];
  } catch {
    localStorage.removeItem(QUOTE_CART_STORAGE_KEY);
    return [];
  }
}

function buildItem(product: Product, options?: { quantity?: number; variantId?: string | null; notes?: string | null }): QuoteCartItem {
  const variant = options?.variantId ? product.variations?.find((entry) => entry.id === options.variantId) ?? null : null;
  return {
    id: `${product.id}:${variant?.id ?? "default"}`,
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    sku: product.sku ?? null,
    imageUrl: product.image_url || product.images?.[0] || null,
    categoryName: product.category?.name ?? null,
    variantId: variant?.id ?? null,
    variantLabel: variant?.label ?? variant?.value ?? null,
    quantity: normalizeQuantity(options?.quantity || 1),
    unit: product.display_unit ? String(product.display_unit) : product.unit_measure ? String(product.unit_measure) : product.unit ?? null,
    notes: options?.notes?.trim() || null,
  };
}

export function QuoteCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<QuoteCartItem[]>(readInitialItems);

  useEffect(() => {
    localStorage.setItem(QUOTE_CART_STORAGE_KEY, JSON.stringify({ version: QUOTE_CART_STORAGE_VERSION, items, expiresAt: null }));
  }, [items]);

  const addProduct = useCallback((product: Product, options?: { quantity?: number; variantId?: string | null; notes?: string | null }) => {
    const nextItem = buildItem(product, options);
    setItems((current) => {
      const existing = current.find((item) => item.id === nextItem.id);
      if (existing) {
        return current.map((item) => item.id === nextItem.id ? { ...item, quantity: normalizeQuantity(item.quantity + nextItem.quantity), notes: nextItem.notes ?? item.notes } : item);
      }
      return [nextItem, ...current].slice(0, MAX_QUOTE_CART_ITEMS);
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<Pick<QuoteCartItem, "quantity" | "unit" | "notes" | "variantId" | "variantLabel">>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch, quantity: patch.quantity === undefined ? item.quantity : normalizeQuantity(patch.quantity) } : item));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const hasProduct = useCallback((productId: string) => items.some((item) => item.productId === productId), [items]);
  const value = useMemo(() => ({
    items,
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    addProduct,
    updateItem,
    removeItem,
    clearCart,
    hasProduct,
  }), [addProduct, clearCart, hasProduct, items, removeItem, updateItem]);

  return <QuoteCartContext.Provider value={value}>{children}</QuoteCartContext.Provider>;
}

export function useQuoteCart() {
  const context = useContext(QuoteCartContext);
  if (!context) throw new Error("useQuoteCart must be used within QuoteCartProvider");
  return context;
}
