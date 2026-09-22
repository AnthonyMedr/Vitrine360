import { useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DeliveryType, OrderOrigin, OrderType, PaymentMethod, SourceActor, SourceChannel } from "@/lib/localCommerce";

interface CartItem {
  productId: string;
  quantity: number;
  quantityInformedClient?: number;
  quantityCalculatedSystem?: number;
  commercialRuleApplied?: string;
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
  calculationOrigin?: string;
  notes?: string;
}

interface OrderData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCpf: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  shippingAddress?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  shippingCost: number;
  couponCode?: string;
  notes?: string;
  correlationId?: string;
  idempotencyKey?: string;
  orderType?: OrderType;
  orderOrigin?: OrderOrigin;
  sourceChannel?: SourceChannel;
  sourceActor?: SourceActor;
  assistedSale?: boolean;
  sellerId?: string | null;
  sellerName?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  deliveryRequired?: boolean;
  pickupAllowed?: boolean;
  assistedSaleNotes?: string | null;
  items: CartItem[];
}

export function useCreateOrder() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightIdempotencyKey = useRef<string | null>(null);

  const createIdempotencyKey = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const createOrder = async (orderData: OrderData) => {
    setLoading(true);
    setError(null);
    const idempotencyKey = orderData.idempotencyKey || inFlightIdempotencyKey.current || createIdempotencyKey();
    inFlightIdempotencyKey.current = idempotencyKey;

    try {
      const response = await apiFetch<{ order: unknown }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey,
          ...orderData,
        }),
      });

      setLoading(false);
      inFlightIdempotencyKey.current = null;
      return { order: response.order, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      setLoading(false);
      inFlightIdempotencyKey.current = null;
      return { order: null, error: message };
    }
  };

  return {
    createOrder,
    loading,
    error,
  };
}
