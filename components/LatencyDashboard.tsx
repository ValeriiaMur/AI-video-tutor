'use client';
// ============================================================
// Latency Dashboard — Clean metric visualization
// ============================================================

import type { LatencyBreakdown, SessionMetrics } from '@/types';
import { LATENCY_BUDGET } from '@/lib/metrics/latency';

interface LatencyDashboardProps {
  currentBreakdown: LatencyBreakdown | null;
  sessionMetrics: SessionMetrics | null;
  isVisible: boolean;
}

export default function LatencyDashboard({
  currentBreakdown,
  sessionMetrics,
  isVisible,
}: LatencyDashboardProps) {
  if (!isVisible) return null;

  return (
    <div className="space-y-6">
      {/* Pipeline Latency */}
      <div>
        <h3 className="label-upper mb-3">Pipeline Latency</h3>

        {currentBreakdown ? (
          <div className="space-y-2.5">
            <LatencyBar label="STT" value={currentBreakdown.sttMs} budget={LATENCY_BUDGET.stt} />
            <LatencyBar label="LLM TTFT" value={currentBreakdown.llmTtftMs} budget={LATENCY_BUDGET.llm_ttft} />
            <LatencyBar label="TTS TTFB" value={currentBreakdown.ttsTtfbMs} budget={LATENCY_BUDGET.tts_ttfb} />
            <LatencyBar label="Avatar" value={currentBreakdown.avatarRenderMs} budget={LATENCY_BUDGET.avatar_render} />

            <div className="divider my-2" />

            <LatencyBar label="E2E" value={currentBreakdown.e2eMs} budget={LATENCY_BUDGET.e2e} highlight />
          </div>
        ) : (
          <p className="text-xs text-ink-ghost italic">
            Waiting for first exchange...
          </p>
        )}
      </div>

      {/* Session Stats */}
      {sessionMetrics && (
        <div className="animate-fade-up">
          <h3 className="label-upper mb-3">Session Stats</h3>
          <div className="space-y-2">
            <StatRow label="Exchanges" value={String(sessionMetrics.totalExchanges)} />
            <StatRow label="Avg E2E" value={`${Math.round(sessionMetrics.avgE2eLatencyMs)}ms`} />
            <StatRow label="Avg TTFT" value={`${Math.round(sessionMetrics.avgTtftMs)}ms`} />
            <StatRow label="Socratic %" value={`${Math.round(sessionMetrics.socraticScore)}%`} accent />
            <StatRow label="Concepts" value={String(sessionMetrics.conceptsCovered)} />
            <StatRow label="Est. Cost" value={`$${sessionMetrics.estimatedCostUsd.toFixed(4)}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function LatencyBar({
  label,
  value,
  budget,
  highlight = false,
}: {
  label: string;
  value: number;
  budget: { target: number; max: number };
  highlight?: boolean;
}) {
  const percentage = Math.min(100, (value / budget.max) * 100);
  const isGood = value <= budget.target;
  const isAcceptable = value <= budget.max;

  const barClass = isGood ? 'latency-good' : isAcceptable ? 'latency-warn' : 'latency-bad';
  const textColor = isGood
    ? 'text-state-listen'
    : isAcceptable
    ? 'text-state-think'
    : 'text-ember';

  return (
    <div className="flex items-center gap-3">
      <span className={`w-[52px] text-right font-mono text-[0.65rem] ${
        highlight ? 'text-ink font-semibold' : 'text-ink-ghost'
      }`}>
        {label}
      </span>
      <div className="flex-1 latency-bar-track">
        <div
          className={`latency-bar-fill ${barClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={`w-[48px] text-right font-mono text-[0.65rem] ${textColor} ${highlight ? 'font-semibold' : ''}`}>
        {value >= 0 ? `${Math.round(value)}ms` : '\u2014'}
      </span>
    </div>
  );
}

function StatRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-ink-ghost">{label}</span>
      <span className={`text-xs font-mono ${accent ? 'text-ember font-medium' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  );
}
