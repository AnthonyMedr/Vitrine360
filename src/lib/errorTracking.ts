/**
 * Global Error Tracking
 * Captures unhandled errors and promise rejections,
 * logs them to the outbox for auditability and future webhook delivery.
 */

import { emit } from '@/data/events/eventBus';
import { addToOutbox } from '@/data/events/outbox';

interface ErrorPayload {
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  type: 'error' | 'unhandled_rejection';
  url: string;
  timestamp: string;
}

let initialized = false;

/**
 * Initialize global error tracking
 * Call once at app bootstrap (main.tsx)
 */
export function initErrorTracking(): void {
  if (initialized) return;
  initialized = true;

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    const payload: ErrorPayload = {
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'error',
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    trackError(payload);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    const payload: ErrorPayload = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: 'unhandled_rejection',
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    trackError(payload);
  });

  console.info('[ErrorTracking] Initialized global error tracking');
}

function trackError(payload: ErrorPayload): void {
  // Always log to console
  console.error('[ErrorTracking]', payload.type, payload.message);

  // Emit as event and persist in outbox for auditability
  try {
    const event = emit('error.tracked', payload);
    addToOutbox(event);
  } catch {
    // Avoid infinite loops if event system itself errors
    console.error('[ErrorTracking] Failed to persist error event');
  }
}
