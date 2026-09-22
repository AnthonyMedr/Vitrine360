/**
 * Event Bus
 * Local event bus for tracking user journey and conversion events
 * Follows standard envelope pattern for OmniGrow CRM integration
 */

import type { EventEnvelope, EventType } from '@/domain/types';

type EventHandler = (event: EventEnvelope) => void;

interface EventBusState {
  handlers: Map<EventType | '*', Set<EventHandler>>;
  correlationId: string;
  sessionStartedAt: string;
}

const SOURCE = 'gamel_web';

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Generate correlation ID for session tracking
function generateCorrelationId(): string {
  const stored = sessionStorage.getItem('omnigrow_correlation_id');
  if (stored) return stored;
  
  const newId = generateId();
  sessionStorage.setItem('omnigrow_correlation_id', newId);
  return newId;
}

// Event bus singleton state
const state: EventBusState = {
  handlers: new Map(),
  correlationId: generateCorrelationId(),
  sessionStartedAt: new Date().toISOString(),
};

/**
 * Subscribe to events
 * @param eventType - Specific event type or '*' for all events
 * @param handler - Callback function
 * @returns Unsubscribe function
 */
export function subscribe(eventType: EventType | '*', handler: EventHandler): () => void {
  if (!state.handlers.has(eventType)) {
    state.handlers.set(eventType, new Set());
  }
  state.handlers.get(eventType)!.add(handler);

  return () => {
    state.handlers.get(eventType)?.delete(handler);
  };
}

/**
 * Emit an event to all subscribers
 * @param eventType - The type of event
 * @param payload - Event payload data
 * @returns The created event envelope
 */
export function emit<T>(eventType: EventType, payload: T): EventEnvelope<T> {
  const event: EventEnvelope<T> = {
    event_id: generateId(),
    event_type: eventType,
    occurred_at: new Date().toISOString(),
    source: SOURCE,
    correlation_id: state.correlationId,
    payload,
  };

  // Log in development
  if (import.meta.env.DEV) {
    console.log(`[EventBus] ${eventType}`, event);
  }

  // Notify specific handlers
  state.handlers.get(eventType)?.forEach((handler) => {
    try {
      handler(event);
    } catch (error) {
      console.error(`[EventBus] Handler error for ${eventType}:`, error);
    }
  });

  // Notify wildcard handlers
  state.handlers.get('*')?.forEach((handler) => {
    try {
      handler(event);
    } catch (error) {
      console.error(`[EventBus] Wildcard handler error:`, error);
    }
  });

  return event;
}

/**
 * Get current correlation ID for the session
 */
export function getCorrelationId(): string {
  return state.correlationId;
}

/**
 * Get session start time
 */
export function getSessionStartedAt(): string {
  return state.sessionStartedAt;
}

/**
 * Reset correlation ID (e.g., on logout)
 */
export function resetCorrelationId(): void {
  sessionStorage.removeItem('omnigrow_correlation_id');
  state.correlationId = generateCorrelationId();
  state.sessionStartedAt = new Date().toISOString();
}

/**
 * Get session duration in milliseconds
 */
export function getSessionDuration(): number {
  return Date.now() - new Date(state.sessionStartedAt).getTime();
}
