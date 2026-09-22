/**
 * useEventBus Hook
 * React hook for event bus integration
 * Provides methods to emit and subscribe to events
 */

import { useCallback, useEffect } from 'react';
import { 
  emit, 
  subscribe, 
  getCorrelationId, 
  getSessionDuration 
} from '@/data/events/eventBus';
import { addToOutbox } from '@/data/events/outbox';
import { getPageContext } from '@/data/events/utmTracking';
import type { 
  EventType,
  EventEnvelope,
  LeadCreatedPayload,
  ProductViewedPayload,
  CartUpdatedPayload,
  CheckoutStartedPayload,
  CartAbandonedPayload,
} from '@/domain/types';

interface UseEventBusOptions {
  persistToOutbox?: boolean;
}

export function useEventBus(options: UseEventBusOptions = { persistToOutbox: true }) {
  const { persistToOutbox } = options;

  /**
   * Emit a generic event
   */
  const emitEvent = useCallback(<T>(eventType: EventType, payload: T): EventEnvelope<T> => {
    const event = emit(eventType, payload);
    
    if (persistToOutbox) {
      addToOutbox(event);
    }
    
    return event;
  }, [persistToOutbox]);

  /**
   * Track lead creation (WhatsApp click, form submission)
   */
  const trackLead = useCallback((
    channel: 'whatsapp' | 'form' | 'chat',
    context: LeadCreatedPayload['context'],
    customer?: { phone?: string; name?: string; email?: string }
  ) => {
    const pageContext = getPageContext();
    
    const payload: LeadCreatedPayload = {
      channel,
      phone: customer?.phone,
      name: customer?.name,
      email: customer?.email,
      utm: pageContext.utm,
      context: {
        ...context,
        page_url: pageContext.page_url,
        referrer: pageContext.referrer,
      },
    };

    return emitEvent('lead.created', payload);
  }, [emitEvent]);

  /**
   * Track product view
   */
  const trackProductView = useCallback((product: {
    sku: string;
    name: string;
    price: number;
    category_slug?: string;
    category_name?: string;
  }) => {
    const pageContext = getPageContext();
    
    const payload: ProductViewedPayload = {
      product_sku: product.sku,
      product_name: product.name,
      product_price: product.price,
      category_slug: product.category_slug,
      category_name: product.category_name,
      page_url: pageContext.page_url,
      referrer: pageContext.referrer,
    };

    return emitEvent('product.viewed', payload);
  }, [emitEvent]);

  /**
   * Track cart updates
   */
  const trackCartUpdate = useCallback((
    action: CartUpdatedPayload['action'],
    items: CartUpdatedPayload['items'],
    cartTotal: number,
    changedItem?: CartUpdatedPayload['changed_item']
  ) => {
    const payload: CartUpdatedPayload = {
      action,
      items,
      cart_total: cartTotal,
      item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      changed_item: changedItem,
    };

    return emitEvent('cart.updated', payload);
  }, [emitEvent]);

  /**
   * Track checkout start
   */
  const trackCheckoutStart = useCallback((
    items: CheckoutStartedPayload['items'],
    subtotal: number,
    shippingOption?: 'pickup' | 'delivery',
    estimatedTotal?: number
  ) => {
    const payload: CheckoutStartedPayload = {
      items,
      subtotal,
      shipping_option: shippingOption,
      estimated_total: estimatedTotal || subtotal,
    };

    return emitEvent('checkout.started', payload);
  }, [emitEvent]);

  /**
   * Track cart abandonment
   */
  const trackCartAbandoned = useCallback((
    items: CartAbandonedPayload['items'],
    totalEstimated: number
  ) => {
    const payload: CartAbandonedPayload = {
      items,
      total_estimated: totalEstimated,
      last_seen_at: new Date().toISOString(),
      session_duration_ms: getSessionDuration(),
    };

    return emitEvent('cart.abandoned', payload);
  }, [emitEvent]);

  /**
   * Get correlation ID for the current session
   */
  const getSessionCorrelationId = useCallback(() => {
    return getCorrelationId();
  }, []);

  return {
    emitEvent,
    trackLead,
    trackProductView,
    trackCartUpdate,
    trackCheckoutStart,
    trackCartAbandoned,
    getSessionCorrelationId,
  };
}

/**
 * Hook to subscribe to events
 */
export function useEventSubscription(
  eventType: EventType | '*',
  handler: (event: EventEnvelope) => void
) {
  useEffect(() => {
    const unsubscribe = subscribe(eventType, handler);
    return unsubscribe;
  }, [eventType, handler]);
}
