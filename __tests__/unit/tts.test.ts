// ============================================================
// Unit Tests: TTS Module (phoneme/viseme mapping)
// Tests: 29-30
// ============================================================

import { inferVisemeFromChar, PHONEME_TO_VISEME } from '@/lib/pipeline/tts';

describe('Phoneme to Viseme Mapping', () => {
  // TEST 29: Standard phoneme mappings are correct
  test('maps common phonemes to correct visemes', () => {
    expect(PHONEME_TO_VISEME['p']).toBe('PP');
    expect(PHONEME_TO_VISEME['b']).toBe('PP');
    expect(PHONEME_TO_VISEME['m']).toBe('PP');
    expect(PHONEME_TO_VISEME['f']).toBe('FF');
    expect(PHONEME_TO_VISEME['s']).toBe('SS');
    expect(PHONEME_TO_VISEME['a']).toBe('aa');
    expect(PHONEME_TO_VISEME['e']).toBe('E');
    expect(PHONEME_TO_VISEME['i']).toBe('I');
    expect(PHONEME_TO_VISEME['o']).toBe('O');
    expect(PHONEME_TO_VISEME['u']).toBe('U');
    expect(PHONEME_TO_VISEME['sil']).toBe('sil');
  });

  // TEST 30: Character-based viseme inference fallback
  test('infers visemes from characters when phoneme map misses', () => {
    expect(inferVisemeFromChar('a')).toBe('aa');
    expect(inferVisemeFromChar('e')).toBe('E');
    expect(inferVisemeFromChar('p')).toBe('PP');
    expect(inferVisemeFromChar('f')).toBe('FF');
    expect(inferVisemeFromChar('s')).toBe('SS');
    expect(inferVisemeFromChar('r')).toBe('RR');
    expect(inferVisemeFromChar('x')).toBe('sil'); // Unknown → silence
  });
});
