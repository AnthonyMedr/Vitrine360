/**
 * Event Outbox
 * Persists events locally for reliability and future webhook delivery
 * Implements deduplication, retry logic, and backoff
 */

import type { EventEnvelope, OutboxEntry } from '@/domain/types';

const STORAGE_KEY = 'omnigrow_event_outbox';
const MAX_ENTRIES = 100;
const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;
const ENTRY_EXPIRY_HOURS = 72;

function debugLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}

/**
 * Get all outbox entries from storage
 */
function getEntries(): OutboxEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save entries to storage
 */
function saveEntries(entries: OutboxEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('[Outbox] Failed to save entries:', error);
  }
}

/**
 * Add an event to the outbox
 */
export function addToOutbox(event: EventEnvelope): OutboxEntry {
  const entries = getEntries();
  
  // Check for duplicates by event_id
  const exists = entries.some((e) => e.event.event_id === event.event_id);
  if (exists) {
    console.warn(`[Outbox] Duplicate event_id: ${event.event_id}`);
    return entries.find((e) => e.event.event_id === event.event_id)!;
  }

  const entry: OutboxEntry = {
    id: event.event_id,
    event,
    status: 'pending',
    attempts: 0,
    max_attempts: MAX_ATTEMPTS,
    created_at: new Date().toISOString(),
  };

  // Add new entry, remove oldest if over limit
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.pop();
  }

  saveEntries(entries);
  
  if (import.meta.env.DEV) {
    console.log('[Outbox] Event added:', event.event_type, event.event_id);
  }

  return entry;
}

/**
 * Get pending entries ready for retry
 */
export function getPendingEntries(): OutboxEntry[] {
  const entries = getEntries();
  const now = Date.now();

  return entries.filter((entry) => {
    if (entry.status !== 'pending' && entry.status !== 'failed') {
      return false;
    }
    if (entry.attempts >= entry.max_attempts) {
      return false;
    }
    if (entry.next_retry_at && new Date(entry.next_retry_at).getTime() > now) {
      return false;
    }
    return true;
  });
}

/**
 * Mark an entry as sent successfully
 */
export function markAsSent(eventId: string): void {
  const entries = getEntries();
  const index = entries.findIndex((e) => e.id === eventId);
  
  if (index !== -1) {
    entries[index].status = 'sent';
    entries[index].last_attempt_at = new Date().toISOString();
    saveEntries(entries);
  }
}

/**
 * Mark an entry as failed with retry scheduling
 */
export function markAsFailed(eventId: string, error: string): void {
  const entries = getEntries();
  const index = entries.findIndex((e) => e.id === eventId);
  
  if (index !== -1) {
    const entry = entries[index];
    entry.attempts += 1;
    entry.status = entry.attempts >= entry.max_attempts ? 'expired' : 'failed';
    entry.last_attempt_at = new Date().toISOString();
    entry.error = error;
    
    // Exponential backoff for retry
    if (entry.status === 'failed') {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, entry.attempts);
      entry.next_retry_at = new Date(Date.now() + delay).toISOString();
    }
    
    saveEntries(entries);
  }
}

/**
 * Remove old/expired entries
 */
export function cleanupOutbox(): number {
  const entries = getEntries();
  const expiryTime = Date.now() - (ENTRY_EXPIRY_HOURS * 60 * 60 * 1000);
  
  const filtered = entries.filter((entry) => {
    const createdAt = new Date(entry.created_at).getTime();
    // Keep if: not expired by time AND (pending/failed OR recently sent)
    if (createdAt < expiryTime) {
      return false;
    }
    if (entry.status === 'expired') {
      return false;
    }
    return true;
  });

  const removed = entries.length - filtered.length;
  if (removed > 0) {
    saveEntries(filtered);
    debugLog(`[Outbox] Cleaned up ${removed} entries`);
  }

  return removed;
}

/**
 * Get outbox statistics
 */
export function getOutboxStats(): {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  expired: number;
} {
  const entries = getEntries();
  return {
    total: entries.length,
    pending: entries.filter((e) => e.status === 'pending').length,
    sent: entries.filter((e) => e.status === 'sent').length,
    failed: entries.filter((e) => e.status === 'failed').length,
    expired: entries.filter((e) => e.status === 'expired').length,
  };
}

/**
 * Get all entries (for debugging/admin)
 */
export function getAllEntries(): OutboxEntry[] {
  return getEntries();
}

/**
 * Clear all entries (use with caution)
 */
export function clearOutbox(): void {
  localStorage.removeItem(STORAGE_KEY);
  debugLog('[Outbox] Cleared all entries');
}

/**
 * Reprocess a failed/expired entry by resetting it to pending
 */
export function reprocessEntry(eventId: string): boolean {
  const entries = getEntries();
  const index = entries.findIndex((e) => e.id === eventId);
  
  if (index === -1) return false;
  
  const entry = entries[index];
  if (entry.status !== 'failed' && entry.status !== 'expired') return false;
  
  entry.status = 'pending';
  entry.attempts = 0;
  entry.error = undefined;
  entry.next_retry_at = undefined;
  entry.last_attempt_at = undefined;
  
  saveEntries(entries);
  debugLog(`[Outbox] Reprocessing event: ${eventId}`);
  return true;
}
