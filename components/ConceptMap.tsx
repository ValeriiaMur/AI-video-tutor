'use client';
// ============================================================
// ConceptMap — Visual knowledge graph
// Shows concepts as nodes, connections as lines.
// Warm, minimal aesthetic matching the editorial design.
// ============================================================

import { useMemo } from 'react';
import type { ConceptGraphState } from '@/lib/knowledge/concept-graph';

interface ConceptMapProps {
  graph: ConceptGraphState;
}

export default function ConceptMap({ graph }: ConceptMapProps) {
  const { nodes, edges, totalMastery } = graph;

  // Lay out nodes in a simple force-free arrangement
  const layout = useMemo(() => {
    if (nodes.length === 0) return [];

    const cx = 160;
    const cy = 120;
    const radius = Math.min(100, 40 + nodes.length * 12);

    return nodes.map((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      const r = nodes.length === 1 ? 0 : radius;
      return {
        ...node,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      };
    });
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-ink-ghost italic">
          Concepts will appear here as you learn.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Mastery bar */}
      <div className="flex items-center gap-3 mb-4">
        <span className="label-upper">Mastery</span>
        <div className="flex-1 h-2 bg-canvas-deep rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${totalMastery}%`,
              background: totalMastery > 70 ? 'var(--state-listen)' : totalMastery > 40 ? 'var(--state-think)' : 'var(--ink-ghost)',
            }}
          />
        </div>
        <span className="text-xs font-mono text-ink-muted">{totalMastery}%</span>
      </div>

      {/* SVG graph */}
      <svg viewBox="0 0 320 240" className="w-full" style={{ maxHeight: 200 }}>
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = layout.find((n) => n.id === edge.from);
          const to = layout.find((n) => n.id === edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--canvas-muted)"
              strokeWidth={1 + edge.weight * 2}
              strokeOpacity={0.5 + edge.weight * 0.3}
            />
          );
        })}

        {/* Nodes */}
        {layout.map((node) => {
          const r = 18 + node.mentions * 3;
          const masteryColor = node.mastery > 0.7
            ? 'var(--state-listen)'
            : node.mastery > 0.4
            ? 'var(--state-think)'
            : 'var(--ink-ghost)';

          return (
            <g key={node.id}>
              {/* Mastery ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r={r}
                fill="white"
                stroke={masteryColor}
                strokeWidth={2}
              />

              {/* Breakthrough glow */}
              {node.breakthrough && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 4}
                  fill="none"
                  stroke="var(--ember-light)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  opacity={0.6}
                >
                  <animate attributeName="r" values={`${r + 3};${r + 6};${r + 3}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0.3;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Label */}
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-ink-soft"
                style={{
                  fontSize: Math.max(7, Math.min(10, 9 - node.label.length * 0.15)),
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                }}
              >
                {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Stats row */}
      <div className="flex justify-between mt-3 text-xs text-ink-ghost">
        <span>{nodes.length} concept{nodes.length !== 1 ? 's' : ''}</span>
        <span>{edges.length} connection{edges.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}
