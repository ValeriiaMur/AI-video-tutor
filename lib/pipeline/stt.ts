// ============================================================
// Speech-to-Text Module — Deepgram Nova-2 Streaming
// WebSocket streaming with VAD and endpointing
// ============================================================

import type { LatencyTracker } from '@/lib/metrics/latency';
import type { AIObserver } from '@/lib/metrics/observer';

export interface STTConfig {
  apiKey: string;
  model?: string;
  language?: string;
  sampleRate?: number;
  encoding?: string;
  endpointingMs?: number;
  interimResults?: boolean;
}

export interface STTResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
}

export type STTEventHandler = (result: STTResult) => void;

/**
 * Deepgram Nova-2 Streaming STT Client
 * Connects via WebSocket for real-time speech-to-text
 */
export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private config: Required<STTConfig>;
  private onResult: STTEventHandler | null = null;
  private onError: ((error: Error) => void) | null = null;
  private latencyTracker: LatencyTracker | null = null;
  private observer: AIObserver | null = null;
  private isConnected: boolean = false;

  constructor(config: STTConfig) {
    this.config = {
      apiKey: config.apiKey,
      model: config.model ?? 'nova-2',
      language: config.language ?? 'en-US',
      sampleRate: config.sampleRate ?? 16000,
      encoding: config.encoding ?? 'linear16',
      endpointingMs: config.endpointingMs ?? 300,
      interimResults: config.interimResults ?? true,
    };
  }

  /** Attach latency tracker and observer */
  attachInstrumentation(tracker: LatencyTracker, observer: AIObserver): void {
    this.latencyTracker = tracker;
    this.observer = observer;
  }

  /** Connect to Deepgram WebSocket */
  async connect(): Promise<void> {
    const params = new URLSearchParams({
      model: this.config.model,
      language: this.config.language,
      sample_rate: String(this.config.sampleRate),
      encoding: this.config.encoding,
      endpointing: String(this.config.endpointingMs),
      interim_results: String(this.config.interimResults),
      punctuate: 'true',
      smart_format: 'true',
    });

    const url = `wss://api.deepgram.com/v1/listen?${params}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url, ['token', this.config.apiKey]);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.observer?.logStage('stt', { event: 'connected', model: this.config.model });
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(typeof event.data === 'string' ? event.data : '{}');
          this.handleMessage(data);
        } catch (err) {
          this.observer?.logError('stt', err);
        }
      };

      this.ws.onerror = (event) => {
        const error = new Error('Deepgram WebSocket error');
        this.observer?.logError('stt', error);
        this.onError?.(error);
        reject(error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.observer?.logStage('stt', { event: 'disconnected' });
      };
    });
  }

  /** Send audio data to Deepgram */
  sendAudio(audioData: ArrayBuffer | Blob): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Don't spam warnings — only log once
      if (this.isConnected) {
        console.warn('[STT] WebSocket disconnected during session');
        this.isConnected = false;
        this.onError?.(new Error('STT WebSocket disconnected'));
      }
      return;
    }

    // Mark start of STT processing
    if (this.latencyTracker) {
      this.latencyTracker.mark('stt');
    }

    this.ws.send(audioData);
  }

  /** Register result handler */
  onTranscript(handler: STTEventHandler): void {
    this.onResult = handler;
  }

  /** Register error handler */
  onSTTError(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  /** Signal end of audio */
  finishAudio(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
    }
  }

  /** Disconnect */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /** Check connection status */
  getIsConnected(): boolean {
    return this.isConnected;
  }

  private handleMessage(data: Record<string, unknown>): void {
    // Deepgram response format
    const channel = (data.channel as Record<string, unknown>) ?? {};
    const alternatives = (channel.alternatives as Array<Record<string, unknown>>) ?? [];
    const isFinal = data.is_final === true || data.speech_final === true;

    if (alternatives.length > 0) {
      const best = alternatives[0];
      const transcript = (best.transcript as string) ?? '';
      const confidence = (best.confidence as number) ?? 0;

      if (transcript.trim().length === 0) return;

      // Measure STT latency on final results
      if (isFinal && this.latencyTracker) {
        const sttLatency = this.latencyTracker.measure('stt');
        this.observer?.logStage('stt', {
          event: 'transcript',
          transcript,
          confidence,
          latencyMs: sttLatency,
          isFinal,
        });
      }

      const result: STTResult = {
        transcript,
        isFinal,
        confidence,
        words: (best.words as STTResult['words']) ?? undefined,
      };

      this.onResult?.(result);
    }
  }
}

/**
 * Mock STT for testing and development without API keys
 */
export class MockSTT {
  private onResult: STTEventHandler | null = null;

  async connect(): Promise<void> {
    console.log('[MockSTT] Connected');
  }

  sendAudio(_data: ArrayBuffer | Blob): void {
    // Simulate transcript after a short delay
    setTimeout(() => {
      this.onResult?.({
        transcript: 'test transcript',
        isFinal: true,
        confidence: 0.95,
      });
    }, 100);
  }

  onTranscript(handler: STTEventHandler): void {
    this.onResult = handler;
  }

  /** Simulate a transcript directly (for text input mode) */
  simulateTranscript(text: string): void {
    this.onResult?.({
      transcript: text,
      isFinal: true,
      confidence: 1.0,
    });
  }

  disconnect(): void {
    console.log('[MockSTT] Disconnected');
  }

  attachInstrumentation(): void {}
  onSTTError(): void {}
  finishAudio(): void {}
  getIsConnected(): boolean { return true; }
}
