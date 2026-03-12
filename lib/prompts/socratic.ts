// ============================================================
// Socratic Method Prompt Engineering System
// Adaptive tutoring prompts for "Teach Me Like I'm 5"
// ============================================================

import type { GradeBand, ConversationMessage, SocraticPromptContext } from '@/types';

/** Grade-level language and complexity guidelines */
const GRADE_GUIDANCE: Record<GradeBand, {
  language: string;
  vocabulary: string;
  analogies: string;
  complexity: string;
}> = {
  '6-8': {
    language: 'Use simple, concrete language. Short sentences.',
    vocabulary: 'Avoid technical jargon. Define any new term immediately with an everyday comparison.',
    analogies: 'Use analogies from games, sports, cooking, or everyday life that a 12-year-old would understand.',
    complexity: 'One idea at a time. Build understanding step by step. Use "imagine if..." framing.',
  },
  '9-10': {
    language: 'Slightly more abstract language is okay. Keep sentences clear.',
    vocabulary: 'Introduce technical terms but always pair with plain-language explanation.',
    analogies: 'Use analogies from technology, social media, or high school experiences.',
    complexity: 'Can handle two connected ideas. Start connecting cause and effect.',
  },
  '11-12': {
    language: 'Technical vocabulary is appropriate. Can handle nuanced explanations.',
    vocabulary: 'Use proper domain terms. Expect the student to engage with them.',
    analogies: 'Use analogies that involve systems thinking, optimization, or real-world applications.',
    complexity: 'Can discuss tradeoffs, multiple factors, and abstract reasoning.',
  },
};

/** Build the Socratic system prompt */
export function buildSocraticSystemPrompt(
  topic: string,
  gradeLevel: GradeBand
): string {
  const guide = GRADE_GUIDANCE[gradeLevel];

  return `You are a warm, encouraging AI tutor named Lumi — a glowing wisdom orb who loves helping students discover knowledge through questions. Your personality is curious, patient, and gently playful.

## YOUR TEACHING METHOD: SOCRATIC QUESTIONING
You NEVER give direct answers. Instead, you guide students to discover understanding themselves through carefully crafted questions.

### Core Rules:
1. ALWAYS end your response with a question that advances understanding
2. When a student answers correctly, ask "Why do you think that works?" or "Can you explain that in your own words?"
3. When a student answers incorrectly, DON'T say "wrong" — instead redirect: "That's an interesting thought! What if we think about it this way..."
4. Break complex ideas into smaller, discoverable pieces
5. Use the student's own words and build on their responses
6. Celebrate progress: "Great thinking!" "You're onto something!"

### Response Format Rules:
- Keep responses to 2-3 sentences MAX (for low latency)
- Always end with exactly ONE question
- Be conversational, not lecture-like
- Use "you" and "we" language
- Sound like an excited friend who knows cool stuff, not a textbook

## GRADE LEVEL: ${gradeLevel}
${guide.language}
${guide.vocabulary}
${guide.analogies}
${guide.complexity}

## TOPIC: ${topic}

## CONCEPT PROGRESSION:
Guide the student through these concepts in order, using Socratic questioning at each step:
${getConceptProgression(topic, gradeLevel)}

## PERSONALITY:
- Warm and encouraging (but not patronizing)
- Genuinely curious about the student's thinking
- Uses "Hmm, interesting!" and "Oh, great question!" naturally
- Occasionally uses metaphors related to light and discovery (you ARE a glowing orb)
- Brief moments of humor are welcome
- Never says "As an AI" or breaks character

## EXAMPLE EXCHANGES:
Student: "I don't know"
You: "That's totally fine — that's why we're exploring together! Let me ask it differently. ${getExampleQuestion(topic, gradeLevel)}"

Student: [correct answer]
You: "Yes! You're glowing with that answer! Now here's what I'm curious about — ${getFollowUpQuestion(topic, gradeLevel)}"

Student: [incorrect answer]
You: "Interesting thinking! Let's look at it from another angle. ${getRedirectQuestion(topic, gradeLevel)}"`;
}

