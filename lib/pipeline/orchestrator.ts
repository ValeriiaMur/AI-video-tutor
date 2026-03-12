// ============================================================
// Pipeline Orchestrator
// Coordinates STT → LLM → TTS → Avatar streaming pipeline
// ============================================================

import type { GradeBand, ConversationMessage, PipelineEvent, VisemeEvent, AvatarState } from '@/types';
import { LatencyTracker } from '@/lib/metrics/latency';
import { AIObserver } from '@/lib/metrics/observer';
import { SessionMetricsCollector } from '@/lib/metrics/session';
import { SlidingWindowContext } from '@/lib/context/window';
import { buildSocraticSystemPrompt } from '@/lib/prompts/socratic';
import { DeepgramSTT, MockSTT } from './stt';
import { ClaudeLLM, MockLLM } from './llm';
import { ElevenLabsTTS, MockTTS } from './tts';

export interface OrchestratorConfig {
  deepgramApiKey?: string;
  anthropicApiKey?: string;
  elevenLabsApiKey?: string;
  elevenLabsVoiceId?: string;
  useMocks?: boolean;
  topic: string;
  gradeLevel: GradeBand;
}

type EventCallback = (event: PipelineEvent) => void;

/**
 * Pipeline Orchestrator
 * Manages the full STT → LLM → TTS flow with streaming
 */
export class PipelineOrchestrator {
  private stt: DeepgramSTT | MockSTT;
  private llm: ClaudeLLM | MockLLM;
  private tts: ElevenLabsTTS | MockTTS;
  private context: SlidingWindowContext;
  private latencyTracker: LatencyTracker;
  private observer: AIObserver;
  private metricsCollector: SessionMetricsCollector;
  private eventCallbacks: EventCallback[] = [];
  private config: OrchestratorConfig;
  private sessionId: string;
  private systemPrompt: string;
  private isProcessing: boolean = false;
  private currentResponseText: string = '';

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.sessionId = `session_${Date.now()}`;
    this.context = new SlidingWindowContext(8, 2000);
    this.latencyTracker = new LatencyTracker();
    this.observer = new AIObserver(this.sessionId);
    this.metricsCollector = new SessionMetricsCollector();

    // Build system prompt
    this.systemPrompt = buildSocraticSystemPrompt(config.topic, config.gradeLevel);

    // Initialize pipeline components
    if (config.useMocks) {
      this.stt = new MockSTT();
      this.llm = new MockLLM();
      this.tts = new MockTTS();
    } else {
      this.stt = new DeepgramSTT({ apiKey: config.deepgramApiKey ?? '' });
      this.llm = new ClaudeLLM({ apiKey: config.anthropicApiKey ?? '' });
      this.tts = new ElevenLabsTTS({
        apiKey: config.elevenLabsApiKey ?? '',
        voiceId: config.elevenLabsVoiceId,
      });
    }

    // Attach instrumentation
    this.stt.attachInstrumentation(this.latencyTracker, this.observer);
    this.llm.attachInstrumentation(this.latencyTracker, this.observer);
    this.tts.attachInstrumentation(this.latencyTracker, this.observer);

    // Wire up STT → LLM pipeline
    this.stt.onTranscript((result) => {
      if (result.isFinal && result.transcript.trim()) {
        this.emit({
          type: 'stt_transcript',
          text: result.transcript,
          isFinal: true,
          latencyMs: this.latencyTracker.get('stt'),
        });
        // Use handleTextInput which has retry/force-unlock logic
        this.handleTextInput(result.transcript);
      } else if (!result.isFinal && result.transcript.trim()) {
        // Emit interim transcripts so UI can show partial text
        this.emit({
          type: 'stt_transcript',
          text: result.transcript,
          isFinal: false,
          latencyMs: -1,
        });
      }
    });

    // Wire up TTS audio output
    this.tts.onAudioChunk((audio, visemes, isFirst) => {
      this.emit({
        type: 'tts_audio',
        audio: arrayBufferToBase64(audio),
        visemes,
        isFirst,
        latencyMs: isFirst ? this.latencyTracker.get('tts_ttfb') : -1,
      });
    });

