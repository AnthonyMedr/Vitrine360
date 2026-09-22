/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { emit } from "@/data/events/eventBus";
import { addToOutbox } from "@/data/events/outbox";
import type { CartUpdatedPayload } from "@/domain/types";
import { useAuth } from "@/hooks/useAuth";
import { Product } from "@/hooks/useProducts";
import { calculateCommercialLine } from "@/lib/commercial-calculation";
import { syncCustomerProfileFromServer, updateActiveCartRecord } from "@/lib/customerCenter";

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
  calculationOrigin?: "product_page" | "cart" | "checkout" | "assisted_sale";
  commercialRuleApplied?: string;
  quantityInformedClient?: number;
  quantityCalculatedSystem?: number;
  requestedMeasurement?: number;
  areaDesiredM2?: number;
  totalAreaM2?: number;
  weightDesiredKg?: number;
  totalWeightKg?: number;
  volumeDesiredLiters?: number;
  totalVolumeLiters?: number;
  cubicMetersDesired?: number;
  totalCubicMeters?: number;
  calculatedBoxes?: number;
  calculatedPieces?: number;
  calculatedPackages?: number;
  lossMarginApplied?: number;
  packagingClosed?: boolean;
  openPackageAllowed?: boolean;
}

function getCartLineCalculation(item: CartItem) {
  return calculateCommercialLine(item.product, {
    quantity: item.quantityInformedClient ?? item.quantity,
    requestedMeasurement: item.requestedMeasurement,
    areaDesiredM2: item.areaDesiredM2,
    weightDesiredKg: item.weightDesiredKg,
    volumeDesiredLiters: item.volumeDesiredLiters,
    cubicMetersDesired: item.cubicMetersDesired,
    lossMargin: item.lossMarginApplied,
  });
}

export function getCartLineTotal(item: CartItem) {
  return getCartLineCalculation(item).subtotal;
}

export function getCartLineLabel(item: CartItem) {
  return getCartLineCalculation(item).clientLabel;
}

