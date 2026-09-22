/**
 * useCartAbandonment Hook
 * Detects cart abandonment via inactivity heuristic
 * Emits 'cart.abandoned' event when user is idle with items in cart
 */

import { useEffect, useRef, useCallback } from 'react';
import { useCart } from '@/contexts/CartContext';
import { emit } from '@/data/events/eventBus';
import { addToOutbox } from '@/data/events/outbox';
import { getSessionDuration } from '@/data/events/eventBus';
import type { CartAbandonedPayload } from '@/domain/types';
import { apiFetch } from '@/lib/api';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

export function useCartAbandonment() {
  const { items, totalPrice } = useCart();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFiredRef = useRef(false);
  const lastItemCountRef = useRef(0);

  // Reset fired flag when cart changes
  useEffect(() => {
    if (items.length !== lastItemCountRef.current) {
      hasFiredRef.current = false;
      lastItemCountRef.current = items.length;
    }
  }, [items.length]);

  const emitAbandonment = useCallback(() => {
    if (items.length === 0 || hasFiredRef.current) return;

    hasFiredRef.current = true;

    const payload: CartAbandonedPayload = {
      items: items.map((item) => ({
        sku: item.product.sku || item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unit_price: Number(item.product.price),
      })),
      total_estimated: totalPrice,
      last_seen_at: new Date().toISOString(),
      session_duration_ms: getSessionDuration(),
    };

    const event = emit('cart.abandoned', payload);
    addToOutbox(event);
    void apiFetch('/api/leads/cart-abandonment', {
      method: 'POST',
      body: JSON.stringify({
        items: payload.items,
        totalEstimated: payload.total_estimated,
        pageOrigin: '/carrinho',
        correlationId: event.correlation_id,
      }),
    }).catch(() => undefined);
  }, [items, totalPrice]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (items.length > 0 && !hasFiredRef.current) {
      timerRef.current = setTimeout(emitAbandonment, INACTIVITY_TIMEOUT_MS);
    }
  }, [items.length, emitAbandonment]);

  useEffect(() => {
    if (items.length === 0) return;

    // Start timer
    resetTimer();

    // Listen for activity
    const handleActivity = () => resetTimer();
    ACTIVITY_EVENTS.forEach((event) =>
      document.addEventListener(event, handleActivity, { passive: true })
    );

    // Fire on page unload if cart has items
    const handleBeforeUnload = () => {
      if (items.length > 0 && !hasFiredRef.current) {
        emitAbandonment();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Fire on visibility change (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden && items.length > 0 && !hasFiredRef.current) {
        // Start a shorter timer when tab is hidden
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(emitAbandonment, 60_000); // 1 min if tab hidden
      } else {
        resetTimer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) =>
        document.removeEventListener(event, handleActivity)
      );
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [items.length, resetTimer, emitAbandonment]);
}
