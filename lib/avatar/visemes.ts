// ============================================================
// Viseme Processing & Interpolation
// Maps phoneme/audio data to avatar mouth shapes
// ============================================================

import type { Viseme, VisemeEvent } from '@/types';

/** Viseme shape parameters for the wisdom orb morphing */
export interface VisemeShape {
  mouthOpen: number;    // 0-1: how open the mouth/opening is
  mouthWidth: number;   // 0-1: how wide
  mouthRound: number;   // 0-1: how rounded
  intensity: number;    // 0-1: overall expression strength
}

/** Default viseme shapes */
export const VISEME_SHAPES: Record<Viseme, VisemeShape> = {
  sil:  { mouthOpen: 0.0, mouthWidth: 0.3, mouthRound: 0.0, intensity: 0.0 },
  PP:   { mouthOpen: 0.0, mouthWidth: 0.0, mouthRound: 0.5, intensity: 0.8 },
  FF:   { mouthOpen: 0.1, mouthWidth: 0.4, mouthRound: 0.0, intensity: 0.6 },
  TH:   { mouthOpen: 0.2, mouthWidth: 0.5, mouthRound: 0.0, intensity: 0.5 },
  DD:   { mouthOpen: 0.3, mouthWidth: 0.4, mouthRound: 0.1, intensity: 0.6 },
  kk:   { mouthOpen: 0.4, mouthWidth: 0.3, mouthRound: 0.2, intensity: 0.7 },
  CH:   { mouthOpen: 0.3, mouthWidth: 0.2, mouthRound: 0.6, intensity: 0.7 },
  SS:   { mouthOpen: 0.2, mouthWidth: 0.5, mouthRound: 0.1, intensity: 0.5 },
  nn:   { mouthOpen: 0.2, mouthWidth: 0.3, mouthRound: 0.1, intensity: 0.4 },
  RR:   { mouthOpen: 0.3, mouthWidth: 0.2, mouthRound: 0.7, intensity: 0.6 },
  aa:   { mouthOpen: 0.8, mouthWidth: 0.5, mouthRound: 0.2, intensity: 0.9 },
  E:    { mouthOpen: 0.5, mouthWidth: 0.7, mouthRound: 0.1, intensity: 0.7 },
  I:    { mouthOpen: 0.3, mouthWidth: 0.8, mouthRound: 0.0, intensity: 0.6 },
  O:    { mouthOpen: 0.6, mouthWidth: 0.3, mouthRound: 0.8, intensity: 0.8 },
  U:    { mouthOpen: 0.4, mouthWidth: 0.2, mouthRound: 0.9, intensity: 0.7 },
};

/**
 * VisemeInterpolator
 * Smoothly interpolates between viseme shapes for natural lip-sync
 */
export class VisemeInterpolator {
  private currentShape: VisemeShape = { ...VISEME_SHAPES.sil };
  private targetShape: VisemeShape = { ...VISEME_SHAPES.sil };
  private queue: VisemeEvent[] = [];
  private startTime: number = 0;
  private smoothingFactor: number = 0.15; // Lower = smoother, higher = snappier

  /** Load a sequence of visemes to play */
  loadVisemes(visemes: VisemeEvent[]): void {
    this.queue.push(...visemes);
    if (this.startTime === 0) {
      this.startTime = performance.now();
    }
  }

  /** Update the current shape based on elapsed time (call every frame) */
  update(deltaMs: number): VisemeShape {
    const elapsed = performance.now() - this.startTime;

    // Find the current target viseme from the queue
    while (this.queue.length > 0) {
      const next = this.queue[0];
      if (elapsed >= next.timestamp + next.duration) {
        this.queue.shift(); // This viseme has passed
      } else if (elapsed >= next.timestamp) {
        // This is the current viseme
        this.targetShape = {
          ...VISEME_SHAPES[next.viseme],
          intensity: VISEME_SHAPES[next.viseme].intensity * next.weight,
        };
        break;
      } else {
        break; // Haven't reached this viseme yet
      }
    }

    // If queue is empty, return to silence
    if (this.queue.length === 0) {
      this.targetShape = { ...VISEME_SHAPES.sil };
    }

    // Smooth interpolation
    const t = Math.min(1, this.smoothingFactor * (deltaMs / 16.67)); // Normalize to 60fps
    this.currentShape = {
      mouthOpen: lerp(this.currentShape.mouthOpen, this.targetShape.mouthOpen, t),
      mouthWidth: lerp(this.currentShape.mouthWidth, this.targetShape.mouthWidth, t),
      mouthRound: lerp(this.currentShape.mouthRound, this.targetShape.mouthRound, t),
      intensity: lerp(this.currentShape.intensity, this.targetShape.intensity, t),
    };

    return { ...this.currentShape };
  }

  /** Get the current interpolated shape */
  getCurrentShape(): VisemeShape {
    return { ...this.currentShape };
  }

  /** Reset the interpolator */
  reset(): void {
    this.currentShape = { ...VISEME_SHAPES.sil };
    this.targetShape = { ...VISEME_SHAPES.sil };
    this.queue = [];
    this.startTime = 0;
  }

  /** Get queue length (for debugging) */
  getQueueLength(): number {
    return this.queue.length;
  }
}

/**
 * AudioDrivenVisemeGenerator
 * Generates visemes from audio amplitude when alignment data isn't available
 */
export class AudioDrivenVisemeGenerator {
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  /** Connect to an audio source */
  connectToAudio(audioContext: AudioContext, source: AudioNode): void {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  /** Generate a viseme shape from current audio amplitude */
  generateFromAudio(): VisemeShape {
    if (!this.analyser || !this.dataArray) {
      return { ...VISEME_SHAPES.sil };
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate amplitude from frequency bands
    const lowFreq = average(this.dataArray, 0, 8);   // Bass
    const midFreq = average(this.dataArray, 8, 32);   // Mids (voice formants)
    const highFreq = average(this.dataArray, 32, 64);  // Highs

    const amplitude = midFreq / 255;
    const brightness = highFreq / 255;

    return {
      mouthOpen: Math.min(1, amplitude * 1.5),
      mouthWidth: 0.3 + brightness * 0.4,
      mouthRound: Math.max(0, 0.5 - brightness),
      intensity: Math.min(1, amplitude * 2),
    };
  }

  disconnect(): void {
    this.analyser?.disconnect();
    this.analyser = null;
    this.dataArray = null;
  }
}

// --- Utilities ---
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function average(data: Uint8Array, start: number, end: number): number {
  let sum = 0;
  const count = Math.min(end, data.length) - start;
  for (let i = start; i < Math.min(end, data.length); i++) {
    sum += data[i];
  }
  return count > 0 ? sum / count : 0;
}

export { lerp };
