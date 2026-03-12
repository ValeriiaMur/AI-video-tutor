'use client';
// ============================================================
// AhaCelebration — "Aha Moment" burst animation
// Warm, editorial-style celebration when student has a breakthrough.
// Particles radiate from center, text fades in and out.
// ============================================================

import { useEffect, useState, useCallback } from 'react';

interface AhaCelebrationProps {
  /** Trigger a new celebration */
  trigger: number; // Increment to trigger
  /** Concept that was understood */
  concept?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  delay: number;
}

const COLORS = [
  '#c4633a', // ember
  '#d98a6a', // ember-light
  '#7a6aaf', // speak purple
  '#5a8f7a', // listen green
  '#c49a3a', // think gold
  '#e2d9cd', // warm gray
];

export default function AhaCelebration({ trigger, concept }: AhaCelebrationProps) {
  const [isActive, setIsActive] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  const spawnParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    const count = 24;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      newParticles.push({
        id: i,
        x: 50, // center %
        y: 50,
        angle,
        speed: 30 + Math.random() * 50,
        size: 3 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 150,
      });
    }

    return newParticles;
  }, []);

  useEffect(() => {
    if (trigger <= 0) return;

    setParticles(spawnParticles());
    setIsActive(true);

    const timer = setTimeout(() => setIsActive(false), 2200);
    return () => clearTimeout(timer);
  }, [trigger, spawnParticles]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      {/* Particle burst */}
      <div className="absolute inset-0">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              animation: `aha-particle 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${p.delay}ms forwards`,
              ['--aha-tx' as string]: `${Math.cos(p.angle) * p.speed}vmin`,
              ['--aha-ty' as string]: `${Math.sin(p.angle) * p.speed}vmin`,
            }}
          />
        ))}
      </div>

      {/* Central text */}
      <div
        className="relative text-center"
        style={{ animation: 'aha-text 2s cubic-bezier(0.22, 1, 0.36, 1) forwards' }}
      >
        <p className="text-4xl md:text-5xl font-display italic text-ember" style={{ lineHeight: 1 }}>
          aha!
        </p>
        {concept && (
          <p className="text-sm text-ink-muted mt-2 font-body">
            You got <span className="text-ink font-medium">{concept}</span>
          </p>
        )}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes aha-particle {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          60% {
            opacity: 0.8;
          }
          100% {
            transform: translate(var(--aha-tx), var(--aha-ty)) scale(0);
            opacity: 0;
          }
        }
        @keyframes aha-text {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          20% {
            opacity: 1;
            transform: scale(1.1);
          }
          40% {
            transform: scale(1);
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
        }
      `}</style>
    </div>
  );
}
