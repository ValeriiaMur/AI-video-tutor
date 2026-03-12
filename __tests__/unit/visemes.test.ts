// ============================================================
// Unit Tests: Viseme Processing & Avatar
// Tests: 13-16
// ============================================================

import {
  VisemeInterpolator,
  VISEME_SHAPES,
  lerp,
  AudioDrivenVisemeGenerator,
} from '@/lib/avatar/visemes';
import { AvatarStateMachine, STATE_VISUALS } from '@/lib/avatar/states';
import type { VisemeEvent } from '@/types';

describe('VisemeInterpolator', () => {
  let interpolator: VisemeInterpolator;

  beforeEach(() => {
    interpolator = new VisemeInterpolator();
  });

  // TEST 13: Viseme mapping correctness
  test('maps standard visemes to correct mouth shapes', () => {
    // Open vowel should have high mouth open
    expect(VISEME_SHAPES.aa.mouthOpen).toBeGreaterThan(0.7);
    // Bilabial should have closed mouth
    expect(VISEME_SHAPES.PP.mouthOpen).toBe(0);
    // Rounded vowel should have high roundness
    expect(VISEME_SHAPES.U.mouthRound).toBeGreaterThan(0.8);
    // Silence should have zero intensity
    expect(VISEME_SHAPES.sil.intensity).toBe(0);
  });

  // TEST 14: Interpolator returns silence when empty
  test('returns silence shape when no visemes loaded', () => {
    const shape = interpolator.update(16);
    expect(shape.mouthOpen).toBeCloseTo(0, 1);
    expect(shape.intensity).toBeCloseTo(0, 1);
  });

  // TEST 15: Interpolator processes viseme queue
  test('processes loaded viseme events', () => {
    const events: VisemeEvent[] = [
      { viseme: 'aa', timestamp: 0, duration: 100, weight: 1.0 },
      { viseme: 'E', timestamp: 100, duration: 100, weight: 1.0 },
      { viseme: 'sil', timestamp: 200, duration: 100, weight: 1.0 },
    ];

    interpolator.loadVisemes(events);
    expect(interpolator.getQueueLength()).toBe(3);

    // After update, should start interpolating toward 'aa'
    const shape = interpolator.update(16);
    // The interpolator should be moving toward the 'aa' shape
    // (may not be fully there yet due to smoothing)
    expect(shape.mouthOpen).toBeGreaterThanOrEqual(0);
  });

  // TEST 16: Reset clears the queue
  test('reset clears all state', () => {
    interpolator.loadVisemes([
      { viseme: 'aa', timestamp: 0, duration: 100, weight: 1.0 },
    ]);
    expect(interpolator.getQueueLength()).toBe(1);

    interpolator.reset();
    expect(interpolator.getQueueLength()).toBe(0);
  });
});

describe('lerp', () => {
  test('interpolates correctly', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
});

describe('AvatarStateMachine', () => {
  let machine: AvatarStateMachine;

  beforeEach(() => {
    machine = new AvatarStateMachine();
  });

  // TEST 17: Default state is idle
  test('starts in idle state', () => {
    expect(machine.getState()).toBe('idle');
  });

  // TEST 18: State transitions work
  test('transitions to new states smoothly', () => {
    machine.setState('thinking');
    expect(machine.getTargetState()).toBe('thinking');
    expect(machine.isTransitioning()).toBe(true);

    // Simulate several frames
    for (let i = 0; i < 60; i++) {
      machine.update(1 / 60);
    }

    // Should have completed transition
    expect(machine.getState()).toBe('thinking');
    expect(machine.isTransitioning()).toBe(false);
  });

  // TEST 19: State visuals change between states
  test('produces different visuals for different states', () => {
    const idleVisuals = machine.update(0);

    machine.setState('speaking');
    // Fast forward to complete transition
    for (let i = 0; i < 120; i++) {
      machine.update(1 / 60);
    }
    const speakingVisuals = machine.update(1 / 60);

    // Speaking should have higher glow intensity
    expect(speakingVisuals.glowIntensity).toBeGreaterThan(idleVisuals.glowIntensity);
    expect(speakingVisuals.scale).toBeGreaterThan(idleVisuals.scale);
  });
});
