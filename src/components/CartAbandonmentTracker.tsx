/**
 * CartAbandonmentTracker
 * Wrapper component that activates cart abandonment detection
 * Must be rendered inside CartProvider
 */

import { useCartAbandonment } from '@/hooks/useCartAbandonment';

export function CartAbandonmentTracker() {
  useCartAbandonment();
  return null;
}
