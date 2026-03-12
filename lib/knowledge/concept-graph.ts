// ============================================================
// Concept Graph — Knowledge Map for Learning Sessions
// Tracks concepts extracted from conversation, builds connections,
// and calculates mastery scores per concept.
// ============================================================

export interface ConceptNode {
  id: string;
  label: string;
  /** Number of times this concept was discussed */
  mentions: number;
  /** 0–1 mastery score based on student responses */
  mastery: number;
  /** When first encountered */
  firstSeen: number;
  /** When last discussed */
  lastSeen: number;
  /** Was this an "aha moment" concept? */
  breakthrough: boolean;
}

export interface ConceptEdge {
  from: string;
  to: string;
  /** How strongly connected (0–1) */
  weight: number;
}

export interface ConceptGraphState {
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  totalMastery: number; // 0–100 aggregate score
}

/**
 * Extract concepts from a tutor response.
 * Uses simple keyword/pattern extraction — no LLM call needed.
 */
export function extractConcepts(text: string): string[] {
  const concepts: string[] = [];

  // Look for quoted terms, bolded terms, or terms introduced with "called", "known as", etc.
  const quotedMatch = text.match(/[""]([^""]+)[""]|"([^"]+)"/g);
  if (quotedMatch) {
    for (const m of quotedMatch) {
      const clean = m.replace(/["""]/g, '').trim();
      if (clean.length > 2 && clean.length < 40) concepts.push(clean.toLowerCase());
    }
  }

  // Look for "called X" or "known as X" patterns
  const calledMatch = text.match(/(?:called|known as|is a|are called|termed|refers to)\s+(\w[\w\s]{1,30}?)(?:\.|,|!|\?|$)/gi);
  if (calledMatch) {
    for (const m of calledMatch) {
      const clean = m
        .replace(/^(called|known as|is a|are called|termed|refers to)\s+/i, '')
        .replace(/[.,!?]$/, '')
        .trim();
      if (clean.length > 2 && clean.length < 40) concepts.push(clean.toLowerCase());
    }
  }

  // Common CS/science concept patterns (capitalized multi-word terms)
  const capitalizedMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g);
  if (capitalizedMatch) {
    for (const m of capitalizedMatch) {
      if (m.length > 4 && m.length < 40 && !m.match(/^(What|How|Why|When|Where|Which|That|This|The|And|But|Have|Does|Could|Would|Should|Great|Good|Nice|Let|Hmm|Interesting)/)) {
        concepts.push(m.toLowerCase());
      }
    }
  }

  // Deduplicate
  return [...new Set(concepts)];
}

/**
 * Detect if a student response indicates understanding (mastery signal).
 * Returns a score from -0.2 (confused) to +0.3 (strong understanding).
 */
export function assessUnderstanding(studentText: string): number {
  const lower = studentText.toLowerCase();

  // Confusion signals
  const confusionPatterns = /i don'?t (know|understand|get it)|what do you mean|i'?m confused|huh\??|no idea|not sure/i;
  if (confusionPatterns.test(lower)) return -0.15;

  // Short/minimal response (probably unsure)
  if (lower.split(/\s+/).length < 3) return -0.05;

  // Strong understanding signals
  const strongPatterns = /because|so basically|that means|in other words|it'?s like|for example|the reason is/i;
  if (strongPatterns.test(lower)) return 0.25;

  // Moderate understanding
  const moderatePatterns = /i think|maybe|probably|it could be|so it'?s|would that be/i;
  if (moderatePatterns.test(lower)) return 0.1;

  // Question back (shows engagement)
  if (lower.endsWith('?')) return 0.08;

  return 0.05; // Neutral engagement
}

/**
 * Detect "aha moments" — when a student demonstrates sudden understanding.
 */
export function detectAhaMoment(
  studentText: string,
  previousMastery: number,
  currentAssessment: number
): boolean {
  const lower = studentText.toLowerCase();

  // Explicit "aha" language
  const ahaPatterns = /oh!|ohh|aha|i get it|that makes sense|now i (see|understand|get)|so that'?s (why|how)|wait.*(so|because)|it clicked|i see now|oh wow|mind blown/i;
  if (ahaPatterns.test(lower)) return true;

  // Mastery jump: student was confused but now shows understanding
  if (previousMastery < 0.3 && currentAssessment >= 0.2) return true;

  // Long, confident explanation after previous short/confused responses
  if (previousMastery < 0.4 && lower.split(/\s+/).length > 12 && currentAssessment >= 0.15) return true;

  return false;
}

/**
 * ConceptGraph — Manages the knowledge map for a learning session.
 */
export class ConceptGraph {
  private nodes: Map<string, ConceptNode> = new Map();
  private edges: ConceptEdge[] = [];
  private previousConcepts: string[] = [];

  /** Add or update concepts extracted from an exchange */
  addConcepts(concepts: string[], masteryDelta: number, isBreakthrough: boolean = false): void {
    const now = Date.now();

    for (const label of concepts) {
      const id = label.replace(/\s+/g, '-');
      const existing = this.nodes.get(id);

      if (existing) {
        existing.mentions += 1;
        existing.mastery = Math.max(0, Math.min(1, existing.mastery + masteryDelta));
        existing.lastSeen = now;
        if (isBreakthrough) existing.breakthrough = true;
      } else {
        this.nodes.set(id, {
          id,
          label,
          mentions: 1,
          mastery: Math.max(0, Math.min(1, 0.2 + masteryDelta)),
          firstSeen: now,
          lastSeen: now,
          breakthrough: isBreakthrough,
        });
      }
    }

    // Create edges between current concepts and previous concepts
    for (const current of concepts) {
      const currentId = current.replace(/\s+/g, '-');
      for (const prev of this.previousConcepts) {
        const prevId = prev.replace(/\s+/g, '-');
        if (currentId !== prevId) {
          const existingEdge = this.edges.find(
            (e) => (e.from === prevId && e.to === currentId) || (e.from === currentId && e.to === prevId)
          );
          if (existingEdge) {
            existingEdge.weight = Math.min(1, existingEdge.weight + 0.15);
          } else {
            this.edges.push({ from: prevId, to: currentId, weight: 0.3 });
          }
        }
      }
    }

    this.previousConcepts = concepts;
  }

  /** Get the full graph state */
  getState(): ConceptGraphState {
    const nodes = Array.from(this.nodes.values());
    const totalMastery = nodes.length > 0
      ? Math.round((nodes.reduce((sum, n) => sum + n.mastery, 0) / nodes.length) * 100)
      : 0;

    return { nodes, edges: [...this.edges], totalMastery };
  }

  /** Get count of concepts explored */
  getConceptCount(): number {
    return this.nodes.size;
  }

  /** Get count of "aha" breakthroughs */
  getBreakthroughCount(): number {
    return Array.from(this.nodes.values()).filter((n) => n.breakthrough).length;
  }
}