    this.tts.onComplete(() => {
      this.emit({
        type: 'tts_done',
        latencyMs: this.latencyTracker.get('tts_total'),
      });
      this.emit({ type: 'avatar_state', state: 'idle' as AvatarState });
      // isProcessing is now reset in handleStudentInput onDone, not here
    });
  }

  /** Subscribe to pipeline events */
  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      this.eventCallbacks = this.eventCallbacks.filter((cb) => cb !== callback);
    };
  }

  /** Initialize all connections */
  async initialize(): Promise<void> {
    this.observer.logSession({ event: 'initializing', topic: this.config.topic });

    try {
      await Promise.all([
        this.stt.connect(),
        this.tts.connect(),
      ]);

      this.emit({
        type: 'session_start',
        sessionId: this.sessionId,
        topic: this.config.topic,
        gradeLevel: this.config.gradeLevel,
      });

      this.observer.logSession({ event: 'initialized' });
    } catch (error) {
      this.observer.logError('orchestrator', error);
      this.emit({ type: 'error', message: String(error), stage: 'init' });
      throw error;
    }
  }

  /** Send audio data to STT — always forward, let STT buffer */
  sendAudio(audioData: ArrayBuffer | Blob): void {
    // Don't block audio during processing — Deepgram handles buffering.
    // The isProcessing guard on handleStudentInput prevents double-sends.
    this.stt.sendAudio(audioData);
  }

  /** Handle text input directly (text-first mode) */
  async handleTextInput(text: string): Promise<void> {
    if (this.isProcessing) {
      console.warn('[Orchestrator] Still processing, message queued:', text);
      // Wait briefly for current processing to finish, then retry
      await new Promise((r) => setTimeout(r, 500));
      if (this.isProcessing) {
        console.warn('[Orchestrator] Still busy after wait, forcing unlock');
        this.isProcessing = false;
      }
    }
    this.emit({
      type: 'stt_transcript',
      text,
      isFinal: true,
      latencyMs: 0,
    });
    await this.handleStudentInput(text);
  }

  /** Process student input through LLM → TTS pipeline */
  private async handleStudentInput(input: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    // Start E2E timer
    this.latencyTracker.reset();
    this.latencyTracker.mark('e2e');
    this.observer.newTrace();

    // Add to context
    this.context.add('user', input);
    this.emit({ type: 'avatar_state', state: 'thinking' as AvatarState });

    // Get conversation messages
    const messages = this.context.toAnthropicMessages();
    this.currentResponseText = '';

    let isFirstToken = true;
    let tokenBuffer = '';
    const FLUSH_THRESHOLD = 40; // Characters before flushing to TTS

    try {
      // Stream LLM → TTS
      this.tts.resetForNewUtterance();

      await this.llm.streamResponse(
        this.systemPrompt,
        messages,
        // onToken
        (token: string, _isFirst: boolean) => {
          if (isFirstToken) {
            const ttft = this.latencyTracker.get('llm_ttft');
            this.emit({ type: 'llm_token', token, isFirst: true, latencyMs: ttft });
            this.emit({ type: 'avatar_state', state: 'speaking' as AvatarState });
            isFirstToken = false;
          } else {
            this.emit({ type: 'llm_token', token, isFirst: false, latencyMs: -1 });
          }

          this.currentResponseText += token;
          tokenBuffer += token;

          // Flush to TTS when we have enough text (sentence boundary or threshold)
          if (tokenBuffer.length >= FLUSH_THRESHOLD || /[.!?]\s*$/.test(tokenBuffer)) {
            this.tts.sendText(tokenBuffer);
            tokenBuffer = '';
          }
        },
        // onDone
        (fullText: string) => {
          // Flush remaining text to TTS
          if (tokenBuffer.length > 0) {
            this.tts.sendText(tokenBuffer);
            tokenBuffer = '';
          }
          this.tts.flush();

          // Measure E2E latency
          const e2e = this.latencyTracker.measure('e2e');

          // Add to context
          this.context.add('assistant', fullText);

          // Record metrics
          const breakdown = this.latencyTracker.buildBreakdown();
          this.metricsCollector.addLatencyBreakdown(breakdown);
          this.metricsCollector.addExchange({
            id: `exchange_${Date.now()}`,
            studentInput: input,
            tutorResponse: fullText,
            timestamp: Date.now(),
            latencyBreakdown: breakdown,
          });

          this.observer.logLatency(breakdown);
          this.emit({ type: 'llm_done', fullText, latencyMs: this.latencyTracker.get('llm_total') });
          this.emit({ type: 'metrics', breakdown });

          // Unlock pipeline after LLM finishes — don't wait for TTS
          // TTS may silently fail (WebSocket disconnect, etc.)
          this.isProcessing = false;
        }
      );
    } catch (error) {
      this.observer.logError('pipeline', error);
      this.emit({ type: 'error', message: String(error), stage: 'pipeline' });
      this.isProcessing = false;
      this.emit({ type: 'avatar_state', state: 'idle' as AvatarState });
    }
  }

  /** Generate the opening greeting from the tutor */
  async generateGreeting(): Promise<void> {
    const greetingPrompt = `The student just joined and said they want to learn about "${this.config.topic}". Give a warm, excited greeting (1-2 sentences) and ask your first Socratic question to start the learning journey. Remember you're Lumi, a glowing wisdom orb!`;

    // Don't add to context here — handleStudentInput already does it
    await this.handleStudentInput(greetingPrompt);
  }

  /** End the session and get final metrics */
  endSession(): { metrics: ReturnType<SessionMetricsCollector['build']>; observability: string } {
    this.stt.disconnect();
    this.tts.disconnect();

    const metrics = this.metricsCollector.build();
    const observability = this.observer.exportJSON();

    this.observer.logSessionEnd(metrics);
    this.emit({ type: 'session_end', metrics });

    return { metrics, observability };
  }

  /** Get current session ID */
  getSessionId(): string {
    return this.sessionId;
  }

  /** Get observer for external access */
  getObserver(): AIObserver {
    return this.observer;
  }

  /** Signal end of voice input — flushes STT buffer */
  finishAudio(): void {
    this.stt.finishAudio();
  }

  /** Check if currently processing */
  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  private emit(event: PipelineEvent): void {
    for (const cb of this.eventCallbacks) {
      try { cb(event); } catch { /* swallow */ }
    }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof btoa !== 'undefined') {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  return Buffer.from(buffer).toString('base64');
}
