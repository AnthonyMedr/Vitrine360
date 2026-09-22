/**
 * useOutbox Hook
 * React hook for managing the event outbox
 */

import { useCallback, useState, useEffect } from 'react';
import {
  getAllEntries,
  getOutboxStats,
  cleanupOutbox,
  clearOutbox,
} from '@/data/events/outbox';
import {
  processPendingEvents,
  getWebhookStatus,
  isWebhookConfigured,
} from '@/data/events/webhookClient';
import type { OutboxEntry } from '@/domain/types';

interface OutboxStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  expired: number;
}

interface WebhookStatus {
  enabled: boolean;
  configured: boolean;
  url: string | undefined;
  signed: boolean;
}

export function useOutbox() {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [stats, setStats] = useState<OutboxStats>({
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    expired: 0,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessResult, setLastProcessResult] = useState<{
    processed: number;
    succeeded: number;
    failed: number;
  } | null>(null);

  /**
   * Refresh entries and stats from storage
   */
  const refresh = useCallback(() => {
    setEntries(getAllEntries());
    setStats(getOutboxStats());
  }, []);

  /**
   * Process pending events (send to webhook if configured)
   */
  const process = useCallback(async () => {
    if (!isWebhookConfigured()) {
      console.info('[useOutbox] Webhook not configured, skipping process');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    setIsProcessing(true);
    try {
      const result = await processPendingEvents();
      setLastProcessResult(result);
      refresh();
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [refresh]);

  /**
   * Clean up old/expired entries
   */
  const cleanup = useCallback(() => {
    const removed = cleanupOutbox();
    refresh();
    return removed;
  }, [refresh]);

  /**
   * Clear all entries (use with caution)
   */
  const clear = useCallback(() => {
    clearOutbox();
    refresh();
  }, [refresh]);

  /**
   * Get webhook configuration status
   */
  const webhookStatus = useCallback((): WebhookStatus => {
    return getWebhookStatus();
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Periodic cleanup (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      cleanup();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [cleanup]);

  return {
    entries,
    stats,
    isProcessing,
    lastProcessResult,
    refresh,
    process,
    cleanup,
    clear,
    webhookStatus,
    isWebhookConfigured: isWebhookConfigured(),
  };
}
