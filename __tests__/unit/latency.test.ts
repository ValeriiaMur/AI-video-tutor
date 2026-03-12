// ============================================================
// Unit Tests: Latency Tracking & Benchmarking
// Tests: 1-4
// ============================================================

import { LatencyTracker, checkLatencyBudget, formatLatencyReport, calculateLatencyStats, LATENCY_BUDGET } from '@/lib/metrics/latency';
import type { LatencyBreakdown } from '@/types';

describe('LatencyTracker', () => {
  let tracker: LatencyTracker;

  beforeEach(() => {
    tracker = new LatencyTracker();
  });

  // TEST 1: Latency timer accuracy
  test('accurately measures elapsed time between mark and measure', async () => {
    tracker.mark('test_stage');
    await new Promise((r) => setTimeout(r, 50));
    const elapsed = tracker.measure('test_stage');

    // Should be approximately 50ms (±30ms tolerance for timer precision)
    expect(elapsed).toBeGreaterThan(20);
    expect(elapsed).toBeLessThan(100);
  });

  // TEST 2: Returns -1 for unmeasured stages
  test('returns -1 for stages that were not marked', () => {
    expect(tracker.get('nonexistent')).toBe(-1);
    expect(tracker.measure('nonexistent')).toBe(-1);
  });

  // TEST 3: Builds complete latency breakdown
  test('builds a complete latency breakdown object', async () => {
    tracker.mark('stt');
    tracker.mark('llm_ttft');
    tracker.mark('e2e');

    await new Promise((r) => setTimeout(r, 10));
    tracker.measure('stt');
    tracker.measure('llm_ttft');
    tracker.measure('e2e');

    const breakdown = tracker.buildBreakdown();

    expect(breakdown.sttMs).toBeGreaterThan(0);
    expect(breakdown.llmTtftMs).toBeGreaterThan(0);
    expect(breakdown.e2eMs).toBeGreaterThan(0);
    expect(breakdown.timestamp).toBeGreaterThan(0);
    // Unmeasured stages should be -1
    expect(breakdown.ttsTtfbMs).toBe(-1);
  });

  // TEST 4: Reset clears all data
  test('reset clears all marks and measurements', () => {
    tracker.mark('test');
    tracker.measure('test');
    expect(tracker.get('test')).toBeGreaterThanOrEqual(0);

    tracker.reset();
    expect(tracker.get('test')).toBe(-1);
    expect(tracker.getAllMeasurements()).toEqual({});
  });
});

describe('checkLatencyBudget', () => {
  // TEST 5: Budget check passes for good latencies
  test('correctly identifies passing measurements', () => {
    const measurements = {
      stt: 100,
      llm_ttft: 150,
      tts_ttfb: 120,
      avatar_render: 50,
      network: 30,
      e2e: 450,
    };

    const results = checkLatencyBudget(measurements);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  // TEST 6: Budget check fails for exceeded latencies
  test('correctly identifies failing measurements', () => {
    const measurements = {
      stt: 500,   // Over max 300
      llm_ttft: 600, // Over max 400
      e2e: 2000,    // Over max 1000
    };

    const results = checkLatencyBudget(measurements);
    const sttResult = results.find((r) => r.stage === 'stt');
    expect(sttResult?.passed).toBe(false);

    const llmResult = results.find((r) => r.stage === 'llm_ttft');
    expect(llmResult?.passed).toBe(false);
  });
});

describe('calculateLatencyStats', () => {
  // TEST 7: Calculates statistics over multiple breakdowns
  test('computes avg, p50, p95, min, max correctly', () => {
    const breakdowns: LatencyBreakdown[] = [
      { sttMs: 100, llmTtftMs: 200, llmTotalMs: 500, ttsTtfbMs: 150, ttsTotalMs: 400, avatarRenderMs: 50, networkMs: 30, e2eMs: 500, timestamp: 1 },
      { sttMs: 150, llmTtftMs: 250, llmTotalMs: 600, ttsTtfbMs: 180, ttsTotalMs: 450, avatarRenderMs: 60, networkMs: 40, e2eMs: 650, timestamp: 2 },
      { sttMs: 120, llmTtftMs: 220, llmTotalMs: 550, ttsTtfbMs: 160, ttsTotalMs: 420, avatarRenderMs: 55, networkMs: 35, e2eMs: 580, timestamp: 3 },
    ];

    const stats = calculateLatencyStats(breakdowns);

    // Average STT should be ~123.3ms
    expect(stats.avg.sttMs).toBeCloseTo(123.3, 0);
    expect(stats.min.sttMs).toBe(100);
    expect(stats.max.sttMs).toBe(150);
    expect(stats.p50.sttMs).toBe(120);
  });

  // TEST 8: Handles empty breakdowns array
  test('returns zeros for empty array', () => {
    const stats = calculateLatencyStats([]);
    expect(stats.avg.sttMs).toBe(0);
    expect(stats.p50.e2eMs).toBe(0);
  });
});

describe('formatLatencyReport', () => {
  test('formats breakdown as readable table', () => {
    const breakdown: LatencyBreakdown = {
      sttMs: 120, llmTtftMs: 200, llmTotalMs: 500, ttsTtfbMs: 150,
      ttsTotalMs: 400, avatarRenderMs: 50, networkMs: 30, e2eMs: 550,
      timestamp: Date.now(),
    };
    const report = formatLatencyReport(breakdown);
    expect(report).toContain('STT');
    expect(report).toContain('E2E Total');
    expect(report).toContain('120 ms');
  });
});
