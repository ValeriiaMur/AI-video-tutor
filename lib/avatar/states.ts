// ============================================================
// Avatar State Machine
// Manages idle, listening, thinking, and speaking states
// ============================================================

import type { AvatarState } from '@/types';

export interface StateVisuals {
  glowIntensity: number;
  glowColor: [number, number, number]; // RGB 0-1
  pulseSpeed: number;         // Pulse frequency multiplier
  particleSpeed: number;      // Particle orbit speed
  particleCount: number;      // Active particle count
  morphAmount: number;        // How much the orb deforms
  morphSpeed: number;         // Deformation speed
  innerGlow: number;          // Inner light intensity
  scale: number;              // Overall scale
  rotationSpeed: number;      // Rotation speed
}

/** Visual parameters for each avatar state */
export const STATE_VISUALS: Record<AvatarState, StateVisuals> = {
  idle: {
    glowIntensity: 0.4,
    glowColor: [0.42, 0.36, 0.91],  // Purple
    pulseSpeed: 0.5,
    particleSpeed: 0.3,
    particleCount: 20,
    morphAmount: 0.05,
    morphSpeed: 0.3,
    innerGlow: 0.3,
    scale: 1.0,
    rotationSpeed: 0.1,
  },
  listening: {
    glowIntensity: 0.6,
    glowColor: [0.0, 0.81, 0.79],   // Teal/cyan (attentive)
    pulseSpeed: 1.0,
    particleSpeed: 0.5,
    particleCount: 30,
    morphAmount: 0.1,
    morphSpeed: 0.5,
    innerGlow: 0.5,
    scale: 1.05,
    rotationSpeed: 0.2,
  },
  thinking: {
    glowIntensity: 0.8,
    glowColor: [0.95, 0.77, 0.06],  // Gold (processing)
    pulseSpeed: 2.0,
    particleSpeed: 1.2,
    particleCount: 50,
    morphAmount: 0.15,
    morphSpeed: 1.0,
    innerGlow: 0.7,
    scale: 0.95,
    rotationSpeed: 0.8,
  },
  speaking: {
    glowIntensity: 1.0,
    glowColor: [0.42, 0.36, 0.91],  // Bright purple (teaching)
    pulseSpeed: 1.5,
    particleSpeed: 0.8,
    particleCount: 40,
    morphAmount: 0.2,
    morphSpeed: 0.8,
    innerGlow: 0.9,
    scale: 1.1,
    rotationSpeed: 0.3,
  },
};

/**
 * AvatarStateMachine
 * Handles transitions between states with smooth interpolation
 */
export class AvatarStateMachine {
  private currentState: AvatarState = 'idle';
  private targetState: AvatarState = 'idle';
  private currentVisuals: StateVisuals = { ...STATE_VISUALS.idle };
  private transitionProgress: number = 1.0;
  private transitionSpeed: number = 3.0; // Units per second

  /** Transition to a new state */
  setState(state: AvatarState): void {
    if (state === this.targetState) return;
    this.targetState = state;
    this.transitionProgress = 0;
  }

  /** Update the state machine (call every frame) */
  update(deltaSeconds: number): StateVisuals {
    if (this.transitionProgress < 1.0) {
      this.transitionProgress = Math.min(
        1.0,
        this.transitionProgress + deltaSeconds * this.transitionSpeed
      );

      const t = easeInOutCubic(this.transitionProgress);
      const from = STATE_VISUALS[this.currentState];
      const to = STATE_VISUALS[this.targetState];

      this.currentVisuals = {
        glowIntensity: lerp(from.glowIntensity, to.glowIntensity, t),
        glowColor: [
          lerp(from.glowColor[0], to.glowColor[0], t),
          lerp(from.glowColor[1], to.glowColor[1], t),
          lerp(from.glowColor[2], to.glowColor[2], t),
        ],
        pulseSpeed: lerp(from.pulseSpeed, to.pulseSpeed, t),
        particleSpeed: lerp(from.particleSpeed, to.particleSpeed, t),
        particleCount: Math.round(lerp(from.particleCount, to.particleCount, t)),
        morphAmount: lerp(from.morphAmount, to.morphAmount, t),
        morphSpeed: lerp(from.morphSpeed, to.morphSpeed, t),
        innerGlow: lerp(from.innerGlow, to.innerGlow, t),
        scale: lerp(from.scale, to.scale, t),
        rotationSpeed: lerp(from.rotationSpeed, to.rotationSpeed, t),
      };

      if (this.transitionProgress >= 1.0) {
        this.currentState = this.targetState;
      }
    }

    return { ...this.currentVisuals };
  }

  /** Get current state */
  getState(): AvatarState {
    return this.currentState;
  }

  /** Get target state */
  getTargetState(): AvatarState {
    return this.targetState;
  }

  /** Check if transitioning */
  isTransitioning(): boolean {
    return this.transitionProgress < 1.0;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
