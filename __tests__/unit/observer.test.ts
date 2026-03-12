// ============================================================
// Unit Tests: AI Observability System
// Tests: 24-26
// ============================================================

import { AIObserver, getObserver, resetObserver } from '@/lib/metrics/observer';
import type { LatencyBreakdown } from '@/types';

describe('AIObserver', () => {
  let observer: AIObserver;

  beforeEach(() => {
    observer = new AIObserver('test-session');
  });

  // TEST 24: Logs pipeline stage events
  test('logs and retrieves pipeline stage events', () => {
    observer.logStage('stt', { event: 'connected', model: 'nova-2' });
    observer.logStage('llm', { event: 'first_token', latencyMs: 200 });

    const events = observer.getEventsByType('pipeline_stage');
    expect(events.length).toBe(2);
    expect(events[0].stage).toBe('stt');
    expect(events[1].data).toEqual({ event: 'first_token', latencyMs: 200 });
  });

  // TEST 25: Error logging works
  test('logs errors with stack trace', () => {
    const error = new Error('Connection failed');
    observer.logError('tts', error);

    const errors = observer.getEventsByType('error');
    expect(errors.length).toBe(1);
    expect(errors[0].stage).toBe('tts');
    expect(errors[0].data.message).toBe('Connection failed');
    expect(errors[0].data.stack).toBeDefined();
  });

  // TEST 26: Summary provides correct counts
  test('generates accurate event summary', () => {
    observer.logStage('stt', { event: 'test' });
    observer.logStage('llm', { event: 'test' });
    observer.logError('tts', 'error');
    observer.logLatency({
      sttMs: 100, llmTtftMs: 200, llmTotalMs: 500, ttsTtfbMs: 150,
      ttsTotalMs: 400, avatarRenderMs: 50, networkMs: 30, e2eMs: 530,
      timestamp: Date.now(),
    });

    const summary = observer.getSummary();
    expect(summary.totalEvents).toBe(4);
    expect(summary.stageEvents).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.metrics).toBe(1);
  });

  // TEST 27: Event subscription works
  test('subscribers receive events', () => {
    const received: string[] = [];
    const unsub = observer.subscribe((event) => {
      received.push(event.eventType);
    });

    observer.logStage('stt', {});
    observer.logError('llm', 'test');

    expect(received).toEqual(['pipeline_stage', 'error']);

    unsub(); // Unsubscribe
    observer.logStage('tts', {});
    expect(received.length).toBe(2); // No new events
  });

  // TEST 28: Export JSON format
  test('exports valid JSON with all events', () => {
    observer.logStage('stt', { test: true });

    const json = observer.exportJSON();
    const parsed = JSON.parse(json);

    expect(parsed.sessionId).toBe('test-session');
    expect(parsed.traceId).toBeDefined();
    expect(parsed.events).toHaveLength(1);
    expect(parsed.summary.totalEvents).toBe(1);
    expect(parsed.exportedAt).toBeDefined();
  });
});

describe('Observer Singleton', () => {
  afterEach(() => resetObserver());

  test('getObserver returns singleton per session', () => {
    const obs1 = getObserver('session-1');
    const obs2 = getObserver('session-2');
    expect(obs1).toBe(obs2); // Same singleton
  });
});
