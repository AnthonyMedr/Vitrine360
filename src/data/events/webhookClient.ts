/**
 * Webhook Client
 * Sends events to OmniGrow CRM (disabled by default via ENV)
 * Implements retry and backoff. Browser code must not hold webhook secrets.
 */

import type { EventEnvelope } from '@/domain/types';
import { getPendingEntries, markAsSent, markAsFailed } from './outbox';

// Environment configuration
const WEBHOOK_ENABLED = import.meta.env.VITE_OMNIGROW_WEBHOOK_ENABLED === 'true';
const WEBHOOK_URL = import.meta.env.VITE_OMNIGROW_WEBHOOK_URL;

const BATCH_SIZE = 10;
const TIMEOUT_MS = 10000;

/**
 * Check if webhook is properly configured
 */
export function isWebhookConfigured(): boolean {
  return WEBHOOK_ENABLED && !!WEBHOOK_URL;
}

/**
 * Send a single event to the webhook
 */
export async function sendEvent(event: EventEnvelope): Promise<{ success: boolean; error?: string }> {
  if (!isWebhookConfigured()) {
    return { success: false, error: 'Webhook not configured' };
  }

  try {
    const payload = JSON.stringify(event);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'gamel_web',
        'X-Event-Type': event.event_type,
        'X-Event-Id': event.event_id,
        'X-Correlation-Id': event.correlation_id,
      },
      body: payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Process pending events from outbox
 * Call this periodically or on specific triggers
 */
export async function processPendingEvents(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (!isWebhookConfigured()) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const pending = getPendingEntries().slice(0, BATCH_SIZE);
  let succeeded = 0;
  let failed = 0;

  for (const entry of pending) {
    const result = await sendEvent(entry.event);
    
    if (result.success) {
      markAsSent(entry.id);
      succeeded++;
    } else {
      markAsFailed(entry.id, result.error || 'Unknown error');
      failed++;
    }
  }

  if (import.meta.env.DEV && pending.length > 0) {
    console.log(`[WebhookClient] Processed ${pending.length} events: ${succeeded} sent, ${failed} failed`);
  }

  return { processed: pending.length, succeeded, failed };
}

/**
 * Get webhook status for admin/debugging
 */
export function getWebhookStatus(): {
  enabled: boolean;
  configured: boolean;
  url: string | undefined;
  signed: boolean;
} {
  return {
    enabled: WEBHOOK_ENABLED,
    configured: isWebhookConfigured(),
    url: WEBHOOK_URL,
    signed: false,
  };
}