export function getCartOperationalLabel(item: CartItem) {
  return getCartLineCalculation(item).operationalLabel;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, details?: Omit<CartItem, "product" | "quantity">) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  replaceCart: (nextItems: CartItem[]) => void;
  totalItems: number;
  totalPrice: number;
  getCartItemsForTracking: () => CartUpdatedPayload["items"];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [serverHydrated, setServerHydrated] = useState(false);
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      localStorage.removeItem("cart");
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
    if (!authLoading && user?.id && serverHydrated) {
      const syncTimer = window.setTimeout(() => {
        updateActiveCartRecord(items, user);
      }, 600);
      return () => window.clearTimeout(syncTimer);
    }
  }, [authLoading, items, serverHydrated, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setServerHydrated(false);
      return;
    }

    let cancelled = false;
    void syncCustomerProfileFromServer(user).then((profile) => {
      if (cancelled) return;
      const serverItems = profile.activeCart?.items ?? [];
      setItems((currentItems) => {
        if (currentItems.length === 0 && serverItems.length > 0) {
          return serverItems;
        }
        if (currentItems.length > 0) {
          updateActiveCartRecord(currentItems, user);
        }
        return currentItems;
      });
      setServerHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const getCartItemsForTracking = useCallback((): CartUpdatedPayload["items"] => {
    return items.map((item) => ({
      sku: item.product.sku || item.product.id,
      name: item.product.name,
      quantity: item.quantityCalculatedSystem ?? item.quantity,
      unit_price: Number(item.product.price),
      tipo_venda: item.product.sale_type,
      unidade_medida: item.product.unit_measure,
      quantidade_informada: item.quantityInformedClient ?? item.quantity,
      quantidade_calculada: item.quantityCalculatedSystem ?? item.quantity,
    }));
  }, [items]);

  const emitCartEvent = useCallback(
    (action: CartUpdatedPayload["action"], newItems: CartItem[], changedItem?: CartUpdatedPayload["changed_item"]) => {
      const cartItems = newItems.map((item) => ({
        sku: item.product.sku || item.product.id,
        name: item.product.name,
        quantity: item.quantityCalculatedSystem ?? item.quantity,
        unit_price: Number(item.product.price),
        tipo_venda: item.product.sale_type,
        unidade_medida: item.product.unit_measure,
        quantidade_informada: item.quantityInformedClient ?? item.quantity,
        quantidade_calculada: item.quantityCalculatedSystem ?? item.quantity,
      }));

      const cartTotal = newItems.reduce((sum, item) => sum + getCartLineTotal(item), 0);

      const payload: CartUpdatedPayload = {
        action,
        items: cartItems,
        cart_total: cartTotal,
        item_count: newItems.reduce((sum, item) => sum + (item.quantityCalculatedSystem ?? item.quantity), 0),
        changed_item: changedItem,
      };

      const event = emit("cart.updated", payload);
      addToOutbox(event);
    },
    [],
  );

  const addItem = (product: Product, quantity = 1, details?: Omit<CartItem, "product" | "quantity">) => {
    setItems((prev) => {
      const calculation = calculateCommercialLine(product, {
        quantity: details?.quantityInformedClient ?? quantity,
        requestedMeasurement: details?.requestedMeasurement,
        areaDesiredM2: details?.areaDesiredM2,
        weightDesiredKg: details?.weightDesiredKg,
        volumeDesiredLiters: details?.volumeDesiredLiters,
        cubicMetersDesired: details?.cubicMetersDesired,
        lossMargin: details?.lossMarginApplied,
      });

      const existing = prev.find((item) => item.product.id === product.id);
      let newItems: CartItem[];

      if (existing) {
        newItems = prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + calculation.operationalQuantity,
                notes: details?.notes ?? item.notes,
                calculationOrigin: details?.calculationOrigin ?? item.calculationOrigin,
                commercialRuleApplied: calculation.commercialRuleApplied,
                quantityInformedClient: details?.quantityInformedClient ?? calculation.quantityInformadaCliente,
                quantityCalculatedSystem: calculation.quantityCalculatedSystem,
                requestedMeasurement: details?.requestedMeasurement ?? item.requestedMeasurement,
                areaDesiredM2: details?.areaDesiredM2 ?? item.areaDesiredM2,
                totalAreaM2: details?.totalAreaM2 ?? calculation.totalAreaM2 ?? item.totalAreaM2,
                weightDesiredKg: details?.weightDesiredKg ?? item.weightDesiredKg,
                totalWeightKg: details?.totalWeightKg ?? calculation.totalWeightKg ?? item.totalWeightKg,
                volumeDesiredLiters: details?.volumeDesiredLiters ?? item.volumeDesiredLiters,
                totalVolumeLiters: details?.totalVolumeLiters ?? calculation.totalVolumeLiters ?? item.totalVolumeLiters,
                cubicMetersDesired: details?.cubicMetersDesired ?? item.cubicMetersDesired,
                totalCubicMeters: details?.totalCubicMeters ?? calculation.totalCubicMeters ?? item.totalCubicMeters,
                calculatedBoxes: details?.calculatedBoxes ?? calculation.calculatedBoxes ?? item.calculatedBoxes,
                calculatedPieces: details?.calculatedPieces ?? calculation.calculatedPieces ?? item.calculatedPieces,
                calculatedPackages: details?.calculatedPackages ?? calculation.calculatedPackages ?? item.calculatedPackages,
                lossMarginApplied: details?.lossMarginApplied ?? calculation.lossMarginApplied ?? item.lossMarginApplied,
                packagingClosed: details?.packagingClosed ?? calculation.packagingClosed ?? item.packagingClosed,
                openPackageAllowed: details?.openPackageAllowed ?? calculation.openPackageAllowed ?? item.openPackageAllowed,
              }
            : item,
        );
      } else {
        newItems = [
          ...prev,
          {
            product,
            quantity: calculation.operationalQuantity,
            ...details,
            commercialRuleApplied: calculation.commercialRuleApplied,
            quantityInformedClient: details?.quantityInformedClient ?? calculation.quantityInformadaCliente,
            quantityCalculatedSystem: calculation.quantityCalculatedSystem,
            totalAreaM2: details?.totalAreaM2 ?? calculation.totalAreaM2 ?? undefined,
            totalWeightKg: details?.totalWeightKg ?? calculation.totalWeightKg ?? undefined,
            totalVolumeLiters: details?.totalVolumeLiters ?? calculation.totalVolumeLiters ?? undefined,
            totalCubicMeters: details?.totalCubicMeters ?? calculation.totalCubicMeters ?? undefined,
            calculatedBoxes: details?.calculatedBoxes ?? calculation.calculatedBoxes ?? undefined,
            calculatedPieces: details?.calculatedPieces ?? calculation.calculatedPieces ?? undefined,
            calculatedPackages: details?.calculatedPackages ?? calculation.calculatedPackages ?? undefined,
            lossMarginApplied: details?.lossMarginApplied ?? calculation.lossMarginApplied ?? undefined,
            packagingClosed: details?.packagingClosed ?? calculation.packagingClosed,
            openPackageAllowed: details?.openPackageAllowed ?? calculation.openPackageAllowed,
          },
        ];
      }

      setTimeout(() => {
        emitCartEvent("add", newItems, {
          sku: product.sku || product.id,
          name: product.name,
          quantity: calculation.quantityCalculatedSystem,
          previous_quantity: existing?.quantityCalculatedSystem ?? existing?.quantity,
        });
      }, 0);

      return newItems;
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => {
      const removedItem = prev.find((item) => item.product.id === productId);
      const newItems = prev.filter((item) => item.product.id !== productId);

      if (removedItem) {
        setTimeout(() => {
          emitCartEvent("remove", newItems, {
            sku: removedItem.product.sku || removedItem.product.id,
            name: removedItem.product.name,
            quantity: 0,
            previous_quantity: removedItem.quantityCalculatedSystem ?? removedItem.quantity,
          });
        }, 0);
      }

      return newItems;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }

    setItems((prev) => {
      const existingItem = prev.find((item) => item.product.id === productId);
      const newItems = prev.map((item) => {
        if (item.product.id !== productId) return item;
        const calculation = calculateCommercialLine(item.product, { quantity });
        return {
          ...item,
          quantity: calculation.operationalQuantity,
          quantityInformedClient: quantity,
          quantityCalculatedSystem: calculation.quantityCalculatedSystem,
          commercialRuleApplied: calculation.commercialRuleApplied,
          calculatedBoxes: calculation.calculatedBoxes ?? item.calculatedBoxes,
          calculatedPieces: calculation.calculatedPieces ?? item.calculatedPieces,
          calculatedPackages: calculation.calculatedPackages ?? item.calculatedPackages,
        };
      });

      if (existingItem) {
        setTimeout(() => {
          emitCartEvent("update_quantity", newItems, {
            sku: existingItem.product.sku || existingItem.product.id,
            name: existingItem.product.name,
            quantity,
            previous_quantity: existingItem.quantityInformedClient ?? existingItem.quantity,
          });
        }, 0);
      }

      return newItems;
    });
  };

  const clearCart = () => {
    const previousItems = items;
    setItems([]);

    if (previousItems.length > 0) {
      emitCartEvent("clear", []);
    }
  };

  const replaceCart = (nextItems: CartItem[]) => {
    setItems(nextItems);
    emitCartEvent("update_quantity", nextItems);
  };

  const totalItems = items.reduce((sum, item) => sum + (item.quantityCalculatedSystem ?? item.quantity), 0);
  const totalPrice = items.reduce((sum, item) => sum + getCartLineTotal(item), 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        replaceCart,
        totalItems,
        totalPrice,
        getCartItemsForTracking,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