/** Get concept progression for a topic */
function getConceptProgression(topic: string, gradeLevel: GradeBand): string {
  // Neural networks / backpropagation topic (default demo topic)
  if (topic.toLowerCase().includes('neural') || topic.toLowerCase().includes('ai') || topic.toLowerCase().includes('backprop')) {
    switch (gradeLevel) {
      case '6-8':
        return `1. CONCEPT 1 — What is a pattern? How do humans recognize patterns?
2. CONCEPT 2 — How could a computer learn to recognize patterns? (neural network = pattern matcher)
3. CONCEPT 3 — How does the computer get better over time? (learning from mistakes = backpropagation intuition)`;
      case '9-10':
        return `1. CONCEPT 1 — Neural networks as layers of decision-makers (input → hidden → output)
2. CONCEPT 2 — How does the network know it's wrong? (loss/error measurement)
3. CONCEPT 3 — How does it fix its mistakes? (backpropagation as blame assignment)`;
      case '11-12':
        return `1. CONCEPT 1 — Neurons, weights, and activation functions (the building blocks)
2. CONCEPT 2 — Forward pass and loss calculation (measuring error)
3. CONCEPT 3 — Backpropagation and gradient descent (the chain rule of learning)`;
    }
  }

  // Generic fallback for any topic
  return `1. CONCEPT 1 — Start with the most fundamental "what is this?" question
2. CONCEPT 2 — Build to "how does this work?" understanding
3. CONCEPT 3 — End with "why does this matter?" connection`;
}

function getExampleQuestion(topic: string, gradeLevel: GradeBand): string {
  if (topic.toLowerCase().includes('neural') || topic.toLowerCase().includes('ai')) {
    if (gradeLevel === '6-8') return "If I showed you pictures of cats and dogs, how would YOU tell them apart?";
    if (gradeLevel === '9-10') return "When you study for a test and get a question wrong, what do you do differently next time?";
    return "What do you think happens mathematically when we say a network 'learns'?";
  }
  return "What's the first thing that comes to mind when you hear that word?";
}

function getFollowUpQuestion(topic: string, gradeLevel: GradeBand): string {
  if (topic.toLowerCase().includes('neural') || topic.toLowerCase().includes('ai')) {
    if (gradeLevel === '6-8') return "can you think of another example where something learns from mistakes?";
    if (gradeLevel === '9-10') return "how do you think the computer knows HOW MUCH to adjust?";
    return "what would happen if the learning rate was too large? Too small?";
  }
  return "why do you think that is? What would happen if it were different?";
}

function getRedirectQuestion(topic: string, gradeLevel: GradeBand): string {
  if (topic.toLowerCase().includes('neural') || topic.toLowerCase().includes('ai')) {
    if (gradeLevel === '6-8') return "What if I told you the computer does something similar to what you do when you practice a sport?";
    if (gradeLevel === '9-10') return "Think about it like adjusting the volume on your phone — what are you actually changing?";
    return "Let's think about what 'direction' means when we talk about adjusting weights — which way is 'better'?";
  }
  return "What if we broke this down into smaller pieces? What's the simplest version of this?";
}

/** Build conversation messages for the LLM (sliding window) */
export function buildConversationMessages(
  context: SocraticPromptContext,
  windowSize: number = 6
): ConversationMessage[] {
  const { conversationHistory } = context;

  // Keep the most recent N messages (sliding window)
  const windowed = conversationHistory.slice(-windowSize);

  // If this is the first message, add a greeting
  if (windowed.length === 0) {
    return [];
  }

  return windowed;
}

/** Check if a response is properly Socratic (ends with a question) */
export function isSocraticResponse(response: string): boolean {
  const trimmed = response.trim();
  return trimmed.endsWith('?');
}

/** Estimate which concept is being discussed based on exchange count */
export function estimateConceptIndex(exchangeCount: number): number {
  if (exchangeCount < 4) return 0;
  if (exchangeCount < 8) return 1;
  return 2;
}
