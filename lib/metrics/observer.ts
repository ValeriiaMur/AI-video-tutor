// ============================================================
// AI Observability System
// Structured logging, tracing, and metric collection
// ============================================================

import type { ObservabilityEvent, LatencyBreakdown, SessionMetrics } from '@/types';

export class AIObserver {
  private events: ObservabilityEvent[] = [];
  private sessionId: string;
  private traceId: string;
  private listeners: ((event: ObservabilityEvent) => void)[] = [];

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.traceId = generateTraceId();
  }

  /** Subscribe to observability events */
  subscribe(listener: (event: ObservabilityEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Log a pipeline stage event */
  logStage(stage: string, data: Record<string, unknown>): void {
    this.emit({
      eventType: 'pipeline_stage',
      stage,
      data,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      traceId: this.traceId,
    });
  }

  /** Log a session-level event */
  logSession(data: Record<string, unknown>): void {
    this.emit({
      eventType: 'session_event',
      data,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      traceId: this.traceId,
    });
  }

  /** Log an error */
  logError(stage: string, error: unknown): void {
    this.emit({
      eventType: 'error',
      stage,
      data: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      traceId: this.traceId,
    });
  }

  /** Log a latency metric */
  logLatency(breakdown: LatencyBreakdown): void {
    this.emit({
      eventType: 'metric',
      stage: 'latency',
      data: { ...breakdown },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      traceId: this.traceId,
    });
  }

  /** Log session completion metrics */
  logSessionEnd(metrics: SessionMetrics): void {
    this.emit({
      eventType: 'session_event',
      stage: 'session_end',
      data: {
        ...metrics,
        latencyBreakdowns: metrics.latencyBreakdowns.length,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
      traceId: this.traceId,
    });
  }

  /** Get all events */
  getEvents(): ObservabilityEvent[] {
    return [...this.events];
  }

  /** Get events filtered by type */
  getEventsByType(type: ObservabilityEvent['eventType']): ObservabilityEvent[] {
    return this.events.filter((e) => e.eventType === type);
  }

  /** Get a summary of all metrics */
  getSummary(): {
    totalEvents: number;
    stageEvents: number;
    errors: number;
    metrics: number;
    duration: number;
  } {
    const now = Date.now();
    const firstEvent = this.events[0]?.timestamp ?? now;
    return {
      totalEvents: this.events.length,
      stageEvents: this.events.filter((e) => e.eventType === 'pipeline_stage').length,
      errors: this.events.filter((e) => e.eventType === 'error').length,
      metrics: this.events.filter((e) => e.eventType === 'metric').length,
      duration: now - firstEvent,
    };
  }

  /** Export all events as JSON (for persistence/analysis) */
  exportJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      traceId: this.traceId,
      events: this.events,
      summary: this.getSummary(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /** Start a new trace (for a new exchange) */
  newTrace(): string {
    this.traceId = generateTraceId();
    return this.traceId;
  }

  private emit(event: ObservabilityEvent): void {
    this.events.push(event);
    // Console output for development
    const prefix = `[AI-OBS][${event.eventType}]`;
    const stage = event.stage ? `[${event.stage}]` : '';
    console.log(`${prefix}${stage}`, event.data);
    // Notify listeners
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* swallow listener errors */ }
    }
  }
}

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/** Singleton observer store for client-side usage */
let currentObserver: AIObserver | null = null;

export function getObserver(sessionId?: string): AIObserver {
  if (!currentObserver && sessionId) {
    currentObserver = new AIObserver(sessionId);
  }
  if (!currentObserver) {
    currentObserver = new AIObserver('default');
  }
  return currentObserver;
}

export function resetObserver(): void {
  currentObserver = null;
}
