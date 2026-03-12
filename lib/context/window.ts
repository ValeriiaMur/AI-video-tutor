// ============================================================
// Sliding Window Context Manager
// Manages conversation history with bounded token usage
// ============================================================

import type { ConversationMessage } from '@/types';

export class SlidingWindowContext {
  private messages: ConversationMessage[] = [];
  private maxMessages: number;
  private maxTokensEstimate: number;

  constructor(maxMessages: number = 8, maxTokensEstimate: number = 2000) {
    this.maxMessages = maxMessages;
    this.maxTokensEstimate = maxTokensEstimate;
  }

  /** Add a message to the context */
  add(role: 'user' | 'assistant', content: string): void {
    this.messages.push({ role, content });
    this.trim();
  }

  /** Get the current window of messages */
  getWindow(): ConversationMessage[] {
    return [...this.messages];
  }

  /** Get the total estimated token count */
  estimateTokens(): number {
    return this.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  /** Get message count */
  getCount(): number {
    return this.messages.length;
  }

  /** Clear all messages */
  clear(): void {
    this.messages = [];
  }

  /** Trim the window to stay within bounds */
  private trim(): void {
    // Trim by message count
    while (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    // Trim by estimated token count
    while (this.estimateTokens() > this.maxTokensEstimate && this.messages.length > 2) {
      this.messages.shift();
    }
  }

  /** Get the last message */
  getLastMessage(): ConversationMessage | undefined {
    return this.messages[this.messages.length - 1];
  }

  /** Get messages as Anthropic API format */
  toAnthropicMessages(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return this.messages.map((m) => ({ role: m.role, content: m.content }));
  }
}
