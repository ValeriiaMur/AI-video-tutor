// ============================================================
// LLM Module — Claude 3.5 Haiku Streaming
// Socratic tutoring with streaming token output
// ============================================================

import type { ConversationMessage } from '@/types';
import type { LatencyTracker } from '@/lib/metrics/latency';
import type { AIObserver } from '@/lib/metrics/observer';

export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export type LLMTokenHandler = (token: string, isFirst: boolean) => void;
export type LLMDoneHandler = (fullText: string) => void;

/**
 * Claude 3.5 Haiku Streaming LLM Client
 * Uses the Anthropic Messages API with streaming
 */
export class ClaudeLLM {
  private config: Required<LLMConfig>;
  private latencyTracker: LatencyTracker | null = null;
  private observer: AIObserver | null = null;
  private abortController: AbortController | null = null;

  constructor(config: LLMConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? 'claude-haiku-4-5-20251001',
      maxTokens: config.maxTokens ?? 150,
      temperature: config.temperature ?? 0.7,
    };
  }

  attachInstrumentation(tracker: LatencyTracker, observer: AIObserver): void {
    this.latencyTracker = tracker;
    this.observer = observer;
  }

  /**
   * Stream a response from Claude using the Messages API
   * Calls onToken for each streamed token, onDone when complete
   */
  async streamResponse(
    systemPrompt: string,
    messages: ConversationMessage[],
    onToken: LLMTokenHandler,
    onDone: LLMDoneHandler
  ): Promise<void> {
    this.abortController = new AbortController();
    this.latencyTracker?.mark('llm_ttft');
    this.latencyTracker?.mark('llm_total');

    let fullText = '';
    let isFirstToken = true;

    try {
      // Route through Next.js API proxy to avoid CORS issues
      // The server-side route reads ANTHROPIC_API_KEY from env
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          maxTokens: this.config.maxTokens,
          temperature: this.config.temperature,
          systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('[LLM] API error details:', errorBody);
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} — ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;

            try {
              const event = JSON.parse(jsonStr);
              if (event.type === 'content_block_delta' && event.delta?.text) {
                const token = event.delta.text;

                if (isFirstToken) {
                  const ttft = this.latencyTracker?.measure('llm_ttft') ?? -1;
                  this.observer?.logStage('llm', {
                    event: 'first_token',
                    latencyMs: ttft,
                  });
                  isFirstToken = false;
                }

                fullText += token;
                onToken(token, isFirstToken);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      const totalLatency = this.latencyTracker?.measure('llm_total') ?? -1;
      this.observer?.logStage('llm', {
        event: 'complete',
        totalLatencyMs: totalLatency,
        responseLength: fullText.length,
        tokenCount: Math.ceil(fullText.length / 4),
      });

      onDone(fullText);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.observer?.logStage('llm', { event: 'aborted' });
        return;
      }
      this.observer?.logError('llm', error);
      throw error;
    }
  }

  /** Cancel an in-progress stream */
  cancel(): void {
    this.abortController?.abort();
  }
}

/**
 * Mock LLM for testing without API keys
 */
export class MockLLM {
  private latencyTracker: LatencyTracker | null = null;

  attachInstrumentation(tracker: LatencyTracker): void {
    this.latencyTracker = tracker;
  }

  async streamResponse(
    _systemPrompt: string,
    _messages: ConversationMessage[],
    onToken: LLMTokenHandler,
    onDone: LLMDoneHandler
  ): Promise<void> {
    const mockResponse = "That's a great question! Think about it this way — when you make a mistake on a test, what do you do next time? You adjust your approach, right? A neural network does something very similar. What do you think happens inside the network when it gets an answer wrong?";

    this.latencyTracker?.mark('llm_ttft');
    this.latencyTracker?.mark('llm_total');

    const words = mockResponse.split(' ');
    let isFirst = true;

    for (const word of words) {
      await new Promise((r) => setTimeout(r, 20));
      if (isFirst) {
        this.latencyTracker?.measure('llm_ttft');
        isFirst = false;
      }
      onToken(word + ' ', isFirst);
    }

    this.latencyTracker?.measure('llm_total');
    onDone(mockResponse);
  }

  cancel(): void {}
}
