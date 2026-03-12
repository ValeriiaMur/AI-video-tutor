'use client';
// ============================================================
// ProgressBadge — Inline session progress indicator
// Shows concepts, breakthroughs, and streak in a compact row.
// ============================================================

import type { ConceptGraphState } from '@/lib/knowledge/concept-graph';
import type { EmotionState } from '@/lib/knowledge/emotion';

interface ProgressBadgeProps {
  graph: ConceptGraphState;
  breakthroughs: number;
  emotion: EmotionState;
  streak: number;
}

export default function ProgressBadge({ graph, breakthroughs, emotion, streak }: ProgressBadgeProps) {
  const emotionIcon: Record<EmotionState, string> = {
    neutral: '',
    confused: '?',
    curious: '~',
    confident: '!',
    frustrated: '...',
    excited: '!!',
    breakthrough: '*',
  };

  return (
    <div className="flex items-center gap-3 text-xs text-ink-ghost">
      {/* Concepts count */}
      <div className="flex items-center gap-1" title="Concepts explored">
        <svg className="w-3.5 h-3.5 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
          <path strokeWidth={1.5} d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07l-2.83 2.83M9.76 14.24l-2.83 2.83m12.14 0l-2.83-2.83M9.76 9.76L6.93 6.93" />
        </svg>
        <span className="font-mono">{graph.nodes.length}</span>
      </div>

      {/* Breakthroughs */}
      {breakthroughs > 0 && (
        <div className="flex items-center gap-1 text-ember" title="Aha moments">
          <span className="text-sm">*</span>
          <span className="font-mono">{breakthroughs}</span>
        </div>
      )}

      {/* Learning streak */}
      {streak > 1 && (
        <div className="flex items-center gap-1" title={`${streak}-day streak`}>
          <span className="text-sm">~</span>
          <span className="font-mono">{streak}d</span>
        </div>
      )}

      {/* Emotion indicator */}
      {emotion !== 'neutral' && emotionIcon[emotion] && (
        <span className="text-ink-faint font-mono" title={`Detected: ${emotion}`}>
          {emotionIcon[emotion]}
        </span>
      )}

      {/* Mastery */}
      {graph.totalMastery > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1 bg-canvas-deep rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${graph.totalMastery}%`,
                background: graph.totalMastery > 70 ? 'var(--state-listen)' : graph.totalMastery > 40 ? 'var(--state-think)' : 'var(--ink-ghost)',
              }}
            />
          </div>
          <span className="font-mono">{graph.totalMastery}%</span>
        </div>
      )}
    </div>
  );
}
