// ============================================================
// Unit Tests: Socratic Prompt System
// Tests: 9-12
// ============================================================

import {
  buildSocraticSystemPrompt,
  buildConversationMessages,
  isSocraticResponse,
  estimateConceptIndex,
} from '@/lib/prompts/socratic';
import type { SocraticPromptContext, GradeBand } from '@/types';

describe('buildSocraticSystemPrompt', () => {
  // TEST 9: System prompt contains Socratic rules
  test('generates prompt with Socratic method instructions', () => {
    const prompt = buildSocraticSystemPrompt('neural networks', '6-8');

    expect(prompt).toContain('Socratic');
    expect(prompt).toContain('question');
    expect(prompt).toContain('NEVER give direct answers');
    expect(prompt).toContain('Lumi');
    expect(prompt).toContain('neural');
  });

  // TEST 10: Grade-level adaptation works
  test('adapts language for different grade levels', () => {
    const middle = buildSocraticSystemPrompt('AI', '6-8');
    const high = buildSocraticSystemPrompt('AI', '11-12');

    // Middle school should use simpler language guidance
    expect(middle).toContain('simple, concrete language');
    expect(middle).toContain('everyday comparison');

    // High school should use more technical language guidance
    expect(high).toContain('Technical vocabulary');
    expect(high).toContain('nuanced');
  });

  // TEST 11: Concept progression differs by grade
  test('provides grade-appropriate concept progression for neural networks', () => {
    const middle = buildSocraticSystemPrompt('How neural networks learn', '6-8');
    const advanced = buildSocraticSystemPrompt('How neural networks learn', '11-12');

    // Middle school: pattern recognition focus
    expect(middle).toContain('pattern');

    // Advanced: technical terms
    expect(advanced).toContain('gradient descent');
  });
});

describe('isSocraticResponse', () => {
  // TEST 12: Correctly identifies Socratic responses
  test('returns true when response ends with a question mark', () => {
    expect(isSocraticResponse("That's great thinking! What do you think happens next?")).toBe(true);
    expect(isSocraticResponse("Interesting idea! Can you explain why?")).toBe(true);
  });

  test('returns false when response does not end with a question', () => {
    expect(isSocraticResponse("That is correct.")).toBe(false);
    expect(isSocraticResponse("Good job!")).toBe(false);
  });

  test('handles whitespace correctly', () => {
    expect(isSocraticResponse("What do you think?  ")).toBe(true);
    expect(isSocraticResponse("  ")).toBe(false);
  });
});

describe('estimateConceptIndex', () => {
  test('returns concept 0 for early exchanges', () => {
    expect(estimateConceptIndex(0)).toBe(0);
    expect(estimateConceptIndex(3)).toBe(0);
  });

  test('returns concept 1 for middle exchanges', () => {
    expect(estimateConceptIndex(4)).toBe(1);
    expect(estimateConceptIndex(7)).toBe(1);
  });

  test('returns concept 2 for later exchanges', () => {
    expect(estimateConceptIndex(8)).toBe(2);
    expect(estimateConceptIndex(15)).toBe(2);
  });
});

describe('buildConversationMessages', () => {
  test('returns empty array for no history', () => {
    const context: SocraticPromptContext = {
      topic: 'AI',
      gradeLevel: '6-8',
      conversationHistory: [],
      conceptsCovered: [],
      currentConceptIndex: 0,
    };
    expect(buildConversationMessages(context)).toEqual([]);
  });

  test('respects sliding window size', () => {
    const context: SocraticPromptContext = {
      topic: 'AI',
      gradeLevel: '6-8',
      conversationHistory: Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`,
      })),
      conceptsCovered: [],
      currentConceptIndex: 0,
    };

    const messages = buildConversationMessages(context, 6);
    expect(messages.length).toBe(6);
    expect(messages[0].content).toBe('Message 14'); // Last 6 messages
  });
});
