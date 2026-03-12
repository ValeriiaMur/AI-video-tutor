'use client';
// ============================================================
// Home Page — Topic Selection
// Clean, warm editorial entrance. Orb as hero focal point.
// ============================================================

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { GradeBand } from '@/types';

const TutorSession = dynamic(() => import('@/components/TutorSession'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <div className="orb-preview animate-scale-in">
          <div className="orb-highlight" />
        </div>
        <p className="text-ink-ghost text-sm animate-fade-in delay-300">
          Waking Lumi up...
        </p>
      </div>
    </div>
  ),
});

const QUICK_TOPICS = [
  { label: 'Neural networks', icon: '🧠' },
  { label: 'Why the sky is blue', icon: '🌌' },
  { label: 'How encryption works', icon: '🔐' },
  { label: 'What is DNA', icon: '🧬' },
  { label: 'How rockets fly', icon: '🚀' },
];

const GRADE_OPTIONS: { value: GradeBand; label: string; sub: string }[] = [
  { value: '6-8', label: 'Explorer', sub: 'Grades 6–8' },
  { value: '9-10', label: 'Seeker', sub: 'Grades 9–10' },
  { value: '11-12', label: 'Scholar', sub: 'Grades 11–12' },
];

export default function Home() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [topic, setTopic] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeBand>('6-8');
  const [useMocks, setUseMocks] = useState(false);

  const startSession = useCallback(() => {
    if (topic.trim()) setSessionStarted(true);
  }, [topic]);

  if (sessionStarted) {
    return <TutorSession topic={topic} gradeLevel={gradeLevel} useMocks={useMocks} />;
  }

  return (
    <div className="min-h-screen bg-paper relative flex items-center justify-center p-6">
      <div className="relative z-10 max-w-md w-full">

        {/* ── Orb + Title ── */}
        <div className="flex flex-col items-center mb-10">
          <div className="animate-scale-in mb-6">
            <div className="orb-preview">
              <div className="orb-highlight" />
            </div>
          </div>

          <h1 className="text-center animate-fade-up delay-200">
            <span className="block text-5xl md:text-6xl font-display italic text-ink leading-tight">
              teach me
            </span>
            <span className="block text-2xl md:text-3xl text-ink-ghost mt-1 font-body font-light tracking-wide">
              like I'm five
            </span>
          </h1>

          <p className="mt-4 text-center text-sm text-ink-muted max-w-xs leading-relaxed animate-fade-up delay-400">
            Ask anything. Lumi will guide you through it
            with questions, never answers.
          </p>
        </div>

        {/* ── Form ── */}
        <div className="card-floating p-7 space-y-5 animate-fade-up delay-500">

          <div>
            <label className="label-upper block mb-2">What do you want to learn?</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startSession()}
              placeholder="e.g. How do neural networks learn?"
              className="input-warm w-full"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_TOPICS.map((t) => (
              <button
                key={t.label}
                onClick={() => setTopic(t.label)}
                className={`chip ${topic === t.label ? 'chip-active' : ''}`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="divider" />

          <div>
            <label className="label-upper block mb-2">Knowledge level</label>
            <div className="grid grid-cols-3 gap-2">
              {GRADE_OPTIONS.map((opt) => {
                const isActive = gradeLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setGradeLevel(opt.value)}
                    className="py-3 px-2 rounded-xl text-center border transition-all duration-200"
                    style={isActive
                      ? { background: '#1a1715', borderColor: '#1a1715', color: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                      : { background: '#f5f0ea', borderColor: '#e2d9cd', color: '#7a7168' }
                    }
                  >
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span
                      className="block text-[0.65rem] mt-0.5"
                      style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#b5aa9e' }}
                    >{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mock toggle */}
          <div className="flex items-center justify-between bg-canvas-warm rounded-xl px-4 py-3 border border-canvas-muted">
            <span className="text-xs text-ink-ghost">Mock mode (no API keys)</span>
            <button
              onClick={() => setUseMocks(!useMocks)}
              className={`toggle-track ${useMocks ? 'toggle-track-active' : ''}`}
            >
              <div className={`toggle-thumb ${useMocks ? 'toggle-thumb-active' : ''}`} />
            </button>
          </div>

          <button onClick={startSession} disabled={!topic.trim()} className="btn-primary w-full">
            Begin Learning
          </button>
        </div>

        <p className="text-center text-ink-faint text-[0.65rem] mt-6 tracking-wide animate-fade-in delay-600">
          Claude Haiku &middot; Deepgram &middot; ElevenLabs &middot; Three.js
        </p>
      </div>
    </div>
  );
}
