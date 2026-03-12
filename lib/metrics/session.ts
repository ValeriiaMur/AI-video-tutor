// ============================================================
// Session Metrics Aggregator
// Tracks quality metrics across the entire tutoring session
// ============================================================

import type { SessionMetrics, LatencyBreakdown, Exchange } from '@/types';

export class SessionMetricsCollector {
  private breakdowns: LatencyBreakdown[] = [];
  private exchanges: Exchange[] = [];
  private conceptsCovered: Set<string> = new Set();
  private sessionStart: number = Date.now();

  // Cost per unit (estimated)
  private static COST_PER_STT_MINUTE = 0.0077;
  private static COST_PER_1K_INPUT_TOKENS = 0.0008;
  private static COST_PER_1K_OUTPUT_TOKENS = 0.004;
  private static COST_PER_1K_TTS_CHARS = 0.006;

  addLatencyBreakdown(breakdown: LatencyBreakdown): void {
    this.breakdowns.push(breakdown);
  }

  addExchange(exchange: Exchange): void {
    this.exchanges.push(exchange);
  }

  addConcept(concept: string): void {
    this.conceptsCovered.add(concept);
  }

  /** Calculate the Socratic score: % of tutor responses that end with a question */
  calculateSocraticScore(): number {
    if (this.exchanges.length === 0) return 0;
    const questionsCount = this.exchanges.filter((e) =>
      e.tutorResponse.trim().endsWith('?')
    ).length;
    return (questionsCount / this.exchanges.length) * 100;
  }

  /** Estimate session cost in USD */
  estimateCost(): number {
    const audioMinutes = (Date.now() - this.sessionStart) / 60000;
    const totalTutorChars = this.exchanges.reduce(
      (sum, e) => sum + e.tutorResponse.length, 0
    );
    const totalStudentChars = this.exchanges.reduce(
      (sum, e) => sum + e.studentInput.length, 0
    );

    // Rough token estimation (1 token ≈ 4 chars)
    const inputTokens = (totalStudentChars + totalTutorChars * 0.3) / 4; // context
    const outputTokens = totalTutorChars / 4;

    const sttCost = audioMinutes * SessionMetricsCollector.COST_PER_STT_MINUTE;
    const llmCost =
      (inputTokens / 1000) * SessionMetricsCollector.COST_PER_1K_INPUT_TOKENS +
      (outputTokens / 1000) * SessionMetricsCollector.COST_PER_1K_OUTPUT_TOKENS;
    const ttsCost = (totalTutorChars / 1000) * SessionMetricsCollector.COST_PER_1K_TTS_CHARS;

    return sttCost + llmCost + ttsCost;
  }

  /** Build complete session metrics */
  build(): SessionMetrics {
    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      totalExchanges: this.exchanges.length,
      avgE2eLatencyMs: avg(this.breakdowns.map((b) => b.e2eMs).filter((v) => v >= 0)),
      avgTtftMs: avg(this.breakdowns.map((b) => b.llmTtftMs).filter((v) => v >= 0)),
      avgTtfbMs: avg(this.breakdowns.map((b) => b.ttsTtfbMs).filter((v) => v >= 0)),
      avgLipSyncOffsetMs: avg(
        this.breakdowns.map((b) => b.avatarRenderMs).filter((v) => v >= 0)
      ),
      socraticScore: this.calculateSocraticScore(),
      conceptsCovered: this.conceptsCovered.size,
      estimatedCostUsd: this.estimateCost(),
      latencyBreakdowns: [...this.breakdowns],
    };
  }

  reset(): void {
    this.breakdowns = [];
    this.exchanges = [];
    this.conceptsCovered.clear();
    this.sessionStart = Date.now();
  }
}
