// ============================================================
// Latency Tracking & Benchmarking Framework
// Per-stage measurement with high-resolution timestamps
// ============================================================

import type { LatencyBreakdown, LatencyBenchmark } from '@/types';

export class LatencyTracker {
  private marks: Map<string, number> = new Map();
  private measurements: Map<string, number> = new Map();

  /** Mark the start of a stage */
  mark(stage: string): void {
    this.marks.set(stage, performance.now());
  }

  /** Measure elapsed time since a mark */
  measure(stage: string): number {
    const start = this.marks.get(stage);
    if (!start) {
      console.warn(`[LatencyTracker] No mark found for stage: ${stage}`);
      return -1;
    }
    const elapsed = performance.now() - start;
    this.measurements.set(stage, elapsed);
    return elapsed;
  }

  /** Get a measurement value */
  get(stage: string): number {
    return this.measurements.get(stage) ?? -1;
  }

  /** Build a complete latency breakdown */
  buildBreakdown(): LatencyBreakdown {
    return {
      sttMs: this.get('stt'),
      llmTtftMs: this.get('llm_ttft'),
      llmTotalMs: this.get('llm_total'),
      ttsTtfbMs: this.get('tts_ttfb'),
      ttsTotalMs: this.get('tts_total'),
      avatarRenderMs: this.get('avatar_render'),
      networkMs: this.get('network'),
      e2eMs: this.get('e2e'),
      timestamp: Date.now(),
    };
  }

  /** Reset all marks and measurements */
  reset(): void {
    this.marks.clear();
    this.measurements.clear();
  }

  /** Get all measurements as a record */
  getAllMeasurements(): Record<string, number> {
    return Object.fromEntries(this.measurements);
  }
}

// --- Latency Budget Definitions ---
export const LATENCY_BUDGET: Record<string, { target: number; max: number }> = {
  stt: { target: 150, max: 300 },
  llm_ttft: { target: 200, max: 400 },
  tts_ttfb: { target: 150, max: 300 },
  avatar_render: { target: 100, max: 200 },
  network: { target: 50, max: 100 },
  e2e: { target: 500, max: 1000 },
};

/** Run a benchmark check against the latency budget */
export function checkLatencyBudget(
  measurements: Record<string, number>
): LatencyBenchmark[] {
  return Object.entries(LATENCY_BUDGET).map(([stage, budget]) => {
    const measured = measurements[stage] ?? -1;
    return {
      stage,
      target: budget.target,
      maxAcceptable: budget.max,
      measured,
      passed: measured >= 0 && measured <= budget.max,
    };
  });
}

/** Format latency breakdown as a readable string */
export function formatLatencyReport(breakdown: LatencyBreakdown): string {
  const lines = [
    '┌─────────────────────────────────────┐',
    '│      Latency Breakdown (ms)         │',
    '├─────────────────┬───────────────────┤',
    `│ STT             │ ${pad(breakdown.sttMs)}│`,
    `│ LLM TTFT        │ ${pad(breakdown.llmTtftMs)}│`,
    `│ LLM Total       │ ${pad(breakdown.llmTotalMs)}│`,
    `│ TTS TTFB        │ ${pad(breakdown.ttsTtfbMs)}│`,
    `│ TTS Total       │ ${pad(breakdown.ttsTotalMs)}│`,
    `│ Avatar Render   │ ${pad(breakdown.avatarRenderMs)}│`,
    `│ Network         │ ${pad(breakdown.networkMs)}│`,
    '├─────────────────┼───────────────────┤',
    `│ E2E Total       │ ${pad(breakdown.e2eMs)}│`,
    '└─────────────────┴───────────────────┘',
  ];
  return lines.join('\n');
}

function pad(value: number): string {
  const str = value >= 0 ? `${Math.round(value)} ms` : 'N/A';
  return str.padStart(18, ' ');
}

/** Calculate statistics over multiple breakdowns */
export function calculateLatencyStats(breakdowns: LatencyBreakdown[]): {
  avg: LatencyBreakdown;
  p50: LatencyBreakdown;
  p95: LatencyBreakdown;
  min: LatencyBreakdown;
  max: LatencyBreakdown;
} {
  if (breakdowns.length === 0) {
    const empty: LatencyBreakdown = {
      sttMs: 0, llmTtftMs: 0, llmTotalMs: 0, ttsTtfbMs: 0,
      ttsTotalMs: 0, avatarRenderMs: 0, networkMs: 0, e2eMs: 0, timestamp: 0,
    };
    return { avg: empty, p50: empty, p95: empty, min: empty, max: empty };
  }

  const fields: (keyof LatencyBreakdown)[] = [
    'sttMs', 'llmTtftMs', 'llmTotalMs', 'ttsTtfbMs',
    'ttsTotalMs', 'avatarRenderMs', 'networkMs', 'e2eMs',
  ];

  const stats = (fn: (vals: number[]) => number): LatencyBreakdown => {
    const result: Record<string, number> = { timestamp: Date.now() };
    for (const field of fields) {
      const vals = breakdowns.map((b) => b[field] as number).filter((v) => v >= 0);
      result[field] = vals.length > 0 ? fn(vals) : -1;
    }
    return result as unknown as LatencyBreakdown;
  };

  const percentile = (vals: number[], p: number): number => {
    const sorted = [...vals].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };

  return {
    avg: stats((v) => v.reduce((a, b) => a + b, 0) / v.length),
    p50: stats((v) => percentile(v, 50)),
    p95: stats((v) => percentile(v, 95)),
    min: stats((v) => Math.min(...v)),
    max: stats((v) => Math.max(...v)),
  };
}
