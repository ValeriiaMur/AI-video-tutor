// ============================================================
// Emotion Detection — Voice-First Sentiment Analysis
// Analyzes student responses for emotional cues to adapt tutoring.
// Combines text-based sentiment with voice energy signals.
// ============================================================

export type EmotionState =
  | 'neutral'
  | 'confused'
  | 'curious'
  | 'confident'
  | 'frustrated'
  | 'excited'
  | 'breakthrough'; // aha moment

export interface EmotionReading {
  state: EmotionState;
  confidence: number; // 0–1
  /** Suggestions for how the tutor should adapt */
  tutorHint: string;
}

/**
 * Analyze text for emotional cues.
 * This runs client-side on the student's response text.
 */
export function analyzeTextEmotion(text: string): EmotionReading {
  const lower = text.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  // === Breakthrough / Excitement ===
  const breakthroughPatterns = /oh!|ohh|aha|i get it|that makes sense|now i (see|understand|get)|it clicked|mind blown|oh wow|that'?s (so cool|amazing|awesome)/i;
  if (breakthroughPatterns.test(lower)) {
    return {
      state: 'breakthrough',
      confidence: 0.85,
      tutorHint: 'Student had a breakthrough! Celebrate and build on this momentum.',
    };
  }

  // === Excitement / Curiosity ===
  const excitedPatterns = /!{2,}|wow|cool|awesome|that'?s (interesting|fascinating)|really\?|no way|tell me more|what about/i;
  if (excitedPatterns.test(lower)) {
    return {
      state: 'excited',
      confidence: 0.7,
      tutorHint: 'Student is engaged and excited. Feed their curiosity with deeper questions.',
    };
  }

  // === Frustration ===
  const frustratedPatterns = /i (still )?don'?t (get|understand)|this (doesn'?t|makes no) sense|i give up|ugh|this is (hard|confusing|impossible)|why (won'?t|can'?t|doesn'?t)/i;
  if (frustratedPatterns.test(lower)) {
    return {
      state: 'frustrated',
      confidence: 0.75,
      tutorHint: 'Student is frustrated. Simplify, use a concrete analogy, and encourage.',
    };
  }

  // === Confusion ===
  const confusedPatterns = /i don'?t know|what\??$|huh\??|what do you mean|i'?m (lost|confused)|not sure|can you (explain|repeat|say that again)/i;
  if (confusedPatterns.test(lower)) {
    return {
      state: 'confused',
      confidence: 0.7,
      tutorHint: 'Student is confused. Rephrase the question with a simpler analogy.',
    };
  }

  // === Very short response (likely uncertain) ===
  if (wordCount <= 2) {
    return {
      state: 'confused',
      confidence: 0.4,
      tutorHint: 'Very short response suggests uncertainty. Try a yes/no or multiple-choice question.',
    };
  }

  // === Confident explanation ===
  const confidentPatterns = /because|so basically|the reason is|it works by|that means|in other words|for example|i think it'?s because/i;
  if (confidentPatterns.test(lower) && wordCount > 8) {
    return {
      state: 'confident',
      confidence: 0.7,
      tutorHint: 'Student is explaining confidently. Challenge them to go deeper.',
    };
  }

  // === Curious question-asking ===
  if (lower.endsWith('?') && wordCount > 4) {
    return {
      state: 'curious',
      confidence: 0.6,
      tutorHint: 'Student is asking questions — great sign of engagement. Answer their curiosity.',
    };
  }

  return {
    state: 'neutral',
    confidence: 0.3,
    tutorHint: 'Neutral engagement. Continue with the Socratic flow.',
  };
}

/**
 * Analyze voice energy from audio buffer.
 * Higher energy + pitch variation = more engaged/excited.
 * Low energy + monotone = disengaged or confused.
 */
export function analyzeVoiceEnergy(audioBuffer: ArrayBuffer): { energy: number; variation: number } {
  const view = new DataView(audioBuffer);
  const samples = audioBuffer.byteLength / 2;

  if (samples === 0) return { energy: 0, variation: 0 };

  let sumSquares = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < samples; i++) {
    const sample = view.getInt16(i * 2, true) / 32768;
    sumSquares += sample * sample;
    if (sample < min) min = sample;
    if (sample > max) max = sample;
  }

  const rmsEnergy = Math.sqrt(sumSquares / samples);
  const dynamicRange = max - min;

  return {
    energy: Math.min(1, rmsEnergy * 10), // Normalized 0–1
    variation: Math.min(1, dynamicRange), // Dynamic range as proxy for pitch variation
  };
}

/**
 * Combine text and voice signals into a final emotion reading.
 */
export function combineSignals(
  textEmotion: EmotionReading,
  voiceEnergy?: { energy: number; variation: number }
): EmotionReading {
  if (!voiceEnergy) return textEmotion;

  // High energy + breakthrough text = very confident breakthrough
  if (textEmotion.state === 'breakthrough' && voiceEnergy.energy > 0.4) {
    return { ...textEmotion, confidence: Math.min(1, textEmotion.confidence + 0.1) };
  }

  // Low energy + confused text = definitely frustrated
  if (textEmotion.state === 'confused' && voiceEnergy.energy < 0.15) {
    return {
      state: 'frustrated',
      confidence: 0.6,
      tutorHint: 'Low voice energy with confusion — student may be giving up. Encourage and simplify.',
    };
  }

  // High variation + neutral text = actually curious
  if (textEmotion.state === 'neutral' && voiceEnergy.variation > 0.5) {
    return {
      state: 'curious',
      confidence: 0.5,
      tutorHint: 'Voice shows engagement even if text is neutral. Student is thinking actively.',
    };
  }

  return textEmotion;
}
