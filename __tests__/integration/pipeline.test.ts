// ============================================================
// Integration Tests: Pipeline Flow
// Tests: 31-34 (using mock services)
// ============================================================

import { PipelineOrchestrator } from '@/lib/pipeline/orchestrator';
import type { PipelineEvent, AvatarState } from '@/types';

describe('PipelineOrchestrator (Mock Mode)', () => {
  let orchestrator: PipelineOrchestrator;
  let events: PipelineEvent[];

  beforeEach(() => {
    events = [];
    orchestrator = new PipelineOrchestrator({
      topic: 'Neural Networks',
      gradeLevel: '6-8',
      useMocks: true,
    });
    orchestrator.onEvent((event) => events.push(event));
  });

  // TEST 31: Pipeline initializes and emits session_start
  test('initializes successfully and emits session_start', async () => {
    await orchestrator.initialize();

    const startEvent = events.find((e) => e.type === 'session_start');
    expect(startEvent).toBeDefined();
    if (startEvent?.type === 'session_start') {
      expect(startEvent.topic).toBe('Neural Networks');
      expect(startEvent.gradeLevel).toBe('6-8');
    }
  });

  // TEST 32: Text input triggers full pipeline flow
  test('text input flows through LLM and produces events', async () => {
    await orchestrator.initialize();
    await orchestrator.handleTextInput('What is a neural network?');

    // Wait for async processing
    await new Promise((r) => setTimeout(r, 2000));

    const tokenEvents = events.filter((e) => e.type === 'llm_token');
    const doneEvents = events.filter((e) => e.type === 'llm_done');
    const stateEvents = events.filter((e) => e.type === 'avatar_state');

    expect(tokenEvents.length).toBeGreaterThan(0);
    expect(doneEvents.length).toBe(1);

    // Should transition through thinking → speaking states
    const states = stateEvents.map((e) => (e as { state: AvatarState }).state);
    expect(states).toContain('thinking');
  }, 5000);

  // TEST 33: Metrics are emitted after exchange
  test('emits latency metrics after completing exchange', async () => {
    await orchestrator.initialize();
    await orchestrator.handleTextInput('Hello');

    await new Promise((r) => setTimeout(r, 2000));

    const metricsEvents = events.filter((e) => e.type === 'metrics');
    expect(metricsEvents.length).toBeGreaterThanOrEqual(1);

    if (metricsEvents[0]?.type === 'metrics') {
      expect(metricsEvents[0].breakdown.e2eMs).toBeGreaterThan(0);
      expect(metricsEvents[0].breakdown.timestamp).toBeGreaterThan(0);
    }
  }, 5000);

  // TEST 34: Session end returns complete metrics
  test('endSession returns session metrics and observability data', async () => {
    await orchestrator.initialize();
    await orchestrator.handleTextInput('What is AI?');
    await new Promise((r) => setTimeout(r, 2000));

    const result = orchestrator.endSession();

    expect(result.metrics).toBeDefined();
    expect(result.metrics.totalExchanges).toBeGreaterThanOrEqual(1);
    expect(result.observability).toBeDefined();

    const obsData = JSON.parse(result.observability);
    expect(obsData.sessionId).toBeDefined();
    expect(obsData.events.length).toBeGreaterThan(0);
  }, 5000);
});

describe('Pipeline Event Ordering', () => {
  // TEST 35: Events arrive in correct order
  test('pipeline events follow expected sequence', async () => {
    const events: string[] = [];
    const orchestrator = new PipelineOrchestrator({
      topic: 'Test',
      gradeLevel: '9-10',
      useMocks: true,
    });
    orchestrator.onEvent((event) => events.push(event.type));

    await orchestrator.initialize();
    await orchestrator.handleTextInput('Test question');
    await new Promise((r) => setTimeout(r, 2000));

    // Expected order: session_start, stt_transcript, avatar_state(thinking),
    // llm_token(s), avatar_state(speaking), llm_done, tts_audio, metrics, tts_done, avatar_state(idle)
    const sessionStartIdx = events.indexOf('session_start');
    const firstTokenIdx = events.indexOf('llm_token');
    const doneIdx = events.indexOf('llm_done');

    expect(sessionStartIdx).toBeLessThan(firstTokenIdx);
    expect(firstTokenIdx).toBeLessThan(doneIdx);
  }, 5000);
});
