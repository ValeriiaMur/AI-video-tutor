// ============================================================
// Unit Tests: Context Management & Session Metrics
// Tests: 20-22
// ============================================================

import { SlidingWindowContext } from '@/lib/context/window';
import { SessionMetricsCollector } from '@/lib/metrics/session';
import type { Exchange, LatencyBreakdown } from '@/types';

describe('SlidingWindowContext', () => {
  let context: SlidingWindowContext;

  beforeEach(() => {
    context = new SlidingWindowContext(4, 500);
  });

  // TEST 20: Sliding window trims old messages
  test('trims messages when exceeding max window size', () => {
    context.add('user', 'Message 1');
    context.add('assistant', 'Response 1');
    context.add('user', 'Message 2');
    context.add('assistant', 'Response 2');
    context.add('user', 'Message 3');

    const window = context.getWindow();
    expect(window.length).toBe(4); // Max 4 messages
    expect(window[0].content).toBe('Response 1'); // Oldest message trimmed
  });

  // TEST 21: Token estimation works
  test('estimates tokens correctly', () => {
    context.add('user', 'Hello world'); // ~3 tokens
    context.add('assistant', 'Hi there, how are you doing today?'); // ~9 tokens

    const tokens = context.estimateTokens();
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  test('provides Anthropic-formatted messages', () => {
    context.add('user', 'Test');
    context.add('assistant', 'Response');

    const messages = context.toAnthropicMessages();
    expect(messages).toEqual([
      { role: 'user', content: 'Test' },
      { role: 'assistant', content: 'Response' },
    ]);
  });

  test('clear removes all messages', () => {
    context.add('user', 'Test');
    context.clear();
    expect(context.getCount()).toBe(0);
    expect(context.getWindow()).toEqual([]);
  });
});

describe('SessionMetricsCollector', () => {
  let collector: SessionMetricsCollector;

  beforeEach(() => {
    collector = new SessionMetricsCollector();
  });

  // TEST 22: Socratic score calculation
  test('calculates Socratic score based on question-ending responses', () => {
    const makeExchange = (response: string): Exchange => ({
      id: 'test',
      studentInput: 'input',
      tutorResponse: response,
      timestamp: Date.now(),
      latencyBreakdown: {} as LatencyBreakdown,
    });

    collector.addExchange(makeExchange('What do you think about that?'));
    collector.addExchange(makeExchange('Great job!'));
    collector.addExchange(makeExchange('Can you explain why?'));
    collector.addExchange(makeExchange('That is correct.'));

    const score = collector.calculateSocraticScore();
    expect(score).toBe(50); // 2 out of 4 end with ?
  });

  // TEST 23: Session metrics build
  test('builds complete session metrics', () => {
    const breakdown: LatencyBreakdown = {
      sttMs: 100, llmTtftMs: 200, llmTotalMs: 500, ttsTtfbMs: 150,
      ttsTotalMs: 400, avatarRenderMs: 50, networkMs: 30, e2eMs: 530,
      timestamp: Date.now(),
    };

    collector.addLatencyBreakdown(breakdown);
    collector.addConcept('neural networks');
    collector.addExchange({
      id: 'test',
      studentInput: 'What are neural networks?',
      tutorResponse: 'Great question! Have you ever noticed how you recognize faces?',
      timestamp: Date.now(),
      latencyBreakdown: breakdown,
    });

    const metrics = collector.build();
    expect(metrics.totalExchanges).toBe(1);
    expect(metrics.avgE2eLatencyMs).toBe(530);
    expect(metrics.conceptsCovered).toBe(1);
    expect(metrics.socraticScore).toBe(100); // Ends with ?
    expect(metrics.estimatedCostUsd).toBeGreaterThan(0);
  });
});
